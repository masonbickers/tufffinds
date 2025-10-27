"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-page continuous squiggle that draws with scroll.
 * Sits BEHIND content (absolute overlay).
 */
export default function ContinuousSquiggle() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [h, setH] = useState(0);

  // Keep SVG height in sync with document height
  useEffect(() => {
    const setSize = () => {
      const docH = document.documentElement.scrollHeight;
      setH(docH);
    };
    setSize();

    const onResize = () => setSize();
    window.addEventListener("resize", onResize);

    const ro = new ResizeObserver(setSize);
    ro.observe(document.documentElement);

    // Update when content changes height (e.g., fonts)
    const mo = new MutationObserver(setSize);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  // Scroll-draw
  useEffect(() => {
    if (!pathRef.current) return;
    const path = pathRef.current;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const p = scrollable <= 0 ? 1 : Math.min(1, Math.max(0, window.scrollY / scrollable));
      path.style.strokeDashoffset = String(len * (1 - p));
    };
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [h]);

  // A down-the-page meander. Coordinates are relative to viewBox (width 1200).
  // Use h to hit key verticals (fractions of page height).
  const d = `
    M 600 ${Math.max(120, h * 0.02)}               

    C 820 ${h * 0.08},  980 ${h * 0.12},  780 ${h * 0.16}
    S 360 ${h * 0.24},  520 ${h * 0.28}
    C 740 ${h * 0.34},  940 ${h * 0.38},  700 ${h * 0.42}

    S 260 ${h * 0.50},  420 ${h * 0.54}
    C 660 ${h * 0.60},  980 ${h * 0.64},  860 ${h * 0.68}

    S 300 ${h * 0.76},  440 ${h * 0.80}
    C 680 ${h * 0.86},  960 ${h * 0.90},  720 ${h * 0.94}

    S 520 ${h * 0.98},  600 ${h * 1.02}
  `;

  return (
    <svg
      ref={svgRef}
      className="page-squiggle"
      width="100%"
      height={h || 0}
      viewBox={`0 0 1200 ${Math.max(h, 2000)}`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden
    >
      <defs>
        {/* subtle glow */}
        <filter id="squiggleGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        ref={pathRef}
        d={d}
        vectorEffect="non-scaling-stroke"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.96"
        filter="url(#squiggleGlow)"
      />
    </svg>
  );
}
