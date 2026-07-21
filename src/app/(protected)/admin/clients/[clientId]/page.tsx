"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  AdminClient,
  ClientProfile,
  FirestoreTimestampValue,
} from "../../admin-types";
import {
  formatDateTime,
  getEmptyProfile,
  normalizeTimestamp,
} from "../../admin-utils";

type PageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export default function AdminClientDetailPage({ params }: PageProps) {
  const { clientId } = use(params);

  const [client, setClient] = useState<AdminClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const unsubscribe = onSnapshot(
      doc(db, "client_profiles", clientId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setClient(null);
          setIsLoading(false);
          setError("Client not found.");
          return;
        }

        const data = snapshot.data() as {
          createdAt?: FirestoreTimestampValue;
          email?: string;
          fullName?: string;
          onboardingCompleted?: boolean;
          phoneNumber?: string;
          phoneNumberNormalized?: string;
          profile?: Partial<ClientProfile> | null;
          updatedAt?: FirestoreTimestampValue;
        };

        const profile = data.profile ?? {};
        const emptyProfile = getEmptyProfile();

        const fallbackName =
          profile.fullName || data.fullName || "Unnamed client";

        const fallbackPhone =
          profile.phoneNumber || data.phoneNumber || "";

        setClient({
          id: snapshot.id,
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
        });

        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load client", error);
        setClient(null);
        setIsLoading(false);
        setError("Could not load this client from Firestore.");
      },
    );

    return unsubscribe;
  }, [clientId]);

  return (
    <AdminShell active="clients">
      <div className="space-y-6">
        <Link
          href="/admin/clients"
          className="inline-flex rounded-full border border-black/10 bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]"
        >
          ← Back to clients
        </Link>

        {isLoading ? (
          <EmptyState title="Loading client" body="Reading this client profile from Firestore." />
        ) : null}

        {!isLoading && error ? (
          <EmptyState title="Client issue" body={error} />
        ) : null}

        {!isLoading && client ? (
          <>
            <section className="rounded-[28px] border border-black/8 bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                Client profile
              </p>

              <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h1 className="font-serif text-4xl">
                    {client.fullName || "Unnamed client"}
                  </h1>

                  <p className="mt-3 text-sm text-black/55">
                    {client.email || "No email"}
                  </p>
                </div>

                <span className="w-fit rounded-full bg-[#F7F1EA] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/50">
                  {client.onboardingCompleted ? "Onboarded" : "Pending"}
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Client UID" value={client.id} />
                <InfoCard label="Phone" value={client.phoneNumber || "Not set"} />
                <InfoCard label="Created" value={formatDateTime(client.createdAt)} />
                <InfoCard label="Updated" value={formatDateTime(client.updatedAt)} />
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="space-y-6">
                <DetailPanel title="Preferences" eyebrow="Style">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ChipGroup label="Style preferences" values={client.profile.stylePreferences} />
                    <ChipGroup label="Favourite brands" values={client.profile.favoriteBrands} />
                    <ChipGroup label="Disliked brands" values={client.profile.dislikedBrands} />
                    <ChipGroup label="Shopping priorities" values={client.profile.shoppingPriorities} />
                    <ChipGroup label="Contact preferences" values={client.profile.contactPreferences} />
                    <TextBlock label="Budget comfort" value={client.profile.budgetComfortRange || "Not captured"} />
                  </div>

                  <div className="mt-4">
                    <TextBlock label="Fit notes" value={client.profile.fitNotes || "Not captured"} />
                  </div>

                  <div className="mt-4">
                    <TextBlock label="Gifting preferences" value={client.profile.giftingPreferences || "Not captured"} />
                  </div>
                </DetailPanel>
              </section>

              <section className="space-y-6">
                <DetailPanel title="Shipping address" eyebrow="Fulfilment">
                  <AddressBlock address={client.profile.shippingAddress} />
                </DetailPanel>

                <DetailPanel title="Sizes" eyebrow="Client sizing">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(client.profile.clothingSizes).map(([key, value]) => (
                      <InfoCard
                        key={key}
                        label={key}
                        value={value || "Not set"}
                      />
                    ))}
                  </div>
                </DetailPanel>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function DetailPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-black/8 bg-white p-5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
        {eyebrow}
      </p>

      <h3 className="mt-3 font-serif text-2xl leading-tight">
        {title}
      </h3>

      <div className="mt-5">{children}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#F7F1EA] p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        {label}
      </p>

      <p className="mt-3 break-words text-sm leading-6 text-black/68">
        {value}
      </p>
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-[#F7F1EA] p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        {label}
      </p>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-black/68">
        {value}
      </p>
    </div>
  );
}

function ChipGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-[22px] bg-[#F7F1EA] p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        {label}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {values?.length ? (
          values.map((value) => (
            <span
              key={value}
              className="rounded-full bg-white px-3 py-1.5 text-sm text-black/66"
            >
              {value}
            </span>
          ))
        ) : (
          <span className="text-sm text-black/45">None captured</span>
        )}
      </div>
    </div>
  );
}

function AddressBlock({
  address,
}: {
  address: {
    firstName: string;
    lastName: string;
    country: string;
    line1: string;
    line2: string;
    company: string;
    city: string;
    postcode: string;
    phone: string;
  };
}) {
  return (
    <div className="rounded-[22px] bg-[#F7F1EA] p-4 text-sm leading-7 text-black/68">
      <p>
        {address.firstName || "—"} {address.lastName || ""}
      </p>

      {address.company ? <p>{address.company}</p> : null}

      <p>{address.line1 || "—"}</p>

      {address.line2 ? <p>{address.line2}</p> : null}

      <p>
        {address.city || "—"} {address.postcode || ""}
      </p>

      <p>{address.country || "—"}</p>
      <p>{address.phone || "—"}</p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-[#FBF7F2] text-center">
      <div className="max-w-md px-8 py-8">
        <h2 className="font-serif text-3xl leading-tight">
          {title}
        </h2>

        <p className="mt-4 text-sm leading-7 text-black/55">
          {body}
        </p>
      </div>
    </div>
  );
}
