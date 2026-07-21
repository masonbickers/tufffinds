// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BLOCKED_ROUTES = [
  /^\/admin\/orders\/[^/]+\/?$/,
  /^\/coming-soon(\/|$)/,
  /^\/duty-calculator(\/|$)/,
  /^\/single-site(\/|$)/,
  /^\/version-1\/(?:app|test)(\/|$)/,
  /^\/voice(\/|$)/,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (BLOCKED_ROUTES.some((pattern) => pattern.test(pathname))) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
