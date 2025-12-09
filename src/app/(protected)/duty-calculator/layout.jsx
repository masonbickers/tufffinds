"use client";

import "./override.css";

export default function DutyCalculatorLayout({ children }) {
  return (
    <main className="duty-wrapper">
      <div className="duty-inner">
        {children}
      </div>
    </main>
  );
}
