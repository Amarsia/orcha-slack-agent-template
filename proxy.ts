import { NextRequest, NextResponse } from "next/server";

import { resolveVisitor } from "@/lib/visitor";

export function proxy(request: NextRequest) {
  const visitor = resolveVisitor(request);
  const response = NextResponse.next();
  if (visitor.setCookie) {
    response.headers.set("Set-Cookie", visitor.setCookie);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
