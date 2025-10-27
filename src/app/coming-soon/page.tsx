"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./coming-soon.module.css";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function ComingSoonPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLElement | null>(null);

  // === Floating icon: constant-speed random walk + slow spin ===
  useEffect(() => {
    const el = rootRef.current; // <main className={styles.cs}>
    if (!el) return;

    // CONFIG
    const SPEED_PX_PER_SEC = 60; // <-- movement speed (pixels/second). Tweak to taste.
    const SPIN_DEG_PER_SEC = 20; // <-- spin speed (degrees/second). Tweak to taste.
    // Safe bounds so it never goes off-screen (as % of viewport)
    const MIN_VW = 10, MAX_VW = 75;
    const MIN_VH = 16, MAX_VH = 78;

    // State
    let angle = 0; // degrees
    // Start near the top-left safe area
    let x = (MIN_VW / 100) * window.innerWidth;
    let y = (MIN_VH / 100) * window.innerHeight;
    // First random target
    let tx = x, ty = y;

    function pickTarget() {
      tx = (randBetween(MIN_VW, MAX_VW) / 100) * window.innerWidth;
      ty = (randBetween(MIN_VH, MAX_VH) / 100) * window.innerHeight;
    }
    function randBetween(a: number, b: number) {
      return a + Math.random() * (b - a);
    }

    // Handle resizes so bounds stay sensible
    let resizeTO: number | null = null;
    const onResize = () => {
      if (resizeTO) window.clearTimeout(resizeTO);
      resizeTO = window.setTimeout(() => {
        // Clamp current and target to new viewport size
        x = Math.min(Math.max(x, (MIN_VW/100)*innerWidth), (MAX_VW/100)*innerWidth);
        y = Math.min(Math.max(y, (MIN_VH/100)*innerHeight), (MAX_VH/100)*innerHeight);
        tx = Math.min(Math.max(tx, (MIN_VW/100)*innerWidth), (MAX_VW/100)*innerWidth);
        ty = Math.min(Math.max(ty, (MIN_VH/100)*innerHeight), (MAX_VH/100)*innerHeight);
      }, 120);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last = performance.now();
    pickTarget();

    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); // clamp dt for safety
      last = now;

      // Spin
      angle = (angle + SPIN_DEG_PER_SEC * dt) % 360;

      // Move toward target at constant speed
      const dx = tx - x;
      const dy = ty - y;
      const dist = Math.hypot(dx, dy);

      if (dist < SPEED_PX_PER_SEC * dt) {
        // Arrived (or very close): snap to target and choose a new one
        x = tx; y = ty;
        pickTarget();
      } else if (dist > 0) {
        const ux = dx / dist;
        const uy = dy / dist;
        x += ux * SPEED_PX_PER_SEC * dt;
        y += uy * SPEED_PX_PER_SEC * dt;
      }

      // Update CSS variables (translate in vw/vh keeps it responsive)
      const txVW = (x / window.innerWidth) * 100;
      const tyVH = (y / window.innerHeight) * 100;
      el.style.setProperty("--tx", `${txVW}vw`);
      el.style.setProperty("--ty", `${tyVH}vh`);
      el.style.setProperty("--angle", `${angle}deg`);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      setStatus("err");
      setMessage("Please enter a valid email.");
      return;
    }

    try {
      setStatus("loading");
      await addDoc(collection(db, "waitlist"), {
        email: email.trim().toLowerCase(),
        createdAt: serverTimestamp(),
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
      setStatus("ok");
      setMessage("You’re on the list! We’ll be in touch soon.");
      setEmail("");
    } catch (err) {
      console.error(err);
      setStatus("err");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <main ref={rootRef} className={styles.cs}>
      <div className={styles.csInner}>
        <div className={styles.logoWrap}>
          <Image
            src="/logo-04.png"              /* high-res PNG or SVG in /public */
            alt="Logo"
            fill
            sizes="(max-width: 640px) 75vw, 460px"
            priority
            className={styles.logoImg}
          />
        </div>

        <h1 className={styles.title}>Coming Soon</h1>
        <p className={styles.sub}>We’re nearly ready. Join the waitlist to be first in.</p>

        <form onSubmit={onSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            required
          />
          <button type="submit" className={styles.button} disabled={status === "loading"}>
            {status === "loading" ? "Joining…" : "Join"}
          </button>
        </form>

        {message && (
          <p className={status === "ok" ? styles.msgOk : styles.msgErr}>{message}</p>
        )}

        <p className={styles.footer}>© {new Date().getFullYear()} — All rights reserved.</p>
      </div>
    </main>
  );
}
