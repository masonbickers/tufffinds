"use client";

import { useEffect, useRef, useState } from "react";
import "./page.css";

function CurlyPath() {
  const pathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const path = pathRef.current!;
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
  }, []);

  return (
    <div className="squiggle-wrap" aria-hidden>
      <svg className="squiggle-svg" viewBox="0 0 1200 5000" preserveAspectRatio="xMidYMin slice">
        <path
          ref={pathRef}
          d="
            M 80 220
            C 200 100, 400 180, 520 240
            S 840 440, 700 640
            C 560 860, 260 980, 260 1180
            S 720 1520, 940 1680
            C 1140 1820, 1040 2100, 800 2200
            S 200 2600, 360 2900
            S 980 3300, 760 3600
            S 220 4000, 360 4300
          "
        />
      </svg>
      <div className="squiggle-glow" />
    </div>
  );
}



export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Back-to-top, parallax, year, detect top/esc
  useEffect(() => {
    const toTop = document.getElementById("toTop");
    const media = document.querySelector<HTMLElement>(".hero-media");
    const yearEl = document.getElementById("year");

    const onScroll = () => {
      // use data attr so CSS can animate it (not display:none)
      if (toTop) toTop.dataset.visible = String(window.scrollY > 500);
      if (media) media.style.setProperty("--parallax", String(Math.min(window.scrollY * 0.06, 36)));
      setAtTop(window.scrollY < 10);
    };

    // Inline section separator (no import needed)
const SectionBreak = ({
  gap = 12,        // top/bottom margin in px
  height = 8,      // line thickness in px
  repeat = false,  // tile the image across the width
}: { gap?: number; height?: number; repeat?: boolean }) => (
  <div
    role="separator"
    aria-hidden="true"
    style={{
      margin: `${gap}px 0`,
      lineHeight: 0,
      ...(repeat
        ? {
            height,
            backgroundImage: 'url(/line.png)',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'center',
            backgroundSize: `auto ${height}px`,
          }
        : {}),
    }}
  >
    {!repeat && (
      <img
        src="/line.png"
        alt=""
        style={{ display: 'block', margin: '0 auto', height, width: 'auto' }}
      />
    )}
  </div>
);


    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    onScroll();
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Lock scroll + outside click to close
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("menu-open", menuOpen);

    const onClickOutside = (e: MouseEvent) => {
      if (!menuOpen) return;
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  // Scroll-reveal
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = document.querySelectorAll<HTMLElement>("[data-anim]");
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.in = "true";
            obs.unobserve(entry.target);
          }
        }),
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // 100vh mobile fix
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div>
      {/* Header */}
{/* Header */}
<header className={`site-header ${atTop ? "transparent" : "solid"}`}>
  <a className="logo" href="#home" aria-label="Home">

  </a>

  {/* Hamburger */}
  <button
    className={`hamburger ${menuOpen ? "is-open" : ""}`}  // match CSS .hamburger.is-open
    aria-label={menuOpen ? "Close menu" : "Open menu"}
    aria-expanded={menuOpen}
    aria-controls="site-sidebar"
    onClick={() => setMenuOpen(v => !v)}
  >
    <span />
    <span />
    <span />
  </button>
</header>


      {/* Overlay + Sidebar */}
      <div
        className="overlay"
        data-state={menuOpen ? "show" : "hide"}
        onClick={closeMenu}
      />
      <aside
        id="site-sidebar"
        ref={sidebarRef}
        className="sidebar"
        data-state={menuOpen ? "open" : "closed"}
        aria-hidden={!menuOpen}
      >
        <div className="sidebar-header">
          <img src="/CHANEL.png" alt="Logo" className="sidebar-logo" />
          <button className="close-x" aria-label="Close menu" onClick={closeMenu}>
            ✕
          </button>
        </div>

        <nav className="sidebar-links" role="menu">
          {/* Stagger via CSS using --i */}
          <a role="menuitem" href="#home" onClick={closeMenu} style={{ ["--i" as any]: 0 }}>
            Home
          </a>
          <a role="menuitem" href="#services" onClick={closeMenu} style={{ ["--i" as any]: 1 }}>
            Services
          </a>
          <a role="menuitem" href="#process" onClick={closeMenu} style={{ ["--i" as any]: 2 }}>
            Process
          </a>
          <a role="menuitem" href="#testimonials" onClick={closeMenu} style={{ ["--i" as any]: 3 }}>
            Reviews
          </a>
          <a role="menuitem" href="#contact" onClick={closeMenu} className="btn" style={{ ["--i" as any]: 4 }}>
            Book a consult
          </a>
        </nav>

        <div className="sidebar-footer">
          <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram ↗</a>
          <a href="mailto:hello@example.com">hello@example.com</a>
        </div>
      </aside>

      <main>
        {/* HERO */}
        <section id="home" className="hero">
<div className="hero-media">
  <img className="hero-logo" src="/logo-01.png" alt="Tufffinds logo" />
  <div className="hero-vignette"></div>
</div>

          <div className="hero-inner container">
  

            <p className="lead" data-anim="up" style={{ transitionDelay: "80ms" }}>
            </p>
        
          </div>
        </section>


        
    

{/* WELCOME */}
<section id="welcome" className="section welcome" data-anim="fade">
  <div className="container">
    <p className="eyebrow" data-anim="up">Personal styling • Sourcing • Discovery</p>
    <h2 data-anim="up">Welcome to Tufffinds</h2>
    <p className="max" data-anim="up" style={{ transitionDelay: "80ms" }}>
      We help you define (or refine) your signature look—merging considered staples with
      special finds. From smart wardrobe edits to event styling and capsules, Tufffinds
      makes dressing feel effortless and personal.
    </p>
  </div>
</section>




{/* SERVICES */}
<section id="services" className="section services-section" data-anim="fade">
  <div className="container">
<h2 data-anim="up" style={{ fontStyle: 'italic' }}>Services</h2>

<div className="services-line" aria-hidden="true" />



    <div className="cards services">
      <article className="card service" data-anim="up">
        <img className="service-icon" src="/CHANEL.png" alt="" aria-hidden="true" />
        <h3>Wardrobe Edit</h3>
        <p>Streamline your closet: keep, tailor, donate. Gaps identified, list provided.</p>
        <ul className="points">
        </ul>
      </article>

      <article className="card service" data-anim="up" style={{ transitionDelay: "80ms" }}>
        <img className="service-icon" src="/GOYARD.png" alt="" aria-hidden="true" />
        <h3>Event Styling</h3>
        <p>Head-to-toe looks for weddings, work events and special occasions.</p>
        <ul className="points">
       
        </ul>
      </article>

      <article className="card service" data-anim="up" style={{ transitionDelay: "160ms" }}>
        <img className="service-icon" src="/HERMESTF.png" alt="" aria-hidden="true" />
        <h3>Capsule Collection</h3>
        <p>Seasonal capsule you can mix &amp; match—versatile pieces that work hard.</p>
        <ul className="points">

        </ul>
      </article>

      <article className="card service" data-anim="up" style={{ transitionDelay: "240ms" }}>
        <img className="service-icon" src="/SUNGLASSES.png" alt="" aria-hidden="true" />
        <h3>Virtual Shop</h3>
        <p>Fast, remote styling with live links and optional video call.</p>
        <ul className="points">
     
        </ul>
      </article>
    </div>
  </div>
</section>


{/* FOUNDERS */}
<section id="founders" className="section founders" data-anim="fade">
  <div className="container founders-wrap">
    {/* Left: photo (file has a space → URL-encode) */}
    <figure className="founders-photo" data-anim="left">
      <img
        src="/tufffinds%20shoot.jpg"
        alt="Founders"
        loading="lazy"
      />
    </figure>

    {/* Right: text */}
    <div className="founders-text">
      <h3 className="founders-title">Meet our founders,</h3>
      <p className="founders-names">Ginvra &amp; Gina</p>

      <div className="founders-copy">
        <p>
          
        </p>
        <p>
          
        </p>
        <p>
         
        </p>
      </div>

      <blockquote className="founders-quote">
        “Tufffinds - The Ones Connected”
      </blockquote>

      <p className="founders-signature">Ginevra &amp; Gina</p>
    </div>
  </div>
</section>


        {/* PROCESS */}
        <section id="process" className="section alt" data-anim="fade">
          <div className="container narrow">
            <h2 data-anim="up">How it works</h2>
            <div className="steps">
              <div className="step" data-anim="left">
                <span className="step-num">1</span>
                <div>
                  <h4>Consult</h4>
                  <p>Free 15-minute call to understand your goals, sizes, budget and timeline.</p>
                </div>
              </div>
              <div className="step" data-anim="left" style={{ transitionDelay: "80ms" }}>
                <span className="step-num">2</span>
                <div>
                  <h4>Curate</h4>
                  <p>Style profile + mood + colour palette. I source pieces and build looks.</p>
                </div>
              </div>
              <div className="step" data-anim="left" style={{ transitionDelay: "160ms" }}>
                <span className="step-num">3</span>
                <div>
                  <h4>Try-on</h4>
                  <p>At-home or virtual try-on with fit notes, tailoring tips and easy returns.</p>
                </div>
              </div>
              <div className="step" data-anim="left" style={{ transitionDelay: "240ms" }}>
                <span className="step-num">4</span>
                <div>
                  <h4>Refine</h4>
                  <p>Final polish and care tips. You get a lookbook and shopping links.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section id="testimonials" className="section" data-anim="fade">
          <div className="container">
            <h2 data-anim="up">Client reviews</h2>
            <div className="quotes">
              <blockquote className="quote" data-anim="up">
                “I saved hours and finally love everything in my wardrobe.” <cite>— Alex R.</cite>
              </blockquote>
              <blockquote className="quote" data-anim="up" style={{ transitionDelay: "100ms" }}>
                “Event outfit was perfect. Got compliments all night.” <cite>— Priya T.</cite>
              </blockquote>
              <blockquote className="quote" data-anim="up" style={{ transitionDelay: "200ms" }}>
                “The capsule made getting dressed effortless.” <cite>— Dan S.</cite>
              </blockquote>
            </div>
          </div>
        </section>

        {/* CTA STRIP */}
        <section className="cta-strip" data-anim="fade">
          <div className="container cta-inner">
            <h3>Ready to refresh your style?</h3>
            <a href="#contact" className="btn">Book your free consult</a>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" className="section alt" data-anim="fade">
          <div className="container narrow">
            <h2 data-anim="up">Book a consult</h2>
            <p className="max" data-anim="up" style={{ transitionDelay: "80ms" }}>
              Tell me a little about you and what you need. I’ll reply within one business day.
            </p>
            <form className="contact-grid" onSubmit={(e) => e.preventDefault()}>
              <input type="text" placeholder="Name" required data-anim="up" />
              <input type="email" placeholder="Email" required data-anim="up" style={{ transitionDelay: "60ms" }} />
              <input type="text" placeholder="Budget (optional)" data-anim="up" style={{ transitionDelay: "120ms" }} />
              <textarea rows={5} placeholder="What are you looking for?" required data-anim="up" style={{ transitionDelay: "180ms" }} />
              <button className="btn" data-anim="up" style={{ transitionDelay: "240ms" }}>Send</button>
            </form>
            <p className="muted" data-anim="fade">Hook up Formspree/Netlify when you’re ready.</p>
          </div>
        </section>

        {/* LOOKS / INSTAGRAM */}
        <section id="instagram" className="section" data-anim="fade">
          <div className="container">
            <h2 data-anim="up">Recent looks</h2>
            <div className="ig-grid">
              <img src="https://picsum.photos/seed/look1/600/600" alt="" data-anim="up" />
              <img src="https://picsum.photos/seed/look2/600/600" alt="" data-anim="up" style={{ transitionDelay: "60ms" }} />
              <img src="https://picsum.photos/seed/look3/600/600" alt="" data-anim="up" style={{ transitionDelay: "120ms" }} />
              <img src="https://picsum.photos/seed/look4/600/600" alt="" data-anim="up" style={{ transitionDelay: "180ms" }} />
              <img src="https://picsum.photos/seed/look5/600/600" alt="" data-anim="up" style={{ transitionDelay: "240ms" }} />
              <img src="https://picsum.photos/seed/look6/600/600" alt="" data-anim="up" style={{ transitionDelay: "300ms" }} />
            </div>
            <div className="center" data-anim="up" style={{ transitionDelay: "180ms" }}>
              <a className="btn btn-outline" href="https://instagram.com" target="_blank">See more on Instagram</a>
            </div>
          </div>
        </section>
      </main>

      <button id="toTop" className="to-top" aria-label="Back to top">↑</button>

      <footer className="footer">
        <div className="container">
          <p>© <span id="year"></span> Personal Shopping by You. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
