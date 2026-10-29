import { getSetupStatus } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(getSetupStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
