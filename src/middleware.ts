// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const ALLOW = [
  /^\/coming-soon(\/|$)/,
  /^\/link(\/|$)/,
  /^\/api(\/|$)/,              // keep if you need API; remove if not
  /^\/_next\//,                // Next.js internals
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|txt)$/ // static files
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ALLOW.some((r) => r.test(pathname))) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/coming-soon";
  return NextResponse.redirect(url);
}

// Match everything (so the allow-list above decides), feel free to tighten if needed
export const config = {
  matcher: ["/:path*"],
};
