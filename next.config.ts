import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Keep URL as "/" but serve the static file
      { source: "/", destination: "/single-site/index.html" },
    ];
  },
};

export default nextConfig;
