import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 100],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;