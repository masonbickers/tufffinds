import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/coming-soon",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ComingSoonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
