"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import type { AdminClient, ClientProfile } from "../admin-types";
import { formatDateTime, getEmptyProfile, normalizeTimestamp } from "../admin-utils";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const clientsQuery = query(
      collection(db, "client_profiles"),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const nextClients = snapshot.docs.map((entry) => {
          const data = entry.data() as {
            createdAt?: any;
            email?: string;
            fullName?: string;
            onboardingCompleted?: boolean;
            phoneNumber?: string;
            phoneNumberNormalized?: string;
            profile?: Partial<ClientProfile> | null;
            updatedAt?: any;
          };

          const profile = data.profile ?? {};
          const emptyProfile = getEmptyProfile();

          const fallbackName =
            profile.fullName || data.fullName || "Unnamed client";

          const fallbackPhone = profile.phoneNumber || data.phoneNumber || "";

          return {
            id: entry.id,
            email: data.email ?? "",
            fullName: data.fullName ?? fallbackName,
            phoneNumber: data.phoneNumber ?? fallbackPhone,
            phoneNumberNormalized: data.phoneNumberNormalized ?? "",
            onboardingCompleted: Boolean(data.onboardingCompleted),
            createdAt: normalizeTimestamp(data.createdAt),
            updatedAt: normalizeTimestamp(data.updatedAt),
            profile: {
              ...emptyProfile,
              ...profile,
              fullName: profile.fullName || fallbackName,
              phoneNumber: profile.phoneNumber || fallbackPhone,
              clothingSizes: {
                ...emptyProfile.clothingSizes,
                ...(profile.clothingSizes ?? {}),
              },
              shippingAddress: {
                ...emptyProfile.shippingAddress,
                ...(profile.shippingAddress ?? {}),
              },
              stylePreferences: profile.stylePreferences ?? [],
              favoriteBrands: profile.favoriteBrands ?? [],
              dislikedBrands: profile.dislikedBrands ?? [],
              shoppingPriorities: profile.shoppingPriorities ?? [],
              contactPreferences: profile.contactPreferences ?? [],
            },
          } satisfies AdminClient;
        });

        setClients(nextClients);
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load clients", error);
        setClients([]);
        setIsLoading(false);
        setError("Could not load clients from Firestore.");
      },
    );

    return unsubscribe;
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return clients;

    return clients.filter((client) =>
      [
        client.fullName,
        client.email,
        client.phoneNumber,
        client.id,
      ].some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [clients, search]);

  return (
    <AdminShell
      active="clients"
      metrics={{
        clients: clients.length,
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

            <h1 className="mt-3 font-serif text-4xl text-[#241E1A]">
              Clients
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">
              Search and manage client profiles, preferences, sizing and shipping details.
            </p>
          </div>

          <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] px-6 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
              Total clients
            </p>

            <p className="mt-2 text-3xl font-semibold text-[#241E1A]">
              {clients.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search full name, email, phone or client ID..."
            className="w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-[#241E1A] outline-none placeholder:text-black/35 focus:border-[#B59674]"
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#DED2C5] bg-white">
          <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_1fr_120px] gap-4 border-b border-[#E9DED3] bg-[#FBF7F2] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
            <p>Client</p>
            <p>Email</p>
            <p>Phone</p>
            <p>Status</p>
            <p>Updated</p>
            <p className="text-right">Open</p>
          </div>

          {isLoading ? (
            <EmptyState
              title="Loading clients"
              body="Reading client profiles from Firestore."
            />
          ) : null}

          {!isLoading && error ? (
            <EmptyState title="Could not load clients" body={error} />
          ) : null}

          {!isLoading && !error && filteredClients.length === 0 ? (
            <EmptyState
              title="No clients found"
              body="No client profiles matched your search."
            />
          ) : null}

          {!isLoading && !error && filteredClients.length > 0 ? (
            <div className="divide-y divide-[#EFE4DA]">
              {filteredClients.map((client) => (
                <ClientRow key={client.id} client={client} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}

function ClientRow({ client }: { client: AdminClient }) {
  return (
    <Link
      href={`/admin/clients/${client.id}`}
      className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_1fr_120px] gap-4 px-5 py-4 text-sm transition hover:bg-[#FFF9F1]"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-[#241E1A]">
          {client.fullName || "Unnamed client"}
        </p>

        <p className="mt-1 truncate text-xs text-black/45">
          {client.id}
        </p>
      </div>

      <p className="truncate text-black/60">
        {client.email || "No email"}
      </p>

      <p className="truncate text-black/60">
        {client.phoneNumber || "Not set"}
      </p>

      <div>
        <span className="rounded-full bg-[#F7F1EA] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50">
          {client.onboardingCompleted ? "Onboarded" : "Pending"}
        </span>
      </div>

      <p className="truncate text-black/60">
        {formatDateTime(client.updatedAt)}
      </p>

      <div className="text-right">
        <span className="rounded-full border border-[#DED2C5] px-3 py-1 text-xs text-black/55">
          View
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center bg-[#FFFDFC] text-center">
      <div className="max-w-md px-8 py-8">
        <h2 className="font-serif text-3xl leading-tight text-[#241E1A]">
          {title}
        </h2>

        <p className="mt-4 text-sm leading-7 text-black/55">
          {body}
        </p>
      </div>
    </div>
  );
}