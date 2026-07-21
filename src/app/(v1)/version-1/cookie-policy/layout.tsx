import { createVersionOneMetadata } from "@/app/lib/siteMetadata";

export const metadata = createVersionOneMetadata(
  "/version-1/cookie-policy",
  "Cookie Policy — Tufffinds",
);

export default function CookieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
