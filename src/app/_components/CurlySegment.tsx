"use client";
import { useEffect, useRef } from "react";

export default function CurlySegment(
  { d, start, end }:{
    d: string;
    start: number; // 0..1 scroll start
    end: number;   // 0..1 scroll end
  }
){
  const ref = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const path = ref.current!;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      const p = Math.min(1, Math.max(0, scrollY / scrollable));
      // normalise progress for this segment
      const seg = (p - start) / (end - start);
      const segClamped = Math.min(1, Math.max(0, seg));
      path.style.strokeDashoffset = String(len * (1 - segClamped));
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [start, end]);

  return (
    <div className="path-wrap" aria-hidden>
      <svg className="path" viewBox="0 0 1200 1000" preserveAspectRatio="xMidYMin slice">
        <path ref={ref} d={d} />
      </svg>
      <div className="path-glow" />
      <style jsx global>{`
        .path-wrap{ position: sticky; top:0; height:100svh; pointer-events:none; z-index:0; }
        .path{ position:absolute; inset:0; width:100%; height:100%; }
        .path path{ fill:none; stroke:#fff; stroke-width:2.2; stroke-linecap:round; opacity:.95; }
      `}</style>
    </div>
  );
}
