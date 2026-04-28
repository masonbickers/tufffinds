"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

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

/* ───────────────────────────────────────────
   Scroll reveal — IntersectionObserver
─────────────────────────────────────────── */
function useInViewOnce({ threshold = 0.15, rootMargin = "0px 0px -12% 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}

export default function VersionOnePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const revealClass = (inView) => cx(baseReveal, inView ? shownReveal : hiddenReveal);

  const revealStyle = (inView, ms = 0) =>
    inView ? { transitionDelay: `${ms}ms` } : { transitionDelay: "0ms" };

  const about = useInViewOnce();
  const services = useInViewOnce();
  const process = useInViewOnce();
  const founders = useInViewOnce();
  const contact = useInViewOnce();
  const footer = useInViewOnce({
    threshold: 0.05,
    rootMargin: "0px 0px -6% 0px",
  });

  const heroIn = mounted;
  const heroReveal = revealClass(heroIn);

  const navItems = [
    ["Home", "#home"],
    ["About", "#about"],
    ["Services", "#services"],
    ["Contact", "#contact"],
  ];

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
          <a href="#home" aria-label="Tufffinds home" onClick={() => setMobileMenuOpen(false)}>
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
              href="#contact"
              className="rounded-full border border-[#40342F]/30 px-5 py-2.5 text-[10px] font-semibold tracking-[0.22em] uppercase text-[#40342F] transition hover:border-[#40342F]/60"
            >
              Enquire
            </a>
          </div>

          {/* Mobile burger icon */}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center bg-transparent text-[#40342F]/80 transition active:scale-[0.98] md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="version-one-mobile-menu"
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
            id="version-one-mobile-menu"
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
      <section
        id="home"
        className="relative flex min-h-[100svh] scroll-mt-24 items-center overflow-hidden bg-[#EFE8DE]"
      >
        {/* Premium editorial background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.34)_34%,rgba(239,232,222,0)_68%)]" />
          <div className="absolute bottom-[-24%] left-[-12%] h-[520px] w-[520px] rounded-full bg-[#D8C7B8]/35 blur-[90px]" />
          <div className="absolute right-[-14%] top-[22%] h-[560px] w-[560px] rounded-full bg-[#F8F4ED]/65 blur-[100px]" />
          <div className="absolute left-[8%] top-[16%] h-[300px] w-[300px] rounded-full bg-white/25 blur-[90px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(64,52,47,0.03),rgba(64,52,47,0)_24%,rgba(64,52,47,0.025)_100%)]" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl items-center justify-center px-5 sm:px-6 lg:px-8">
          <div className="max-w-4xl pb-10 pt-20 text-center sm:pb-16 sm:pt-32">
            <p
              className={cx(
                "mx-auto mb-5 max-w-[21rem] text-[10px] leading-[1.7] tracking-[0.16em] uppercase text-black/55 sm:mb-6 sm:max-w-none sm:text-[11px] sm:tracking-[0.3em]",
                heroReveal
              )}
              style={revealStyle(heroIn, 80)}
            >
              Personal Shopping • Wardrobe Edits • Sourcing • Styling
            </p>

            <h1 className={cx(ui.h1, heroReveal)} style={revealStyle(heroIn, 160)}>
              Find the unfindable
              <span className="block text-[#40342F]/80">with the ones connected.</span>
            </h1>

            <p
              className={cx(
                "mx-auto mt-5 max-w-xl text-[15px] leading-[1.75] text-black/65 sm:mt-6 md:text-[16px]",
                heroReveal
              )}
              style={revealStyle(heroIn, 240)}
            >
              A London-based personal shopping studio for rare, sold-out and hard-to-find luxury pieces.
              Send the brief — we source, edit and coordinate the rest.
            </p>

            <div
              className={cx(
                "mt-8 flex flex-col justify-center gap-3 sm:mt-11 sm:flex-row sm:gap-4",
                heroReveal
              )}
              style={revealStyle(heroIn, 320)}
            >
              <a
                href="#contact"
                className="min-h-12 rounded-full bg-[#40342F] px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#40342F]/90 active:scale-[0.99] sm:px-9 sm:tracking-[0.22em]"
              >
                Request sourcing
              </a>

              <a
                href="#services"
                className="min-h-12 rounded-full border border-[#40342F]/15 bg-white/35 px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#40342F]/85 backdrop-blur transition hover:border-[#40342F]/30 active:scale-[0.99] sm:px-9 sm:tracking-[0.22em]"
              >
                View services
              </a>
            </div>

            <div
              className={cx(
                "mt-9 flex flex-col justify-center gap-2 text-[10px] tracking-[0.22em] uppercase text-black/55 sm:mt-12 sm:flex-row sm:gap-10 sm:text-[11px] sm:tracking-[0.28em]",
                heroReveal
              )}
              style={revealStyle(heroIn, 400)}
            >
              <span>London</span>
              <span>Global network</span>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="relative scroll-mt-24 overflow-hidden bg-[#F8F7F3]">
        <SectionDivider />

        <div
          ref={about.ref}
          className={cx(ui.container, ui.sectionY, "relative text-center", revealClass(about.inView))}
        >
          {/* Watermark icon */}
          <div className="pointer-events-none absolute inset-x-0 top-[42%] flex justify-center">
            <div className="relative w-[130px] sm:w-[170px] md:w-[210px] lg:w-[240px]">
              <Image
                src="/icon.png"
                alt=""
                width={380}
                height={380}
                className="h-auto w-full object-contain opacity-[0.15]"
                priority={false}
              />
            </div>
          </div>

          <p
            className={cx("relative z-10 mb-5 text-black/50 sm:mb-6", ui.eyebrow)}
            style={revealStyle(about.inView, 60)}
          >
            About
          </p>

          <h2 className={cx("relative z-10", ui.h2)} style={revealStyle(about.inView, 120)}>
            Quietly high-touch.
            <span className={ui.h2Split}>Precisely curated.</span>
          </h2>

          <div
            className={cx("relative z-10 mx-auto mt-8 max-w-4xl space-y-5 sm:mt-10", ui.body)}
            style={revealStyle(about.inView, 200)}
          >
            <p>
              Tufffinds helps private clients source rare, sold-out and hard-to-find luxury pieces
              without the overwhelm of searching across boutiques, resale platforms and private sellers.
            </p>

            <p>
              From one-off requests to considered wardrobe updates, we edit the options, verify the
              details and coordinate the process with discretion from first message to delivery.
            </p>

            <p className="pt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-black/45 sm:text-[11px] sm:tracking-[0.28em]">
              Rare pieces · Private sourcing · Personal guidance
            </p>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="scroll-mt-24 bg-[#F8F7F3]">
        <SectionDivider />

        <div
          ref={services.ref}
          className={cx(
            "mx-auto grid max-w-7xl grid-cols-1 items-start gap-10 px-5 sm:px-6 md:grid-cols-12 md:gap-16 lg:px-8",
            ui.sectionY,
            revealClass(services.inView)
          )}
        >
          {/* TEXT */}
          <div className="order-1 md:order-1 md:col-span-6">
            <p
              className={cx("mb-5 text-black/50 sm:mb-6", ui.eyebrow)}
              style={revealStyle(services.inView, 60)}
            >
              What We Source
            </p>

            <h2 className={ui.h2} style={revealStyle(services.inView, 120)}>
              Rare pieces.
              <span className={ui.h2Split}>Refined wardrobes.</span>
            </h2>

            <p
              className={cx("mt-5 max-w-xl sm:mt-6", ui.bodyLarge)}
              style={revealStyle(services.inView, 200)}
            >
              From sold-out accessories to event looks and everyday wardrobe gaps, we source with clarity:
              what is worth considering, what to avoid, and where timing or price makes sense.
            </p>

            {/* Mobile image */}
            <div className="mt-9 md:hidden" style={revealStyle(services.inView, 240)}>
              <div className="relative aspect-[4/4.7] overflow-hidden rounded-[28px] bg-[#40342F]/5">
                <Image
                  src="/gina-ginny.jpg"
                  alt="Gina and Ginny — Tufffinds sourcing and personal shopping"
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>
            </div>

            <div className="mt-9 space-y-7 sm:mt-12 sm:space-y-8">
              {[
                {
                  n: "01",
                  h: "Rare & Sold-Out Pieces",
                  p: "Hard-to-find bags, shoes, accessories and ready-to-wear sourced through trusted private, retail and resale channels.",
                },
                {
                  n: "02",
                  h: "Wardrobe & Event Edits",
                  p: "Considered pieces for travel, events, seasonal updates and everyday wardrobes — edited to your style, size and budget.",
                },
                {
                  n: "03",
                  h: "Purchase & Delivery Support",
                  p: "We handle checks, approvals, purchase coordination, shipping updates and follow-through with discretion.",
                },
              ].map((s, idx) => (
                <article
                  key={s.n}
                  className="group border-t border-[#40342F]/10 pt-6 first:border-t-0 first:pt-0"
                  style={revealStyle(services.inView, 300 + idx * 110)}
                >
                  <div className="grid grid-cols-[44px_1fr] gap-5 sm:grid-cols-[56px_1fr] sm:gap-7">
                    <div className={cx("pt-1 text-black/40", ui.eyebrow)}>{s.n}</div>

                    <div className="max-w-md">
                      <div className="flex items-baseline gap-4">
                        <h3 className="font-serif text-[24px] leading-tight tracking-tight text-[#40342F] sm:text-[28px]">
                          {s.h}
                        </h3>
                        <span className="hidden h-px w-10 bg-[#40342F]/10 transition-all duration-300 group-hover:w-16 sm:block" />
                      </div>

                      <p className={cx("mt-3", ui.body)}>{s.p}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* DESKTOP IMAGE */}
          <div
            className="hidden md:order-2 md:col-span-6 md:col-start-7 md:block"
            style={revealStyle(services.inView, 180)}
          >
            <div className="md:sticky md:top-28">
              <div className="relative aspect-[4/5] max-h-[680px] overflow-hidden rounded-[32px] bg-[#40342F]/5">
                <Image
                  src="/gina-ginny.jpg"
                  alt="Gina and Ginny — Tufffinds sourcing and personal shopping"
                  fill
                  className="object-cover"
                  sizes="50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#40342F]/10 pt-4 text-[10px] uppercase tracking-[0.22em] text-black/45">
                <span>Private sourcing</span>
                <span>London</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="scroll-mt-24 bg-[#F8F7F3]">
        <SectionDivider />

        <div
          ref={process.ref}
          className={cx(
            ui.container,
            "py-14 sm:py-20 md:py-20 lg:py-24",
            revealClass(process.inView)
          )}
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 py-10 sm:py-12 md:grid-cols-12 md:gap-16">
            {/* LEFT */}
            <div className="md:col-span-5">
              <p
                className={cx("mb-5 text-black/50 sm:mb-6", ui.eyebrow)}
                style={revealStyle(process.inView, 60)}
              >
                Process
              </p>

              <h2 className={cx(ui.h2, "max-w-xl")} style={revealStyle(process.inView, 120)}>
                From brief to delivery —
                <span className={ui.h2Split}>handled quietly.</span>
              </h2>

              <p
                className={cx("mt-5 max-w-xl sm:mt-6", ui.body)}
                style={revealStyle(process.inView, 190)}
              >
                A simple, considered route from first message to final delivery — with clear updates at each stage.
              </p>
            </div>

            {/* RIGHT */}
            <div className="md:col-span-7">
              <div className="border-t border-[#40342F]/10 md:border-t-0">
                {[
                  {
                    n: "01",
                    h: "Brief",
                    p: "Send the item, size, budget, preferred condition, timeline and any reference images or links.",
                  },
                  {
                    n: "02",
                    h: "Source",
                    p: "We search trusted boutiques, private sellers and fashion contacts for viable options.",
                  },
                  {
                    n: "03",
                    h: "Edit",
                    p: "You receive a refined shortlist with pricing, condition, availability and estimated timing.",
                  },
                  {
                    n: "04",
                    h: "Secure",
                    p: "Once approved, we coordinate purchase, delivery updates and follow-through with discretion.",
                  },
                ].map((s, idx) => (
                  <article
                    key={s.n}
                    className="grid grid-cols-[42px_1fr] gap-5 border-b border-[#40342F]/10 py-6 sm:grid-cols-[56px_1fr] sm:gap-7 sm:py-7"
                    style={revealStyle(process.inView, 260 + idx * 90)}
                  >
                    <div className={cx("pt-1 text-black/40", ui.eyebrow)}>{s.n}</div>

                    <div>
                      <h3 className="font-serif text-[25px] leading-tight tracking-tight text-[#40342F] sm:text-[30px]">
                        {s.h}
                      </h3>

                      <p className={cx("mt-2.5 max-w-xl", ui.body)}>{s.p}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div
                className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                style={revealStyle(process.inView, 640)}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/45">
                  Clear brief · Refined shortlist · Discreet delivery
                </p>

                <a
                  href="#contact"
                  className="min-h-12 rounded-full bg-[#40342F] px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#40342F]/90 active:scale-[0.99] sm:px-9 sm:tracking-[0.22em]"
                >
                  Request sourcing
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDERS */}
      <section id="founders" className="scroll-mt-24 bg-[#F8F7F3]">
        <SectionDivider />

        <div
          ref={founders.ref}
          className={cx(
            "mx-auto grid max-w-7xl grid-cols-1 items-start gap-10 px-5 sm:px-6 md:grid-cols-12 md:gap-16 lg:px-8",
            ui.sectionY,
            revealClass(founders.inView)
          )}
        >
          <div className="md:col-span-6" style={revealStyle(founders.inView, 120)}>
            <div className="md:sticky md:top-24">
              <div className="relative aspect-[4/4.7] max-h-[680px] overflow-hidden rounded-[28px] bg-[#40342F]/5 sm:aspect-[4/5] md:rounded-[32px]">
                <Image
                  src="/tufffinds-shoot.jpg"
                  alt="Gina and Ginevra — founders of Tufffinds"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>

              <div className="mt-5 hidden items-center justify-between border-t border-[#40342F]/10 pt-4 text-[10px] uppercase tracking-[0.22em] text-black/45 md:flex">
                <span>Gina</span>
                <span>Ginevra</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-7" style={revealStyle(founders.inView, 60)}>
            <p className={cx("mb-5 text-black/50 sm:mb-6", ui.eyebrow)}>Founders</p>

            <h2 className={ui.h2}>
              Built on trust.
              <span className={ui.h2Split}>Refined through experience.</span>
            </h2>

            <div className={cx("mt-7 max-w-xl space-y-5 sm:mt-8 sm:space-y-6", ui.body)}>
              <p>
                Founded by Gina and Ginevra, Tufffinds brings together luxury client experience,
                editorial taste and a trusted international sourcing network.
              </p>

              <p>
                Their role is to filter clearly: what is worth considering, what to avoid, and
                where price, condition or timing makes sense.
              </p>

              <p>
                The result is personal shopping that feels calm, discreet and genuinely useful —
                whether you are sourcing one rare piece or refining a wider wardrobe.
              </p>
            </div>

            <div className="mt-8 text-[10px] uppercase tracking-[0.28em] text-black/45 sm:text-[11px] sm:tracking-[0.32em]">
              Gina &nbsp;·&nbsp; Ginevra
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="scroll-mt-24 bg-[#F8F7F3]">
        <SectionDivider />

        <div
          ref={contact.ref}
          className={cx(
            ui.container,
            "py-14 sm:py-20 md:py-20 lg:py-24",
            revealClass(contact.inView)
          )}
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
            {/* LEFT */}
            <div className="md:col-span-5" style={revealStyle(contact.inView, 60)}>
              <p className={cx("mb-5 text-black/50 sm:mb-6", ui.eyebrow)}>Contact</p>

              <h2 className={cx(ui.h2, "max-w-xl")}>
                Send the brief.
                <span className={ui.h2Split}>We’ll handle the rest.</span>
              </h2>

              <div className={cx("mt-6 max-w-xl space-y-5 sm:mt-8", ui.body)}>
                <p>
                  Start with the item, size, budget, preferred condition and timeline. Screenshots,
                  links or references are always helpful.
                </p>

                <p className="text-black/55">
                  For urgent requests, WhatsApp or Instagram is usually fastest.
                </p>
              </div>

              <div
                className="mt-8 space-y-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50 sm:mt-10"
                style={revealStyle(contact.inView, 160)}
              >
                <a
href="https://wa.me/447591207418?text=Hi%20Tufffinds"                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between border-b border-[#40342F]/10 pb-4 transition hover:text-black"
                >
                  <span>WhatsApp</span>
                  <span className="text-black/35">Message us</span>
                </a>

                <a
                  href="https://instagram.com/tufffinds__"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between border-b border-[#40342F]/10 pb-4 transition hover:text-black"
                >
                  <span>Instagram</span>
                  <span className="text-black/35">DM us</span>
                </a>

                <a
                  href="mailto:hello@tufffinds.com?subject=Tufffinds%20Sourcing%20Request&body=Hi%20Tufffinds%2C%0A%0AItem%3A%0ASize%3A%0ABudget%20range%3A%0ATimeline%3A%0ALinks%2FRefs%3A%0A%0AThank%20you!"
                  className="flex items-center justify-between border-b border-[#40342F]/10 pb-4 transition hover:text-black"
                >
                  <span>Email</span>
                  <span className="text-black/35">info@tufffinds.com</span>
                </a>
              </div>
            </div>

            {/* RIGHT */}
            <div className="md:col-span-6 md:col-start-7" style={revealStyle(contact.inView, 120)}>
              <div className="mx-auto w-full max-w-xl md:pt-12">
                <div className={cx("mb-7 text-black/50", ui.eyebrow)}>Send a brief</div>

                <form onSubmit={(e) => e.preventDefault()} className="space-y-7">
                  <div>
                    <label className={cx("mb-2 block text-black/45", ui.eyebrow)}>Name</label>
                    <input
                      type="text"
                      placeholder="Your name"
                      className="w-full border-b border-[#40342F]/20 bg-transparent py-3 text-[16px] text-black/80 outline-none transition placeholder:text-black/30 focus:border-[#40342F]/50"
                    />
                  </div>

                  <div>
                    <label className={cx("mb-2 block text-black/45", ui.eyebrow)}>Email</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      className="w-full border-b border-[#40342F]/20 bg-transparent py-3 text-[16px] text-black/80 outline-none transition placeholder:text-black/30 focus:border-[#40342F]/50"
                    />
                  </div>

                  <div>
                    <label className={cx("mb-2 block text-black/45", ui.eyebrow)}>
                      What are you looking for?
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Item, size, budget range, timeline, and any links or references…"
                      className="w-full resize-none border-b border-[#40342F]/20 bg-transparent py-3 text-[16px] text-black/80 outline-none transition placeholder:text-black/30 focus:border-[#40342F]/50"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="min-h-12 w-full rounded-full bg-[#40342F] px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white transition hover:bg-[#40342F]/90 active:scale-[0.99]"
                    >
                      Submit request
                    </button>

                    <p className="mt-4 text-center text-[10px] leading-relaxed tracking-[0.14em] text-black/40 sm:text-[11px] sm:tracking-[0.16em]">
                      By submitting, you agree to be contacted about your enquiry.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer ref={footer.ref} className={cx("bg-[#40342F] text-white", revealClass(footer.inView))}>
        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-6 md:grid-cols-12 lg:px-8">
            <div className="md:col-span-5" style={revealStyle(footer.inView, 80)}>
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

            <div className="md:col-span-7 md:col-start-7" style={revealStyle(footer.inView, 140)}>
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                    Support
                  </div>

                  <ul className="mt-4 space-y-2.5 text-sm text-white/70">
                    <li>
                      <a href="/version-1#contact" className="transition hover:text-white">
                        Contact
                      </a>
                    </li>
                    <li>
                      <a href="/version-1/faq" className="transition hover:text-white">
                        FAQ
                      </a>
                    </li>
                    <li>
                      <a href="mailto:hello@tufffinds.com" className="transition hover:text-white">
                        Email support
                      </a>
                    </li>
                    <li>
                      <a href="/version-1#about" className="transition hover:text-white">
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
                      <a href="/version-1/privacy-policy" className="transition hover:text-white">
                        Privacy policy
                      </a>
                    </li>
                    <li>
                      <a href="/version-1/terms" className="transition hover:text-white">
                        Terms of use
                      </a>
                    </li>
                    <li>
                      <a href="/version-1/cookie-policy" className="transition hover:text-white">
                        Cookie policy
                      </a>
                    </li>
                    <li>
                      <a href="/version-1/data-security" className="transition hover:text-white">
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