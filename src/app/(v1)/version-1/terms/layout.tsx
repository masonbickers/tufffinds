import { createVersionOneMetadata } from "@/app/lib/siteMetadata";

export const metadata = createVersionOneMetadata(
  "/version-1/terms",
  "Terms of Use — Tufffinds",
);

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
