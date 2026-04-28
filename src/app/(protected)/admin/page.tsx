"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import AdminShell from "./_components/AdminShell";
export default function AdminDashboardPage() {
  return (
    <AdminShell active="dashboard">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
          Overview
        </p>

        <h1 className="mt-3 font-serif text-4xl">
          Tufffinds operations dashboard
        </h1>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-black/60">
          Use the sidebar to manage clients, requests and messages. Request workflow,
          invoices, payment, dispatch and delivery will sit inside each request page.
        </p>

        <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                value="24"
                label="Active clients"
                detail="Profiles currently being handled by the team."
              />
              <StatCard
                value="11"
                label="Open requests"
                detail="Sourcing work that still needs action or follow-up."
              />
              <StatCard
                value="5"
                label="Unread threads"
                detail="Conversations waiting for a response."
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <DashboardCard
                title="Clients"
                body="View client profiles, sizing, preferences and onboarding status."
                href="/admin/clients"
                cta="Open clients"
              />
              <DashboardCard
                title="Requests"
                body="Manage sourcing requests, missing info and request workflow."
                href="/admin/requests"
                cta="Open requests"
              />
              <DashboardCard
                title="Messages"
                body="Review request-linked conversations and move stalled threads forward."
                href="/admin/messages"
                cta="Open messages"
              />
            </div>
          </div>

          <div className="space-y-4">
            <PanelCard
              eyebrow="Today"
              title="Operations focus"
              body="Prioritise outstanding client replies, confirm paid orders and chase any requests waiting on item details."
            >
              <div className="mt-5 space-y-3">
                <ChecklistItem label="Reply to unread messages" meta="5 threads" />
                <ChecklistItem label="Review requests needing info" meta="3 requests" />
                <ChecklistItem label="Confirm payments sent today" meta="2 invoices" />
              </div>
            </PanelCard>

            <PanelCard
              eyebrow="Shortcuts"
              title="Jump into the workflow"
              body="Use the main areas below when you need to move quickly between sourcing, fulfilment and communication."
            >
              <div className="mt-5 grid gap-2">
                <QuickLink href="/admin/orders" label="Orders desk" />
                <QuickLink href="/admin/requests" label="Requests pipeline" />
                <QuickLink href="/admin/messages" label="Inbox review" />
              </div>
            </PanelCard>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function StatCard({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#e6d9ca] bg-[#f8f3ec] p-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-black/35">
        {label}
      </p>
      <p className="mt-3 font-serif text-4xl text-[#241E1A]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-black/58">{detail}</p>
    </div>
  );
}

function DashboardCard({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-[#e3d6c8] bg-[#fbf7f2] p-5 transition hover:border-[#d2c0ae] hover:bg-[#f8f0e6]"
    >
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-black/60">{body}</p>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a5d46]">
        {cta}
      </p>
    </Link>
  );
}

function PanelCard({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#dfd1c2] bg-[#fcfaf6] p-5">
      <p className="text-[11px] uppercase tracking-[0.24em] text-black/35">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-[2rem] leading-none">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-black/60">{body}</p>
      {children}
    </section>
  );
}

function ChecklistItem({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#eadfd3] bg-white px-4 py-3">
      <span className="text-sm text-[#241E1A]">{label}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8b6d55]">
        {meta}
      </span>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#eadfd3] bg-white px-4 py-3 text-sm text-[#241E1A] transition hover:border-[#d2c0ae] hover:bg-[#f8f0e6]"
    >
      {label}
    </Link>
  );
}
