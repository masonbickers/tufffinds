// src/app/_components/Section.tsx
"use client";

import { PropsWithChildren, CSSProperties } from "react";

type SectionProps = PropsWithChildren<{
  id?: string;            // anchor target: href="#services"
  title?: string;
  wide?: boolean;
  className?: string;
  anchorOffset?: number;  // px; how far below the top to stop on anchor jump
}>;

// allow the CSS custom property in the style object
type SectionStyle = CSSProperties & { ["--anchor-offset"]?: string };

export default function Section({
  id,
  title,
  wide,
  className = "",
  anchorOffset = 96,
  children,
}: SectionProps) {
  const style: SectionStyle = { ["--anchor-offset"]: `${anchorOffset}px` };

  return (
    <section
      id={id}
      className={`block ${wide ? "block--wide" : ""} ${className}`}
      style={style}
    >
      {title && <h2>{title}</h2>}
      <div className="block__body">{children}</div>
    </section>
  );
}
