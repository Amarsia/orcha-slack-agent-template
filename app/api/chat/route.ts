import { createSessionName, startAssistant } from "@/lib/assistant";
import { AppConfigurationError, getAssistant } from "@/lib/orcha-server";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const encoder = new TextEncoder();

function encoded(value: unknown) {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

export async function POST(request: Request): Promise<Response> {
  let body: { message?: unknown; sessionId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : undefined;
  if (!message) return Response.json({ error: "Message is required." }, { status: 400 });
  if (message.length > 20_000) {
    return Response.json({ error: "Message must be 20,000 characters or fewer." }, { status: 400 });
  }

  try {
    const visitor = resolveVisitor(request);
    const assistant = getAssistant();
    if (sessionId) {
      const session = await assistant.get(sessionId);
      if (
        session.metadata.surface !== "web" ||
        session.metadata.visitorId !== visitor.id
      ) {
        return Response.json({ error: "Conversation not found." }, { status: 404 });
      }
    }

    const execution = startAssistant(
      {
        message,
        sessionId,
        name: createSessionName(message, "Web conversation"),
        metadata: { surface: "web", visitorId: visitor.id },
      },
      assistant,
    );

    let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (value: unknown) => {
          if (!closed) controller.enqueue(encoded(value));
        };
        write({ type: "session", sessionId: execution.sessionId });

        void (async () => {
          try {
            for await (const snapshot of execution.stream) {
              write({ type: "snapshot", snapshot });
            }
            write({ type: "result", result: await execution.result });
          } catch (error) {
            write({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "The assistant could not complete this response.",
            });
          } finally {
            if (!closed) controller.close();
          }
        })();
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(stream, {
      headers: withVisitorCookie(
        {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
        visitor.setCookie,
      ),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AppConfigurationError
            ? error.message
            : "The assistant could not be started.",
      },
      { status: error instanceof AppConfigurationError ? 503 : 500 },
    );
  }
}
