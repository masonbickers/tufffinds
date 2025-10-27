"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { WHATSAPP_POOL, type WaTarget } from "@/app/lib/whatsappPool";

/** Weighted random pick (roulette wheel) */
function pickWeightedRandom(pool: WaTarget[]): WaTarget {
  const total = pool.reduce((s, t) => s + (t.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const t of pool) {
    r -= t.weight ?? 1;
    if (r <= 0) return t;
  }
  return pool[pool.length - 1];
}

/** Read the assigned key from cookie if present */
function readAssignmentCookie(): string | null {
  const name = "wa_affinity=";
  const found = document.cookie.split("; ").find((c) => c.startsWith(name));
  return found ? decodeURIComponent(found.slice(name.length)) : null;
}

/** Write the assigned key into the cookie (sticky ~180 days) */
function writeAssignmentCookie(key: string) {
  document.cookie = `wa_affinity=${encodeURIComponent(key)}; Max-Age=${60 * 60 * 24 * 180}; Path=/; SameSite=Lax`;
}

/** Clear the assignment cookie (for testing) */
function clearAssignmentCookie() {
  document.cookie = `wa_affinity=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** Optional: simple local round-robin for debugging (per device) */
function getCycledTarget(pool: WaTarget[]): WaTarget {
  const k = "wa_cycle_idx";
  const n = pool.length;
  let idx = Number(localStorage.getItem(k) ?? "0") || 0;
  const picked = pool[idx % n];
  localStorage.setItem(k, String((idx + 1) % n));
  return picked;
}

export default function LinkRotator() {
  const query = useSearchParams();

  useEffect(() => {
    const forceId = (query.get("id") || "").toLowerCase();
    const textOverride = (query.get("text") || "").trim();
    const reset = query.get("reset") === "1";
    const cycle = query.get("cycle") === "1";

    if (reset) {
      clearAssignmentCookie();
    }

    let target: WaTarget | undefined;

    // 1) Forced recipient via ?id=
    if (forceId) {
      target = WHATSAPP_POOL.find((t) => t.key.toLowerCase() === forceId);
    }

    // 2) Dev cycle mode (alternates per click on this device)
    if (!target && cycle) {
      target = getCycledTarget(WHATSAPP_POOL);
    }

    // 3) Sticky cookie assignment (assign once if missing)
    if (!target) {
      const assignedKey = readAssignmentCookie();
      if (assignedKey) {
        target = WHATSAPP_POOL.find((t) => t.key.toLowerCase() === assignedKey.toLowerCase());
      }
      if (!target) {
        // First time on this device: weighted random, then store the key
        const picked = pickWeightedRandom(WHATSAPP_POOL);
        writeAssignmentCookie(picked.key);
        target = picked;
      }
    }

    // Fallback (shouldn't happen)
    if (!target) target = WHATSAPP_POOL[0];

    const msg = (textOverride || target.text || "").trim();
    const web = `https://wa.me/${target.number}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
    const deep = `whatsapp://send?phone=${target.number}${msg ? `&text=${encodeURIComponent(msg)}` : ""}`;

    // Try the app first, then fallback to Web
    window.location.href = deep;
    const t = setTimeout(() => {
      if (!document.hidden) window.location.replace(web);
    }, 600);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <main style={{
      display: "flex",
      minHeight: "100dvh",
      alignItems: "center",
      justifyContent: "center",
      background: "#000",
      color: "#9ca3af",
      fontFamily: "system-ui,-apple-system,Segoe UI,Roboto"
    }}>
      Opening WhatsApp…
    </main>
  );
}
