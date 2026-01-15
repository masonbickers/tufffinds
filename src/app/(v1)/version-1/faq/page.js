// src/app/faq/page.js
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export default function FAQPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // simple open/close state (no extra libs)
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    setMounted(true);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ui = useMemo(
    () => ({
      container: "mx-auto max-w-7xl px-6",
      sectionY: "py-20 md:py-24",
      eyebrow: "text-[11px] tracking-[0.36em] uppercase",
      body: "text-[15px] leading-relaxed md:text-[16px]",
      h1: "font-serif text-4xl leading-[1.05] md:text-6xl",
      h2: "font-serif italic text-4xl leading-[1.08] tracking-tight md:text-5xl",
      h2Split: "block not-italic text-black/70",
    }),
    []
  );

  const baseReveal = "transition-all duration-1000 ease-out";
  const reveal = mounted
    ? "opacity-100 translate-y-0 blur-0"
    : "opacity-0 translate-y-3 blur-[2px]";
  const delay = (ms) => (mounted ? `delay-[${ms}ms]` : "");

  const faqs = useMemo(
    () => [
      {
        group: "Getting started",
        items: [
          {
            q: "How does Tufffinds work?",
            a: (
              <>
                You send a brief (item, size, budget range, deadline, and references). We source options through our
                network and return a tight shortlist. Once you approve, we help coordinate purchase and delivery.
              </>
            ),
          },
          {
            q: "What should I include in my brief?",
            a: (
              <>
                Include: size(s), colour preferences, budget range, deadline, location, and any links/screenshots.
                If you’re unsure, tell us the vibe and we’ll guide the rest.
              </>
            ),
          },
          {
            q: "Do you only source luxury items?",
            a: (
              <>
                Our focus is premium/luxury and hard-to-find pieces, but we’ll always work within your brief. If the
                request isn’t a fit, we’ll tell you quickly.
              </>
            ),
          },
        ],
      },
      {
        group: "Sourcing & authenticity",
        items: [
          {
            q: "Can you source sold-out or rare items?",
            a: (
              <>
                Yes — that’s the point. We use trusted sources and relationships to surface pieces that rarely reach
                the open market. Availability is never guaranteed, but we’ll be transparent.
              </>
            ),
          },
          {
            q: "How do you handle authenticity?",
            a: (
              <>
                We prioritise vetted sources and receipts/traceability where possible. If you want third-party
                authentication, we can advise on options before purchase.
              </>
            ),
          },
          {
            q: "Can you source internationally?",
            a: (
              <>
                Yes. We source globally and coordinate delivery depending on the item and location. Duties/taxes may
                apply and will be discussed where relevant.
              </>
            ),
          },
        ],
      },
      {
        group: "Pricing, payments & fees",
        items: [
          {
            q: "How much does it cost to use your service?",
            a: (
              <>
                It depends on the request. We’ll confirm any service fees (if applicable) and item pricing before you
                commit. Nothing is purchased without your approval.
              </>
            ),
          },
          {
            q: "Do you charge a deposit?",
            a: (
              <>
                For certain high-demand requests, we may request a deposit or service fee to begin sourcing. We’ll
                confirm this upfront.
              </>
            ),
          },
          {
            q: "Are duties and taxes included?",
            a: (
              <>
                If items ship internationally, duties/taxes may apply depending on destination and carrier handling.
                We’ll flag this early and help you understand what to expect.
              </>
            ),
          },
        ],
      },
      {
        group: "Delivery & timelines",
        items: [
          {
            q: "How long does sourcing take?",
            a: (
              <>
                Some briefs can be answered same-day, others take longer depending on rarity and timeline. We’ll give
                you a realistic expectation after reviewing your request.
              </>
            ),
          },
          {
            q: "Do you offer urgent sourcing?",
            a: (
              <>
                Yes — if you have a deadline, tell us. We’ll prioritise accordingly and be honest about what’s
                possible.
              </>
            ),
          },
          {
            q: "Can you ship directly to me?",
            a: (
              <>
                Often yes. In some cases, items route via us for checks/coordination. We’ll choose the cleanest path
                for the brief.
              </>
            ),
          },
        ],
      },
      {
        group: "Returns & cancellations",
        items: [
          {
            q: "Can I return items?",
            a: (
              <>
                Returns depend on the seller/source and item type. We’ll clarify the return position before purchase
                where possible, but rare/sold-out items are often final sale.
              </>
            ),
          },
          {
            q: "What if I change my mind after approving?",
            a: (
              <>
                If an order hasn’t been placed yet, we can stop. If it has been placed, cancellation depends on the
                seller’s terms and may not be possible.
              </>
            ),
          },
          {
            q: "What if something arrives damaged?",
            a: (
              <>
                Tell us immediately. We’ll support the claim process with the courier/source where applicable. If
                insurance was added, that will help.
              </>
            ),
          },
        ],
      },
    ],
    []
  );

  // Flatten for search + rendering, keep group headers
  const allItems = useMemo(() => faqs, [faqs]);

  const brand = "Tufffinds";

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
              <a href="/#home" className="transition hover:text-black">
                Home
              </a>
              <a href="/#about" className="transition hover:text-black">
                About
              </a>
              <a href="/#services" className="transition hover:text-black">
                Services
              </a>
              <a href="/#contact" className="transition hover:text-black">
                Contact
              </a>
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

      {/* HERO (text-only) */}
      <section className="pt-32">
        <div className={[ui.container, ui.sectionY, "pt-10 md:pt-14"].join(" ")}>
          <div className="mx-auto max-w-3xl text-center">
            <p
              className={[
                "mb-6 text-[11px] tracking-[0.34em] uppercase text-black/55",
                baseReveal,
                reveal,
                delay(80),
              ].join(" ")}
            >
              Support • FAQs
            </p>

            <h1 className={[ui.h1, baseReveal, reveal, delay(160)].join(" ")}>
              Questions, answered —
              <span className="block text-black/80">calmly and clearly.</span>
            </h1>

            <p
              className={[
                "mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-black/65 md:text-[16px]",
                baseReveal,
                reveal,
                delay(240),
              ].join(" ")}
            >
              Everything you need to know about our sourcing process, authenticity, timelines and logistics.
              If you don’t see your question, message us and we’ll respond personally.
            </p>

            <div
              className={[
                "mt-10 flex flex-wrap justify-center gap-4",
                baseReveal,
                reveal,
                delay(320),
              ].join(" ")}
            >
              <a
                href="/#contact"
                className="rounded-full bg-black px-9 py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-black/85"
              >
                Ask a question
              </a>

              <a
                href="mailto:hello@tufffinds.com"
                className="rounded-full border border-black/20 bg-white/40 px-9 py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/85 backdrop-blur transition hover:border-black/40"
              >
                Email support
              </a>
            </div>

            <div
              className={[
                "mt-12 flex justify-center gap-10 text-[11px] tracking-[0.28em] uppercase text-black/55",
                baseReveal,
                reveal,
                delay(400),
              ].join(" ")}
            >
              <span>London</span>
              <span>Global network</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ LIST */}
      <section className="bg-[#F8F7F3]">
        <div className={[ui.container, "pb-24 md:pb-28"].join(" ")}>
          <div className="mx-auto max-w-4xl">
            {allItems.map((g, gi) => (
              <div key={g.group} className={gi === 0 ? "" : "mt-14"}>
                <div className="flex items-center justify-between gap-6">
                  <p className={[ui.eyebrow, "text-black/50"].join(" ")}>
                    {g.group}
                  </p>
                  <div className="h-px flex-1 bg-black/10" />
                </div>

                <div className="mt-6 divide-y divide-black/10">
                  {g.items.map((item, idx) => {
                    // create a stable index across groups
                    const flatIndex =
                      allItems
                        .slice(0, gi)
                        .reduce((acc, gg) => acc + gg.items.length, 0) + idx;

                    const isOpen = openIndex === flatIndex;

                    return (
                      <div key={item.q} className="py-6">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenIndex((cur) => (cur === flatIndex ? -1 : flatIndex))
                          }
                          className="group flex w-full items-start justify-between gap-6 text-left"
                          aria-expanded={isOpen}
                        >
                          <div className="pr-6">
                            <h3 className="text-[18px] font-semibold tracking-tight text-black">
                              {item.q}
                            </h3>
                            <p className="mt-2 text-[13px] uppercase tracking-[0.22em] text-black/45">
                              Tap to {isOpen ? "close" : "open"}
                            </p>
                          </div>

                          <div
                            className={[
                              "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white/40 backdrop-blur transition",
                              isOpen ? "rotate-45 border-black/30" : "group-hover:border-black/30",
                            ].join(" ")}
                            aria-hidden="true"
                          >
                            <span className="relative block h-[14px] w-[14px]">
                              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/60" />
                              <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-black/60" />
                            </span>
                          </div>
                        </button>

                        <div
                          className={[
                            "grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-out",
                            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                          ].join(" ")}
                        >
                          <div className="min-h-0">
                            <div className={["mt-4 max-w-3xl", ui.body, "text-black/65"].join(" ")}>
                              {item.a}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bottom CTA */}
            <div className="mt-20 text-center">
              <p className={[ui.eyebrow, "text-black/50"].join(" ")}>Still unsure?</p>
              <h2 className={["mt-5", ui.h2].join(" ")}>
                Send your brief —
                <span className={ui.h2Split}>we’ll reply personally.</span>
              </h2>
              <p className={["mx-auto mt-6 max-w-2xl", ui.body, "text-black/65"].join(" ")}>
                If you’re ready to start, share item details, size, budget range and timeline. We’ll confirm next
                steps and begin sourcing.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <a
                  href="/#contact"
                  className="rounded-full bg-black px-10 py-3.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white transition hover:bg-black/85"
                >
                  Message us
                </a>
                <a
                  href="mailto:hello@tufffinds.com"
                  className="rounded-full border border-black/20 bg-white/40 px-10 py-3.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/85 backdrop-blur transition hover:border-black/40"
                >
                  Email support
                </a>
              </div>

              <div className="mt-12 text-[11px] tracking-[0.28em] uppercase text-black/55">
                London · Global sourcing
              </div>
            </div>
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
