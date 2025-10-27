// app/_components/CurlyPath.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SignatureFlow — smooth, elegant single black stroke inspired by the reference:
 *  - tiny flourish near the top
 *  - broad S-curves between sections
 *  - one clean circular loop around the mid anchors
 *  - big “bowl” wrap near the lower section
 * It measures [data-path-anchor] boxes and glides down the roomier side.
 */
export default function SignatureFlow() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [h, setH] = useState(0);
  const [w, setW] = useState(0);

  // Feel / styling
  const K = {
    gutterMin: 80,
    gutterMax: 220,
    startXR: 0.20,       // where the line begins (fraction of width)
    approachY: 180,      // curve starts this far above a section
    departY: 220,        // curve finishes this far below a section
    wallOffset: 42,      // distance from the section side
    tension: 0.15,       // lower = wider/softer
    strokeWidth: 1.8,
  };

  // Size tracking
  useEffect(() => {
    const setSize = () => {
      setH(document.documentElement.scrollHeight);
      setW(window.innerWidth);
    };
    setSize();
    addEventListener("resize", setSize);
    const ro = new ResizeObserver(setSize);
    ro.observe(document.documentElement);
    const t = setTimeout(setSize, 200);
    return () => {
      removeEventListener("resize", setSize);
      ro.disconnect();
      clearTimeout(t);
    };
  }, []);

  // Build smooth path that routes around content, with stylised motifs
  const buildPath = () => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLElement>("[data-path-anchor]")
    ).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    const gutter = Math.min(K.gutterMax, Math.max(K.gutterMin, Math.round(w * 0.08)));
    const xStart = Math.round(w * K.startXR);

    // Helpers
    type P = { x: number; y: number };
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const sideX = (rect: DOMRect, side: "L" | "R") =>
      side === "L"
        ? clamp(rect.left - K.wallOffset, gutter, w - gutter)
        : clamp(rect.right + K.wallOffset, gutter, w - gutter);

    // Decide side with more room (with a gentle bias to alternate)
    const decideSide = (rect: DOMRect, i: number): "L" | "R" => {
      const leftSpace = Math.max(0, rect.left);
      const rightSpace = Math.max(0, w - rect.right);
      if (Math.abs(leftSpace - rightSpace) < 80) return i % 2 ? "R" : "L";
      return leftSpace > rightSpace ? "L" : "R";
    };

    // Points we’ll spline through
    const pts: P[] = [];

    // 0) Enter + small top flourish like the reference
    pts.push({ x: xStart, y: 0 });
    const topY = Math.min(h * 0.06, 420);
    // gentle arch to the right then back to the start x
    pts.push({ x: xStart + Math.min(120, w * 0.12), y: topY * 0.45 });
    // small “comma” flourish
    pts.push({ x: xStart - 28, y: topY * 0.75 });
    pts.push({ x: xStart + 8, y: topY });

    // 1) Route around each anchor with broad S-curves
    anchors.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const bottom = r.bottom + window.scrollY;
      const centreY = top + r.height / 2;
      const side = decideSide(r, i);
      const xEdge = sideX(r, side);

      const yIn = Math.max(0, top - K.approachY);
      const yOut = Math.min(h, bottom + K.departY);

      // approach from centre to chosen edge
      pts.push({ x: mix(xStart, xEdge, 0.45), y: yIn });
      // slide down the edge (top/centre/bottom) to get a rounded wrap
      pts.push({ x: xEdge, y: top - 6 });
      pts.push({ x: xEdge, y: centreY });
      pts.push({ x: xEdge, y: bottom + 6 });
      // depart under the block and ease back toward centre
      pts.push({ x: mix(xEdge, xStart, 0.58), y: yOut });

      // 2) Insert ONE clean loop around the middle set of anchors (like the screenshot)
      const midIndex = Math.floor(anchors.length * 0.45);
      if (i === midIndex) {
        const loopR = Math.min(48, Math.max(34, w * 0.04)); // nice round loop
        const loopSide: "L" | "R" = side === "L" ? "R" : "L"; // loop out on opposite side
        const lx = loopSide === "L"
          ? clamp(r.left - K.wallOffset - loopR, gutter, w - gutter)
          : clamp(r.right + K.wallOffset + loopR, gutter, w - gutter);
        const ly = centreY + Math.min(36, r.height * 0.25);
        // lead into loop
        pts.push({ x: mix(xStart, lx, 0.55), y: ly - loopR * 0.9 });
        // tangent points to hint a circle (Catmull-Rom will round it)
        pts.push({ x: lx, y: ly - loopR * 0.2 });
        pts.push({ x: lx, y: ly + loopR * 0.2 });
        // exit from loop
        pts.push({ x: mix(lx, xStart, 0.6), y: ly + loopR * 0.9 });
      }
    });

    // 3) Big “bowl” near the bottom like the reference
    const bowlY = Math.min(h - 260, Math.max(h * 0.68, h - 900));
    const bowlW = Math.min(w * 0.55, 860);
    pts.push({ x: xStart - bowlW * 0.40, y: bowlY });        // glide left
    pts.push({ x: xStart + bowlW * 0.55, y: bowlY + 180 });  // swing right/down
    pts.push({ x: xStart - bowlW * 0.20, y: bowlY + 320 });  // settle left

    // 4) Tail to the bottom
    pts.push({ x: xStart + Math.min(160, w * 0.16), y: h - 140 });
    pts.push({ x: xStart, y: h - 1 });

    // Catmull–Rom → Bézier
    const C = (p0: P, p1: P, p2: P, p3: P, t = K.tension) => {
      const c1x = p1.x + (p2.x - p0.x) * t;
      const c1y = p1.y + (p2.y - p0.y) * t;
      const c2x = p2.x - (p3.x - p1.x) * t;
      const c2y = p2.y - (p3.y - p1.y) * t;
      return { c1x, c1y, c2x, c2y };
    };

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const { c1x, c1y, c2x, c2y } = C(p0, p1, p2, p3);
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  // Scroll-draw
  useEffect(() => {
    const path = pathRef.current!;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      const p = scrollable > 0 ? Math.min(1, Math.max(0, scrollY / scrollable)) : 0;
      path.style.strokeDashoffset = String(len * (1 - p));
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [h, w]);

  const d = buildPath();

  return (
    <>
      <svg
        ref={svgRef}
        className="page-squiggle"
        width="100%"
        height={h || 0}
        viewBox={`0 0 ${w || 1} ${h || 0}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path ref={pathRef} d={d} vectorEffect="non-scaling-stroke" />
      </svg>

      <style jsx global>{`
        .page-squiggle {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0; /* behind content */
        }
        .page-squiggle path {
          fill: none;
          stroke: #000;                 /* solid black like you asked */
          stroke-width: ${K.strokeWidth}px;
          stroke-linecap: round;
          opacity: .96;
        }
        .site, main, .block { position: relative; z-index: 1; }
      `}</style>
    </>
  );
}
