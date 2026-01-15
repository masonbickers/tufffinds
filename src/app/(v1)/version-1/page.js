"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

/* ───────────────────────────────────────────
   Scroll reveal (no libs) — IntersectionObserver
   ✅ No Tailwind arbitrary delay classes
   ✅ Uses inline transitionDelay so it always works
   ✅ Reveals once per section
─────────────────────────────────────────── */
function useInViewOnce({ threshold = 0.15, rootMargin = "0px 0px -12% 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If IO not supported, just show
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    setMounted(true);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // One place to control spacing + type, so everything matches
  const ui = useMemo(
    () => ({
      container: "mx-auto max-w-7xl px-6",
      sectionY: "py-24 md:py-28",
      eyebrow: "text-[11px] tracking-[0.36em] uppercase",
      body: "text-[15px] leading-relaxed md:text-[16px]",
      bodyLarge: "text-[15px] leading-relaxed md:text-[16px]",
      h1: "font-serif text-4xl leading-[1.05] md:text-6xl",
      h2: "font-serif italic text-4xl leading-[1.08] tracking-tight md:text-5xl",
      h2Split: "block not-italic text-black/70",
    }),
    []
  );

  /* ─────────────────────────────
     Reveal helpers
  ───────────────────────────── */
  const baseReveal = "transition-all duration-1000 ease-out will-change-transform";
  const hiddenReveal = "opacity-0 translate-y-4 blur-sm";
  const shownReveal = "opacity-100 translate-y-0 blur-0";

  const revealClass = (inView) => [baseReveal, inView ? shownReveal : hiddenReveal].join(" ");

  const revealStyle = (inView, ms = 0) =>
    inView ? { transitionDelay: `${ms}ms` } : { transitionDelay: "0ms" };

  // Section observers
  const about = useInViewOnce();
  const services = useInViewOnce();
  const approach = useInViewOnce();
  const editorialImage = useInViewOnce();
  const process = useInViewOnce();
  const founders = useInViewOnce();
  const contact = useInViewOnce();
  const footer = useInViewOnce({ threshold: 0.05, rootMargin: "0px 0px -6% 0px" });

  // HERO load-in (mounted)
  const heroIn = mounted;
  const heroReveal = revealClass(heroIn);

  return (
    <main className="min-h-screen bg-[#F8F7F3] text-[#121212]">
      {/* Header */}
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
          {/* Keep intrinsic pixels high, control visible size with className */}
          <Image
            src="/finallogobrown.png"
            alt="Tufffinds"
            width={220}
            height={56}
            quality={100}
            priority
            className="h-5 w-auto select-none" // smaller without losing sharpness
          />

          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6 text-[11px] tracking-[0.26em] uppercase text-black/70">
              <a href="#home" className="transition hover:text-black">
                Home
              </a>
              <a href="#about" className="transition hover:text-black">
                About
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
              className="rounded-full border border-black/30 px-5 py-2.5 text-[10px] font-semibold tracking-[0.22em] uppercase text-black/90 transition hover:border-black"
            >
              Enquire
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="home" className="relative min-h-screen">
        {/* Background */}
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

        {/* Centered content */}
        <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6">
          <div className="max-w-2xl pt-32 pb-16 text-center">
            <p className={["mb-6 text-[11px] tracking-[0.34em] uppercase text-black/55", heroReveal].join(" ")} style={revealStyle(heroIn, 80)}>
              Personal Shopping • Wardrobe Edits • Sourcing • Styling
            </p>

            <h1 className={[ui.h1, heroReveal].join(" ")} style={revealStyle(heroIn, 160)}>
              Find the unfindable —
              <span className="block text-black/80">with the ones connected.</span>
            </h1>

            <p
              className={[
                "mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-black/65 md:text-[16px]",
                heroReveal,
              ].join(" ")}
              style={revealStyle(heroIn, 240)}
            >
              Tufffinds is a London-based personal shopping studio built on taste, access and trust. You brief us once —
              we return with a curated shortlist and handle the rest.
            </p>

            <div className={["mt-12 flex justify-center gap-4", heroReveal].join(" ")} style={revealStyle(heroIn, 320)}>
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
              className={[
                "mt-14 flex justify-center gap-10 text-[11px] tracking-[0.28em] uppercase text-black/55",
                heroReveal,
              ].join(" ")}
              style={revealStyle(heroIn, 400)}
            >
              <span>London</span>
              <span>Global network</span>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="bg-[#F8F7F3] relative overflow-hidden">
        <div
          ref={about.ref}
          className={[ui.container, ui.sectionY, "relative text-center", revealClass(about.inView)].join(" ")}
        >
          {/* Background watermark */}
          <div className="pointer-events-none absolute inset-0 flex justify-center">
            <Image
              src="/icon.png"
              alt=""
              width={360}
              height={360}
              quality={100}
              className="mt-10 opacity-[0.15] w-[260px] md:w-[320px] lg:w-[380px]"
            />
          </div>

          {/* Content */}
          <p className={["mb-6", ui.eyebrow, "text-black/50 relative z-10"].join(" ")} style={revealStyle(about.inView, 60)}>
            About
          </p>

          <h2 className={[ui.h2, "text-black relative z-10"].join(" ")} style={revealStyle(about.inView, 120)}>
            Quietly high-touch.
            <span className={ui.h2Split}>Precisely curated.</span>
          </h2>

          <div
            className={[
              "mx-auto mt-10 max-w-4xl space-y-6 relative z-10",
              ui.body,
              "text-black/65",
            ].join(" ")}
            style={revealStyle(about.inView, 200)}
          >
            <p>
              Tufffinds is a London-based personal shopping studio built on taste, discretion and access. We work closely
              with a global network of trusted sources to find pieces that rarely surface — and never feel forced.
            </p>
          </div>
        </div>
      </section>

      {/* SERVICES — Editorial Columns */}
      <section id="services" className="bg-[#F8F7F3]">
        <div
          ref={services.ref}
          className={[
            "mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-6",
            ui.sectionY,
            "md:grid-cols-12 md:gap-16",
            revealClass(services.inView),
          ].join(" ")}
        >
          {/* Left: copy */}
          <div className="md:col-span-6">
            <p className={["mb-6", ui.eyebrow, "text-black/50"].join(" ")} style={revealStyle(services.inView, 60)}>
              Services
            </p>

            <h2 className={ui.h2} style={revealStyle(services.inView, 120)}>
              A calm process. Exceptional outcomes.
              <span className={ui.h2Split}></span>
            </h2>

            <p className={["mt-6 max-w-xl", ui.bodyLarge, "text-black/65"].join(" ")} style={revealStyle(services.inView, 200)}>
              We keep it simple: a clear brief, a tight shortlist, and seamless coordination — so you can move quickly
              without compromising taste.
            </p>

            <div className="mt-14 space-y-10">
              {[
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
              ].map((s, idx) => (
                <div key={s.n} className="group" style={revealStyle(services.inView, 260 + idx * 120)}>
                  <div className="flex items-start gap-7">
                    <div className={["pt-1", ui.eyebrow, "text-black/45"].join(" ")}>{s.n}</div>

                    <div className="max-w-md">
                      <div className="flex items-baseline gap-4">
                        <h3 className="text-xl font-semibold tracking-tight text-black">{s.h}</h3>
                        <span className="h-px w-12 bg-black/10 transition-all duration-300 group-hover:w-20" />
                      </div>

                      <p className={["mt-3", ui.body, "text-black/65"].join(" ")}>{s.p}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: image */}
          <div className="md:col-span-6 md:col-start-7" style={revealStyle(services.inView, 180)}>
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

      {/* INTERLUDE — Editorial Values */}
      <section className="bg-[#F8F7F3]">
        <div ref={approach.ref} className={[ui.container, ui.sectionY, revealClass(approach.inView)].join(" ")}>
          {/* Header */}
          <div className="mx-auto max-w-3xl text-center">
            <p className={["mb-8", ui.eyebrow, "text-black/50"].join(" ")} style={revealStyle(approach.inView, 60)}>
              The Approach
            </p>

            <h2 className={ui.h2} style={revealStyle(approach.inView, 120)}>
              Considered by nature.
              <span className={ui.h2Split}>Defined by restraint.</span>
            </h2>
          </div>

          {/* Values grid */}
          <div className="mx-auto mt-24 grid max-w-6xl gap-20 md:grid-cols-3 md:gap-24">
            {[
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
            ].map((item, idx) => (
              <div key={item.h} className="text-center" style={revealStyle(approach.inView, 220 + idx * 140)}>
                {/* Icon */}
                <div className="mx-auto mb-10 flex h-20 items-center justify-center">
                  <Image
                    src={item.icon}
                    alt={item.h}
                    width={140}
                    height={70}
                    quality={100}
                    className="h-13 w-auto object-contain opacity-95"
                  />
                </div>

                {/* Title */}
                <h3 className="font-serif text-2xl tracking-tight md:text-3xl">{item.h}</h3>

                {/* Copy */}
                <p className={["mx-auto mt-6 max-w-sm", ui.body, "text-black/65"].join(" ")}>{item.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IMAGE — Editorial break */}
      <section className="bg-[#F8F7F3]">
        <div ref={editorialImage.ref} className={[ui.container, ui.sectionY].join(" ")}>
          <div className={["relative aspect-[16/9] overflow-hidden rounded-3xl bg-black/5", revealClass(editorialImage.inView)].join(" ")}>
            <Image
              src="/tufffinds-shoot.jpg" // swap if needed
              alt="Tufffinds editorial"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1280px"
            />
          </div>
        </div>
      </section>

      {/* PROCESS — Simple Steps */}
      <section id="process" className="bg-[#F8F7F3]">
        <div ref={process.ref} className={[ui.container, ui.sectionY, revealClass(process.inView)].join(" ")}>
          <div className="mx-auto max-w-3xl text-center">
            <p className={["mb-6", ui.eyebrow, "text-black/50"].join(" ")} style={revealStyle(process.inView, 60)}>
              Process
            </p>

            <h2 className={ui.h2} style={revealStyle(process.inView, 120)}>
              A quiet, clear way to source.
              <span className={ui.h2Split}>From brief to delivery — handled.</span>
            </h2>

            <p className={["mx-auto mt-6 max-w-2xl", ui.body, "text-black/65"].join(" ")} style={revealStyle(process.inView, 200)}>
              We keep everything intentional: a focused shortlist, direct communication, and seamless coordination — so
              you can move quickly without compromise.
            </p>
          </div>

          {/* Steps */}
          <div className="mx-auto mt-24 w-full">
            <div className="grid gap-20 md:grid-cols-5">
              {[
                { n: "01", h: "Brief", p: "Tell us what you’re looking for — size, budget range, timeline, and any references." },
                { n: "02", h: "Source", p: "We tap our network and pull options that match your taste and requirements." },
                { n: "03", h: "Shortlist", p: "You receive a tight edit — no overwhelm, only viable pieces worth considering." },
                { n: "04", h: "Secure", p: "We guide approval and purchasing, keeping the process clean and discreet." },
                { n: "05", h: "Deliver", p: "We coordinate next steps and delivery support, with care at every stage." },
              ].map((s, idx) => (
                <div key={s.n} className="text-left" style={revealStyle(process.inView, 260 + idx * 110)}>
                  <div className={[ui.eyebrow, "mb-4 text-black/40"].join(" ")}>{s.n}</div>
                  <h3 className="font-serif text-xl tracking-tight text-black">{s.h}</h3>
                  <div className="mt-4 h-px w-10 bg-black/15" />
                  <p className={["mt-6 max-w-[18rem]", ui.body, "text-black/65"].join(" ")}>{s.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOUNDERS — Editorial Columns */}
      <section id="founders" className="bg-[#F8F7F3]">
        <div
          ref={founders.ref}
          className={[
            "mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 px-6",
            ui.sectionY,
            "md:grid-cols-12 md:gap-16",
            revealClass(founders.inView),
          ].join(" ")}
        >
          <div className="md:col-span-6" style={revealStyle(founders.inView, 120)}>
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

          <div className="md:col-span-6 md:col-start-7" style={revealStyle(founders.inView, 60)}>
            <p className={["mb-6", ui.eyebrow, "text-black/50"].join(" ")}>Founders</p>

            <h2 className={ui.h2}>
              Built on trust.
              <span className={ui.h2Split}>Refined through experience.</span>
            </h2>

            <div className={["mt-8 max-w-xl space-y-6", ui.body, "text-black/65"].join(" ")}>
  <p>
    Tufffinds was founded by Gina and Ginevra with a shared belief that personal shopping should feel calm,
    considered, and quietly precise — never rushed, never performative.
  </p>

  <p>
    With years spent immersed in luxury fashion, private clients, and global sourcing, they built a studio
    defined by discretion and taste. The focus is on wardrobes that last: pieces with longevity, function,
    and a sense of ease — not momentary trends or “one-time” outfits.
  </p>

  <p>
    Their approach is intentionally editorial: a clear brief, a tight shortlist, and guidance that keeps
    decisions simple. Options are filtered with care so you’re only seeing pieces worth your time — aligned
    to your lifestyle, your proportions, and how you actually like to wear clothes.
  </p>

  <p>
    We work through a trusted network of boutiques, private sellers, and long-standing industry relationships,
    enabling us to move quickly when something exceptional surfaces — and to source quietly when it doesn’t.
    Each step is managed with clarity, from approvals to purchase coordination and delivery support.
  </p>
</div>

<div className="mt-10 text-[11px] tracking-[0.32em] uppercase text-black/45">
  Gina &nbsp;·&nbsp; Ginevra
</div>



          </div>
        </div>
      </section>

      {/* CONTACT — Split */}
      <section id="contact" className="bg-[#F8F7F3]">
        <div ref={contact.ref} className={[ui.container, ui.sectionY, revealClass(contact.inView)].join(" ")}>
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
            {/* LEFT */}
            <div className="md:col-span-6" style={revealStyle(contact.inView, 60)}>
              <p className={["mb-8", ui.eyebrow, "text-black/50"].join(" ")}>Contact</p>

              <h2 className={[ui.h2, "text-black"].join(" ")}>
                Let’s start quietly.
                <span className={ui.h2Split}>With a clear brief.</span>
              </h2>

              <div className={["mt-10 max-w-xl space-y-6", ui.body, "text-black/65"].join(" ")}>
                <p>
                  The fastest way to begin is a short message with the essentials — item, size, budget range, timeline,
                  and any reference links or screenshots.
                </p>
                <p>
                  We’ll reply personally with next steps and availability, then return a tight shortlist that matches
                  your taste. Nothing excessive — just viable options worth considering.
                </p>
                <p className="text-black/55">Typical response time: within 24 hours.</p>
              </div>
            </div>

            {/* RIGHT */}
            <div className="md:col-span-6 md:col-start-7" style={revealStyle(contact.inView, 120)}>
              <div className="mx-auto w-full max-w-xl">
                {/* Contact options */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <a
                    href="https://wa.me/447000000000?text=Hi%20Tufffinds%2C%20I%E2%80%99d%20love%20some%20help%20with%20sourcing...%0A%0AItem%3A%20%0ASize%3A%20%0ABudget%3A%20%0ATimeline%3A%20%0ALinks%2FRefs%3A%20"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl border border-black/10 bg-white/35 px-5 py-4 text-center backdrop-blur transition hover:border-black/20 hover:bg-white/45"
                  >
                    <div className={["mb-2", ui.eyebrow, "text-black/50"].join(" ")}>WhatsApp</div>
                    <div className="text-sm text-black/70">Message us</div>
                  </a>

                  <a
                    href="https://instagram.com/tufffinds__"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl border border-black/10 bg-white/35 px-5 py-4 text-center backdrop-blur transition hover:border-black/20 hover:bg-white/45"
                  >
                    <div className={["mb-2", ui.eyebrow, "text-black/50"].join(" ")}>Instagram</div>
                    <div className="text-sm text-black/70">DM us</div>
                  </a>

                  <a
                    href="mailto:hello@tufffinds.com?subject=Tufffinds%20Sourcing%20Request&body=Hi%20Tufffinds%2C%0A%0AItem%3A%0ASize%3A%0ABudget%20range%3A%0ATimeline%3A%0ALinks%2FRefs%3A%0A%0AThank%20you!"
                    className="rounded-2xl border border-black/10 bg-white/35 px-5 py-4 text-center backdrop-blur transition hover:border-black/20 hover:bg-white/45"
                  >
                    <div className={["mb-2", ui.eyebrow, "text-black/50"].join(" ")}>Email</div>
                    <div className="text-sm text-black/70">info@tufffinds.com</div>
                  </a>
                </div>

                {/* Form */}
                <div className="mt-10">
                  <div className={["mb-6", ui.eyebrow, "text-black/50"].join(" ")}>Send a brief</div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      // Hook up later (Formspree, Resend, etc.)
                    }}
                    className="space-y-7"
                  >
                    <div>
                      <label className={["block mb-2", ui.eyebrow, "text-black/45"].join(" ")}>Name</label>
                      <input
                        type="text"
                        placeholder="Your name"
                        className="w-full border-b border-black/20 bg-transparent py-3 text-[15px] text-black/80 placeholder:text-black/35 outline-none transition focus:border-black/40"
                      />
                    </div>

                    <div>
                      <label className={["block mb-2", ui.eyebrow, "text-black/45"].join(" ")}>Email</label>
                      <input
                        type="email"
                        placeholder="info@tufffinds.com"
                        className="w-full border-b border-black/20 bg-transparent py-3 text-[15px] text-black/80 placeholder:text-black/35 outline-none transition focus:border-black/40"
                      />
                    </div>

                    <div>
                      <label className={["block mb-2", ui.eyebrow, "text-black/45"].join(" ")}>
                        What are you looking for?
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Item, size, budget range, timeline, and any links or references…"
                        className="w-full resize-none border-b border-black/20 bg-transparent py-3 text-[15px] text-black/80 placeholder:text-black/35 outline-none transition focus:border-black/40"
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
                        By submitting, you agree to be contacted about your enquiry.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer ref={footer.ref} className={["bg-[#40342F] text-white", revealClass(footer.inView)].join(" ")}>
        {/* Icon strip */}

        <div className="border-t border-white/10">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:grid-cols-12">
            <div className="md:col-span-5" style={revealStyle(footer.inView, 80)}>
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

              <form className="mt-5 flex max-w-md items-center gap-3" onSubmit={(e) => e.preventDefault()}>
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

            <div className="md:col-span-7 md:col-start-7" style={revealStyle(footer.inView, 140)}>
              <div className="grid gap-8 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">Support</div>
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
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">Legal</div>
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
