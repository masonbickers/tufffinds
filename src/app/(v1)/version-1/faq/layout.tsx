import { createVersionOneMetadata } from "@/app/lib/siteMetadata";

export const metadata = createVersionOneMetadata(
  "/version-1/faq",
  "Frequently Asked Questions — Tufffinds",
);

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
