"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAdminSession } from "./AdminGuard";
import styles from "./AdminWorkspace.module.css";

export type AdminSection =
  | "dashboard"
  | "clients"
  | "requests"
  | "orders"
  | "sourcing"
  | "suppliers"
  | "shipments"
  | "finance"
  | "marketing"
  | "email-signups"
  | "email-campaigns"
  | "reports"
  | "team"
  | "settings";

type AdminMetrics = {
  clients: number;
  requests: number;
  threads: number;
  needsInfo: number;
};

type AdminShellProps = {
  active: AdminSection;
  children: React.ReactNode;
  metrics?: AdminMetrics;
};

type AdminNavItem = {
  href: string;
  label: string;
  section: AdminSection;
  activeOn?: AdminSection[];
  planned?: boolean;
};

const NAV_GROUPS: Array<{
  label: string;
  items: AdminNavItem[];
}> = [
  {
    label: "Workspace",
    items: [
      { href: "/admin", label: "Dashboard", section: "dashboard" },
      { href: "/admin/clients", label: "Clients", section: "clients" },
      { href: "/admin/requests", label: "Requests", section: "requests" },
      { href: "/admin/orders", label: "Orders", section: "orders" },
    ],
  },
  {
    label: "Growth",
    items: [
      {
        href: "/admin/marketing",
        label: "Marketing",
        section: "marketing",
        activeOn: ["marketing", "email-signups", "email-campaigns"],
      },
      {
        href: "/admin/reports",
        label: "Reports",
        section: "reports",
        planned: true,
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        href: "/admin/team",
        label: "Team",
        section: "team",
      },
      { href: "/admin/settings", label: "Settings", section: "settings" },
    ],
  },
];

const SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  requests: "Requests",
  orders: "Orders",
  sourcing: "Sourcing",
  suppliers: "Suppliers",
  shipments: "Shipments",
  finance: "Finance",
  marketing: "Marketing",
  "email-signups": "Email signups",
  "email-campaigns": "Email campaigns",
  reports: "Reports",
  team: "Team",
  settings: "Settings",
};

export default function AdminShell({
  active,
  children,
  metrics,
}: AdminShellProps) {
  const { signOut, signOutError, user } = useAdminSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    const sidebar = mobileSidebarRef.current;
    const focusable = sidebar?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    document.body.style.overflow = "hidden";
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }

      if (event.key !== "Tab" || !focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const sidebarProps = {
    active,
    isSigningOut,
    metrics,
    onNavigate: () => setMenuOpen(false),
    onSignOut: handleSignOut,
    signOutError,
    userEmail: user.email || "Unknown admin",
  };

  return (
    <main className={styles.workspace}>
      <a href="#admin-content" className={styles.skipLink}>
        Skip to admin content
      </a>

      <aside className={`${styles.desktopSidebar} print:hidden`} aria-label="Admin sidebar">
        <SidebarContent {...sidebarProps} />
      </aside>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close admin navigation"
            className={styles.mobileScrim}
            onClick={() => setMenuOpen(false)}
          />
          <aside
            id="admin-mobile-navigation"
            ref={mobileSidebarRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className={`${styles.mobileSidebar} print:hidden`}
          >
            <SidebarContent
              {...sidebarProps}
              showClose
              onClose={() => setMenuOpen(false)}
            />
          </aside>
        </>
      ) : null}

      <div className={styles.contentColumn}>
        <header className={`${styles.topbar} print:hidden`}>
          <div className={styles.topbarStart}>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen(true)}
              className={styles.menuButton}
              aria-label="Open admin navigation"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-navigation"
            >
              <MenuIcon />
            </button>
            <div className="min-w-0">
              <p className={styles.topbarEyebrow}>Admin workspace</p>
              <p className={styles.topbarTitle}>{SECTION_LABELS[active]}</p>
            </div>
          </div>
          <div className={styles.topbarEnd} aria-label="Signed-in status">
            <span className={styles.verifiedDot} aria-hidden="true" />
            <span className={styles.verifiedText}>Verified</span>
            <span className={styles.topbarDivider} aria-hidden="true" />
            <span className={styles.topbarEmail}>{user.email}</span>
          </div>
        </header>

        <section
          id="admin-content"
          className={styles.pageContainer}
          aria-label={`${SECTION_LABELS[active]} content`}
          tabIndex={-1}
        >
          {children}
        </section>
      </div>
    </main>
  );
}

function SidebarContent({
  active,
  isSigningOut,
  metrics,
  onClose,
  onNavigate,
  onSignOut,
  showClose = false,
  signOutError,
  userEmail,
}: {
  active: AdminSection;
  isSigningOut: boolean;
  metrics?: AdminMetrics;
  onClose?: () => void;
  onNavigate: () => void;
  onSignOut: () => Promise<void>;
  showClose?: boolean;
  signOutError: string;
  userEmail: string;
}) {
  return (
    <div className={styles.sidebarInner}>
      <div className={styles.brandRow}>
        <Link
          href="/admin"
          onClick={onNavigate}
          className={styles.brand}
          aria-label="Tufffinds admin dashboard"
        >
          <Image
            src="/finallogobrown.png"
            alt="Tufffinds"
            width={132}
            height={16}
            priority
            className={styles.brandLogo}
          />
        </Link>
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            className={styles.iconButton}
            aria-label="Close admin navigation"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <nav className={styles.navigation} aria-label="Admin sections">
        {NAV_GROUPS.map((group) => (
          <div className={styles.navGroup} key={group.label}>
            <p className={styles.navLabel}>{group.label}</p>
            <ul className={styles.navList}>
              {group.items.map((item) => (
                <li key={item.section}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={
                      (item.activeOn ?? [item.section]).includes(active)
                        ? "page"
                        : undefined
                    }
                    className={`${styles.navLink} ${
                      (item.activeOn ?? [item.section]).includes(active)
                        ? styles.navLinkActive
                        : ""
                    }`}
                  >
                    <span className={styles.navLinkText}>{item.label}</span>
                    {item.planned ? (
                      <span className={styles.navBadge}>Planned</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {metrics ? (
        <section className={styles.metrics} aria-label="Current view metrics">
          <p className={styles.metricsLabel}>Current view</p>
          <div className={styles.metricGrid}>
            <MetricMini label="Clients" value={metrics.clients} />
            <MetricMini label="Requests" value={metrics.requests} />
            <MetricMini label="Threads" value={metrics.threads} />
            <MetricMini label="Needs info" value={metrics.needsInfo} />
          </div>
        </section>
      ) : null}

      <div className={styles.session}>
        <p className={styles.sessionEmail} title={userEmail}>
          {userEmail}
        </p>
        <button
          type="button"
          onClick={onSignOut}
          disabled={isSigningOut}
          className={styles.signOutButton}
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
        {signOutError ? (
          <p className={styles.signOutError} role="alert">
            {signOutError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metricMini}>
      <p className={styles.metricMiniLabel}>{label}</p>
      <p className={styles.metricMiniValue}>{value}</p>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 fill-none stroke-current stroke-[1.7]"
    >
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 fill-none stroke-current stroke-[1.7]"
    >
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}
