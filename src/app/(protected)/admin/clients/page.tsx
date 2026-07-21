"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import type { ManagedAdminClient } from "../admin-types";
import { formatDateTime, parseAdminClient } from "../admin-utils";

type ClientFilter = "all" | "active" | "incomplete" | "archived";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ManagedAdminClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("active");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const clientsQuery = query(
      collection(db, "client_profiles"),
      orderBy("updatedAt", "desc"),
    );

    return onSnapshot(
      clientsQuery,
      (snapshot) => {
        setClients(
          snapshot.docs.map((entry) =>
            parseAdminClient(entry.id, entry.data()),
          ),
        );
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load clients", snapshotError);
        setClients([]);
        setIsLoading(false);
        setError("Could not load clients from Firestore.");
      },
    );
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return clients.filter((client) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && !client.archived) ||
        (filter === "incomplete" &&
          !client.archived &&
          !client.onboardingCompleted) ||
        (filter === "archived" && client.archived);
      const matchesSearch =
        !term ||
        [client.fullName, client.email, client.phoneNumber].some((value) =>
          value.toLowerCase().includes(term),
        );

      return matchesFilter && matchesSearch;
    });
  }, [clients, filter, search]);

  const activeCount = clients.filter((client) => !client.archived).length;
  const incompleteCount = clients.filter(
    (client) => !client.archived && !client.onboardingCompleted,
  ).length;
  const archivedCount = clients.filter((client) => client.archived).length;

  return (
    <AdminShell
      active="clients"
      metrics={{
        clients: activeCount,
        requests: 0,
        threads: 0,
        needsInfo: 0,
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              Client database
            </p>
            <h1 className="mt-3 font-serif text-4xl text-[#241E1A]">Clients</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">
              Manage client profiles, onboarding, preferences, linked activity and
              archive state.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="Active" value={activeCount} />
            <SummaryCard label="Incomplete" value={incompleteCount} />
            <SummaryCard label="Archived" value={archivedCount} />
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] p-4 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search full name, email or phone..."
            className="w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-[#241E1A] outline-none placeholder:text-black/35 focus:border-[#B59674]"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as ClientFilter)}
            aria-label="Filter clients"
            className="rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-[#241E1A] outline-none focus:border-[#B59674]"
          >
            <option value="active">Active clients</option>
            <option value="incomplete">Onboarding incomplete</option>
            <option value="archived">Archived clients</option>
            <option value="all">All clients</option>
          </select>
        </div>

        <section className="overflow-x-auto rounded-2xl border border-[#DED2C5] bg-white">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_1fr_110px] gap-4 border-b border-[#E9DED3] bg-[#FBF7F2] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
              <p>Client</p>
              <p>Contact</p>
              <p>Onboarding</p>
              <p>Account</p>
              <p>Updated</p>
              <p className="text-right">Open</p>
            </div>

            {isLoading ? (
              <EmptyState title="Loading clients" body="Reading client profiles from Firestore." />
            ) : null}
            {!isLoading && error ? (
              <EmptyState title="Could not load clients" body={error} />
            ) : null}
            {!isLoading && !error && filteredClients.length === 0 ? (
              <EmptyState
                title="No clients found"
                body="No client profiles matched the selected filter and search."
              />
            ) : null}
            {!isLoading && !error && filteredClients.length > 0 ? (
              <div className="divide-y divide-[#EFE4DA]">
                {filteredClients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function ClientRow({ client }: { client: ManagedAdminClient }) {
  return (
    <Link
      href={`/admin/clients/${client.id}`}
      className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_1fr_110px] gap-4 px-5 py-4 text-sm transition hover:bg-[#FFF9F1]"
    >
      <p className="truncate font-medium text-[#241E1A]">
        {client.fullName || "Unnamed client"}
      </p>
      <div className="min-w-0 text-black/60">
        <p className="truncate">{client.email || "No email"}</p>
        <p className="mt-1 truncate text-xs text-black/45">
          {client.phoneNumber || "No phone"}
        </p>
      </div>
      <StatusBadge
        label={client.onboardingCompleted ? "Complete" : "Incomplete"}
        tone={client.onboardingCompleted ? "success" : "warning"}
      />
      <StatusBadge
        label={client.archived ? "Archived" : "Active"}
        tone={client.archived ? "neutral" : "success"}
      />
      <p className="truncate text-black/60">{formatDateTime(client.updatedAt)}</p>
      <div className="text-right">
        <span className="rounded-full border border-[#DED2C5] px-3 py-1 text-xs text-black/55">
          View
        </span>
      </div>
    </Link>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning";
}) {
  const styles =
    tone === "success"
      ? "bg-[#DDECDD] text-[#2F5A34]"
      : tone === "warning"
        ? "bg-[#F5E6C8] text-[#76561E]"
        : "bg-[#ECE7E1] text-[#65584E]";

  return (
    <div>
      <span
        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${styles}`}
      >
        {label}
      </span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-3">
      <p className="text-[9px] uppercase tracking-[0.2em] text-black/40">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#241E1A]">{value}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center bg-[#FFFDFC] text-center">
      <div className="max-w-md px-8 py-8">
        <h2 className="font-serif text-3xl leading-tight text-[#241E1A]">{title}</h2>
        <p className="mt-4 text-sm leading-7 text-black/55">{body}</p>
      </div>
    </div>
  );
}
