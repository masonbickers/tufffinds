// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ALLOW = [
  /^\/coming-soon(\/|$)/,
  /^\/link(\/|$)/,
  /^\/api(\/|$)/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt)$/
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // let allowed paths through
  if (ALLOW.some((r) => r.test(pathname))) {
    return NextResponse.next();
  }

  // serve /coming-soon content *without* changing the URL
  const url = req.nextUrl.clone();
  url.pathname = "/coming-soon";
  return NextResponse.rewrite(url);     // <- was redirect(...)
}

// apply to everything; allow-list + rewrite controls behaviour
export const config = {
  matcher: ["/:path*"],
};
