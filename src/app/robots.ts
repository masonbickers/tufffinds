import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tufffinds.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/coming-soon",
        "/duty-calculator",
        "/link",
        "/single-site",
        "/version-1",
        "/voice",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
