"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIGNUP_SOURCES = [
  {
    collectionName: "newsletter_signups",
    label: "Newsletter",
    type: "newsletter",
  },
  { collectionName: "waitlist", label: "Waitlist", type: "waitlist" },
] as const;

type SignupType = (typeof SIGNUP_SOURCES)[number]["type"];
type AdminState = "eligible" | "suppressed" | "invalid" | "archived";
type DuplicateFilter = "all" | "duplicate" | "unique";
type EligibilityFilter = "all" | AdminState;

type EmailSignup = {
  adminState: AdminState | null;
  collectionName: string;
  createdAt: Date | null;
  documentId: string;
  email: string;
  key: string;
  legacySuppressed: boolean;
  normalizedEmail: string;
  page: string;
  source: string;
  type: SignupType;
  typeLabel: string;
};

type DisplaySignup = EmailSignup & {
  duplicateCount: number;
  effectiveState: AdminState;
};

type CleanupTarget = {
  signup: DisplaySignup;
  state: AdminState;
};

export default function EmailSignupsPage() {
  const [signups, setSignups] = useState<EmailSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [partialError, setPartialError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SignupType>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [duplicateFilter, setDuplicateFilter] =
    useState<DuplicateFilter>("all");
  const [eligibilityFilter, setEligibilityFilter] =
    useState<EligibilityFilter>("all");
  const [cleanupTarget, setCleanupTarget] = useState<CleanupTarget | null>(null);
  const [cleanupReason, setCleanupReason] = useState("");
  const [cleanupConfirmed, setCleanupConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cleanupFeedback, setCleanupFeedback] = useState("");

  const loadSignups = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setPartialError("");

    const results = await Promise.allSettled(
      SIGNUP_SOURCES.map(async (signupSource) => {
        const snapshot = await getDocs(
          collection(db, signupSource.collectionName),
        );

        return snapshot.docs.map((entry) => {
          const data = entry.data() as Record<string, unknown>;
          const email = readString(data.email);
          return {
            adminState: readAdminState(data.emailAdmin),
            collectionName: signupSource.collectionName,
            createdAt: normalizeDate(data.createdAt),
            documentId: entry.id,
            email,
            key: `${signupSource.type}:${entry.id}`,
            legacySuppressed: hasLegacySuppression(data),
            normalizedEmail: normalizeEmail(email),
            page: readString(data.page),
            source: readString(data.source),
            type: signupSource.type,
            typeLabel: signupSource.label,
          } satisfies EmailSignup;
        });
      }),
    );

    const loaded = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const failedLabels = results.flatMap((result, index) =>
      result.status === "rejected" ? [SIGNUP_SOURCES[index].label] : [],
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Failed to load ${SIGNUP_SOURCES[index].collectionName}`,
          result.reason,
        );
      }
    });

    setSignups(
      loaded.sort(
        (left, right) =>
          (right.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY) -
          (left.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY),
      ),
    );
    if (failedLabels.length === SIGNUP_SOURCES.length) {
      setError("Email signups could not be loaded. Please try again.");
    } else if (failedLabels.length > 0) {
      setPartialError(
        `${failedLabels.join(" and ")} records could not be loaded. Counts, duplicate detection and exports currently include only the available list.`,
      );
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadSignups();
  }, [loadSignups]);

  const displaySignups = useMemo(() => deriveDisplaySignups(signups), [signups]);
  const availableSources = useMemo(
    () => [...new Set(signups.map((signup) => signup.source).filter(Boolean))],
    [signups],
  );
  const filteredSignups = useMemo(() => {
    const term = search.trim().toLowerCase();

    return displaySignups.filter((signup) => {
      const matchesType = typeFilter === "all" || signup.type === typeFilter;
      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "__missing__"
          ? !signup.source
          : signup.source === sourceFilter);
      const matchesDuplicate =
        duplicateFilter === "all" ||
        (duplicateFilter === "duplicate"
          ? signup.duplicateCount > 1
          : signup.duplicateCount <= 1);
      const matchesEligibility =
        eligibilityFilter === "all" ||
        signup.effectiveState === eligibilityFilter;
      const matchesSearch =
        !term ||
        signup.email.toLowerCase().includes(term) ||
        signup.normalizedEmail.includes(term);

      return (
        matchesType &&
        matchesSource &&
        matchesDuplicate &&
        matchesEligibility &&
        matchesSearch
      );
    });
  }, [
    displaySignups,
    duplicateFilter,
    eligibilityFilter,
    search,
    sourceFilter,
    typeFilter,
  ]);
  const summary = useMemo(() => summarize(displaySignups), [displaySignups]);

  function beginCleanup(signup: DisplaySignup, state: AdminState) {
    setCleanupTarget({ signup, state });
    setCleanupReason("");
    setCleanupConfirmed(false);
    setCleanupFeedback("");
  }

  async function saveCleanupState() {
    if (
      !cleanupTarget ||
      cleanupReason.trim().length < 5 ||
      cleanupReason.trim().length > 200 ||
      !cleanupConfirmed ||
      isSaving
    ) {
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setCleanupFeedback("Your admin session has expired. Sign in again.");
      return;
    }

    setIsSaving(true);
    setCleanupFeedback("");
    try {
      await updateDoc(
        doc(
          db,
          cleanupTarget.signup.collectionName,
          cleanupTarget.signup.documentId,
        ),
        {
          emailAdmin: {
            reason: cleanupReason.trim(),
            state: cleanupTarget.state,
            updatedAt: serverTimestamp(),
            updatedByUid: uid,
          },
        },
      );
      setCleanupTarget(null);
      setCleanupReason("");
      setCleanupConfirmed(false);
      await loadSignups();
      setCleanupFeedback("Eligibility state updated. Original signup data was preserved.");
    } catch (saveError) {
      console.error("Failed to update signup eligibility", saveError);
      setCleanupFeedback("The eligibility state could not be updated. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminShell active="email-signups">
      <div className="space-y-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              Audience
            </p>
            <h1 className="mt-3 font-serif text-4xl text-[#241E1A]">
              Email signups
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">
              Review newsletter and waitlist records without rewriting or
              merging their original signup history.
            </p>
          </div>
          <button
            type="button"
            disabled={isLoading || filteredSignups.length === 0}
            onClick={() => exportCsv(filteredSignups)}
            className="rounded-xl bg-[#40342F] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Export filtered CSV
          </button>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Loaded records" value={summary.totalRecords} />
          <SummaryCard label="Unique valid emails" value={summary.uniqueValid} />
          <SummaryCard label="Eligible emails" value={summary.eligibleUnique} />
          <SummaryCard label="Duplicate records" value={summary.duplicates} />
          <SummaryCard label="Invalid records" value={summary.invalid} />
        </div>

        <div className="grid gap-3 rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] p-4 md:grid-cols-2 xl:grid-cols-5">
          <FilterLabel label="Search email">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email address"
              className={inputClass}
            />
          </FilterLabel>
          <FilterLabel label="List type">
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as "all" | SignupType)
              }
              className={inputClass}
            >
              <option value="all">All lists</option>
              <option value="newsletter">Newsletter</option>
              <option value="waitlist">Waitlist</option>
            </select>
          </FilterLabel>
          <FilterLabel label="Source">
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">All sources</option>
              <option value="__missing__">Source unavailable</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </FilterLabel>
          <FilterLabel label="Duplicates">
            <select
              value={duplicateFilter}
              onChange={(event) =>
                setDuplicateFilter(event.target.value as DuplicateFilter)
              }
              className={inputClass}
            >
              <option value="all">All records</option>
              <option value="duplicate">Duplicates only</option>
              <option value="unique">Single records</option>
            </select>
          </FilterLabel>
          <FilterLabel label="Eligibility">
            <select
              value={eligibilityFilter}
              onChange={(event) =>
                setEligibilityFilter(event.target.value as EligibilityFilter)
              }
              className={inputClass}
            >
              <option value="all">All states</option>
              <option value="eligible">Eligible</option>
              <option value="suppressed">Suppressed</option>
              <option value="archived">Archived</option>
              <option value="invalid">Invalid</option>
            </select>
          </FilterLabel>
        </div>

        {partialError ? (
          <div className="rounded-2xl border border-[#D8B6A7] bg-[#FFF8F4] px-5 py-4 text-sm text-[#7A3E31]" role="alert">
            {partialError}
          </div>
        ) : null}
        {cleanupFeedback ? (
          <p className="text-sm text-[#5B493D]" role="status">
            {cleanupFeedback}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-[#DED2C5] bg-white">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_0.65fr_0.9fr_0.75fr_0.85fr_auto] gap-4 border-b border-[#E9DED3] bg-[#FBF7F2] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40 lg:grid">
            <p>Email</p><p>List</p><p>Source</p><p>Created</p><p>State</p><p>Actions</p>
          </div>

          {isLoading ? (
            <SignupState title="Loading email signups" body="Reading both signup collections and calculating duplicates." />
          ) : null}
          {!isLoading && error ? (
            <SignupState title="Could not load email signups" body={error} action={loadSignups} />
          ) : null}
          {!isLoading && !error && filteredSignups.length === 0 ? (
            <SignupState
              title={signups.length === 0 ? "No email signups yet" : "No signups found"}
              body={signups.length === 0 ? "Newsletter and waitlist submissions will appear here." : "No loaded records match the current filters."}
            />
          ) : null}
          {!isLoading && !error && filteredSignups.length > 0 ? (
            <div className="divide-y divide-[#EFE4DA]">
              {filteredSignups.map((signup) => (
                <article key={signup.key} className="grid gap-4 px-5 py-4 text-sm lg:grid-cols-[minmax(0,1.4fr)_0.65fr_0.9fr_0.75fr_0.85fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <MobileLabel>Email</MobileLabel>
                    <p className="break-all font-medium text-[#241E1A]">{signup.email || "—"}</p>
                    {signup.duplicateCount > 1 ? (
                      <p className="mt-1 text-xs text-[#8A674B]">{signup.duplicateCount} records share this normalized email</p>
                    ) : null}
                  </div>
                  <div><MobileLabel>List</MobileLabel><Badge>{signup.typeLabel}</Badge></div>
                  <div className="min-w-0 text-black/60"><MobileLabel>Source</MobileLabel><p className="break-words">{formatSource(signup)}</p></div>
                  <div className="text-black/60"><MobileLabel>Created</MobileLabel><p>{formatDate(signup.createdAt)}</p></div>
                  <div><MobileLabel>State</MobileLabel><StateBadge state={signup.effectiveState} /></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => beginCleanup(signup, "suppressed")} className={smallButtonClass}>Suppress</button>
                    <button type="button" onClick={() => beginCleanup(signup, "invalid")} className={smallButtonClass}>Invalid</button>
                    <button type="button" onClick={() => beginCleanup(signup, "archived")} className={smallButtonClass}>Archive</button>
                    <button type="button" onClick={() => beginCleanup(signup, "eligible")} disabled={!signup.normalizedEmail} className={smallButtonClass}>Restore</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <p className="text-xs leading-5 text-black/45">
          Eligibility is operational state, not proof of marketing consent.
          Duplicate comparison trims and lowercases valid emails without changing
          stored values. Any excluded record suppresses its normalized address;
          otherwise the address is included once across both lists.
        </p>

        {cleanupTarget ? (
          <CleanupDialog
            confirmed={cleanupConfirmed}
            isSaving={isSaving}
            onCancel={() => setCleanupTarget(null)}
            onConfirmChange={setCleanupConfirmed}
            onReasonChange={setCleanupReason}
            onSave={() => void saveCleanupState()}
            reason={cleanupReason}
            target={cleanupTarget}
          />
        ) : null}
      </div>
    </AdminShell>
  );
}

const inputClass = "w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-[#241E1A] outline-none focus:border-[#B59674]";
const smallButtonClass = "rounded-lg border border-[#DED2C5] px-3 py-2 text-xs font-semibold text-[#5B493D] disabled:cursor-not-allowed disabled:opacity-40";

function deriveDisplaySignups(signups: EmailSignup[]): DisplaySignup[] {
  const groups = new Map<string, EmailSignup[]>();
  for (const signup of signups) {
    if (!signup.normalizedEmail) continue;
    const group = groups.get(signup.normalizedEmail) || [];
    group.push(signup);
    groups.set(signup.normalizedEmail, group);
  }

  return signups.map((signup) => {
    if (!signup.normalizedEmail) {
      return { ...signup, duplicateCount: 1, effectiveState: "invalid" };
    }
    const group = groups.get(signup.normalizedEmail) || [signup];
    const states = group.map(recordState);
    const excluded = (["invalid", "archived", "suppressed"] as const).find(
      (state) => states.includes(state),
    );
    return {
      ...signup,
      duplicateCount: group.length,
      effectiveState: excluded || "eligible",
    };
  });
}

function recordState(signup: EmailSignup): AdminState {
  if (!signup.normalizedEmail) return "invalid";
  if (signup.adminState && signup.adminState !== "eligible") return signup.adminState;
  if (signup.legacySuppressed) return "suppressed";
  return "eligible";
}

function summarize(signups: DisplaySignup[]) {
  const validGroups = new Map<string, DisplaySignup[]>();
  for (const signup of signups) {
    if (!signup.normalizedEmail) continue;
    const group = validGroups.get(signup.normalizedEmail) || [];
    group.push(signup);
    validGroups.set(signup.normalizedEmail, group);
  }
  return {
    totalRecords: signups.length,
    uniqueValid: validGroups.size,
    eligibleUnique: [...validGroups.values()].filter(
      (group) => group[0]?.effectiveState === "eligible",
    ).length,
    duplicates: [...validGroups.values()].reduce(
      (total, group) => total + Math.max(0, group.length - 1),
      0,
    ),
    invalid: signups.filter((signup) => !signup.normalizedEmail).length,
  };
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : "";
}

function readAdminState(value: unknown): AdminState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = (value as Record<string, unknown>).state;
  return ["eligible", "suppressed", "invalid", "archived"].includes(String(state))
    ? (state as AdminState)
    : null;
}

function hasLegacySuppression(data: Record<string, unknown>) {
  const trueFields = ["unsubscribed", "optedOut", "opted_out", "suppressed", "doNotEmail", "do_not_email"];
  const dateFields = ["unsubscribedAt", "optedOutAt", "opted_out_at", "suppressedAt"];
  const consentFields = ["subscribed", "emailConsent", "marketingConsent"];
  if (trueFields.some((field) => data[field] === true)) return true;
  if (dateFields.some((field) => data[field] !== undefined && data[field] !== null)) return true;
  if (consentFields.some((field) => data[field] === false) || data.active === false) return true;
  const status = readString(data.emailStatus || data.subscriptionStatus || data.status)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return ["unsubscribed", "optedout", "opted_out", "suppressed", "inactive", "disabled", "archived", "invalid"].includes(status);
}

function exportCsv(signups: DisplaySignup[]) {
  const rows = [
    ["email", "normalized_email", "list_type", "source", "page", "signup_date", "validity", "duplicate_records", "eligibility"],
    ...signups.map((signup) => [
      signup.email,
      signup.normalizedEmail,
      signup.type,
      signup.source,
      signup.page,
      signup.createdAt?.toISOString() || "",
      signup.normalizedEmail ? "valid" : "invalid",
      String(signup.duplicateCount),
      signup.effectiveState,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `tufffinds-email-signups-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function CleanupDialog({ confirmed, isSaving, onCancel, onConfirmChange, onReasonChange, onSave, reason, target }: {
  confirmed: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onConfirmChange: (value: boolean) => void;
  onReasonChange: (value: string) => void;
  onSave: () => void;
  reason: string;
  target: CleanupTarget;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="cleanup-title">
      <div className="w-full max-w-lg rounded-[24px] border border-[#DED2C5] bg-white p-6 shadow-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/40">Eligibility change</p>
        <h2 id="cleanup-title" className="mt-2 font-serif text-2xl text-[#241E1A]">Set record to {target.state}</h2>
        <p className="mt-3 break-all text-sm text-black/60">{target.signup.email || "Invalid email record"}</p>
        <p className="mt-3 text-xs leading-5 text-black/48">This preserves the original record. Restoring one duplicate does not override exclusions on another duplicate or any historical opt-out marker.</p>
        <label className="mt-5 block">
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">Operational reason</span>
          <textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} maxLength={200} className={`${inputClass} min-h-24`} placeholder="5–200 characters" />
        </label>
        <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-black/60">
          <input type="checkbox" checked={confirmed} onChange={(event) => onConfirmChange(event.target.checked)} className="mt-1" />
          I confirm this eligibility change and understand it affects campaign selection.
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" disabled={isSaving || !confirmed || reason.trim().length < 5} onClick={onSave} className="rounded-xl bg-[#40342F] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{isSaving ? "Saving…" : "Save state"}</button>
          <button type="button" disabled={isSaving} onClick={onCancel} className="rounded-xl border border-[#DED2C5] px-5 py-3 text-sm font-semibold text-[#40342F]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] p-4"><p className="text-[9px] uppercase tracking-[0.2em] text-black/40">{label}</p><p className="mt-2 text-2xl font-semibold text-[#241E1A]">{value}</p></div>;
}

function FilterLabel({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="space-y-2"><span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">{label}</span>{children}</label>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-[#DED2C5] bg-[#FBF7F2] px-3 py-1 text-xs font-medium text-[#5B493D]">{children}</span>;
}

function StateBadge({ state }: { state: AdminState }) {
  const tone = state === "eligible" ? "border-[#B7CFB9] bg-[#F2F8F2] text-[#2F5A34]" : state === "invalid" ? "border-[#D8B6A7] bg-[#FFF8F4] text-[#9F3A2A]" : "border-[#D8C8B6] bg-[#F8F1E9] text-[#7A5D46]";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${tone}`}>{state}</span>;
}

function readString(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function normalizeDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Date unavailable"; }
function formatSource(signup: EmailSignup) { return [signup.source, signup.page].filter(Boolean).join(" · ") || "—"; }
function MobileLabel({ children }: { children: React.ReactNode }) { return <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-black/35 lg:hidden">{children}</p>; }
function SignupState({ action, body, title }: { action?: () => Promise<void>; body: string; title: string }) {
  return <div className="px-6 py-16 text-center"><h2 className="font-serif text-2xl text-[#241E1A]">{title}</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-black/55">{body}</p>{action ? <button type="button" onClick={() => void action()} className="mt-5 rounded-xl border border-[#40342F] px-4 py-2 text-sm font-semibold text-[#40342F]">Try again</button> : null}</div>;
}
