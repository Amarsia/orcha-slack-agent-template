"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  Github,
  Hash,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Unplug,
  Workflow,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import { ChatMessage } from "@/components/chat-message";
import { ThemeSelector } from "@/components/theme-selector";
import { botConfig } from "@/config/bot";
import { contentToText, type ChatMessage as Message, type SessionSummary } from "@/lib/chat-types";

type SetupStatus = {
  provider: boolean;
  slackBot: boolean;
  slackApp: boolean;
  workspaceName?: string;
  workspaceUrl?: string;
};

type StreamEvent = {
  type?: unknown;
  sessionId?: unknown;
  snapshot?: { status?: unknown; output?: unknown };
  result?: { status?: unknown; output?: unknown; error?: { message?: unknown } };
  error?: unknown;
};

function text(value: unknown): string {
  if (typeof value === "string") return value;
  return value == null ? "" : JSON.stringify(value, null, 2);
}

function relativeTime(value: string): string {
  const difference = Date.now() - Date.parse(value);
  if (!Number.isFinite(difference) || difference < 60_000) return "Just now";
  const minutes = Math.floor(difference / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Dashboard() {
  const [status, setStatus] = useState<SetupStatus>();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResponse, sessionsResponse] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }),
        fetch("/api/sessions", { cache: "no-store" }),
      ]);
      const statusData = (await statusResponse.json()) as SetupStatus;
      const sessionData = (await sessionsResponse.json()) as {
        items?: SessionSummary[];
        error?: string;
      };
      setStatus(statusData);
      if (sessionsResponse.ok) setSessions(sessionData.items ?? []);
      else setError(sessionData.error ?? "Recent sessions could not be loaded.");
    } catch {
      setError("The application could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: sending ? "smooth" : "auto" });
  }, [messages, sending]);

  const openSession = async (nextSessionId: string) => {
    setLoadingSession(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(nextSessionId)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        items?: Array<{
          id?: string;
          type?: string;
          role?: "user" | "assistant";
          content?: unknown;
          createdAt?: string;
        }>;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Conversation could not be loaded.");
      setMessages(
        (data.items ?? []).flatMap((item) =>
          item.type === "message" && item.role
            ? [{
                id: item.id ?? crypto.randomUUID(),
                role: item.role,
                content: contentToText(item.content),
                createdAt: item.createdAt ?? new Date().toISOString(),
              }]
            : [],
        ),
      );
      setSessionId(nextSessionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Conversation could not be loaded.");
    } finally {
      setLoadingSession(false);
    }
  };

  const updateAssistant = (id: string, update: Partial<Message>) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...update } : message)),
    );
  };

  const sendMessage = async (raw: string) => {
    const message = raw.trim();
    if (!message || sending) return;
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content: message, createdAt: new Date().toISOString() },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);
    setInput("");
    setError(undefined);
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "The assistant could not be reached.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalOutput = "";

      const handle = (event: StreamEvent) => {
        if (event.type === "session" && typeof event.sessionId === "string") {
          setSessionId(event.sessionId);
        } else if (event.type === "snapshot" && event.snapshot?.status === "streaming") {
          finalOutput = text(event.snapshot.output);
          updateAssistant(assistantId, { content: finalOutput });
        } else if (event.type === "result") {
          if (event.result?.status === "failed") {
            throw new Error(
              typeof event.result.error?.message === "string"
                ? event.result.error.message
                : "The assistant could not complete this response.",
            );
          }
          finalOutput = text(event.result?.output);
          updateAssistant(assistantId, { content: finalOutput });
        } else if (event.type === "error" && typeof event.error === "string") {
          throw new Error(event.error);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line) as StreamEvent);
        if (done) break;
      }
      if (buffer.trim()) handle(JSON.parse(buffer) as StreamEvent);
      if (!finalOutput) throw new Error("The assistant returned an empty response.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "The assistant could not complete this response.";
      setError(message);
      updateAssistant(assistantId, { content: `I couldn’t complete that response. ${message}` });
    } finally {
      updateAssistant(assistantId, { pending: false });
      setSending(false);
      void loadOverview();
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const connected = Boolean(status?.slackBot && status?.slackApp);
  const setupItems = [
    { label: "AI provider configured", complete: status?.provider },
    { label: "Slack bot token added", complete: status?.slackBot },
    { label: "Socket Mode token added", complete: status?.slackApp },
  ];

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label={`${botConfig.name} overview`}>
          <Image src={botConfig.avatar.src} alt="" width={36} height={36} />
          <span><strong>{botConfig.name}</strong><small>Orcha Slack agent</small></span>
        </a>
        <nav aria-label="Page sections">
          <a href="#capabilities">Capabilities</a>
          <a href="#test-chat">Test chat</a>
          <a href="#setup">Setup</a>
        </nav>
        <div className="topbar-actions">
          <ThemeSelector />
          <a className="icon-link" href="https://github.com/Amarsia/orcha" target="_blank" rel="noreferrer" aria-label="OrchaJS on GitHub">
            <Github />
          </a>
        </div>
      </header>

      <div className="page">
        <section className="hero" id="overview">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles /> Built with OrchaJS + Slack Bolt</span>
            <h1>Your team’s AI teammate, right where work happens.</h1>
            <p>{botConfig.description}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#test-chat">Try it locally <ArrowRight /></a>
              <a className="secondary-button" href="#setup">View setup</a>
            </div>
          </div>
          <div className="profile-card">
            <div className="profile-heading">
              <Image src={botConfig.avatar.src} alt={botConfig.avatar.alt} width={72} height={72} />
              <div><h2>{botConfig.name}</h2><p>AI assistant</p></div>
              <span className={connected ? "status connected" : "status"}><i />{connected ? "Connected" : "Setup needed"}</span>
            </div>
            <p>{botConfig.welcome}</p>
            <div className="workspace">
              <div><Hash /><span><small>Workspace</small><strong>{status?.workspaceName || "Your Slack workspace"}</strong></span></div>
              <div><Workflow /><span><small>Connection</small><strong>Socket Mode</strong></span></div>
            </div>
          </div>
        </section>

        <section className="section" id="capabilities">
          <div className="section-heading">
            <div><span className="eyebrow">Capabilities</span><h2>Useful from the first message</h2></div>
            <p>Configure the identity and examples in <code>config/bot.ts</code>.</p>
          </div>
          <div className="capability-grid">
            {botConfig.capabilities.map((capability, index) => (
              <article className="capability-card" key={capability.title}>
                <span className="capability-number">0{index + 1}</span>
                <h3>{capability.title}</h3>
                <p>{capability.description}</p>
                <button type="button" onClick={() => { setInput(capability.command); document.querySelector("#test-chat")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <MessageCircle /> {capability.command}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="section test-section" id="test-chat">
          <div className="section-heading">
            <div><span className="eyebrow">Local test chat</span><h2>Test the same assistant Slack uses</h2></div>
            <p>Web visitors receive isolated, signed conversation storage.</p>
          </div>
          <div className="chat-layout">
            <aside className="sessions-panel">
              <div className="sessions-title">
                <span>Recent Orcha sessions</span>
                <button type="button" onClick={() => { setSessionId(undefined); setMessages([]); setError(undefined); }} aria-label="New conversation"><Plus /></button>
              </div>
              {loading ? (
                <div className="session-skeleton"><i /><i /><i /></div>
              ) : sessions.length ? (
                <div className="session-list">
                  {sessions.map((session) => (
                    <button key={session.sessionId} type="button" data-active={session.sessionId === sessionId || undefined} onClick={() => void openSession(session.sessionId)}>
                      <MessageCircle /><span><strong>{session.name || "Untitled conversation"}</strong><small><Clock3 /> {relativeTime(session.updatedAt)}</small></span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><MessageCircle /><strong>No conversations yet</strong><p>Send a message to create your first session.</p></div>
              )}
            </aside>
            <div className="chat-panel">
              <div className="chat-header">
                <div><Image src={botConfig.avatar.src} alt="" width={34} height={34} /><span><strong>{botConfig.name}</strong><small><i /> Local preview</small></span></div>
                <span>Private to this browser</span>
              </div>
              <div className="messages" aria-live="polite">
                {loadingSession ? (
                  <div className="message-loading"><i /><i /><i /></div>
                ) : messages.length ? (
                  <>{messages.map((message) => <ChatMessage key={message.id} message={message} />)}<div ref={endRef} /></>
                ) : (
                  <div className="chat-empty">
                    <Image src={botConfig.avatar.src} alt="" width={52} height={52} />
                    <h3>Chat with {botConfig.name}</h3>
                    <p>Try an example below or ask anything.</p>
                    <div>{botConfig.capabilities.slice(0, 2).map((item) => <button type="button" key={item.command} onClick={() => void sendMessage(item.command)}>{item.command}</button>)}</div>
                  </div>
                )}
              </div>
              <div className="composer-wrap">
                {error ? <div className="error-banner" role="alert"><CircleAlert />{error}</div> : null}
                <form className="composer" onSubmit={submit}>
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={keyDown} placeholder={`Message ${botConfig.name}…`} aria-label={`Message ${botConfig.name}`} maxLength={20_000} rows={1} disabled={sending} />
                  <button type="submit" disabled={!input.trim() || sending} aria-label="Send message"><Send /></button>
                </form>
                <p>{botConfig.name} can make mistakes. Check important information.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section setup-section" id="setup">
          <div className="section-heading">
            <div><span className="eyebrow">Setup status</span><h2>Three steps to Slack</h2></div>
            <p>Credentials remain server-side and are never returned to the browser.</p>
          </div>
          <div className="setup-grid">
            <div className="setup-list">
              {setupItems.map((item) => (
                <div key={item.label}><span data-complete={item.complete || undefined}>{item.complete ? <Check /> : <Unplug />}</span><div><strong>{item.label}</strong><small>{item.complete ? "Ready" : "Add to your environment"}</small></div></div>
              ))}
            </div>
            <div className="command-card">
              <span>Example commands</span>
              {botConfig.capabilities.slice(0, 3).map((capability) => <code key={capability.command}>{capability.command}</code>)}
            </div>
          </div>
        </section>
      </div>
      <footer><span>Powered by <a href="https://github.com/Amarsia/orcha">OrchaJS</a></span><span>Next.js · Slack Bolt · Socket Mode</span></footer>
    </main>
  );
}
