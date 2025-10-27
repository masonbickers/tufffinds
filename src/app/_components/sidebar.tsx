// src/app/_components/sidebar.tsx
"use client";
import React, { useEffect, useRef, CSSProperties } from "react";
import Image from "next/image";

export type SidebarLink = {
  label: string;
  href: string;
  cta?: boolean; // render as primary button
};

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  logoSrc?: string;
  links?: SidebarLink[];
  instagramUrl?: string;
  email?: string;
  /** Override colours if you like */
  bg?: string; // panel background
  ink?: string; // text colour
};

type PanelStyle = CSSProperties & { ["--bg"]?: string; ["--ink"]?: string };
type LinkStyle = CSSProperties & { ["--i"]?: number };

export default function Sidebar({
  open,
  onClose,
  logoSrc = "/CHANEL.png",
  links = [
    { label: "Home", href: "#home" },
    { label: "Quote", href: "#quote" },
    { label: "About", href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Founders / Contact", href: "#founders", cta: true },
  ],
  instagramUrl = "https://instagram.com",
  email = "hello@example.com",
  bg = "#f7f5f2",
  ink = "#0f0f0f",
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement | null>(null);

  // close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // lock scroll while open (adds class to <html>)
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.classList.add("menu-open");
    else root.classList.remove("menu-open");
    return () => root.classList.remove("menu-open");
  }, [open]);

  const panelStyle: PanelStyle = { "--bg": bg, "--ink": ink };
  const linkStyle = (i: number): LinkStyle => ({ "--i": i });

  return (
    <>
      {/* Overlay */}
      <div
        className="overlay"
        data-state={open ? "show" : "hide"}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className="sidebar"
        data-state={open ? "open" : "closed"}
        aria-hidden={!open}
        aria-labelledby="sidebar-title"
        style={panelStyle}
      >
        <div className="sidebar-header">
          <Image
            src={logoSrc}
            alt="Logo"
            width={120}
            height={28}
            className="sidebar-logo"
            priority
          />
          <h2 id="sidebar-title" className="sr-only">
            Site menu
          </h2>
          <button className="close-x" aria-label="Close menu" onClick={onClose}>
            ✕
          </button>
        </div>

        <nav className="sidebar-links" role="menu">
          {links.map((link, i) => (
            <a
              key={link.href}
              role="menuitem"
              href={link.href}
              onClick={onClose}
              className={link.cta ? "btn" : ""}
              style={linkStyle(i)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href={instagramUrl} target="_blank" rel="noreferrer">
            Instagram ↗
          </a>
          <a href={`mailto:${email}`}>{email}</a>
        </div>
      </aside>

      {/* Styles scoped globally so it “just works” */}
      <style jsx global>{`
        html.menu-open,
        body.menu-open {
          overflow: hidden;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Overlay — subtle, chic */
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 90;
          background: rgba(15, 15, 15, 0.32);
          backdrop-filter: blur(4px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.24s ease;
        }
        .overlay[data-state="show"] {
          opacity: 1;
          pointer-events: auto;
        }

        /* Sidebar — minimal + elegant */
        .sidebar {
          --bg: ${bg};
          --ink: ${ink};
          --line: rgba(0, 0, 0, 0.08);
          --radius: 14px;

          position: fixed;
          top: 0;
          right: 0;
          z-index: 100;
          height: 100svh;
          width: min(88vw, 360px);
          background: var(--bg);
          color: var(--ink);
          border-left: 1px solid var(--line);
          transform: translateX(16px);
          opacity: 0;
          transition: transform 0.28s cubic-bezier(0.32, 0.72, 0.28, 1),
            opacity 0.28s ease;
          display: grid;
          grid-template-rows: auto 1fr auto;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
            Roboto, Arial, sans-serif;
          letter-spacing: 0.01em;
        }
        .sidebar[data-state="open"] {
          transform: translateX(0);
          opacity: 1;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: 1px solid var(--line);
        }
        .sidebar-logo {
          width: 120px;
          height: auto;
          display: block;
          opacity: 0.92;
        }
        .close-x {
          appearance: none;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          padding: 8px;
          border-radius: 10px;
          transition: background 0.18s ease, transform 0.14s ease;
          color: var(--ink);
        }
        .close-x:hover {
          background: rgba(0, 0, 0, 0.05);
        }
        .close-x:active {
          transform: scale(0.97);
        }

        .sidebar-links {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 16px 12px;
        }
        .sidebar-links a {
          --delay: calc(70ms * var(--i, 0));
          display: block;
          padding: 12px 12px;
          border-radius: var(--radius);
          color: var(--ink);
          text-decoration: none;
          background: transparent;
          border: 1px solid transparent;
          transform: translateY(4px);
          opacity: 0;
          transition: transform 0.28s cubic-bezier(0.32, 0.72, 0.28, 1),
            opacity 0.28s ease, background 0.18s ease, border-color 0.18s ease;
        }
        .sidebar[data-state="open"] .sidebar-links a {
          transition-delay: var(--delay);
          transform: translateY(0);
          opacity: 1;
        }
        .sidebar-links a:hover {
          background: rgba(255, 255, 255, 0.6);
          border-color: var(--line);
        }
        .sidebar-links .btn {
          background: var(--ink);
          color: #fff;
          border-color: var(--ink);
        }
        .sidebar-links .btn:hover {
          filter: brightness(0.96);
        }

        .sidebar-footer {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          padding: 14px 20px 18px;
          border-top: 1px solid var(--line);
          color: #6f7177;
          font-size: 14px;
        }
        .sidebar-footer a {
          color: inherit;
          text-decoration: none;
          opacity: 0.9;
          transition: opacity 0.18s ease, text-decoration-color 0.18s ease;
        }
        .sidebar-footer a:hover {
          opacity: 1;
          text-decoration: underline;
        }

        @media (prefers-reduced-motion: reduce) {
          .overlay,
          .sidebar,
          .sidebar-links a {
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}
