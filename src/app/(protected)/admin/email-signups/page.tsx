"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import {
  AdminFilterSelect,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminSearchInput,
  AdminState,
  AdminStatusBadge,
  AdminTable,
  AdminToolbar,
} from "../_components/AdminUI";

const SIGNUPS_PER_TYPE = 200;

const SIGNUP_SOURCES = [
  {
    collectionName: "newsletter_signups",
    label: "Newsletter",
    type: "newsletter",
  },
  {
    collectionName: "waitlist",
    label: "Waitlist",
    type: "waitlist",
  },
] as const;

type SignupType = (typeof SIGNUP_SOURCES)[number]["type"];

type EmailSignup = {
  createdAt: Date | null;
  email: string;
  key: string;
  page: string;
  source: string;
  type: SignupType;
  typeLabel: string;
};

export default function EmailSignupsPage() {
  const [signups, setSignups] = useState<EmailSignup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SignupType>("all");

  useEffect(() => {
    let cancelled = false;

    async function loadSignups() {
      setIsLoading(true);
      setError("");

      try {
        const sourceResults = await Promise.all(
          SIGNUP_SOURCES.map(async (signupSource) => {
            const signupCollection = collection(db, signupSource.collectionName);
            const [snapshot, countSnapshot] = await Promise.all([
              getDocs(
                query(
                  signupCollection,
                  orderBy("createdAt", "desc"),
                  limit(SIGNUPS_PER_TYPE),
                ),
              ),
              getCountFromServer(signupCollection),
            ]);

            const records = snapshot.docs.map((entry) => {
              const data = entry.data() as Record<string, unknown>;

              return {
                createdAt: normalizeDate(data.createdAt),
                email: readString(data.email),
                key: `${signupSource.type}:${entry.id}`,
                page: readString(data.page),
                source: readString(data.source),
                type: signupSource.type,
                typeLabel: signupSource.label,
              } satisfies EmailSignup;
            });

            return {
              count: countSnapshot.data().count,
              records,
            };
          }),
        );

        if (cancelled) return;

        setSignups(
          sourceResults
            .flatMap((result) => result.records)
            .sort(
              (left, right) =>
                (right.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY) -
                (left.createdAt?.getTime() ?? Number.NEGATIVE_INFINITY),
            ),
        );
        setTotalCount(
          sourceResults.reduce((total, result) => total + result.count, 0),
        );
        setIsLoading(false);
      } catch (loadError) {
        console.error("Failed to load email signups", loadError);

        if (cancelled) return;

        setSignups([]);
        setTotalCount(0);
        setError("Email signups could not be loaded. Please try again.");
        setIsLoading(false);
      }
    }

    void loadSignups();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredSignups = useMemo(() => {
    const term = search.trim().toLowerCase();

    return signups.filter((signup) => {
      const matchesType = typeFilter === "all" || signup.type === typeFilter;
      const matchesSearch =
        !term || signup.email.toLowerCase().includes(term);

      return matchesType && matchesSearch;
    });
  }, [search, signups, typeFilter]);

  return (
    <AdminShell active="email-signups">
      <AdminPage>
        <AdminPageHeader eyebrow="Audience" title="Email signups" description="Newsletter and waitlist submissions, newest first." actions={<div className="border-l border-[#ded5cb] pl-4"><AdminMetric label="Total signups" value={isLoading ? "—" : totalCount} /></div>} />

        <AdminTable label="Email signups">
          <AdminToolbar>
            <AdminSearchInput value={search} onChange={setSearch} placeholder="Search by email address" label="Search signups" />
            <AdminFilterSelect label="Signup type" value={typeFilter} onChange={(value) => setTypeFilter(value as "all" | SignupType)}>
              <option value="all">All signups</option>
              <option value="newsletter">Newsletter</option>
              <option value="waitlist">Waitlist</option>
            </AdminFilterSelect>
          </AdminToolbar>

        {!isLoading && !error ? (
          <p className="text-xs text-black/45">
            Showing {filteredSignups.length} of {signups.length} loaded records
            {totalCount > signups.length ? ` (${totalCount} total)` : ""}.
          </p>
        ) : null}

        <div>
          <div className="hidden grid-cols-[minmax(0,1.45fr)_0.8fr_minmax(0,1.25fr)_1fr] gap-4 border-b border-[#E9DED3] bg-[#FBF7F2] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40 md:grid">
            <p>Email</p>
            <p>Type</p>
            <p>Source / page</p>
            <p>Created</p>
          </div>

          {isLoading ? (
            <AdminState
              title="Loading email signups"
              body="Reading the newest newsletter and waitlist records."
            />
          ) : null}

          {!isLoading && error ? (
            <AdminState title="Could not load email signups" body={error} tone="error" />
          ) : null}

          {!isLoading && !error && filteredSignups.length === 0 ? (
            <AdminState
              title={signups.length === 0 ? "No email signups yet" : "No signups found"}
              body={
                signups.length === 0
                  ? "Newsletter and waitlist submissions will appear here."
                  : "No loaded records match the current search and filter."
              }
            />
          ) : null}

          {!isLoading && !error && filteredSignups.length > 0 ? (
            <div className="divide-y divide-[#EFE4DA]">
              {filteredSignups.map((signup) => (
                <article
                  key={signup.key}
                  className="grid gap-4 px-5 py-4 text-sm md:grid-cols-[minmax(0,1.45fr)_0.8fr_minmax(0,1.25fr)_1fr] md:items-center"
                >
                  <div className="min-w-0">
                    <MobileLabel>Email</MobileLabel>
                    <p className="break-all font-medium text-[#241E1A]">
                      {signup.email || "—"}
                    </p>
                  </div>

                  <div>
                    <MobileLabel>Type</MobileLabel>
                    <AdminStatusBadge tone={signup.type === "newsletter" ? "info" : "neutral"}>
                      {signup.typeLabel}
                    </AdminStatusBadge>
                  </div>

                  <div className="min-w-0 text-black/60">
                    <MobileLabel>Source / page</MobileLabel>
                    <p className="break-words">{formatSource(signup)}</p>
                  </div>

                  <div className="text-black/60">
                    <MobileLabel>Created</MobileLabel>
                    <p>{formatDate(signup.createdAt)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
        </AdminTable>

        <p className="text-xs leading-5 text-black/40">
          This page loads at most the newest {SIGNUPS_PER_TYPE} records from
          each signup type. Older records remain in Firestore.
        </p>
      </AdminPage>
    </AdminShell>
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDate(value: Date | null) {
  if (!value) return "Date unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatSource(signup: EmailSignup) {
  return [signup.source, signup.page].filter(Boolean).join(" · ") || "—";
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-black/35 md:hidden">
      {children}
    </p>
  );
}
