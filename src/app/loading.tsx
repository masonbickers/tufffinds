// src/app/loading.tsx
import Image from "next/image";
import "./page.css";

export default function Loading() {
  return (
    <div className="route-loading" aria-live="polite" aria-busy="true">
      <Image
        src="/handbag.png"
        alt=""
        width={64}
        height={64}
        className="bag-spin"
        priority
      />
      <p className="muted">Loading…</p>
    </div>
  );
}
