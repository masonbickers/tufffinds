// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tufffinds - The Ones Connected",
  description:
    "Effortless style, tailored to you — wardrobe edits, event styling, and capsule collections.",
  metadataBase: new URL("http://localhost:3000"), // update when deployed
  openGraph: {
    title: "Tufffinds - The Ones Connected",
    description:
      "Effortless style, tailored to you — wardrobe edits, event styling, and capsule collections.",
    url: "/",
    siteName: "Tufffinds",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }],
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f7f4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}

