"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminSession } from "./AdminGuard";

type AdminSection =
  | "dashboard"
  | "clients"
  | "requests"
  | "messages"
  | "orders"
  | "email-signups"
  | "email-campaigns";

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

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  section: AdminSection;
}> = [
  { href: "/admin", label: "Dashboard", section: "dashboard" },
  { href: "/admin/clients", label: "Clients", section: "clients" },
  { href: "/admin/requests", label: "Requests", section: "requests" },
  { href: "/admin/orders", label: "Orders", section: "orders" },
  { href: "/admin/messages", label: "Messages", section: "messages" },
  {
    href: "/admin/email-signups",
    label: "Email signups",
    section: "email-signups",
  },
  {
    href: "/admin/email-campaigns",
    label: "Email campaigns",
    section: "email-campaigns",
  },
];

export default function AdminShell({
  active,
  children,
  metrics,
}: AdminShellProps) {
  const { signOut, signOutError, user } = useAdminSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#efe7dc] text-[#241E1A]">
      <div className="flex min-h-screen flex-col lg:block">
          <aside className="overflow-hidden border border-[#3A2F28] bg-[#221C18] text-[#F8F1E9] shadow-[0_20px_50px_rgba(30,22,17,0.16)] lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-[244px] lg:rounded-none">
            <div className="flex h-full flex-col p-5 sm:p-6">
              <div>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D6BFA8]/20 bg-[#3A2F28] text-sm font-semibold tracking-[0.18em] text-[#E8D5C2]">
                  TF
                </div>

                <p className="text-[10px] uppercase tracking-[0.28em] text-[#BFA58E]">
                  Tufffinds admin
                </p>

                <h1 className="mt-2 font-serif text-[1.85rem] leading-none text-[#FFF9F3]">
                  Operations
                </h1>

                <p className="mt-2 max-w-[18rem] text-xs leading-5 text-[#C9B7A6]">
                  Clients, requests, orders, invoices and fulfilment.
                </p>
              </div>

              <nav className="mt-7">
                <p className="mb-3 px-1 text-[9px] font-semibold uppercase tracking-[0.26em] text-[#BFA58E]">
                  Workspace
                </p>

                <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1.5">
                  {NAV_ITEMS.map((item) => (
                    <SidebarLink
                      key={item.section}
                      href={item.href}
                      label={item.label}
                      active={active === item.section}
                    />
                  ))}
                </div>

                {metrics ? (
                  <div className="mt-8">
                    <p className="mb-3 px-1 text-[9px] font-semibold uppercase tracking-[0.26em] text-[#BFA58E]">
                      Snapshot
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <MetricMini label="Clients" value={metrics.clients} />
                      <MetricMini label="Reqs" value={metrics.requests} />
                      <MetricMini label="Threads" value={metrics.threads} />
                      <MetricMini label="Info" value={metrics.needsInfo} />
                    </div>
                  </div>
                ) : null}
              </nav>

              <div className="mt-6 border-t border-[#D6BFA8]/15 pt-4 lg:mt-auto">
                <div className="mb-3 rounded-2xl border border-[#D6BFA8]/15 bg-[#2B231E] p-3">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-[#BFA58E]">
                    Session
                  </p>

                  <p className="mt-2 truncate text-xs text-[#E8D5C2]">
                    {user.email || "Unknown"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full rounded-2xl border border-[#D6BFA8]/20 bg-[#2B231E] px-3 py-2.5 text-left text-xs font-semibold text-[#E8D5C2] transition hover:bg-[#F3EEE6] hover:text-[#221C18] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out…" : "Logout"}
                </button>

                {signOutError ? (
                  <p className="mt-3 text-xs text-[#F2B8A8]" role="alert">
                    {signOutError}
                  </p>
                ) : null}
              </div>
            </div>
          </aside>

          <section className="min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:ml-[244px] lg:px-8">
            <header className="sticky top-4 z-30 mb-4 rounded-[24px] border border-[#d8c8b7] bg-[#fbf7f1]/94 px-5 py-4 shadow-[0_10px_24px_rgba(62,44,31,0.05)] backdrop-blur sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.28em] text-black/35">
                    Tufffinds workspace
                  </p>

                  <p className="font-serif text-lg text-[#241E1A] sm:text-[1.35rem]">
                    Operations desk
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
                  <span className="rounded-full border border-[#B8D6BC] bg-[#E8F5E9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2F5A34]">
                    Verified
                  </span>

                  <span className="truncate text-xs text-black/45 sm:max-w-[18rem]">
                    {user.email}
                  </span>
                </div>
              </div>
            </header>

            <div className="rounded-[28px] border border-[#dacbbb] bg-white p-5 shadow-[0_18px_46px_rgba(62,44,31,0.08)] sm:p-6 lg:p-8">
              {children}
            </div>
          </section>
      </div>
    </main>
  );
}

function SidebarLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition lg:flex",
        active
          ? "border-[#f0e5d8] bg-[#F3EEE6] text-[#221C18] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
          : "border-[#3a2f28] bg-[#2B231E] text-[#D7C6B6] hover:border-[#5a4a3f] hover:bg-[#312822] hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#3a2f28] bg-[#2B231E] p-2.5">
      <p className="text-[9px] uppercase tracking-[0.18em] text-[#BFA58E]">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-[#FFF9F3]">
        {value}
      </p>
    </div>
  );
}
