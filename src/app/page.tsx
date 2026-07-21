import VersionOnePage from "./(v1)/version-1/page";
import { createVersionOneMetadata } from "./lib/siteMetadata";
import "./(v1)/v1.css";

export const metadata = createVersionOneMetadata(
  "/",
  "Tufffinds — Personal Shopping and Sourcing",
);

export default function HomePage() {
  return <VersionOnePage />;
}
