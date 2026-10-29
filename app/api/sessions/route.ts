import { AppConfigurationError, getAssistant } from "@/lib/orcha-server";
import { resolveVisitor, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const visitor = resolveVisitor(request);
    const sessions = await getAssistant().list({
      page: 1,
      pageSize: 12,
      metadata: { surface: "web", visitorId: visitor.id },
    });
    return Response.json(sessions, {
      headers: withVisitorCookie({ "Cache-Control": "no-store" }, visitor.setCookie),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AppConfigurationError
            ? error.message
            : "Recent sessions could not be loaded.",
      },
      { status: error instanceof AppConfigurationError ? 503 : 500 },
    );
  }
}
