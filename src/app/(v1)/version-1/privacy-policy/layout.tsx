import { createVersionOneMetadata } from "@/app/lib/siteMetadata";

export const metadata = createVersionOneMetadata(
  "/version-1/privacy-policy",
  "Privacy Policy — Tufffinds",
);

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
