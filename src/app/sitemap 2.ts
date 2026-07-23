import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tufffinds.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "/",
    "/faq",
    "/privacy",
    "/terms",
    "/cookie-policy",
    "/data-security",
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === "/" ? "weekly" : "yearly",
    priority: path === "/" ? 1 : 0.4,
  }));
}
