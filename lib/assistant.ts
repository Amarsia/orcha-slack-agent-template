import type { AgentRuntime } from "orchajs";

import { getAssistant } from "@/lib/orcha-server";

export type AssistantRequest = {
  message: string;
  sessionId?: string;
  name: string;
  metadata: Record<string, string>;
};

export type AssistantResponse = {
  sessionId: string;
  output: string;
};

function outputToText(output: unknown): string {
  if (typeof output === "string") return output;
  if (output === null || output === undefined) return "";
  return JSON.stringify(output, null, 2);
}

export function startAssistant(
  request: AssistantRequest,
  assistant: AgentRuntime = getAssistant(),
) {
  return request.sessionId
    ? assistant.resume(request.sessionId, { content: request.message })
    : assistant.run({
        content: request.message,
        name: request.name,
        metadata: request.metadata,
      });
}

export async function completeAssistant(
  request: AssistantRequest,
  assistant: AgentRuntime = getAssistant(),
): Promise<AssistantResponse> {
  const execution = startAssistant(request, assistant);
  const result = await execution.result;
  if (result.status === "failed") {
    throw new Error(result.error?.message || "The assistant could not complete this response.");
  }

  const output = outputToText(result.output).trim();
  if (!output) throw new Error("The assistant returned an empty response.");
  return { sessionId: execution.sessionId, output };
}

export function createSessionName(message: string, fallback: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 52
    ? `${normalized.slice(0, 49).trimEnd()}…`
    : normalized;
}
