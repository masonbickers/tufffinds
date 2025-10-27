// src/app/version-1/page.js
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Manrope } from "next/font/google";
import "../version-1.css";
import Footer from "../_components/footer";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export default function VersionOnePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef(null);

  // Close on Esc + click outside
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    const onClickOutside = (e) => {
      if (!menuOpen) return;
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
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

  // Scroll-reveal
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".v1 .reveal"));
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            obs.unobserve(en.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main className={`v1 ${manrope.variable}`}>
      {/* Header — matches /voice */}
      <header className="site__header">
        <div className="brand">Opening Line__</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            className={`hamburger ${menuOpen ? "is-open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="v1-sidebar"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* Overlay */}
      <div
        className="overlay"
        data-state={menuOpen ? "show" : "hide"}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />

      {/* Sidebar (RIGHT, sharp edges) */}
      <aside
        id="v1-sidebar"
        ref={sidebarRef}
        className="sidebar"
        data-state={menuOpen ? "open" : "closed"}
        aria-hidden={!menuOpen}
        aria-labelledby="sidebar-title"
      >
        <div className="sidebar-head">
          <Image src="/CHANEL.png" alt="Logo" className="logo" width={120} height={28} priority />
          <h2 id="sidebar-title" className="sr-only">Site menu</h2>
          <button className="close-x" aria-label="Close menu" onClick={() => setMenuOpen(false)}>×</button>
        </div>

        <nav className="links" role="menu">
          <a role="menuitem" href="#home" style={{ "--i": 0 }}>Home</a>
          <a role="menuitem" href="#quote" style={{ "--i": 1 }}>Quote</a>
          <a role="menuitem" href="#about" style={{ "--i": 2 }}>About</a>
          <a role="menuitem" href="#services" style={{ "--i": 3 }}>Services</a>
          <a role="menuitem" href="#founders" className="btn" style={{ "--i": 4 }}>Founders / Contact</a>
        </nav>

        <div className="sidebar-foot">
          <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram ↗</a>
          <a href="mailto:hello@example.com">hello@example.com</a>
        </div>
      </aside>

      {/* HERO — matches /voice knobs */}
      <section id="home" className="hero hero--lift">
        <div className="wrap">
          <h1 className="hero-title reveal">
            <Image
              src="/icon.png"
              alt="Opening Line"
              className="hero-logo"
              width={96}
              height={96}
              priority
            />
          </h1>
        </div>
      </section>

      {/* QUOTE */}
      <section id="quote" className="sec ink">
        <div className="wrap center">
          <blockquote className="quote reveal">
            “Find the unfindable — with the ones connected.”
          </blockquote>
          <p className="quote-by reveal">— Tufffinds</p>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="sec ink">
        <div className="wrap">
          <p className="reveal body">
            Rooted in London’s fashion scene, Tufffinds brings years of experience in personal shopping,
            styling, and sourcing. We’ve built relationships across the industry, understand what clients
            actually need, and keep a close eye on what’s next. At its heart, Tufffinds is about connection —
            between people, pieces, and stories — where the rare becomes reachable.
          </p>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="sec ink">
        <div className="wrap">
          <h2 className="h2 reveal">Services</h2>
          <ul className="cards">
            {[
              { h: "Find", p: "Sourcing the unsourceable: sold-out, archive, and rare pieces through our global network." },
              { h: "Style", p: "Look builds for events and travel, seasonal capsules, and streamlined wardrobe edits." },
              { h: "Deliver", p: "On-approval try-ons, end-to-end purchase, insured shipping & duties, plus aftercare." },
            ].map((s, i) => (
              <li className="card reveal" key={i} style={{ transitionDelay: `${80 * i}ms` }}>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
              </li>
            ))}
          </ul>
          <p className="reveal more">
            Want to know more? <a className="ink-link" href="#founders">Press contact below →</a>
          </p>
        </div>
      </section>

      {/* FOUNDERS */}
      <section id="founders" className="sec ink">
        <div className="wrap">
          <div className="founders">
            <figure className="f-photo reveal">
              <div style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
                <Image
                  src="/tufffinds-shoot.jpg"
                  alt="Gina & Ginevra — Tufffinds founders"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                  loading="lazy"
                />
              </div>
            </figure>
            <div className="f-copy reveal">
              <h2 className="eyebrow">Meet our founders,</h2>
              <h3 className="names">Gina &amp; Ginevra</h3>
              <p>
                With years working across personal shopping and fashion, Gina has a knack for elevating wardrobes
                both online and in person. Her eye for detail, impeccable taste, and deep network set her apart—
                pairing curation with thoughtful, real-world styling.
              </p>
              <p>
                Complementing Gina’s strengths, Ginevra brings experience across fashion, events, and creative
                direction. Having seen the industry from multiple angles, she understands where clients and brands
                need more care, clarity, and connection—and builds that into every brief.
              </p>
              <p>
                United by a shared point of view, they created Tufffinds: a personal shopping studio built on trust,
                access, and a love of finding the pieces you’ll actually live in.
              </p>
              <blockquote className="pull">“This isn’t just sourcing—it’s a relationship with your wardrobe.”</blockquote>
              <div className="sig">Gina &amp; Ginevra</div>
              <div className="contact">
                <a className="ink-link" href="mailto:gina@tufffinds.com">gina@tufffinds.com</a>
                <a className="ink-link" href="mailto:ginevra@tufffinds.com">ginevra@tufffinds.com</a>
                <a className="ink-link" href="mailto:hello@tufffinds.com">General: hello@tufffinds.com</a>
                <a className="ink-link" href="https://instagram.com" target="_blank" rel="noreferrer">Instagram ↗</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="sec">
        <div className="wrap">
          <h2 className="h2 reveal">Process</h2>
          <ol className="steps reveal">
            <li><strong>Brand strategy</strong> — Nail your proposition.</li>
            <li><strong>Voice system</strong> — Tone, lexicon, guardrails.</li>
            <li><strong>Application</strong> — Roll it through the brand.</li>
          </ol>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
