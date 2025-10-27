// src/app/components/sectionbreak.tsx
"use client";

import { CSSProperties, useState } from "react";
import Image from "next/image";

type Props = {
  /** Space above/below the break (px). Default: 8 */
  gap?: number;
  /** Thickness of the line (px). Default: 8 */
  height?: number;
  /** Tile the image across the width. Default: false (single image centered) */
  repeat?: boolean;
  /** Optional custom image path. Default: "/line.png" (put this in /public) */
  src?: string;
  /** Fallback colour if no image (only used when repeat=false and src missing) */
  color?: string;
};

export default function SectionBreak({
  gap = 8,
  height = 8,
  repeat = false,
  src = "/line.png",
  color = "var(--line)",
}: Props) {
  const baseStyle: CSSProperties = {
    margin: `${gap}px 0`,
    lineHeight: 0,
  };

  // Repeating (full-width) version
  if (repeat) {
    return (
      <div role="separator" aria-hidden="true" style={baseStyle}>
        <div
          style={{
            height,
            backgroundImage: `url(${src})`,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "center",
            backgroundSize: `auto ${height}px`,
          }}
        />
      </div>
    );
  }

  // Single centered image with graceful fallback
  return <SingleLine src={src} height={height} color={color} baseStyle={baseStyle} />;
}

function SingleLine({
  src,
  height,
  color,
  baseStyle,
}: {
  src: string;
  height: number;
  color: string;
  baseStyle: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    // Fallback: simple centred rounded line
    return (
      <div role="separator" aria-hidden="true" style={baseStyle}>
        <div
          style={{
            height,
            background: color,
            borderRadius: 999,
            maxWidth: 600,
            margin: "0 auto",
            opacity: 0.65,
          }}
        />
      </div>
    );
  }

  // Use a fixed-height, relative box and let the image scale to fit (no layout shift)
  return (
    <div role="separator" aria-hidden="true" style={baseStyle}>
      <div style={{ position: "relative", height, width: "100%" }}>
        <Image
          src={src}
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: "contain", objectPosition: "center" }}
          onError={() => setFailed(true)}
          priority={false}
        />
      </div>
    </div>
  );
}
