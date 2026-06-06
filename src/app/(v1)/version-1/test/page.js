"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const clamp01 = (n) => Math.max(0, Math.min(1, n));

function WordReveal({ text, t, className = "", startAt = 0.18, endAt = 0.95 }) {
  const words = useMemo(() => text.split(" "), [text]);

  const span = Math.max(0.0001, endAt - startAt);
  const localT = clamp01((t - startAt) / span);

  return (
    <p className={className}>
      {words.map((w, i) => {
        const at = i / Math.max(1, words.length - 1); // 0..1 across words
        const softness = 0.22; // smaller = snappier, larger = softer
        const p = clamp01((localT - at) / softness);

        return (
          <span
            key={`${w}-${i}`}
            style={{
              opacity: p,
              transform: `translateY(${(1 - p) * 10}px)`,
              filter: `blur(${(1 - p) * 1.6}px)`,
              display: "inline-block",
              willChange: "opacity, transform, filter",
            }}
          >
            {w}
            {i < words.length - 1 ? "\u00A0" : ""}
          </span>
        );
      })}
    </p>
  );
}

export default function VersionOneTopScrollPull_FullAbout_WordReveal() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 0..1 scroll progress driving takeover + word reveal
  const [t, setT] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setScrolled(y > 10);

      const vh = Math.max(1, window.innerHeight || 1);

      // 1 screen of scroll = full takeover
      setT(clamp01(y / vh));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    setMounted(true);

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ui = useMemo(
    () => ({
      container: "mx-auto max-w-7xl px-6",
      eyebrow: "text-[11px] tracking-[0.36em] uppercase",
      body: "text-[15px] leading-relaxed md:text-[16px]",
      h1: "font-serif text-4xl leading-[1.05] md:text-6xl",
      h2: "font-serif italic text-4xl leading-[1.08] tracking-tight md:text-5xl",
      h2Split: "block not-italic text-black/70",
    }),
    []
  );

  // About overlay moves from below (100%) to fully on screen (0%)
  const aboutTranslateY = (1 - t) * 100;

  // Optional: gently dim hero as About comes in
  const heroFade = 1 - t * 0.25;

  return (
    <main className="relative min-h-screen bg-[#F8F7F3] text-[#121212]">
      {/* HEADER (fixed; About covers it) */}
      <header
        className={[
          "fixed top-0 left-0 right-0 bg-transparent",
          scrolled ? "backdrop-blur-[6px]" : "",
        ].join(" ")}
        style={{ zIndex: 40 }}
      >
        <div
          className={[
            "mx-auto flex max-w-7xl items-center justify-between px-6 py-5",
            scrolled ? "border-b border-black/10" : "",
          ].join(" ")}
        >
          <Image
            src="/finallogobrown.png"
            alt="Tufffinds"
            width={220}
            height={56}
            quality={100}
            priority
            className="h-5 w-auto select-none"
          />

          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6 text-[11px] tracking-[0.26em] uppercase text-black/70">
              <a
                href="#home"
                className="transition hover:text-black"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                Home
              </a>

            </nav>

            <a
              href="#home"
              className="rounded-full border border-black/30 px-5 py-2.5 text-[10px] font-semibold tracking-[0.22em] uppercase text-black/90 transition hover:border-black"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Home
            </a>
          </div>
        </div>
      </header>

      {/* HERO (fixed; never scrolls away) */}
      <section id="home" className="fixed inset-0" style={{ zIndex: 10, opacity: heroFade }}>
        <div className="absolute inset-0">
          <Image
            src="/tufffinds-shoot.jpg"
            alt="Tufffinds shoot"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#F8F7F3]/65" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/15" />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="max-w-2xl pt-32 pb-16 text-center">
            <p
              className={[
                "mb-6 text-[11px] tracking-[0.34em] uppercase text-black/55 transition-all duration-1000 ease-out",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              ].join(" ")}
              style={{ transitionDelay: "120ms" }}
            >
              Personal Shopping • Wardrobe Edits • Sourcing • Styling
            </p>

            <p
              className={[
                "mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-black/65 md:text-[16px]",
                "transition-all duration-1000 ease-out",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              ].join(" ")}
              style={{ transitionDelay: "320ms" }}
            >
              Tufffinds is a London-based personal shopping studio built on taste, access and trust. You brief us once —
              we return with a curated shortlist and handle the rest.
            </p>

            <div
              className={[
                "mt-12 flex justify-center gap-4 transition-all duration-1000 ease-out",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
              ].join(" ")}
              style={{ transitionDelay: "420ms" }}
            >
              <button
                type="button"
                onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
                className="rounded-full bg-black px-9 py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-black/85"
              >
                Learn more
              </button>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
