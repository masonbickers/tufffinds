import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
