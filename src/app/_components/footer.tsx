// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <img src="/logo-04.png" alt="sensus" className="footer__logo" />

        <nav className="footer__nav">
          <a href="/about">ABOUT</a>
          <a href="/founders">SERVICES</a>
          <a href="/work-with-us">FOUDNERS</a>
          <a href="/guest-list">CONTACT</a>
          <a href="/contact">T&C</a>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="ig">
            {/* Instagram icon (inline SVG) */}
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm5-2.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z" fill="currentColor"/>
            </svg>
          </a>
        </nav>

        <small className="footer__copy">TUFFFINDS 2025. ALL RIGHTS RESERVED</small>
      </div>

      <style jsx global>{`.footer {
  background: #F8F7F3;        /* Footer background colour (warm off-white). Change to your brand hex if needed. */
  color: #000000ff;           /* Default text colour inside the footer. */
  width: 100%;                /* Make the footer span the full viewport width. */
}

.footer__inner {
  max-width: 1200px;          /* Limit content width for nice readable line-length. */
  margin: 0 auto;             /* Centre the .footer__inner block horizontally. */
  padding: 56px 24px 28px;    /* Top / right-left / bottom padding inside the footer. */
  text-align: center;         /* Centre text and inline elements (like links). */
}

.footer__logo {
  width: 72px;                /* Logo width (scales the image proportionally). */
  height: auto;               /* Keep the logo’s aspect ratio. */
  display: block;             /* Allows margin to take effect properly. */
  margin: 0 auto 28px;        /* Centre the logo horizontally and add bottom space. */
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.08)); /* Subtle depth; tweak blur/offset/opacity for taste. */
}

.footer__nav {
  display: flex;              /* Use flexbox to lay out the links in a row. */
  justify-content: center;    /* Centre the link row horizontally. */
  flex-wrap: wrap;            /* Allow links to wrap onto multiple lines on small screens. */
  gap: 30px;                  /* Space between each link item. Reduce for tighter layout. */
  margin-bottom: 28px;        /* Space below the nav row before the copyright line. */
  letter-spacing: .06em;      /* Slightly widen letter spacing for a ‘chic’ look. */
}

.footer__nav a {
  color: #000000ff;           /* Link colour. Change for brand colour or use currentColor. */
  text-decoration: none;      /* Remove underlines by default. */
  font-weight: 600;           /* Make links semi-bold. */
  font-size: 10px;            /* Link size; increase if it feels too small. */
  opacity: .9;                /* Slightly soften the link colour until hover. */
}

.footer__nav a:hover {
  opacity: 1;                 /* Full opacity on hover for emphasis. */
  text-decoration: underline; /* Add underline on hover for affordance. */
}

.footer__nav .ig {
  display: inline-flex;       /* Align icon + text nicely on the baseline. */
  align-items: center;        /* Vertically centre icon with text. */
}

.footer__copy {
  display: block;             /* Treat as block so margins/padding behave predictably. */
  opacity: .9;                /* Slightly dim to de-emphasise legal text. */
  font-size: 8px;             /* Small print size; bump up if readability is an issue. */
  letter-spacing: .08em;      /* Extra tracking to improve legibility at tiny sizes. */
}

/* ── Mobile tweaks (≤ 640px) ───────────────────────────────────────────── */
@media (max-width: 640px) {
  .footer__logo {
    width: 60px;              /* Slightly smaller logo on small screens. */
    margin-bottom: 10px;      /* Tighter spacing to save vertical space. */
  }
  .footer__nav {
    gap: 18px;                /* Reduce spacing so more links fit per row. */
  }
}

      `}</style>
    </footer>
  );
}
