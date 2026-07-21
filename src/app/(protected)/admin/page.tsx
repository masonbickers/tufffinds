"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "./_components/AdminShell";

type DashboardMetrics = {
  actionableThreads: number | null;
  clients: number | null;
  needsInfo: number | null;
  openRequests: number | null;
  ordersAwaitingPayment: number | null;
};

const EMPTY_METRICS: DashboardMetrics = {
  actionableThreads: null,
  clients: null,
  needsInfo: null,
  openRequests: null,
  ordersAwaitingPayment: null,
};

const METRIC_LABELS: Record<keyof DashboardMetrics, string> = {
  actionableThreads: "actionable message threads",
  clients: "client profiles",
  needsInfo: "requests needing information",
  openRequests: "open requests",
  ordersAwaitingPayment: "orders awaiting payment",
};

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [failedMetrics, setFailedMetrics] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      setIsLoading(true);
      setFailedMetrics([]);

      const results = await Promise.allSettled([
        getCountFromServer(collection(db, "client_profiles")).then(
          (snapshot) => snapshot.data().count,
        ),
        getCountFromServer(
          query(
            collection(db, "requests"),
            where("status", "not-in", ["closed", "cancelled"]),
          ),
        ).then((snapshot) => snapshot.data().count),
        getActionableThreadCount(),
        getCountFromServer(
          query(collection(db, "requests"), where("status", "==", "needs_info")),
        ).then((snapshot) => snapshot.data().count),
        getCountFromServer(
          query(collection(db, "orders"), where("status", "==", "invoice_sent")),
        ).then((snapshot) => snapshot.data().count),
      ]);

      if (cancelled) return;

      const keys: Array<keyof DashboardMetrics> = [
        "clients",
        "openRequests",
        "actionableThreads",
        "needsInfo",
        "ordersAwaitingPayment",
      ];
      const nextMetrics = { ...EMPTY_METRICS };
      const nextFailedMetrics: string[] = [];

      results.forEach((result, index) => {
        const key = keys[index];

        if (result.status === "fulfilled") {
          nextMetrics[key] = result.value;
          return;
        }

        console.error(`Failed to load dashboard metric: ${key}`, result.reason);
        nextFailedMetrics.push(METRIC_LABELS[key]);
      });

      setMetrics(nextMetrics);
      setFailedMetrics(nextFailedMetrics);
      setIsLoading(false);
    }

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  const hasNoActivity =
    !isLoading &&
    failedMetrics.length === 0 &&
    Object.values(metrics).every((value) => value === 0);

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
          Use Requests for sourcing, missing information and client approval.
          Use Orders for payment, purchasing, dispatch and delivery.
        </p>

        {isLoading ? (
          <DashboardNotice
            title="Loading dashboard metrics"
            body="Reading the latest operational counts from Firestore."
          />
        ) : null}

        {!isLoading && failedMetrics.length > 0 ? (
          <DashboardNotice
            tone="error"
            title="Some dashboard metrics could not be loaded"
            body={`Unavailable: ${failedMetrics.join(", ")}. The other live metrics are still shown below.`}
          />
        ) : null}

        {hasNoActivity ? (
          <DashboardNotice
            title="No operational activity yet"
            body="Firestore returned zero clients, open requests, actionable threads, requests needing information and orders awaiting payment."
          />
        ) : null}

        <div className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                value={formatMetric(metrics.clients, isLoading)}
                label="Total clients"
                detail="Client profile documents currently stored in Firestore."
              />
              <StatCard
                value={formatMetric(metrics.openRequests, isLoading)}
                label="Open requests"
                detail="Requests whose status is neither closed nor cancelled."
              />
              <StatCard
                value={formatMetric(metrics.actionableThreads, isLoading)}
                label="Actionable threads"
                detail="Conversations whose latest stored message is from a client."
              />
              <StatCard
                value={formatMetric(metrics.needsInfo, isLoading)}
                label="Needs information"
                detail="Requests currently marked as needing client information."
              />
              <StatCard
                value={formatMetric(metrics.ordersAwaitingPayment, isLoading)}
                label="Awaiting payment"
                detail="Orders with an invoice sent and payment still outstanding."
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
                body="Manage sourcing, missing information and client approval."
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
              body="Prioritise client replies, requests waiting on information and orders waiting for payment."
            >
              <div className="mt-5 space-y-3">
                <ChecklistItem
                  label="Reply to actionable messages"
                  meta={formatMetricLabel(
                    metrics.actionableThreads,
                    isLoading,
                    "thread",
                  )}
                />
                <ChecklistItem
                  label="Review requests needing info"
                  meta={formatMetricLabel(metrics.needsInfo, isLoading, "request")}
                />
                <ChecklistItem
                  label="Follow up orders awaiting payment"
                  meta={formatMetricLabel(
                    metrics.ordersAwaitingPayment,
                    isLoading,
                    "order",
                  )}
                />
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

async function getActionableThreadCount() {
  const snapshot = await getDocs(collection(db, "message_threads"));

  return snapshot.docs.reduce((total, entry) => {
    const data = entry.data() as {
      detail?: {
        messages?: Array<{ type?: unknown }>;
      };
    };
    const messages = Array.isArray(data.detail?.messages)
      ? data.detail.messages
      : [];
    const latestMessage = messages[messages.length - 1];

    return latestMessage?.type === "client" ? total + 1 : total;
  }, 0);
}

function formatMetric(value: number | null, isLoading: boolean) {
  if (isLoading) return "…";
  return value === null ? "—" : String(value);
}

function formatMetricLabel(
  value: number | null,
  isLoading: boolean,
  noun: string,
) {
  if (isLoading) return "Loading";
  if (value === null) return "Unavailable";
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

function DashboardNotice({
  body,
  title,
  tone = "neutral",
}: {
  body: string;
  title: string;
  tone?: "error" | "neutral";
}) {
  return (
    <section
      className={[
        "mt-6 rounded-[24px] border p-5",
        tone === "error"
          ? "border-[#E2B8AA] bg-[#FFF2EF] text-[#8B3D2D]"
          : "border-[#dfd1c2] bg-[#fcfaf6] text-[#241E1A]",
      ].join(" ")}
      role={tone === "error" ? "alert" : "status"}
    >
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 opacity-70">{body}</p>
    </section>
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
