// app/voice/page.tsx
"use client";

import { useEffect, useRef, useState, CSSProperties } from "react";
import Section from "../_components/section";
import Footer from "../_components/footer";
import { Manrope } from "next/font/google";

/* Font: injects --font-sans so existing CSS keeps working */
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export default function VoicePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  // helper to set CSS vars without TS errors
  const cssVar = (name: string, value: string | number) =>
    ({ [name]: value } as CSSProperties);

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", menuOpen);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    const onClickOutside = (e: MouseEvent) => {
      if (!menuOpen) return;
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [menuOpen]);

  // 🔥 Scroll-reveal (load-in) animations
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        // Reveal the main content blocks + services cards
        '[data-path-anchor], .services-wide li, .founders-photo, .founders-copy, .shift-demo'
      )
    );

    // mark as revealable
    els.forEach((el) => el.classList.add("reveal"));

    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`page ${manrope.variable}`}>
      <main className="site">
        {/* Header */}
        <header className="site__header">
          <div className="brand">Opening Line__</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className={`hamburger ${menuOpen ? "is-open" : ""}`}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="site-sidebar"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </header>

        <>
          {/* Overlay */}
          <div
            className="overlay"
            data-state={menuOpen ? "show" : "hide"}
            onClick={closeMenu}
            aria-hidden={!menuOpen}
          />

          {/* Sidebar (RIGHT) */}
          <aside
            id="site-sidebar"
            ref={sidebarRef}
            className="sidebar"
            data-state={menuOpen ? "open" : "closed"}
            aria-hidden={!menuOpen}
            aria-labelledby="sidebar-title"
          >
            <div className="sidebar-header">
              <img src="/CHANEL.png" alt="Logo" className="sidebar-logo" />
              <h2 id="sidebar-title" className="sr-only">
                Site menu
              </h2>
              <button className="close-x" aria-label="Close menu" onClick={closeMenu}>
                ×
              </button>
            </div>

            <nav className="sidebar-links" role="menu">
              <a role="menuitem" href="#home" onClick={closeMenu} style={cssVar("--i", 0)}>
                Home
              </a>
              <a role="menuitem" href="#quote" onClick={closeMenu} style={cssVar("--i", 1)}>
                Quote
              </a>
              <a role="menuitem" href="#about" onClick={closeMenu} style={cssVar("--i", 2)}>
                About
              </a>
              <a role="menuitem" href="#services" onClick={closeMenu} style={cssVar("--i", 3)}>
                Services
              </a>
              <a
                role="menuitem"
                href="#founders"
                onClick={closeMenu}
                className="btn"
                style={cssVar("--i", 4)}
              >
                Founders / Contact
              </a>
            </nav>

            <div className="sidebar-footer">
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                Instagram ↗
              </a>
              <a href="mailto:hello@example.com">hello@example.com</a>
            </div>
          </aside>

          {/* Global font, layout width & reveal styles */}
          <style jsx global>{`
            :root {
              /* next/font injects --font-sans; this is a fallback */
              --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              --wrap: min(1180px, 92vw); /* 🔒 content width similar to Sensus */
            }

            html,
            body {
              font-family: var(--font-sans);
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: optimizeLegibility;
              scroll-behavior: smooth; /* subtle anchor scrolling */
            }

            /* 🔒 Center and constrain width of content blocks */
            /* Your Sections wrap content in a div[data-path-anchor] — perfect hook */
            section > [data-path-anchor] {
              width: var(--wrap);
              margin-inline: auto;
            }

            /* Sidebar — right, sharp, brand colour */
            .sidebar {
              font: 400 1rem/1.35 var(--font-sans);
              position: fixed;
              top: 0;
              bottom: 0;
              right: 0;
              left: auto;
              width: min(100vw, 340px);
              background: #f8f7f3 !important;
              color: #0e1115;
              border-left: 1px solid rgba(0, 0, 0, 0.06);
              border-radius: 0 !important;
              box-shadow: 0 20px 60px rgba(14, 17, 21, 0.18);
              transform: translateX(100%);
              transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
              z-index: 70;
              display: grid;
              grid-template-rows: auto 1fr auto;
            }
            .sidebar[data-state="open"] {
              transform: translateX(0);
            }

            /* Overlay */
            .overlay {
              position: fixed;
              inset: 0;
              background: rgba(14, 17, 21, 0.32);
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.2s ease;
              z-index: 60;
            }
            .overlay[data-state="show"] {
              opacity: 1;
              pointer-events: auto;
            }

            /* Sidebar internals (compact) */
            .sidebar-header {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 10px 12px;
              border-bottom: 1px solid rgba(14, 17, 21, 0.12);
            }
            .sidebar-logo {
              height: 20px;
              width: auto;
              display: block;
            }
            .close-x {
              margin-left: auto;
              font-size: 22px;
              line-height: 1;
              background: none;
              border: 0;
              cursor: pointer;
              color: inherit;
              padding: 2px 4px;
              letter-spacing: 0.01em;
              text-decoration: none;
              font-weight: 200; /* Manrope supports 200 */
            }

            .sidebar-links {
              display: grid;
              gap: 0;
              padding: 4px 6px;
            }
            .sidebar-links a {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 8px 8px;
              text-decoration: none;
              color: inherit;
              border: 0;
              font-size: 14px;
              line-height: 1.25;
              letter-spacing: 0.005em;
              transition: background 0.14s ease, transform 0.14s ease;
              font-weight: 200; /* light nav look */
            }
            .sidebar-links a + a {
              border-top: 1px solid rgba(14, 17, 21, 0.06);
            }
            .sidebar-links a:hover {
              background: rgba(0, 0, 0, 0.05);
              transform: translateY(-0.5px);
            }
            .sidebar-links a.btn {
              margin-top: 8px;
              background: #0e1115;
              color: #fff;
              text-align: center;
              letter-spacing: 0.01em;
              font-weight: 400;
            }
            .sidebar-links a.btn:hover {
              filter: brightness(0.96);
            }

            .sidebar-footer {
              border-top: 1px solid rgba(14, 17, 21, 0.12);
              padding: 10px 12px;
              display: grid;
              gap: 6px;
              font-size: 13px;
              line-height: 1.3;
              opacity: 0.95;
            }

            /* No rounded corners anywhere inside sidebar */
            .sidebar-header,
            .sidebar-links a,
            .sidebar-footer,
            .sidebar * {
              border-radius: 0 !important;
            }

            /* Focus ring */
            .sidebar a:focus-visible,
            .close-x:focus-visible {
              outline: 2px solid #0e1115;
              outline-offset: 2px;
            }

            /* ===== Scroll reveal styles ===== */
            .reveal {
              opacity: 0;
              transform: translateY(14px);
              transition:
                opacity .6s ease,
                transform .6s ease;
              will-change: opacity, transform;
            }
            .reveal.is-visible {
              opacity: 1;
              transform: translateY(0);
            }

            /* Subtle card stagger inside services */
            .services-wide li {
              transition-delay: .05s;
            }
            .services-wide li:nth-child(2) {
              transition-delay: .12s;
            }
            .services-wide li:nth-child(3) {
              transition-delay: .18s;
            }

            /* Respect reduced motion */
            @media (prefers-reduced-motion: reduce) {
              html { scroll-behavior: auto; }
              .overlay,
              .sidebar,
              .reveal,
              .sidebar-links a {
                transition: none !important;
                animation: none !important;
                transform: none !important;
                opacity: 1 !important;
              }
            }

            /* Keep your previous base font rules for the page */
            body {
              font-family: var(--font-sans);
            }
          `}</style>
        </>

        {/* HERO */}
        <section
          id="home"
          className="hero hero--lift"
          style={{
            background: "#F8F7F3",
            ...cssVar("--hero-top", "120px"),
            ...cssVar("--hero-logo-w", "800px"),
            ...cssVar("--hero-shift-y", "-200px"),
            ...cssVar("--hero-shift-x", "0px"),
            ...cssVar("--hero-align", "center"),
          }}
          data-path-anchor
        >
          <h1 className="hero-title" style={{ display: "flex", justifyContent: "center" }}>
            <img
              src="/icon.png"
              alt="Opening Line"
              className="hero-logo"
              style={{ display: "block" }}
              decoding="async"
              loading="eager" /* keep LCP eager */
            />
          </h1>
        </section>

        {/* Quote */}
        <Section id="quote" title="" className="ink-black" wide>
          <div
            data-path-anchor
            style={{
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: "80px 0",
            }}
          >
            <blockquote
              style={{
                maxWidth: 920,
                fontSize: "clamp(1.4rem, 3.5vw, 2.4rem)",
                lineHeight: 1.25,
                fontWeight: 600,
              }}
            >
              “Find the unfindable — with the ones connected.”
            </blockquote>
            <p style={{ marginTop: 12, opacity: 0.7 }}>— Tufffinds</p>
          </div>
        </Section>

        {/* About */}
        <Section id="about" title="About" className="ink-black services-wide">
          <div data-path-anchor>
            <p>
              Rooted in London’s fashion scene, Tufffinds brings years of experience in personal shopping, styling, and
              sourcing. We’ve built relationships across the industry, understand what clients actually need, and keep a
              close eye on what’s next. At its heart, Tufffinds is about connection — between people, pieces, and
              stories — where the rare becomes reachable.
            </p>
          </div>
        </Section>

        {/* Services */}
        <Section id="services" title="Services" className="ink-black services-wide">
          <div data-path-anchor>
            <ul
              style={{
                listStyle: "none",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 20,
                padding: 0,
                margin: "16px 0 0",
              }}
            >
              {[
                {
                  h: "Find",
                  p: "Sourcing the unsourceable: sold-out, archive, and rare pieces through our global network.",
                },
                {
                  h: "Style",
                  p: "Look builds for events and travel, seasonal capsules, and streamlined wardrobe edits.",
                },
                {
                  h: "Deliver",
                  p: "On-approval try-ons, end-to-end purchase, insured shipping & duties, plus aftercare.",
                },
              ].map((s, i) => (
                <li
                  key={i}
                  className="reveal"
                  style={{
                    border: "1px solid rgba(0,0,0,0.08)",
                    padding: 22,
                    borderRadius: 14, // keep your original card rounding; remove if you want all-sharp
                    transition: "transform .6s ease, box-shadow .6s ease, opacity .6s ease",
                  }}
                >
                  <h3 style={{ margin: "0 0 6px", fontSize: "1.08rem" }}>{s.h}</h3>
                  <p style={{ margin: 0, opacity: 0.8 }}>{s.p}</p>
                </li>
              ))}
            </ul>

            <div className="reveal" style={{ marginTop: 18, opacity: 0.8 }}>
              Want to know more?{" "}
              <a className="ink" href="#founders">
                Press contact below →
              </a>
            </div>
          </div>
        </Section>

        {/* Founders / Contact */}
        <Section id="founders" title="Founders & Contact" wide className="ink-black">
          <div className="founders-split" data-path-anchor>
            {/* Left: Photo */}
            <figure className="founders-photo">
              <img
                src="/tufffinds-shoot.jpg"
                alt="Gina & Ginevra — Tufffinds founders"
                loading="lazy"
                decoding="async"
              />
            </figure>

            {/* Right: Copy */}
            <div className="founders-copy">
              <h2 className="eyebrow">Meet our founders,</h2>
              <h3 className="names">Gina &amp; Ginevra</h3>

              <p>
                With years working across personal shopping and fashion, Gina has a knack for elevating wardrobes both
                online and in person. Her eye for detail, impeccable taste, and deep network set her apart—pairing
                curation with thoughtful, real-world styling.
              </p>
              <p>
                Complementing Gina’s strengths, Ginevra brings experience across fashion, events, and creative
                direction. Having seen the industry from multiple angles, she understands where clients and brands need
                more care, clarity, and connection—and builds that into every brief.
              </p>
              <p>
                United by a shared point of view, they created Tufffinds: a personal shopping studio built on trust,
                access, and a love of finding the pieces you’ll actually live in.
              </p>

              <blockquote className="pull">
                “This isn’t just sourcing—it’s a relationship with your wardrobe.”
              </blockquote>

              <div className="sig">Gina &amp; Ginevra</div>

              <div className="contact">
                <a className="ink" href="mailto:gina@tufffinds.com">
                  gina@tufffinds.com
                </a>
                <a className="ink" href="mailto:ginevra@tufffinds.com">
                  ginevra@tufffinds.com
                </a>
                <a className="ink" href="mailto:hello@tufffinds.com">
                  General: hello@tufffinds.com
                </a>
                <a className="ink" href="https://instagram.com" target="_blank" rel="noreferrer">
                  Instagram ↗
                </a>
              </div>

              <div className="footnote">
                Prefer WhatsApp or a quick call?{" "}
                <a className="ink" href="mailto:hello@tufffinds.com">
                  Email us
                </a>{" "}
                and we’ll send a direct line.
              </div>
            </div>
          </div>

          <style jsx>{`
            .founders-split {
              display: grid;
              grid-template-columns: clamp(340px, 38vw, 640px) minmax(0, 1fr);
              gap: clamp(20px, 4vw, 56px);
              align-items: start;
            }
            .founders-photo {
              margin: 0;
              border-radius: 16px;
              overflow: hidden;
              border: 1px solid rgba(0, 0, 0, 0.06);
              background: #f6f6f6;
            }
            .founders-photo img {
              display: block;
              width: 100%;
              height: 100%;
              object-fit: cover;
              aspect-ratio: 4 / 5;
            }
            .founders-copy {
              max-width: none;
            }
            .eyebrow {
              margin: 0 0 4px;
              font-weight: 500;
              letter-spacing: 0.02em;
              color: var(--muted, #6f7177);
              font-size: clamp(16px, 1.6vw, 18px);
            }
            .names {
              margin: 0 0 18px;
              font-size: clamp(28px, 4vw, 44px);
              font-weight: 600;
              font-style: italic;
              line-height: 1.1;
            }
            .founders-copy p {
              margin: 0 0 14px;
              line-height: 1.6;
              color: var(--ink, #171717);
            }
            .pull {
              margin: 16px 0 8px;
              font-size: clamp(18px, 2.2vw, 22px);
              font-style: italic;
              opacity: 0.9;
            }
            .sig {
              font-family: ui-serif, Georgia, Times, serif;
              font-size: clamp(22px, 2.6vw, 28px);
              margin: 6px 0 18px;
            }
            .contact {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 8px 16px;
              margin: 6px 0 8px;
            }
            .footnote {
              margin-top: 8px;
              opacity: 0.8;
            }
            @media (max-width: 960px) {
              .founders-split {
                grid-template-columns: 1fr;
              }
              .founders-photo img {
                aspect-ratio: 16 / 9;
              }
            }
          `}</style>
        </Section>



        {/* Process */}
        <Section id="process" title="Process">
          <div data-path-anchor>
            <ol className="steps">
              <li>
                <strong>Brand strategy</strong> — Nail your proposition.
              </li>
              <li>
                <strong>Voice system</strong> — Tone, lexicon, guardrails.
              </li>
              <li>
                <strong>Application</strong> — Roll it through the brand.
              </li>
            </ol>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
