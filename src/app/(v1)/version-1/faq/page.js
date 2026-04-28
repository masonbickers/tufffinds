// src/app/faq/page.js
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function SectionDivider() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
      <div className="h-px w-full bg-[#40342F]/10" />
    </div>
  );
}

export default function FAQPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);

    onScroll();
    setMounted(true);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const { style } = document.body;
    const previousOverflow = style.overflow;
    const previousPaddingRight = style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      style.overflow = previousOverflow;
      style.paddingRight = previousPaddingRight;
    };
  }, [mobileMenuOpen]);

  const ui = useMemo(
    () => ({
      container: "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8",
      sectionY: "py-14 sm:py-20 md:py-24 lg:py-28",
      eyebrow:
        "text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px] sm:tracking-[0.28em]",
      body: "text-[15px] leading-[1.75] text-black/65 sm:text-[16px]",
      bodyLarge: "text-[15px] leading-[1.75] text-black/65 sm:text-[16px]",
      h1:
        "font-serif text-[clamp(36px,9vw,48px)] leading-[1.05] tracking-tight text-[#40342F] sm:text-5xl md:text-6xl lg:text-[76px]",
      h2:
        "font-serif italic text-[clamp(30px,8.5vw,36px)] leading-[1.1] tracking-tight text-[#40342F] sm:text-4xl md:text-5xl lg:text-[56px]",
      h2Split: "block not-italic text-[#40342F]/75",
    }),
    []
  );

  const baseReveal = "transition-all duration-1000 ease-out will-change-transform";
  const hiddenReveal = "opacity-0 translate-y-4 blur-sm";
  const shownReveal = "opacity-100 translate-y-0 blur-0";

  const revealClass = mounted ? shownReveal : hiddenReveal;

  const revealStyle = (ms = 0) =>
    mounted ? { transitionDelay: `${ms}ms` } : { transitionDelay: "0ms" };

  const navItems = [
    ["Home", "/#home"],
    ["About", "/#about"],
    ["Services", "/#services"],
    ["Contact", "/#contact"],
  ];

  const faqs = useMemo(
    () => [
      {
        group: "Getting started",
        items: [
          {
            q: "How does Tufffinds work?",
            a: "You send a brief with the item, size, budget range, deadline and references. We source options through our network and return a tight shortlist. Once you approve, we help coordinate purchase and delivery.",
          },
          {
            q: "What should I include in my brief?",
            a: "Include sizes, colour preferences, budget range, deadline, location and any links or screenshots. If you’re unsure, tell us the overall direction and we’ll guide the rest.",
          },
          {
            q: "Do you only source luxury items?",
            a: "Our focus is premium, luxury and hard-to-find pieces, but we’ll always work from the brief. If a request is not the right fit, we’ll let you know quickly.",
          },
        ],
      },
      {
        group: "Sourcing & authenticity",
        items: [
          {
            q: "Can you source sold-out or rare items?",
            a: "Yes. We use trusted sources and relationships to surface pieces that rarely reach the open market. Availability is never guaranteed, but we’ll always be transparent.",
          },
          {
            q: "How do you handle authenticity?",
            a: "We prioritise vetted sources, receipts and traceability where possible. If you would like third-party authentication, we can advise on suitable options before purchase.",
          },
          {
            q: "Can you source internationally?",
            a: "Yes. We source globally and coordinate delivery depending on the item and destination. Duties or taxes may apply and will be discussed where relevant.",
          },
        ],
      },
      {
        group: "Pricing, payments & fees",
        items: [
          {
            q: "How much does it cost to use your service?",
            a: "It depends on the request. We’ll confirm any service fees and item pricing before you commit. Nothing is purchased without your approval.",
          },
          {
            q: "Do you charge a deposit?",
            a: "For certain high-demand requests, we may request a deposit or service fee to begin sourcing. If so, this will be confirmed upfront.",
          },
          {
            q: "Are duties and taxes included?",
            a: "If items ship internationally, duties and taxes may apply depending on destination and carrier handling. We’ll flag this early and help you understand what to expect.",
          },
        ],
      },
      {
        group: "Delivery & timelines",
        items: [
          {
            q: "How long does sourcing take?",
            a: "Some briefs can be answered the same day, while others take longer depending on rarity and timeline. We’ll give you a realistic expectation after reviewing your request.",
          },
          {
            q: "Do you offer urgent sourcing?",
            a: "Yes. If you have a deadline, tell us in the brief. We’ll prioritise accordingly and be honest about what is possible.",
          },
          {
            q: "Can you ship directly to me?",
            a: "Often, yes. In some cases, items may route via us for checks or coordination. We’ll choose the cleanest route for the brief.",
          },
        ],
      },
      {
        group: "Returns & cancellations",
        items: [
          {
            q: "Can I return items?",
            a: "Returns depend on the seller, source and item type. We’ll clarify the return position before purchase where possible, but rare or sold-out pieces are often final sale.",
          },
          {
            q: "What if I change my mind after approving?",
            a: "If an order has not been placed, we can stop. If it has already been placed, cancellation depends on the seller’s terms and may not be possible.",
          },
          {
            q: "What if something arrives damaged?",
            a: "Tell us immediately. We’ll support the claim process with the courier or source where applicable. If insurance was added, that will help.",
          },
        ],
      },
    ],
    []
  );

  return (
    <main className="min-h-[100svh] overflow-x-hidden bg-[#F8F7F3] text-[#121212] antialiased">
      {/* HEADER */}
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
          scrolled || mobileMenuOpen ? "bg-[#F8F7F3] shadow-sm" : "bg-transparent"
        )}
      >
        <div
          className={cx(
            "mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8",
            scrolled || mobileMenuOpen ? "border-b border-[#40342F]/10" : ""
          )}
        >
          <a href="/#home" aria-label="Tufffinds home" onClick={() => setMobileMenuOpen(false)}>
            <Image
              src="/finallogobrown.png"
              alt="Tufffinds"
              width={220}
              height={56}
              priority
              className="h-5 w-auto select-none sm:h-6"
            />
          </a>

          <div className="hidden items-center gap-6 md:flex">
            <nav className="flex items-center gap-6 text-[11px] tracking-[0.26em] uppercase text-black/70">
              {navItems.map(([label, href]) => (
                <a key={href} href={href} className="transition hover:text-black">
                  {label}
                </a>
              ))}
            </nav>

            <a
              href="/#contact"
              className="rounded-full border border-[#40342F]/30 px-5 py-2.5 text-[10px] font-semibold tracking-[0.22em] uppercase text-[#40342F] transition hover:border-[#40342F]/60"
            >
              Enquire
            </a>
          </div>

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center bg-transparent text-[#40342F]/80 transition active:scale-[0.98] md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="faq-mobile-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span className="relative block h-5 w-5">
              <span
                className={cx(
                  "absolute left-0 top-[6px] h-px w-5 bg-[#40342F]/85 transition-all duration-300",
                  mobileMenuOpen ? "top-1/2 -translate-y-1/2 rotate-45" : ""
                )}
              />
              <span
                className={cx(
                  "absolute left-0 top-[13px] h-px w-5 bg-[#40342F]/85 transition-all duration-300",
                  mobileMenuOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : ""
                )}
              />
            </span>
          </button>
        </div>

        {/* MOBILE MENU */}
        <div
          className={cx(
            "fixed left-5 right-5 top-[78px] z-[110] mx-auto max-w-[390px] transition-all duration-300 md:hidden",
            mobileMenuOpen
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-4 opacity-0"
          )}
        >
          <nav
            id="faq-mobile-menu"
            className="overflow-hidden rounded-[24px] border border-[#40342F]/10 bg-[#F8F7F3] p-3 shadow-[0_24px_70px_rgba(64,52,47,0.12)]"
          >
            {navItems.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="block rounded-xl px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-black/70 transition hover:bg-[#40342F]/[0.04]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative flex min-h-[72svh] items-center overflow-hidden bg-[#EFE8DE] pt-20 sm:min-h-[78svh]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.34)_34%,rgba(239,232,222,0)_68%)]" />
          <div className="absolute bottom-[-24%] left-[-12%] h-[520px] w-[520px] rounded-full bg-[#D8C7B8]/35 blur-[90px]" />
          <div className="absolute right-[-14%] top-[22%] h-[560px] w-[560px] rounded-full bg-[#F8F4ED]/65 blur-[100px]" />
          <div className="absolute left-[8%] top-[16%] h-[300px] w-[300px] rounded-full bg-white/25 blur-[90px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(64,52,47,0.03),rgba(64,52,47,0)_24%,rgba(64,52,47,0.025)_100%)]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-center px-5 py-16 text-center sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <p
              className={cx(
                "mx-auto mb-5 max-w-[21rem] text-[10px] leading-[1.7] tracking-[0.16em] uppercase text-black/55 sm:mb-6 sm:max-w-none sm:text-[11px] sm:tracking-[0.3em]",
                baseReveal,
                revealClass
              )}
              style={revealStyle(80)}
            >
              Support • FAQs
            </p>

            <h1 className={cx(ui.h1, baseReveal, revealClass)} style={revealStyle(160)}>
              Questions, answered
              <span className="block text-[#40342F]/80">calmly and clearly.</span>
            </h1>

            <p
              className={cx(
                "mx-auto mt-5 max-w-2xl text-[15px] leading-[1.75] text-black/65 sm:mt-6 md:text-[16px]",
                baseReveal,
                revealClass
              )}
              style={revealStyle(240)}
            >
              Everything you need to know about our sourcing process, authenticity, timelines and logistics.
              If you don’t see your question, message us and we’ll reply personally.
            </p>

            <div
              className={cx(
                "mt-8 flex flex-col justify-center gap-3 sm:mt-11 sm:flex-row sm:gap-4",
                baseReveal,
                revealClass
              )}
              style={revealStyle(320)}
            >
              <a
                href="/#contact"
                className="min-h-12 rounded-full bg-[#40342F] px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#40342F]/90 active:scale-[0.99] sm:px-9 sm:tracking-[0.22em]"
              >
                Ask a question
              </a>

              <a
                href="mailto:hello@tufffinds.com"
                className="min-h-12 rounded-full border border-[#40342F]/15 bg-white/35 px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#40342F]/85 backdrop-blur transition hover:border-[#40342F]/30 active:scale-[0.99] sm:px-9 sm:tracking-[0.22em]"
              >
                Email support
              </a>
            </div>

            <div
              className={cx(
                "mt-9 flex flex-col justify-center gap-2 text-[10px] tracking-[0.22em] uppercase text-black/55 sm:mt-12 sm:flex-row sm:gap-10 sm:text-[11px] sm:tracking-[0.28em]",
                baseReveal,
                revealClass
              )}
              style={revealStyle(400)}
            >
              <span>London</span>
              <span>Global network</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ LIST */}
      <section className="bg-[#F8F7F3]">
        <SectionDivider />

        <div className={cx(ui.container, "py-14 sm:py-20 md:py-24")}>
          <div className="mx-auto max-w-4xl">
            {faqs.map((group, groupIndex) => (
              <div key={group.group} className={groupIndex === 0 ? "" : "mt-14 sm:mt-16"}>
                <div className="flex items-center gap-6">
                  <p className={cx(ui.eyebrow, "shrink-0 text-black/50")}>{group.group}</p>
                  <div className="h-px flex-1 bg-[#40342F]/10" />
                </div>

                <div className="mt-6 divide-y divide-[#40342F]/10">
                  {group.items.map((item, itemIndex) => {
                    const flatIndex =
                      faqs.slice(0, groupIndex).reduce((acc, current) => acc + current.items.length, 0) +
                      itemIndex;

                    const isOpen = openIndex === flatIndex;

                    return (
                      <article key={item.q} className="py-6">
                        <button
                          type="button"
                          onClick={() => setOpenIndex((current) => (current === flatIndex ? -1 : flatIndex))}
                          className="group flex w-full items-start justify-between gap-6 text-left"
                          aria-expanded={isOpen}
                        >
                          <div className="pr-2">
                            <h3 className="font-serif text-[24px] leading-tight tracking-tight text-[#40342F] sm:text-[28px]">
                              {item.q}
                            </h3>

                            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/35">
                              Tap to {isOpen ? "close" : "open"}
                            </p>
                          </div>

                          <div
                            className={cx(
                              "mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#40342F]/15 bg-white/35 backdrop-blur transition",
                              isOpen ? "rotate-45 border-[#40342F]/30" : "group-hover:border-[#40342F]/30"
                            )}
                            aria-hidden="true"
                          >
                            <span className="relative block h-[14px] w-[14px]">
                              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#40342F]/65" />
                              <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#40342F]/65" />
                            </span>
                          </div>
                        </button>

                        <div
                          className={cx(
                            "grid overflow-hidden transition-[grid-template-rows,opacity] duration-500 ease-out",
                            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          )}
                        >
                          <div className="min-h-0">
                            <p className={cx("mt-4 max-w-3xl", ui.body)}>{item.a}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="bg-[#F8F7F3]">
        <SectionDivider />

        <div className={cx(ui.container, "py-14 text-center sm:py-20 md:py-24")}>
          <div className="mx-auto max-w-3xl">
            <p className={cx("mb-5 text-black/50 sm:mb-6", ui.eyebrow)}>Still unsure?</p>

            <h2 className={ui.h2}>
              Send your brief.
              <span className={ui.h2Split}>We’ll reply personally.</span>
            </h2>

            <p className={cx("mx-auto mt-6 max-w-2xl", ui.body)}>
              Share the item, size, budget range and timeline. We’ll confirm next steps and let you know
              what is possible.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <a
                href="/#contact"
                className="min-h-12 rounded-full bg-[#40342F] px-9 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-[#40342F]/90 active:scale-[0.99]"
              >
                Message us
              </a>

              <a
                href="mailto:hello@tufffinds.com"
                className="min-h-12 rounded-full border border-[#40342F]/15 bg-white/35 px-9 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#40342F]/85 backdrop-blur transition hover:border-[#40342F]/30 active:scale-[0.99]"
              >
                Email support
              </a>
            </div>

            <div className="mt-10 text-[10px] uppercase tracking-[0.24em] text-black/45 sm:text-[11px] sm:tracking-[0.28em]">
              London · Global sourcing
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#40342F] text-white">
        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-6 md:grid-cols-12 lg:px-8">
            <div className="md:col-span-5">
              <Image
                src="/finallogobrown.png"
                alt="Tufffinds"
                width={220}
                height={56}
                className="h-6 w-auto select-none invert brightness-[1.05]"
              />

              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
                Join for updates, edits, and early access to sourcing drops.
              </p>

              <form
                className="mt-5 flex max-w-md flex-col gap-3 sm:flex-row sm:items-center"
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="Your email"
                  className="h-11 w-full rounded-full border border-white/20 bg-transparent px-5 text-[16px] text-white outline-none transition placeholder:text-white/45 focus:border-white/40 sm:h-10 sm:text-sm"
                />

                <button
                  type="submit"
                  className="h-11 rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#40342F] transition hover:bg-white/90 active:scale-[0.99] sm:h-10"
                >
                  Join
                </button>
              </form>
            </div>

            <div className="md:col-span-7 md:col-start-7">
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                    Support
                  </div>

                  <ul className="mt-4 space-y-2.5 text-sm text-white/70">
                    <li>
                      <a href="/#contact" className="transition hover:text-white">
                        Contact
                      </a>
                    </li>
                    <li>
                      <a href="/faq" className="transition hover:text-white">
                        FAQ
                      </a>
                    </li>
                    <li>
                      <a href="mailto:hello@tufffinds.com" className="transition hover:text-white">
                        Email support
                      </a>
                    </li>
                    <li>
                      <a href="/#about" className="transition hover:text-white">
                        About Tufffinds
                      </a>
                    </li>
                  </ul>
                </div>

                <div className="sm:border-l sm:border-white/10 sm:pl-10">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                    Legal
                  </div>

                  <ul className="mt-4 space-y-2.5 text-sm text-white/70">
                    <li>
                      <a href="/privacy-policy" className="transition hover:text-white">
                        Privacy policy
                      </a>
                    </li>
                    <li>
                      <a href="/terms" className="transition hover:text-white">
                        Terms of use
                      </a>
                    </li>
                    <li>
                      <a href="/cookie-policy" className="transition hover:text-white">
                        Cookie policy
                      </a>
                    </li>
                    <li>
                      <a href="/data-security" className="transition hover:text-white">
                        Data &amp; security
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-4 text-[10px] uppercase tracking-[0.2em] text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
              <p>© {new Date().getFullYear()} Tufffinds — All rights reserved</p>
              <p className="hidden sm:block">London · Global sourcing</p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}