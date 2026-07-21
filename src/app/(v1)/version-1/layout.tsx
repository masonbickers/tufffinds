import { createVersionOneMetadata } from "@/app/lib/siteMetadata";

export const metadata = createVersionOneMetadata(
  "/version-1",
  "Tufffinds — Personal Shopping and Sourcing",
);

export default function VersionOneLayout({ children }: { children: React.ReactNode }) {
  return children;
}
