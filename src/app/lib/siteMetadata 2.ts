import type { Metadata } from "next";

const description =
  "Personal shopping, wardrobe edits, sourcing and styling from Tufffinds.";

export function createVersionOneMetadata(path: string, title: string): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Tufffinds",
      type: "website",
      images: [
        {
          url: "/tufffinds-shoot.jpg",
          width: 1066,
          height: 1121,
          alt: "Gina and Ginevra, founders of Tufffinds",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/tufffinds-shoot.jpg"],
    },
  };
}
