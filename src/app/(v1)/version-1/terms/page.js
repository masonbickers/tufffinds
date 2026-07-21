"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NewsletterForm from "../_components/NewsletterForm";

export default function TermsOfUsePage() {
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
  const supportEmail = "info@tufffinds.com";

  return (
    <main className="min-h-screen bg-[#F8F7F3] text-[#121212]">
      {/* HEADER — same as homepage */}
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
              <Link href="/" className="transition hover:text-black">Home</Link>
              <Link href="/#about" className="transition hover:text-black">About</Link>
              <Link href="/#services" className="transition hover:text-black">Services</Link>
              <Link href="/#contact" className="transition hover:text-black">Contact</Link>
            </nav>

            <Link
              href="/#contact"
              className="rounded-full border border-black/30 px-5 py-2.5 text-[10px] font-semibold tracking-[0.22em] uppercase text-black/90 transition hover:border-black"
            >
              Enquire
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <section className={`${ui.sectionY} pt-36`}>
        <div className={ui.container}>
          <p className={ui.eyebrow}>Legal</p>

          <h1 className={`${ui.h1} mt-6`}>
            Terms of Use
          </h1>

          <p className="mt-6 text-sm text-black/50">
            Last updated: 12 January 2026
          </p>

          <div className={ui.divider} />

          <div className={`space-y-8 ${ui.body}`}>
            <p>
              These Terms of Use govern your access to and use of the{" "}
              <strong>{brand}</strong> website and services. By using this site,
              you agree to these terms. If you do not agree, please do not use
              our website.
            </p>

            <h2 className={ui.h2}>1. About us</h2>
            <p>
              {brand} is a personal shopping and sourcing service providing
              discretionary sourcing, styling, and coordination services.
              Information on this website is provided for general guidance only.
            </p>

            <h2 className={ui.h2}>2. Use of the website</h2>
            <p>
              You agree to use this website for lawful purposes only. You must
              not misuse the site, attempt unauthorised access, or interfere
              with its operation.
            </p>

            <h2 className={ui.h2}>3. Services & availability</h2>
            <p>
              All services are subject to availability. We do not guarantee the
              sourcing of any specific item. Any timelines, pricing, or
              availability shared are indicative only unless confirmed in
              writing.
            </p>

            <h2 className={ui.h2}>4. Pricing & payments</h2>
            <p>
              Pricing for sourced items or services will be confirmed directly
              with you before any commitment is made. Payments, where
              applicable, are handled securely through agreed payment methods.
            </p>

            <h2 className={ui.h2}>5. Intellectual property</h2>
            <p>
              All content on this website, including text, imagery, branding,
              and design, is owned by or licensed to {brand}. You may not copy,
              reproduce, or use any content without prior written consent.
            </p>

            <h2 className={ui.h2}>6. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, {brand} shall not be
              liable for any loss or damage arising from use of this website or
              reliance on information provided, except where required by law.
            </p>

            <h2 className={ui.h2}>7. External links</h2>
            <p>
              This website may contain links to third-party websites. We are not
              responsible for the content, availability, or privacy practices
              of those sites.
            </p>

            <h2 className={ui.h2}>8. Changes to these terms</h2>
            <p>
              We may update these Terms of Use from time to time. Continued use
              of the website after changes are posted constitutes acceptance of
              the updated terms.
            </p>

            <h2 className={ui.h2}>9. Governing law</h2>
            <p>
              These Terms of Use are governed by and construed in accordance
              with the laws of England and Wales.
            </p>

            <h2 className={ui.h2}>10. Contact</h2>
            <p>
              If you have any questions regarding these Terms of Use, please
              contact us at{" "}
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
          priority
          className="h-6 w-auto select-none [filter:brightness(0)_saturate(100%)_invert(92%)_sepia(12%)_saturate(243%)_hue-rotate(337deg)_brightness(106%)_contrast(90%)]"
        />

        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
          Join for updates, edits, and early access to sourcing drops.
        </p>

        <NewsletterForm compact page="/terms" />
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
                <Link
                  href="/#contact"
                  className="transition hover:text-white"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@tufffinds.com"
                  className="transition hover:text-white"
                >
                  Email support
                </a>
              </li>
              <li>
                <Link
                  href="/#about"
                  className="transition hover:text-white"
                >
                  About Tufffinds
                </Link>
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
                <Link
                  href="/privacy"
                  className="transition hover:text-white"
                >
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="transition hover:text-white"
                >
                  Terms of use
                </Link>
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
