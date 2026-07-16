"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";

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
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [contactStatus, setContactStatus] = useState("idle");
  const [contactFeedback, setContactFeedback] = useState("");

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

    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previousBodyOverflow = bodyStyle.overflow;
    const previousHtmlOverflow = htmlStyle.overflow;
    const previousOverscrollBehavior = htmlStyle.overscrollBehavior;
    const previousPaddingRight = bodyStyle.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";
    htmlStyle.overscrollBehavior = "contain";

    if (scrollbarWidth > 0) {
      bodyStyle.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      bodyStyle.overflow = previousBodyOverflow;
      htmlStyle.overflow = previousHtmlOverflow;
      htmlStyle.overscrollBehavior = previousOverscrollBehavior;
      bodyStyle.paddingRight = previousPaddingRight;
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

  const HOME_PATH = "/version-1";
  const FAQ_PATH = "/version-1/faq";
  const PRIVACY_PATH = "/version-1/privacy-policy";
  const TERMS_PATH = "/version-1/terms";

  const handleContactChange = (field) => (event) => {
    setContactForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();

    const name = contactForm.name.trim();
    const email = contactForm.email.trim().toLowerCase();
    const phone = contactForm.phone.trim();
    const message = contactForm.message.trim();

    if (!name || !email || !phone || !message) {
      setContactStatus("error");
      setContactFeedback("Please add your name, email, phone number and brief.");
      return;
    }

    setContactStatus("submitting");
    setContactFeedback("");

    try {
      const titleBrief = message.split(/\s+/).slice(0, 8).join(" ");
      await addDoc(collection(db, "requests"), {
        clientEmail: email,
        clientId: "",
        clientName: name,
        clientPhone: phone,
        createdAt: serverTimestamp(),
        detail: {
          activitySummary: [
            {
              id: "submitted",
              label: "Website enquiry received",
              meta: "Version 1 contact form",
              type: "client",
            },
          ],
          categories: [],
          createdDateLabel: "",
          dislikedBrands: [],
          favoriteBrands: [],
          href: "",
          id: "",
          linkedEdits: [],
          linkedMessagesPreview: [],
          notes: message,
          purchaseMode: "Sourcing request",
          references: [],
          requestType: "Website enquiry",
          shippingCountry: "",
          status: "submitted",
          statusTimeline: [
            {
              id: "submitted",
              label: "Submitted",
              meta: "Awaiting review",
              type: "client",
            },
          ],
          styleNotes: "",
          title: `${name} - ${titleBrief || "Website enquiry"}`,
          urgency: "",
          whatHappensNext: "Review the enquiry and reply to the client by email.",
        },
        source: "version-1-contact-form",
        status: "submitted",
        submittedFrom: typeof window !== "undefined" ? window.location.pathname : "/version-1",
        updatedAt: serverTimestamp(),
      });

      setContactStatus("success");
      setContactFeedback("Thank you. Your brief has been sent.");
      setContactForm({ name: "", email: "", phone: "", message: "" });
    } catch (error) {
      console.error("Failed to submit contact form", error);
      setContactStatus("error");
      setContactFeedback("Something went wrong. Please email info@tufffinds.com directly.");
    }
  };

  const navItems = [
    ["Home", `${HOME_PATH}#home`],
    ["Services", `${HOME_PATH}#services`],
    ["Process", `${HOME_PATH}#process`],
    ["About", `${HOME_PATH}#about`],
    ["Contact", `${HOME_PATH}#contact`],
  ];

  const iconStripItems = [
    { label: "Chanel", src: "/CHANEL.png" },
    { label: "Goyard", src: "/GOYARD.png" },
    { label: "Sunglasses", src: "/SUNGLASSES.png" },
    { label: "Hermes", src: "/HERMES.png" },
    { label: "Manolo", src: "/MANOLO 2.png" },
  ];

  return (
    <main className="min-h-[100svh] overflow-x-clip bg-[#F8F7F3] text-[#121212] antialiased">
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
          <a href={`${HOME_PATH}#home`} aria-label="Tufffinds home" onClick={() => setMobileMenuOpen(false)}>
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
              href={`${HOME_PATH}#contact`}
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
          aria-hidden={!mobileMenuOpen}
          className={cx(
            "fixed inset-0 z-[110] bg-[#121212]/20 backdrop-blur-[2px] transition-opacity duration-300 md:hidden",
            mobileMenuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
          onClick={() => setMobileMenuOpen(false)}
        >
          <nav
            id="version-one-mobile-menu"
            aria-label="Mobile navigation"
            onClick={(e) => e.stopPropagation()}
            className={cx(
              "ml-auto flex h-full w-[min(82vw,380px)] flex-col overflow-y-auto overscroll-contain border-l border-[#40342F]/10 bg-[#F8F7F3] px-5 pb-8 pt-6 shadow-[-24px_0_70px_rgba(64,52,47,0.14)] transition-transform duration-300 ease-out",
              mobileMenuOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="mb-10 flex items-center justify-between">
              <Image
                src="/finallogobrown.png"
                alt="Tufffinds"
                width={180}
                height={46}
                className="h-5 w-auto select-none"
              />

              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center bg-transparent text-[#40342F]/80 transition active:scale-[0.98]"
                aria-label="Close side menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="relative block h-5 w-5">
                  <span className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 rotate-45 bg-[#40342F]/85" />
                  <span className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 -rotate-45 bg-[#40342F]/85" />
                </span>
              </button>
            </div>

            {navItems.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="border-b border-[#40342F]/10 px-1 py-5 text-[12px] font-semibold uppercase tracking-[0.28em] text-black/70 transition hover:text-black"
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </a>
            ))}

            <a
              href={`${HOME_PATH}#contact`}
              className="mt-8 min-h-12 rounded-full bg-[#40342F] px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#40342F]/90 active:scale-[0.99]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Enquire
            </a>
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
          <Image
            src="/icon.png"
            alt=""
            width={620}
            height={620}
            priority
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-auto w-[340px] -translate-x-1/2 -translate-y-[72%] opacity-50 sm:w-[500px] lg:w-[620px]"
          />
          <div className="relative z-10 flex max-w-4xl translate-y-[22vh] flex-col items-center gap-8 pb-10 pt-20 text-center sm:gap-9 sm:pb-16 sm:pt-32">
            <h1 className={cx("flex justify-center", heroReveal)} style={revealStyle(heroIn, 80)}>
              <Image
                src="/the-ones-connected2.png"
                alt="The Ones Connected"
                width={2782}
                height={100}
                priority
                className="h-auto w-[min(92vw,760px)] [filter:brightness(0)_saturate(100%)_invert(18%)_sepia(12%)_saturate(770%)_hue-rotate(334deg)_brightness(92%)_contrast(88%)]"
              />
            </h1>

            <p
              className={cx(
                "mx-auto max-w-[21rem] text-[10px] leading-[1.7] tracking-[0.16em] uppercase text-black/55 sm:max-w-none sm:text-[11px] sm:tracking-[0.3em]",
                heroReveal
              )}
              style={revealStyle(heroIn, 160)}
            >
              Personal Shopping • Wardrobe Edits • Sourcing • Styling
            </p>

            <div
              className={cx(
                "flex flex-col justify-center gap-3 sm:flex-row sm:gap-4",
                heroReveal
              )}
              style={revealStyle(heroIn, 240)}
            >
              <a
                href={`${HOME_PATH}#contact`}
                className="min-h-12 rounded-full bg-[#40342F] px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#EFE8DE] transition hover:bg-[#40342F]/90 active:scale-[0.99] sm:px-9 sm:tracking-[0.22em]"
              >
                Request sourcing
              </a>

              <a
                href={`${HOME_PATH}#services`}
                className="min-h-12 rounded-full bg-[#40342F] px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#EFE8DE] transition hover:bg-[#40342F]/90 active:scale-[0.99] sm:px-9 sm:tracking-[0.22em]"
              >
                View services
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ICON STRIP */}
      <section aria-label="Sourcing categories" className="overflow-hidden bg-[#F8F7F3] py-8 sm:py-10">
        <div className="py-5 sm:py-6">
          <div className="tf-icon-marquee flex w-max items-center gap-8 sm:gap-12">
            {[...iconStripItems, ...iconStripItems, ...iconStripItems].map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                className="flex h-24 w-24 shrink-0 items-center justify-center p-1 sm:h-28 sm:w-28"
              >
                {item.src ? (
                  <Image
                    src={item.src}
                    alt={item.label}
                    width={96}
                    height={96}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="font-serif text-[18px] uppercase tracking-[0.08em] text-[#40342F] sm:text-[20px]">
                    {item.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="scroll-mt-24 bg-[#F8F7F3]">
        <SectionDivider />

        <div
          ref={services.ref}
          className={cx(
            "mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 sm:px-6 md:grid-cols-12 md:gap-16 lg:px-8",
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
              Services We Offer
            </p>

            <h2 className={ui.h2} style={revealStyle(services.inView, 120)}>
              Helping you source,
              <span className={ui.h2Split}>style and refresh your wardrobe.</span>
            </h2>

            {/* Mobile image */}
            <div className="mt-9 md:hidden" style={revealStyle(services.inView, 240)}>
              <div className="relative aspect-[4/4.7] overflow-hidden rounded-[28px] bg-[#40342F]/5">
                <Image
                  src="/street.jpg"
                  alt="Tufffinds services"
                  fill
                  className="object-cover object-bottom"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>
            </div>

            <div className="mt-9 space-y-7 sm:mt-12 sm:space-y-8">
              {[
                {
                  n: "01",
                  h: "Personal Shopping and Sourcing",
                  p: "Searching for a sold out or hard to find piece? Tufffinds sources through a trusted global network to help you secure the item you’ve been looking for.",
                },
                {
                  n: "02",
                  h: "Styling Edits / In-Person Styling",
                  p: "Need help deciding what to wear? Whether your wardrobe feels full but you keep reaching for the same pieces, we can create a digital styling edit or work with you in person for a more refined styling session.",
                  p2: (
                    <>
                      To enquire about this service, please send us a{" "}
                      <a
                        href="https://www.tufffinds.com/link?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPOTM2NjE5NzQzMzkyNDU5AAGnBfazMQHjtMVXLMbMYQSWDc0F3q7i82ZT-ZnHN4B1CRJaFQq6tCLUVZQyY30_aem_to6S4mLhbMtYxijihS2xIw"
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-[#40342F]/30 underline-offset-4 transition hover:text-[#40342F]"
                      >
                        message
                      </a>
                      .
                    </>
                  ),
                },
                {
                  n: "03",
                  h: "Wardrobe Refresh",
                  p: (
                    <>
                      Whether your wardrobe needs a tidy, a reset or a full refresh, we help
                      re-organise, edit and refine your pieces so your wardrobe feels more
                      considered and easier to style.
                    </>
                  ),
                },
              ].map((s, idx) => (
                <article
                  key={s.n}
                  className="group border-t border-[#40342F]/10 pt-6 first:border-t-0 first:pt-0"
                  style={revealStyle(services.inView, 300 + idx * 110)}
                >
                  <div className="grid grid-cols-[44px_1fr] gap-5 sm:grid-cols-[56px_1fr] sm:gap-7">
                    <div className={cx("pt-1 text-black/40", ui.eyebrow)}>{s.n}</div>

                    <div className="max-w-2xl">
                      <div className="flex items-baseline gap-4">
                        <h3 className="whitespace-nowrap font-serif text-[24px] leading-tight tracking-tight text-[#40342F] sm:text-[28px]">
                          {s.h}
                        </h3>
                        <span className="hidden h-px w-10 bg-[#40342F]/10 transition-all duration-300 group-hover:w-16 sm:block" />
                      </div>

                      <p className={cx("mt-3", ui.body)}>{s.p}</p>
                      {s.p2 ? <p className={cx("mt-3", ui.body)}>{s.p2}</p> : null}
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
            <div>
              <div className="relative aspect-[4/5] max-h-[680px] overflow-hidden rounded-[32px] bg-[#40342F]/5">
                <Image
                  src="/street.jpg"
                  alt="Tufffinds services"
                  fill
                  className="object-cover object-bottom"
                  sizes="50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#40342F]/10 pt-4 text-[10px] uppercase tracking-[0.22em] text-black/45">
                <span>Based in London</span>
                <span>Global Network</span>
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
                The process of personal shopping and sourcing
              </p>

              <h2 className={cx(ui.h2, "max-w-xl")} style={revealStyle(process.inView, 120)}>
                A simple five step process,
                <span className={ui.h2Split}>from brief to delivery.</span>
              </h2>

              <p
                className={cx("mt-5 max-w-xl sm:mt-6", ui.body)}
                style={revealStyle(process.inView, 190)}
              >
                Tell us what you need, and we’ll guide the search, quote, payment and delivery from start to finish.
              </p>
            </div>

            {/* RIGHT */}
            <div className="md:col-span-7">
              <div className="border-t border-[#40342F]/10 md:border-t-0">
                {[
                  {
                    n: "01",
                    h: "Send Your Request",
                    p: "Tell us what you’re searching for, with as much detail as possible, and we’ll take it from there.",
                    p2: (
                      <>
                        To send us your request, message us on Instagram{" "}
                        <a
                          href="https://www.instagram.com/tufffinds__/"
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-[#40342F]/30 underline-offset-4 transition hover:text-[#40342F]"
                        >
                          @tufffinds__
                        </a>
                        , email us at{" "}
                        <a
                          href="mailto:info@tufffinds.com"
                          className="underline decoration-[#40342F]/30 underline-offset-4 transition hover:text-[#40342F]"
                        >
                          info@tufffinds.com
                        </a>
                        , or send us a WhatsApp message{" "}
                        <a
                          href="https://www.tufffinds.com/link?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPOTM2NjE5NzQzMzkyNDU5AAGnBfazMQHjtMVXLMbMYQSWDc0F3q7i82ZT-ZnHN4B1CRJaFQq6tCLUVZQyY30_aem_to6S4mLhbMtYxijihS2xIw"
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-[#40342F]/30 underline-offset-4 transition hover:text-[#40342F]"
                        >
                          here
                        </a>
                        .
                      </>
                    ),
                  },
                  {
                    n: "02",
                    h: "We Source",
                    p: "Our sourcing process begins across a trusted network of boutiques, resellers and global contacts.",
                  },
                  {
                    n: "03",
                    h: "Receive a Quote",
                    p: "Once found, you’ll receive a quote with pricing, delivery timing and shipping estimate.",
                  },
                  {
                    n: "04",
                    h: "Payment",
                    p: "Once approved, payment is completed securely via payment link or bank transfer.",
                  },
                  {
                    n: "05",
                    h: "Final Step",
                    p: "We will directly ship your item to your chosen address and provide tracking links.",
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
                      {s.p2 ? <p className={cx("mt-3 max-w-xl break-words", ui.body)}>{s.p2}</p> : null}
                    </div>
                  </article>
                ))}
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="scroll-mt-24 bg-[#F8F7F3]">
        <SectionDivider />

        <div
          ref={founders.ref}
          className={cx(
            "mx-auto grid max-w-7xl grid-cols-1 items-start gap-10 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-12 md:gap-16 md:py-20 lg:px-8 lg:py-24",
            revealClass(founders.inView)
          )}
        >
          <div className="md:col-span-6" style={revealStyle(founders.inView, 80)}>
            <div className="md:sticky md:top-28">
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
            </div>
          </div>

          <div className="md:col-span-6 md:col-start-7" style={revealStyle(founders.inView, 140)}>
            <p className={cx("mb-5 text-black/50 sm:mb-6", ui.eyebrow)}>About</p>

            <h2 className={ui.h2}>
              Founders
            </h2>

            <div className={cx("mt-7 max-w-xl space-y-5 sm:mt-8 sm:space-y-6", ui.body)}>
              <p>
                Gina & Ginevra, the founders behind Tufffinds.
              </p>

              <p>
                What started as a conversation about how hard it can be to find those one of a kind
                items before it&apos;s gone, quickly turned into a mission to make discovering the
                toughest finds effortless.
              </p>

              <p>
                Based in London but available for everyone anywhere, we bring years of experience
                in personal shopping, styling, and sourcing.
              </p>

              <p>
                At its heart, Tufffinds is about connection between people, pieces, and stories.
                Where the rare finds become reachable.
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
                  Start by sharing the item, size and any timing you need it for. Photos,
                  screenshots, links or references are always helpful.
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
                  href="https://wa.me/447591207418?text=Hi%20Tufffinds"
                  target="_blank"
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
                  href="mailto:info@tufffinds.com?subject=Tufffinds%20Sourcing%20Request&body=Hi%20Tufffinds%2C%0A%0AItem%3A%0ASize%3A%0ABudget%20range%3A%0ATimeline%3A%0ALinks%2FRefs%3A%0A%0AThank%20you!"
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

                <form onSubmit={handleContactSubmit} className="space-y-7">
                  <div>
                    <label className={cx("mb-2 block text-black/45", ui.eyebrow)}>Name</label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={handleContactChange("name")}
                      placeholder="Your name"
                      autoComplete="name"
                      required
                      className="w-full border-b border-[#40342F]/20 bg-transparent py-3 text-[16px] text-black/80 outline-none transition placeholder:text-black/30 focus:border-[#40342F]/50"
                    />
                  </div>

                  <div>
                    <label className={cx("mb-2 block text-black/45", ui.eyebrow)}>Email</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={handleContactChange("email")}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      className="w-full border-b border-[#40342F]/20 bg-transparent py-3 text-[16px] text-black/80 outline-none transition placeholder:text-black/30 focus:border-[#40342F]/50"
                    />
                  </div>

                  <div>
                    <label className={cx("mb-2 block text-black/45", ui.eyebrow)}>Phone</label>
                    <input
                      type="tel"
                      value={contactForm.phone}
                      onChange={handleContactChange("phone")}
                      placeholder="+44 7000 000000"
                      autoComplete="tel"
                      required
                      className="w-full border-b border-[#40342F]/20 bg-transparent py-3 text-[16px] text-black/80 outline-none transition placeholder:text-black/30 focus:border-[#40342F]/50"
                    />
                  </div>

                  <div>
                    <label className={cx("mb-2 block text-black/45", ui.eyebrow)}>
                      What are you looking for?
                    </label>
                    <textarea
                      rows={5}
                      value={contactForm.message}
                      onChange={handleContactChange("message")}
                      placeholder="Item, size, budget range, timeline, and any links or references…"
                      required
                      className="w-full resize-none border-b border-[#40342F]/20 bg-transparent py-3 text-[16px] text-black/80 outline-none transition placeholder:text-black/30 focus:border-[#40342F]/50"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={contactStatus === "submitting"}
                      className="min-h-12 w-full rounded-full bg-[#40342F] px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white transition hover:bg-[#40342F]/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {contactStatus === "submitting" ? "Sending..." : "Submit request"}
                    </button>

                    {contactFeedback ? (
                      <p
                        className={cx(
                          "mt-4 text-center text-[11px] leading-relaxed",
                          contactStatus === "success" ? "text-[#40342F]" : "text-red-700"
                        )}
                        role="status"
                      >
                        {contactFeedback}
                      </p>
                    ) : null}

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
                className="h-6 w-auto select-none [filter:brightness(0)_saturate(100%)_invert(92%)_sepia(12%)_saturate(243%)_hue-rotate(337deg)_brightness(106%)_contrast(90%)]"
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
                      <a href={`${HOME_PATH}#contact`} className="transition hover:text-white">
                        Contact
                      </a>
                    </li>
                    <li>
                      <a href={FAQ_PATH} className="transition hover:text-white">
                        FAQ
                      </a>
                    </li>
                    <li>
                      <a href="mailto:info@tufffinds.com" className="transition hover:text-white">
                        Email support
                      </a>
                    </li>
                    <li>
                      <a href={`${HOME_PATH}#about`} className="transition hover:text-white">
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
                      <a href={PRIVACY_PATH} className="transition hover:text-white">
                        Privacy policy
                      </a>
                    </li>
                    <li>
                      <a href={TERMS_PATH} className="transition hover:text-white">
                        Terms of use
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
