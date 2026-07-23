import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep dev artifacts separate from production builds. Running `next build`
    // while the dev server is open otherwise replaces files the server needs.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    images: {
      qualities: [75, 100],
    },
    async redirects() {
      return [
        { source: "/version-1", destination: "/", permanent: true },
        { source: "/version-1/faq", destination: "/faq", permanent: true },
        {
          source: "/version-1/privacy",
          destination: "/privacy",
          permanent: true,
        },
        {
          source: "/version-1/privacy-policy",
          destination: "/privacy",
          permanent: true,
        },
        { source: "/version-1/terms", destination: "/terms", permanent: true },
        {
          source: "/version-1/cookie-policy",
          destination: "/cookie-policy",
          permanent: true,
        },
        {
          source: "/version-1/data-security",
          destination: "/data-security",
          permanent: true,
        },
      ];
    },
  };
}
