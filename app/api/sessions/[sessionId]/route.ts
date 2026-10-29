import { AppConfigurationError, getAssistant } from "@/lib/orcha-server";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const { sessionId } = await context.params;
  if (!sessionId.startsWith("ses_")) {
    return Response.json({ error: "Invalid conversation ID." }, { status: 400 });
  }

  try {
    const visitor = resolveVisitor(request);
    const assistant = getAssistant();
    const session = await assistant.get(sessionId);
    if (
      session.metadata.surface !== "web" ||
      session.metadata.visitorId !== visitor.id
    ) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
    const history = await assistant.history(sessionId, { page: 1, pageSize: 200 });
    return Response.json(history, {
      headers: withVisitorCookie({ "Cache-Control": "no-store" }, visitor.setCookie),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AppConfigurationError
            ? error.message
            : "Conversation could not be loaded.",
      },
      { status: error instanceof AppConfigurationError ? 503 : 404 },
    );
  }
}
