// src/app/loading.tsx
import "./page.css";

export default function Loading() {
  return (
    <div className="route-loading" aria-live="polite" aria-busy="true">
      <img src="/handbag.png" alt="" className="bag-spin" />
      <p className="muted">Loading…</p>
    </div>
  );
}
