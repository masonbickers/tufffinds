"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export default function PrivacyPolicyPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ui = useMemo(
    () => ({
      container: "mx-auto max-w-3xl px-6",
      sectionY: "py-16 md:py-20",
      eyebrow: "text-[11px] tracking-[0.36em] uppercase text-black/50",
      body: "text-[15px] leading-relaxed md:text-[16px] text-black/70",
      h1: "font-serif text-4xl leading-[1.05] md:text-5xl",
      h2: "font-serif text-2xl md:text-3xl tracking-tight",
      divider: "my-12 h-px w-full bg-black/10",
    }),
    []
  );

  const brand = "Tufffinds";
  const supportEmail = "hello@tufffinds.com";

  return (
    <main className="min-h-screen bg-[#F8F7F3] text-[#121212]">
      {/* HEADER — identical to homepage */}
      <header
        className={[
          "fixed top-0 z-50 w-full bg-transparent",
          scrolled ? "backdrop-blur-[6px]" : "",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex max-w-7xl items-center justify-between px-6 py-5",
            scrolled ? "border-b border-black/10" : "",
          ].join(" ")}
        >
          <Image
            src="/finallogobrown.png"
            alt={brand}
            width={220}
            height={56}
            quality={100}
            priority
            className="h-5 w-auto select-none"
          />

          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6 text-[11px] tracking-[0.26em] uppercase text-black/70">
              <a href="/" className="transition hover:text-black">Home</a>
              <a href="/#about" className="transition hover:text-black">About</a>
              <a href="/#services" className="transition hover:text-black">Services</a>
              <a href="/#contact" className="transition hover:text-black">Contact</a>
            </nav>

            <a
              href="/#contact"
              className="rounded-full border border-black/30 px-5 py-2.5 text-[10px] font-semibold tracking-[0.22em] uppercase text-black/90 transition hover:border-black"
            >
              Enquire
            </a>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <section className={`${ui.sectionY} pt-36`}>
        <div className={ui.container}>
          <p className={ui.eyebrow}>Legal</p>

          <h1 className={`${ui.h1} mt-6`}>
            Privacy Policy
          </h1>

          <p className="mt-6 text-sm text-black/50">
            Last updated: 12 January 2026
          </p>

          <div className={ui.divider} />

          <div className={`space-y-8 ${ui.body}`}>
            <p>
              This Privacy Policy explains how <strong>{brand}</strong> collects,
              uses, and protects your personal information when you visit our
              website or engage with our services.
            </p>

            <h2 className={ui.h2}>1. Information we collect</h2>
            <p>
              We may collect personal information including your name, email
              address, phone number, and any details you choose to share when
              contacting us or submitting a sourcing brief.
            </p>

            <h2 className={ui.h2}>2. How we use your information</h2>
            <p>
              Your information is used solely to respond to enquiries, provide
              sourcing and styling services, communicate updates, and improve
              our offering.
            </p>

            <h2 className={ui.h2}>3. Sharing your information</h2>
            <p>
              We do not sell your personal data. We only share information with
              trusted partners where necessary to deliver services (such as
              logistics or payment processing).
            </p>

            <h2 className={ui.h2}>4. Data security</h2>
            <p>
              We take reasonable steps to protect your information using secure
              systems and trusted providers. However, no online transmission is
              completely secure.
            </p>

            <h2 className={ui.h2}>5. Cookies</h2>
            <p>
              Our website may use cookies or similar technologies to understand
              site usage and improve performance. You can control cookies
              through your browser settings.
            </p>

            <h2 className={ui.h2}>6. Your rights</h2>
            <p>
              You have the right to request access to, correction of, or deletion
              of your personal data. You may also opt out of communications at
              any time.
            </p>

            <h2 className={ui.h2}>7. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy or how your
              data is handled, please contact us at{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="underline underline-offset-4 decoration-black/20 hover:decoration-black/40"
              >
                {supportEmail}
              </a>.
            </p>
          </div>
        </div>
      </section>

{/* FOOTER — your footer */}
<footer className="bg-[#40342F] text-white">
  {/* Main footer */}
  <div className="border-t border-white/10">
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-12">
      {/* Left: logo + signup */}
      <div className="md:col-span-5">
        <Image
          src="/finallogobrown.png"
          alt="Tufffinds"
          width={220}
          height={56}
          quality={100}
          className="h-6 w-auto invert brightness-[1.05] select-none"
        />

        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
          Join for updates, edits, and early access to sourcing drops.
        </p>

        <form
          className="mt-5 flex max-w-md items-center gap-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            placeholder="Your email"
            className="h-10 w-full rounded-full border border-white/20 bg-transparent px-5 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-white/40"
          />
          <button
            type="submit"
            className="h-10 rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#40342F] transition hover:bg-white/90"
          >
            Join
          </button>
        </form>
      </div>

      {/* Right: links */}
      <div className="md:col-span-7 md:col-start-7">
        <div className="grid gap-8 sm:grid-cols-2">
          {/* Support */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Support
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-white/70">
              <li>
                <a
                  href="/version-1#contact"
                  className="transition hover:text-white"
                >
                  Contact
                </a>
              </li>
              <li>
                <a href="/version-1/faq" className="transition hover:text-white">
                  FAQ
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@tufffinds.com"
                  className="transition hover:text-white"
                >
                  Email support
                </a>
              </li>
              <li>
                <a
                  href="/version-1#about"
                  className="transition hover:text-white"
                >
                  About Tufffinds
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="sm:border-l sm:border-white/10 sm:pl-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
              Legal
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-white/70">
              <li>
                <a
                  href="/version-1/privacy-policy"
                  className="transition hover:text-white"
                >
                  Privacy policy
                </a>
              </li>
              <li>
                <a
                  href="/version-1/terms"
                  className="transition hover:text-white"
                >
                  Terms of use
                </a>
              </li>
              <li>
                <a
                  href="/version-1/cookie-policy"
                  className="transition hover:text-white"
                >
                  Cookie policy
                </a>
              </li>
              <li>
                <a
                  href="/version-1/data-security"
                  className="transition hover:text-white"
                >
                  Data &amp; security
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    {/* Bottom bar */}
    <div className="border-t border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-white/50">
        <p>© {new Date().getFullYear()} Tufffinds — All rights reserved</p>
        <p className="hidden sm:block">London · Global sourcing</p>
      </div>
    </div>
  </div>
</footer>

      
    </main>
  );
}
