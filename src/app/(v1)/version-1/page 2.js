"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

/* ───────────────────────────────────────────
   Helpers
─────────────────────────────────────────── */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function useInViewOnce({
  threshold = 0.15,
  rootMargin = "0px 0px -12% 0px",
} = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, inView };
}

const SERVICE_ITEMS = [
  {
    n: "01",
    h: "Sourcing",
    p: "Rare, sold-out, and hard-to-find pieces through our global network — vetted and aligned to your brief.",
  },
  {
    n: "02",
    h: "Styling & Edits",
    p: "Wardrobe refinement, travel capsules, and event looks — considered, wearable, and personal.",
  },
  {
    n: "03",
    h: "Coordination",
    p: "Support from shortlist to delivery — guidance, approvals, and logistics handled with discretion.",
  },
];

const APPROACH_ITEMS = [
  {
    h: "Discovery",
    p: "Every brief begins with understanding — not assumptions. We define what works for your lifestyle, not just what’s available.",
    icon: "/SUNGLASSES.png",
  },
  {
    h: "Access",
    p: "Through long-standing relationships and trusted sources, we surface pieces that rarely reach the open market — quietly and efficiently.",
    icon: "/CHANEL.png",
  },
  {
    h: "Direction",
    p: "Edits are refined, shortlists remain tight, and decisions feel clear. Nothing excessive, nothing unnecessary.",
    icon: "/GOYARD.png",
  },
];

const PROCESS_ITEMS = [
  {
    n: "01",
    h: "Brief",
    p: "Tell us what you’re looking for — size, budget range, timeline, and any references.",
  },
  {
    n: "02",
    h: "Source",
    p: "We tap our network and pull options that match your taste and requirements.",
  },
  {
    n: "03",
    h: "Shortlist",
    p: "You receive a tight edit — no overwhelm, only viable pieces worth considering.",
  },
  {
    n: "04",
    h: "Secure",
    p: "We guide approval and purchasing, keeping the process clean and discreet.",
  },
  {
    n: "05",
    h: "Deliver",
    p: "We coordinate next steps and delivery support, with care at every stage.",
  },
];

const CONTACT_CARDS = [
  {
    label: "WhatsApp",
    text: "Message us",
    href: "https://wa.me/447000000000?text=Hi%20Tufffinds%2C%20I%E2%80%99d%20love%20some%20help%20with%20sourcing...%0A%0AItem%3A%20%0ASize%3A%20%0ABudget%3A%20%0ATimeline%3A%20%0ALinks%2FRefs%3A%20",
  },
  {
    label: "Instagram",
    text: "DM us",
    href: "https://instagram.com/tufffinds__",
  },
  {
    label: "Email",
    text: "info@tufffinds.com",
    href: "mailto:info@tufffinds.com?subject=Tufffinds%20Sourcing%20Request&body=Hi%20Tufffinds%2C%0A%0AItem%3A%0ASize%3A%0ABudget%20range%3A%0ATimeline%3A%0ALinks%2FRefs%3A%0A%0AThank%20you!",
  },
];

export default function VersionOnePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    onScroll();
    setMounted(true);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ui = useMemo(
    () => ({
      container: "mx-auto max-w-7xl px-6",
      sectionY: "py-24 md:py-28",
      eyebrow: "text-[11px] tracking-[0.34em] uppercase",
      body: "text-[15px] leading-relaxed md:text-[16px]",
      h1: "font-serif text-4xl leading-[1.05] tracking-tight md:text-6xl",
      h2: "font-serif italic text-4xl leading-[1.08] tracking-tight md:text-5xl",
      h2Split: "block not-italic text-black/70",
    }),
    []
  );

  const baseReveal = "transition-all duration-1000 ease-out will-change-transform";
  const hiddenReveal = "opacity-0 translate-y-4 blur-sm";
  const shownReveal = "opacity-100 translate-y-0 blur-0";

  const revealClass = (inView, extra = "") =>
    cn(baseReveal, inView ? shownReveal : hiddenReveal, extra);

  const revealStyle = (inView, delay = 0) => ({
    transitionDelay: inView ? `${delay}ms` : "0ms",
  });

  const about = useInViewOnce();
  const services = useInViewOnce();
  const approach = useInViewOnce();
  const editorialImage = useInViewOnce();
  const process = useInViewOnce();
  const founders = useInViewOnce();
  const contact = useInViewOnce();
  const footer = useInViewOnce({
    threshold: 0.05,
    rootMargin: "0px 0px -6% 0px",
  });

  const heroIn = mounted;

  function handleContactSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();

    const subject = encodeURIComponent("Tufffinds Sourcing Request");
    const body = encodeURIComponent(
      `Hi Tufffinds,\n\nName: ${name}\nEmail: ${email}\n\nBrief:\n${message}\n\nThank you!`
    );

    window.location.href = `mailto:info@tufffinds.com?subject=${subject}&body=${body}`;
  }

  return (
    <main className="min-h-screen bg-[#F8F7F3] text-[#121212]">
      {/* Header */}
      <header
        className={cn(
          "fixed top-0 z-50 w-full transition-all duration-300",
          scrolled ? "bg-[#F8F7F3]/75 backdrop-blur-[8px]" : "bg-transparent"
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-7xl items-center justify-between px-6 py-5 transition-all duration-300",
            scrolled && "border-b border-black/10"
          )}
        >
          <a href="#home" aria-label="Tufffinds home">
            <Image
              src="/finallogobrown.png"
              alt="Tufffinds"
              width={220}
              height={56}
              quality={100}
              priority
              className="h-5 w-auto select-none"
            />
          </a>

          <div className="hidden items-center gap-6 md:flex">
            <nav className="flex items-center gap-6 text-[11px] uppercase tracking-[0.26em] text-black/70">
              <a href="#home" className="transition hover:text-black">
                Home
              </a>
              <a href="#services" className="transition hover:text-black">
                Services
              </a>
              <a href="#contact" className="transition hover:text-black">
                Contact
              </a>
            </nav>

            <a
              href="#contact"
              className="rounded-full border border-black/30 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/90 transition hover:border-black"
            >
              Enquire
            </a>
          </div>

          <a
            href="#contact"
            className="rounded-full border border-black/25 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/80 transition hover:border-black md:hidden"
          >
            Enquire
          </a>
        </div>
      </header>

      {/* Hero */}
      <section id="home" className="relative min-h-screen">
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
          <div className="max-w-2xl pb-16 pt-32 text-center">
            <p
              className={revealClass(
                heroIn,
                "mb-6 text-[11px] uppercase tracking-[0.34em] text-black/55"
              )}
              style={revealStyle(heroIn, 80)}
            >
              Personal Shopping • Wardrobe Edits • Sourcing • Styling
            </p>

            <p
              className={revealClass(
                heroIn,
                "mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-black/65 md:text-[16px]"
              )}
              style={revealStyle(heroIn, 240)}
            >
              Tufffinds is a London-based personal shopping studio built on
              taste, access and trust. You brief us once — we return with a
              curated shortlist and handle the rest.
            </p>

            <div
              className={revealClass(
                heroIn,
                "mt-12 flex flex-col justify-center gap-4 sm:flex-row"
              )}
              style={revealStyle(heroIn, 320)}
            >
              <a
                href="#contact"
                className="rounded-full bg-black px-9 py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-black/85"
              >
                Request sourcing
              </a>

              <a
                href="#services"
                className="rounded-full border border-black/20 bg-white/40 px-9 py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/85 backdrop-blur transition hover:border-black/40"
              >
                View services
              </a>
            </div>

            <div
              className={revealClass(
                heroIn,
                "mt-14 flex flex-wrap justify-center gap-6 text-[11px] uppercase tracking-[0.28em] text-black/55 sm:gap-10"
              )}
              style={revealStyle(heroIn, 400)}
            >
              <span>London</span>
              <span>Global network</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-[#F8F7F3]">
        <div
          ref={services.ref}
          className={cn(
            "mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-6 md:grid-cols-12 md:gap-16",
            ui.sectionY
          )}
        >
          <div className="md:col-span-6">
            <p
              className={revealClass(
                services.inView,
                cn("mb-6 text-black/50", ui.eyebrow)
              )}
              style={revealStyle(services.inView, 60)}
            >
              Services
            </p>

            <h2
              className={revealClass(services.inView, ui.h2)}
              style={revealStyle(services.inView, 120)}
            >
              A calm process. Exceptional outcomes.
            </h2>

            <p
              className={revealClass(
                services.inView,
                cn("mt-6 max-w-xl text-black/65", ui.body)
              )}
              style={revealStyle(services.inView, 200)}
            >
              We keep it simple: a clear brief, a tight shortlist, and seamless
              coordination — so you can move quickly without compromising
              taste.
            </p>

            <div className="mt-14 space-y-10">
              {SERVICE_ITEMS.map((service, index) => (
                <div
                  key={service.n}
                  className={revealClass(services.inView, "group")}
                  style={revealStyle(services.inView, 260 + index * 120)}
                >
                  <div className="flex items-start gap-7">
                    <div className={cn("pt-1 text-black/45", ui.eyebrow)}>
                      {service.n}
                    </div>

                    <div className="max-w-md">
                      <div className="flex items-baseline gap-4">
                        <h3 className="text-xl font-semibold tracking-tight text-black">
                          {service.h}
                        </h3>
                        <span className="h-px w-12 bg-black/10 transition-all duration-300 group-hover:w-20" />
                      </div>

                      <p className={cn("mt-3 text-black/65", ui.body)}>
                        {service.p}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={revealClass(
              services.inView,
              "md:col-span-6 md:col-start-7"
            )}
            style={revealStyle(services.inView, 180)}
          >
            <div className="sticky top-28">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-black/5">
                <Image
                  src="/coat.jpg"
                  alt="Tufffinds services"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="bg-[#F8F7F3]">
        <div ref={approach.ref} className={cn(ui.container, ui.sectionY)}>
          <div className="mx-auto max-w-3xl text-center">
            <p
              className={revealClass(
                approach.inView,
                cn("mb-8 text-black/50", ui.eyebrow)
              )}
              style={revealStyle(approach.inView, 60)}
            >
              The Approach
            </p>

            <h2
              className={revealClass(approach.inView, ui.h2)}
              style={revealStyle(approach.inView, 120)}
            >
              Considered by nature.
              <span className={ui.h2Split}>Defined by restraint.</span>
            </h2>
          </div>

          <div className="mx-auto mt-24 grid max-w-6xl gap-20 md:grid-cols-3 md:gap-24">
            {APPROACH_ITEMS.map((item, index) => (
              <div
                key={item.h}
                className={revealClass(approach.inView, "text-center")}
                style={revealStyle(approach.inView, 220 + index * 140)}
              >
                <div className="mx-auto mb-10 flex h-20 items-center justify-center">
                  <Image
                    src={item.icon}
                    alt={item.h}
                    width={140}
                    height={70}
                    quality={100}
                    className="h-14 w-auto object-contain opacity-95"
                  />
                </div>

                <h3 className="font-serif text-2xl tracking-tight md:text-3xl">
                  {item.h}
                </h3>

                <p className={cn("mx-auto mt-6 max-w-sm text-black/65", ui.body)}>
                  {item.p}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Editorial Image */}
      <section className="bg-[#F8F7F3]">
        <div
          ref={editorialImage.ref}
          className={cn(ui.container, ui.sectionY)}
        >
          <div
            className={revealClass(
              editorialImage.inView,
              "relative aspect-[16/9] overflow-hidden rounded-3xl bg-black/5"
            )}
          >
            <Image
              src="/tufffinds-shoot.jpg"
              alt="Tufffinds editorial"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1280px"
            />
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="bg-[#F8F7F3]">
        <div ref={process.ref} className={cn(ui.container, ui.sectionY)}>
          <div className="mx-auto max-w-3xl text-center">
            <p
              className={revealClass(
                process.inView,
                cn("mb-6 text-black/50", ui.eyebrow)
              )}
              style={revealStyle(process.inView, 60)}
            >
              Process
            </p>

            <h2
              className={revealClass(process.inView, ui.h2)}
              style={revealStyle(process.inView, 120)}
            >
              A quiet, clear way to source.
              <span className={ui.h2Split}>
                From brief to delivery — handled.
              </span>
            </h2>

            <p
              className={revealClass(
                process.inView,
                cn("mx-auto mt-6 max-w-2xl text-black/65", ui.body)
              )}
              style={revealStyle(process.inView, 200)}
            >
              We keep everything intentional: a focused shortlist, direct
              communication, and seamless coordination — so you can move
              quickly without compromise.
            </p>
          </div>

          <div className="mx-auto mt-24 w-full">
            <div className="grid gap-14 md:grid-cols-5 md:gap-10 lg:gap-20">
              {PROCESS_ITEMS.map((step, index) => (
                <div
                  key={step.n}
                  className={revealClass(process.inView, "text-left")}
                  style={revealStyle(process.inView, 260 + index * 110)}
                >
                  <div className={cn("mb-4 text-black/40", ui.eyebrow)}>
                    {step.n}
                  </div>
                  <h3 className="font-serif text-xl tracking-tight text-black">
                    {step.h}
                  </h3>
                  <div className="mt-4 h-px w-10 bg-black/15" />
                  <p className={cn("mt-6 max-w-[18rem] text-black/65", ui.body)}>
                    {step.p}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Founders */}
      <section id="founders" className="bg-[#F8F7F3]">
        <div
          ref={founders.ref}
          className={cn(
            "mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-6 md:grid-cols-12 md:gap-16",
            ui.sectionY
          )}
        >
          <div
            className={revealClass(founders.inView, "md:col-span-6")}
            style={revealStyle(founders.inView, 120)}
          >
            <div className="sticky top-24">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-black/5">
                <Image
                  src="/tufffinds-shoot.jpg"
                  alt="Founders — Tufffinds"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>
            </div>
          </div>

          <div
            className={revealClass(
              founders.inView,
              "md:col-span-6 md:col-start-7"
            )}
            style={revealStyle(founders.inView, 60)}
          >
            <p className={cn("mb-6 text-black/50", ui.eyebrow)}>Founders</p>

            <h2 className={ui.h2}>
              Built on trust.
              <span className={ui.h2Split}>Refined through experience.</span>
            </h2>

            <div className={cn("mt-8 max-w-xl space-y-6 text-black/65", ui.body)}>
              <p>
                Tufffinds was founded by Gina and Ginevra with a shared belief
                that personal shopping should feel calm, considered, and
                quietly precise — never rushed, never performative.
              </p>

              <p>
                With years spent immersed in luxury fashion, private clients,
                and global sourcing, they built a studio defined by discretion
                and taste. The focus is on wardrobes that last: pieces with
                longevity, function, and a sense of ease — not momentary trends
                or “one-time” outfits.
              </p>

              <p>
                Their approach is intentionally editorial: a clear brief, a
                tight shortlist, and guidance that keeps decisions simple.
                Options are filtered with care so you’re only seeing pieces
                worth your time — aligned to your lifestyle, your proportions,
                and how you actually like to wear clothes.
              </p>

              <p>
                We work through a trusted network of boutiques, private sellers,
                and long-standing industry relationships, enabling us to move
                quickly when something exceptional surfaces — and to source
                quietly when it doesn’t. Each step is managed with clarity, from
                approvals to purchase coordination and delivery support.
              </p>
            </div>

            <div className="mt-10 text-[11px] uppercase tracking-[0.32em] text-black/45">
              Gina &nbsp;·&nbsp; Ginevra
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-[#F8F7F3]">
        <div ref={contact.ref} className={cn(ui.container, ui.sectionY)}>
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
            <div
              className={revealClass(contact.inView, "md:col-span-6")}
              style={revealStyle(contact.inView, 60)}
            >
              <p className={cn("mb-8 text-black/50", ui.eyebrow)}>Contact</p>

              <h2 className={cn(ui.h2, "text-black")}>
                Let’s start quietly.
                <span className={ui.h2Split}>With a clear brief.</span>
              </h2>

              <div className={cn("mt-10 max-w-xl space-y-6 text-black/65", ui.body)}>
                <p>
                  The fastest way to begin is a short message with the
                  essentials — item, size, budget range, timeline, and any
                  reference links or screenshots.
                </p>
                <p>
                  We’ll reply personally with next steps and availability, then
                  return a tight shortlist that matches your taste. Nothing
                  excessive — just viable options worth considering.
                </p>
                <p className="text-black/55">
                  Typical response time: within 24 hours.
                </p>
              </div>
            </div>

            <div
              className={revealClass(
                contact.inView,
                "md:col-span-6 md:col-start-7"
              )}
              style={revealStyle(contact.inView, 120)}
            >
              <div className="mx-auto w-full max-w-xl">
                <div className="grid gap-4 sm:grid-cols-3">
                  {CONTACT_CARDS.map((card) => (
                    <a
                      key={card.label}
                      href={card.href}
                      target={
                        card.href.startsWith("http") ? "_blank" : undefined
                      }
                      rel={
                        card.href.startsWith("http")
                          ? "noopener noreferrer"
                          : undefined
                      }
                      className="rounded-2xl border border-black/10 bg-white/35 px-5 py-4 text-center backdrop-blur transition hover:border-black/20 hover:bg-white/45"
                    >
                      <div className={cn("mb-2 text-black/50", ui.eyebrow)}>
                        {card.label}
                      </div>
                      <div className="text-sm text-black/70">{card.text}</div>
                    </a>
                  ))}
                </div>

                <div className="mt-10">
                  <div className={cn("mb-6 text-black/50", ui.eyebrow)}>
                    Send a brief
                  </div>

                  <form onSubmit={handleContactSubmit} className="space-y-7">
                    <div>
                      <label
                        htmlFor="name"
                        className={cn("mb-2 block text-black/45", ui.eyebrow)}
                      >
                        Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Your name"
                        required
                        className="w-full border-b border-black/20 bg-transparent py-3 text-[15px] text-black/80 outline-none transition placeholder:text-black/35 focus:border-black/40"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className={cn("mb-2 block text-black/45", ui.eyebrow)}
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        className="w-full border-b border-black/20 bg-transparent py-3 text-[15px] text-black/80 outline-none transition placeholder:text-black/35 focus:border-black/40"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="message"
                        className={cn("mb-2 block text-black/45", ui.eyebrow)}
                      >
                        What are you looking for?
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        rows={4}
                        required
                        placeholder="Item, size, budget range, timeline, and any links or references…"
                        className="w-full resize-none border-b border-black/20 bg-transparent py-3 text-[15px] text-black/80 outline-none transition placeholder:text-black/35 focus:border-black/40"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full rounded-full bg-black px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white transition hover:bg-black/85"
                      >
                        Submit
                      </button>

                      <p className="mt-4 text-center text-[11px] tracking-[0.18em] text-black/45">
                        By submitting, you agree to be contacted about your
                        enquiry.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        ref={footer.ref}
        className={revealClass(footer.inView, "bg-[#40342F] text-white")}
      >
        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-12">
            <div
              className="md:col-span-5"
              style={revealStyle(footer.inView, 80)}
            >
              <Image
                src="/finallogobrown.png"
                alt="Tufffinds"
                width={220}
                height={56}
                quality={100}
                className="h-6 w-auto select-none brightness-[1.05] invert"
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
                  aria-label="Your email"
                  className="h-10 w-full rounded-full border border-white/20 bg-transparent px-5 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white/40"
                />
                <button
                  type="submit"
                  className="h-10 rounded-full bg-white px-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#40342F] transition hover:bg-white/90"
                >
                  Join
                </button>
              </form>
            </div>

            <div
              className="md:col-span-7 md:col-start-7"
              style={revealStyle(footer.inView, 140)}
            >
              <div className="grid gap-8 sm:grid-cols-2">
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
                      <a
                        href="/version-1/faq"
                        className="transition hover:text-white"
                      >
                        FAQ
                      </a>
                    </li>
                    <li>
                      <a
                        href="mailto:info@tufffinds.com"
                        className="transition hover:text-white"
                      >
                        Email support
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
                  </ul>
                </div>
              </div>
            </div>
          </div>

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
