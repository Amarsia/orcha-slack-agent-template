import { App, LogLevel } from "@slack/bolt";

import { completeAssistant, createSessionName } from "@/lib/assistant";
import { getSlackEnv } from "@/lib/env";
import { getAssistant } from "@/lib/orcha-server";

type SlackMessage = {
  text?: string;
  channel: string;
  channel_type?: string;
  user?: string;
  ts: string;
  thread_ts?: string;
  subtype?: string;
  bot_id?: string;
};

const MAX_SLACK_MESSAGE_LENGTH = 3_500;
const pendingByConversation = new Map<string, Promise<void>>();

function splitSlackMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > MAX_SLACK_MESSAGE_LENGTH) {
    const window = remaining.slice(0, MAX_SLACK_MESSAGE_LENGTH + 1);
    const boundary = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const splitAt = boundary > MAX_SLACK_MESSAGE_LENGTH * 0.6
      ? boundary
      : MAX_SLACK_MESSAGE_LENGTH;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function cleanMention(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/gi, "").trim();
}

function conversationIdentity(teamId: string, message: SlackMessage): string {
  if (message.channel_type === "im") return `${teamId}:dm:${message.channel}`;
  return `${teamId}:channel:${message.channel}:thread:${message.thread_ts ?? message.ts}`;
}

function enqueue(key: string, task: () => Promise<void>): Promise<void> {
  const previous = pendingByConversation.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(task);
  pendingByConversation.set(key, current);
  const cleanup = () => {
    if (pendingByConversation.get(key) === current) pendingByConversation.delete(key);
  };
  void current.then(cleanup, cleanup);
  return current;
}

async function findSessionId(conversationKey: string): Promise<string | undefined> {
  const sessions = await getAssistant().list({
    page: 1,
    pageSize: 1,
    metadata: { surface: "slack", slackConversationKey: conversationKey },
  });
  return sessions.items[0]?.sessionId;
}

async function runSlackAssistant(
  teamId: string,
  message: SlackMessage,
  respond: (text: string) => Promise<void>,
): Promise<void> {
  const conversationKey = conversationIdentity(teamId, message);
  await enqueue(conversationKey, async () => {
    const prompt = cleanMention(message.text ?? "");
    if (!prompt) {
      await respond("What would you like help with?");
      return;
    }

    try {
      const sessionId = await findSessionId(conversationKey);
      const response = await completeAssistant({
        message: prompt,
        sessionId,
        name: createSessionName(prompt, "Slack conversation"),
        metadata: {
          surface: "slack",
          slackConversationKey: conversationKey,
          slackChannelId: message.channel,
        },
      });
      for (const chunk of splitSlackMessage(response.output)) await respond(chunk);
    } catch {
      await respond(
        "I couldn’t complete that request. Please try again, or ask a workspace administrator to check the agent configuration.",
      );
    }
  });
}

async function main(): Promise<void> {
  const env = getSlackEnv();
  const app = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    socketMode: true,
    logLevel: process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  });

  app.event("app_mention", async ({ event, client, context }) => {
    const message = event as SlackMessage;
    const threadTs = message.thread_ts ?? message.ts;
    await runSlackAssistant(context.teamId ?? "unknown-team", message, async (text) => {
      await client.chat.postMessage({
        channel: message.channel,
        thread_ts: threadTs,
        text,
        unfurl_links: false,
        unfurl_media: false,
      });
    });
  });

  app.message(async ({ message, client, context }) => {
    const candidate = message as SlackMessage;
    if (
      candidate.channel_type !== "im" ||
      candidate.subtype ||
      candidate.bot_id ||
      !candidate.user
    ) {
      return;
    }
    await runSlackAssistant(context.teamId ?? "unknown-team", candidate, async (text) => {
      await client.chat.postMessage({
        channel: candidate.channel,
        thread_ts: candidate.thread_ts,
        text,
        unfurl_links: false,
        unfurl_media: false,
      });
    });
  });

  app.error(async (error) => {
    console.error("Slack worker error:", error.name || "unknown_error");
  });

  await app.start();
  console.log("Slack Socket Mode worker connected.");
}

void main().catch((error: unknown) => {
  console.error(
    "Slack worker failed to start:",
    error instanceof Error ? error.message.replace(/xox[baprs]-[A-Za-z0-9-]+/g, "[redacted]") : "Unknown error",
  );
  process.exitCode = 1;
});
