import { createVersionOneMetadata } from "@/app/lib/siteMetadata";

export const metadata = createVersionOneMetadata(
  "/version-1/data-security",
  "Data Security — Tufffinds",
);

export default function DataSecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
