// src/app/_components/Section.tsx
"use client";

import { PropsWithChildren } from "react";

type SectionProps = PropsWithChildren<{
  id?: string;                 // anchor target: href="#services"
  title?: string;              // optional now
  wide?: boolean;
  className?: string;
  anchorOffset?: number;       // px; how far below the top to stop on anchor jump
}>;

export default function Section({
  id,
  title,
  wide,
  className = "",
  anchorOffset = 96,           // default works with a sticky header
  children,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`block ${wide ? "block--wide" : ""} ${className}`}
      style={{ ["--anchor-offset" as any]: `${anchorOffset}px` }}
    >
      {title && <h2>{title}</h2>}
      <div className="block__body">{children}</div>
    </section>
  );
}
