"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import {
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminState,
  AdminStatusBadge,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../_components/AdminUI";

type CampaignStatus = {
  accepted?: number;
  completed?: boolean;
  exists: boolean;
  failed?: number;
  pending?: number;
  status?: string;
};

type RecentSignup = {
  createdAt: Date | null;
  email: string;
  id: string;
  type: "Newsletter" | "Waitlist";
};

type DashboardData = {
  campaign: CampaignStatus | null;
  newsletterCount: number;
  recentSignups: RecentSignup[];
  waitlistCount: number;
};

const readCampaignStatus = httpsCallable<Record<string, never>, CampaignStatus>(
  functions,
  "getLaunchEmailCampaignStatus",
);

const SOCIAL_ACCOUNTS = [
  {
    handle: "@tufffinds__",
    href: "https://www.instagram.com/tufffinds__/",
    name: "Instagram",
  },
  { handle: "Not added", href: "", name: "TikTok" },
  { handle: "Not added", href: "", name: "Facebook" },
  { handle: "Not added", href: "", name: "Pinterest" },
] as const;

export default function MarketingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const newsletterRef = collection(db, "newsletter_signups");
        const waitlistRef = collection(db, "waitlist");

        const [
          newsletterCount,
          waitlistCount,
          newsletterRecent,
          waitlistRecent,
          campaignResult,
        ] = await Promise.all([
          getCountFromServer(newsletterRef),
          getCountFromServer(waitlistRef),
          getDocs(query(newsletterRef, orderBy("createdAt", "desc"), limit(5))),
          getDocs(query(waitlistRef, orderBy("createdAt", "desc"), limit(5))),
          readCampaignStatus({}).catch(() => null),
        ]);

        if (cancelled) return;

        const recentSignups = [
          ...newsletterRecent.docs.map((entry) =>
            signupFromDocument(entry.id, entry.data(), "Newsletter"),
          ),
          ...waitlistRecent.docs.map((entry) =>
            signupFromDocument(entry.id, entry.data(), "Waitlist"),
          ),
        ]
          .sort(
            (left, right) =>
              (right.createdAt?.getTime() ?? 0) -
              (left.createdAt?.getTime() ?? 0),
          )
          .slice(0, 6);

        setData({
          campaign: campaignResult?.data ?? null,
          newsletterCount: newsletterCount.data().count,
          recentSignups,
          waitlistCount: waitlistCount.data().count,
        });
        setError("");
      } catch (loadError) {
        console.error("Failed to load marketing dashboard", loadError);
        if (!cancelled) {
          setError("Marketing data could not be loaded. Please try again.");
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalSignups = data
    ? data.newsletterCount + data.waitlistCount
    : "—";
  const campaign = useMemo(
    () => describeCampaign(data?.campaign ?? null),
    [data?.campaign],
  );

  return (
    <AdminShell active="marketing">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Growth"
          title="Marketing dashboard"
          description="Monitor your audience and manage email activity from one place."
          actions={
            <Link
              href="/admin/email-campaigns"
              className={adminPrimaryButton}
            >
              Create campaign
            </Link>
          }
        />

        {error ? (
          <AdminState
            title="Marketing dashboard unavailable"
            body={error}
            tone="error"
          />
        ) : null}

        <section
          className="grid divide-y divide-[#e2d9cf] border-y border-[#e2d9cf] sm:grid-cols-4 sm:divide-x sm:divide-y-0"
          aria-label="Marketing summary"
        >
          <SummaryMetric
            href="/admin/email-signups"
            label="Total signups"
            value={totalSignups}
            detail="All audience records"
          />
          <SummaryMetric
            href="/admin/email-signups"
            label="Newsletter"
            value={data?.newsletterCount ?? "—"}
            detail="Newsletter subscribers"
          />
          <SummaryMetric
            href="/admin/email-signups"
            label="Waitlist"
            value={data?.waitlistCount ?? "—"}
            detail="Waitlist subscribers"
          />
          <SummaryMetric
            href="/admin/email-campaigns"
            label="Campaign"
            value={campaign.label}
            detail={campaign.detail}
          />
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)]">
          <AdminSection
            title="Recent signups"
            description="The latest newsletter and waitlist submissions."
          >
            <div className="divide-y divide-[#e8e1d9] overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
              {!data && !error ? (
                <AdminState
                  title="Loading recent signups"
                  body="Reading the newest audience records."
                />
              ) : null}
              {data && data.recentSignups.length === 0 ? (
                <AdminState
                  title="No signups yet"
                  body="Newsletter and waitlist submissions will appear here."
                />
              ) : null}
              {data?.recentSignups.map((signup) => (
                <Link
                  key={signup.id}
                  href="/admin/email-signups"
                  className="group grid min-w-0 gap-3 px-4 py-3.5 transition hover:bg-[#faf7f2] focus:outline-none sm:grid-cols-[minmax(0,1fr)_auto_2rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="mb-2">
                      <AdminStatusBadge
                        tone={signup.type === "Newsletter" ? "info" : "neutral"}
                      >
                        {signup.type}
                      </AdminStatusBadge>
                    </div>
                    <p className="truncate text-sm font-medium text-[#302722]">
                      {signup.email || "Email unavailable"}
                    </p>
                  </div>
                  <p className="text-xs font-medium text-[#62564e]">
                    {formatDate(signup.createdAt)}
                  </p>
                  <span aria-hidden="true" className="hidden text-right text-[#9a8d83] sm:block">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </AdminSection>

          <AdminSection
            title="Quick actions"
            description="Frequent marketing destinations."
          >
            <nav aria-label="Marketing actions">
              <div className="divide-y divide-[#e5ddd4] overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
                <QuickLink
                  href="/admin/email-signups"
                  label="View email signups"
                  detail={`${totalSignups} audience records`}
                />
                <QuickLink
                  href="/admin/email-campaigns"
                  label="Manage email campaigns"
                  detail={campaign.detail}
                />
                <QuickLink
                  href="/admin/email-campaigns"
                  label="Preview email templates"
                  detail="Review welcome and launch emails"
                />
              </div>
            </nav>
          </AdminSection>
        </div>

        <AdminSection
          title="Social media"
          description="Access Tufffinds social accounts and see which channels have been added."
          action={
            <span className="text-xs text-[#81746a]">
              1 of {SOCIAL_ACCOUNTS.length} added
            </span>
          }
        >
          <div className="grid overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white sm:grid-cols-2 xl:grid-cols-4">
            {SOCIAL_ACCOUNTS.map((account) => (
              <article
                key={account.name}
                className="flex min-h-40 min-w-0 flex-col border-b border-r border-[#e5ddd4] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0e9e2] text-xs font-semibold text-[#55453a]"
                    >
                      {account.name.slice(0, 2).toUpperCase()}
                    </span>
                    <h3 className="truncate text-sm font-semibold text-[#302722]">
                      {account.name}
                    </h3>
                  </div>
                  <AdminStatusBadge tone={account.href ? "success" : "neutral"}>
                    {account.href ? "Added" : "Not added"}
                  </AdminStatusBadge>
                </div>
                <p className="mt-4 truncate text-xs text-[#81746a]">
                  {account.handle}
                </p>
                <div className="mt-auto pt-5">
                  {account.href ? (
                    <a
                      href={account.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#55453a] underline decoration-[#b8a99c] underline-offset-4 hover:text-black"
                    >
                      Open profile ↗
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="text-xs text-[#9a8d83]">
                      Connection not configured
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#81746a]">
            Profile links are available now. Publishing and performance
            analytics will require each platform&apos;s API connection.
          </p>
        </AdminSection>

        <AdminSection
          title="Campaign overview"
          description="Current launch campaign delivery status."
          action={
            <Link
                href="/admin/email-campaigns"
                className={adminSecondaryButton}
              >
              Open campaign workspace
              </Link>
          }
        >
          <div className="grid overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white sm:grid-cols-2 xl:grid-cols-4">
            <CampaignPanel
              label="Status"
              value={campaign.label}
              detail={campaign.detail}
              badgeTone={campaign.tone}
            />
            <CampaignPanel
              label="Accepted"
              value={data?.campaign?.accepted ?? "—"}
              detail="Accepted for delivery"
            />
            <CampaignPanel
              label="Pending"
              value={data?.campaign?.pending ?? "—"}
              detail="Waiting to be processed"
            />
            <CampaignPanel
              label="Failed"
              value={data?.campaign?.failed ?? "—"}
              detail="May need attention"
            />
            </div>
        </AdminSection>
      </AdminPage>
    </AdminShell>
  );
}

function SummaryMetric({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group min-w-0 transition hover:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#806650]"
    >
      <AdminMetric label={label} value={value} detail={`${detail} →`} />
    </Link>
  );
}

function QuickLink({
  detail,
  href,
  label,
}: {
  detail: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition hover:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#806650]"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#302722]">{label}</p>
        <p className="mt-0.5 truncate text-xs text-[#81746a]">{detail}</p>
      </div>
      <span aria-hidden="true" className="text-[#9a8d83]">
        →
      </span>
    </Link>
  );
}

function CampaignPanel({
  badgeTone,
  detail,
  label,
  value,
}: {
  badgeTone?: "neutral" | "info" | "success" | "warning" | "danger";
  detail: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 border-b border-r border-[#e5ddd4] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#807269]">
          {label}
        </p>
        {badgeTone ? (
          <AdminStatusBadge tone={badgeTone}>{value}</AdminStatusBadge>
        ) : null}
      </div>
      {!badgeTone ? (
        <p className="mt-3 text-lg font-semibold tabular-nums text-[#2c241f]">
          {value}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-[#81746a]">{detail}</p>
    </div>
  );
}

function signupFromDocument(
  id: string,
  value: Record<string, unknown>,
  type: RecentSignup["type"],
): RecentSignup {
  const timestamp = value.createdAt as { toDate?: () => Date } | undefined;
  return {
    createdAt:
      typeof timestamp?.toDate === "function" ? timestamp.toDate() : null,
    email: typeof value.email === "string" ? value.email : "",
    id: `${type}:${id}`,
    type,
  };
}

function describeCampaign(campaign: CampaignStatus | null): {
  detail: string;
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
} {
  if (!campaign) {
    return {
      detail: "Campaign status is currently unavailable.",
      label: "Unavailable",
      tone: "neutral",
    };
  }
  if (!campaign.exists) {
    return {
      detail: "No launch campaign has been started.",
      label: "Not started",
      tone: "neutral",
    };
  }
  if ((campaign.failed ?? 0) > 0) {
    return {
      detail: `${campaign.failed} email${campaign.failed === 1 ? "" : "s"} failed and may need attention.`,
      label: "Needs attention",
      tone: "danger",
    };
  }
  if (campaign.completed) {
    return {
      detail: `${campaign.accepted ?? 0} emails were accepted for delivery.`,
      label: "Complete",
      tone: "success",
    };
  }
  return {
    detail: `${campaign.pending ?? 0} emails are waiting to be processed.`,
    label: campaign.status === "running" ? "Sending" : "In progress",
    tone: "info",
  };
}

function formatDate(value: Date | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
