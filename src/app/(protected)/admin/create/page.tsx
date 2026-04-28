"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import type { AdminClient, ClientProfile } from "../admin-types";
import { getEmptyProfile, normalizeTimestamp } from "../admin-utils";

type Currency = "GBP" | "EUR" | "USD";

type OrderForm = {
  clientId: string;
  clientEmail: string;
  requestId: string;
  title: string;
  brand: string;
  item: string;
  size: string;
  colour: string;
  salePrice: string;
  costPrice: string;
  currency: Currency;
  invoiceNumber: string;
  invoiceUrl: string;
  paymentMethod: string;
  supplier: string;
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  notes: string;
};

const emptyOrderForm: OrderForm = {
  clientId: "",
  clientEmail: "",
  requestId: "",
  title: "",
  brand: "",
  item: "",
  size: "",
  colour: "",
  salePrice: "",
  costPrice: "",
  currency: "GBP",
  invoiceNumber: "",
  invoiceUrl: "",
  paymentMethod: "",
  supplier: "",
  courier: "",
  trackingNumber: "",
  trackingUrl: "",
  notes: "",
};

function isCurrency(value: string): value is Currency {
  return value === "GBP" || value === "EUR" || value === "USD";
}

function parseMoney(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  const number = Number(cleaned);

  return Number.isFinite(number) && cleaned ? number : 0;
}

export default function CreateOrderPage() {
  const router = useRouter();

  const [clients, setClients] = useState<AdminClient[]>([]);
  const [form, setForm] = useState<OrderForm>(emptyOrderForm);
  const [isCreating, setIsCreating] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const clientsQuery = query(
      collection(db, "client_profiles"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const nextClients = snapshot.docs.map((entry) => {
          const data = entry.data() as {
            createdAt?: unknown;
            email?: string;
            fullName?: string;
            onboardingCompleted?: boolean;
            phoneNumber?: string;
            phoneNumberNormalized?: string;
            profile?: Partial<ClientProfile> | null;
            updatedAt?: unknown;
          };

          const emptyProfile = getEmptyProfile();
          const profile = data.profile ?? {};

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
        setClientsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load clients", snapshotError);
        setClients([]);
        setClientsLoading(false);
        setError("Could not load clients.");
      }
    );

    return () => unsubscribe();
  }, []);

  function handleClientChange(clientId: string) {
    const selectedClient = clients.find((client) => client.id === clientId);

    setForm((current) => ({
      ...current,
      clientId,
      clientEmail: selectedClient?.email ?? "",
    }));
  }

  async function createManualOrder() {
    if (isCreating) return;

    setError("");

    if (!form.clientId) {
      setError("Select a client before creating the order.");
      return;
    }

    if (!form.title.trim()) {
      setError("Add an order title.");
      return;
    }

    setIsCreating(true);

    try {
      const orderRef = await addDoc(collection(db, "orders"), {
        clientId: form.clientId,
        clientEmail: form.clientEmail.trim(),
        requestId: form.requestId.trim(),

        title: form.title.trim(),
        brand: form.brand.trim(),
        item: form.item.trim(),
        size: form.size.trim(),
        colour: form.colour.trim(),

        status: "created",

        salePrice: parseMoney(form.salePrice),
        costPrice: parseMoney(form.costPrice),
        currency: form.currency,

        invoiceNumber: form.invoiceNumber.trim(),
        invoiceUrl: form.invoiceUrl.trim(),
        paymentMethod: form.paymentMethod.trim(),

        supplier: form.supplier.trim(),
        courier: form.courier.trim(),
        trackingNumber: form.trackingNumber.trim(),
        trackingUrl: form.trackingUrl.trim(),

        notes: form.notes.trim(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.push(`/admin/orders/${orderRef.id}`);
    } catch (createError) {
      console.error("Failed to create manual order", createError);
      setError("Could not create manual order.");
      setIsCreating(false);
    }
  }

  return (
    <AdminShell
      active="orders"
      metrics={{
        clients: clients.length,
        requests: 0,
        threads: 0,
        needsInfo: 0,
      }}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/orders"
              className="inline-flex rounded-lg border border-[#DED2C5] bg-[#FBF7F2] px-3 py-1.5 text-xs text-black/65 hover:bg-[#F5EEE6]"
            >
              ← Back to orders
            </Link>

            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                Manual order
              </p>

              <h1 className="mt-2 font-serif text-3xl text-[#241E1A]">
                Create order
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
                Create an order manually and assign it to an existing client.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={createManualOrder}
            disabled={isCreating || clientsLoading}
            className="shrink-0 rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isCreating ? "Creating..." : "Create order"}
          </button>
        </div>

        {error ? (
          <div className="rounded-xl border border-[#E2B8AA] bg-[#FFF2EF] p-3 text-sm text-[#8B3D2D]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4">
          <FormCard title="Client">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <FormSelect
                label="Assign to client"
                value={form.clientId}
                onChange={handleClientChange}
                options={[
                  {
                    label: clientsLoading
                      ? "Loading clients..."
                      : "Select client",
                    value: "",
                  },
                  ...clients.map((client) => ({
                    label: `${client.fullName || "Unnamed client"} — ${
                      client.email || client.id
                    }`,
                    value: client.id,
                  })),
                ]}
              />

              <FormInput
                label="Client email"
                value={form.clientEmail}
                onChange={(value) =>
                  setForm((current) => ({ ...current, clientEmail: value }))
                }
              />

              <FormInput
                label="Linked request ID optional"
                value={form.requestId}
                onChange={(value) =>
                  setForm((current) => ({ ...current, requestId: value }))
                }
              />
            </div>
          </FormCard>

          <FormCard title="Item">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormInput
                label="Order title"
                value={form.title}
                onChange={(value) =>
                  setForm((current) => ({ ...current, title: value }))
                }
              />

              <FormInput
                label="Brand"
                value={form.brand}
                onChange={(value) =>
                  setForm((current) => ({ ...current, brand: value }))
                }
              />

              <FormInput
                label="Item"
                value={form.item}
                onChange={(value) =>
                  setForm((current) => ({ ...current, item: value }))
                }
              />

              <FormInput
                label="Size"
                value={form.size}
                onChange={(value) =>
                  setForm((current) => ({ ...current, size: value }))
                }
              />

              <FormInput
                label="Colour"
                value={form.colour}
                onChange={(value) =>
                  setForm((current) => ({ ...current, colour: value }))
                }
              />

              <FormInput
                label="Sale price"
                value={form.salePrice}
                keyboard="decimal"
                onChange={(value) =>
                  setForm((current) => ({ ...current, salePrice: value }))
                }
              />

              <FormInput
                label="Cost price"
                value={form.costPrice}
                keyboard="decimal"
                onChange={(value) =>
                  setForm((current) => ({ ...current, costPrice: value }))
                }
              />

              <FormSelect
                label="Currency"
                value={form.currency}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    currency: isCurrency(value) ? value : "GBP",
                  }))
                }
                options={[
                  { label: "GBP", value: "GBP" },
                  { label: "EUR", value: "EUR" },
                  { label: "USD", value: "USD" },
                ]}
              />
            </div>
          </FormCard>

          <FormCard title="Invoice and fulfilment">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormInput
                label="Invoice number"
                value={form.invoiceNumber}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    invoiceNumber: value,
                  }))
                }
              />

              <FormInput
                label="Invoice URL"
                value={form.invoiceUrl}
                onChange={(value) =>
                  setForm((current) => ({ ...current, invoiceUrl: value }))
                }
              />

              <FormInput
                label="Payment method"
                value={form.paymentMethod}
                onChange={(value) =>
                  setForm((current) => ({ ...current, paymentMethod: value }))
                }
              />

              <FormInput
                label="Supplier"
                value={form.supplier}
                onChange={(value) =>
                  setForm((current) => ({ ...current, supplier: value }))
                }
              />

              <FormInput
                label="Courier"
                value={form.courier}
                onChange={(value) =>
                  setForm((current) => ({ ...current, courier: value }))
                }
              />

              <FormInput
                label="Tracking number"
                value={form.trackingNumber}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    trackingNumber: value,
                  }))
                }
              />

              <div className="md:col-span-2">
                <FormInput
                  label="Tracking URL"
                  value={form.trackingUrl}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      trackingUrl: value,
                    }))
                  }
                />
              </div>

              <div className="md:col-span-2 xl:col-span-4">
                <FormTextarea
                  label="Internal notes"
                  value={form.notes}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, notes: value }))
                  }
                />
              </div>
            </div>
          </FormCard>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={createManualOrder}
            disabled={isCreating || clientsLoading}
            className="rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isCreating ? "Creating order..." : "Create manual order"}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

function FormCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#DED2C5] bg-white px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
        {title}
      </p>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function FormInput({
  label,
  value,
  onChange,
  keyboard = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: "text" | "decimal";
}) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-[0.2em] text-black/40">
        {label}
      </span>

      <input
        value={value}
        type={keyboard === "decimal" ? "number" : "text"}
        step={keyboard === "decimal" ? "0.01" : undefined}
        inputMode={keyboard === "decimal" ? "decimal" : "text"}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#DED2C5] bg-[#FBF7F2] px-3 py-2.5 text-sm text-black/70 outline-none focus:border-[#B59674]"
      />
    </label>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-[0.2em] text-black/40">
        {label}
      </span>

      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full resize-none rounded-lg border border-[#DED2C5] bg-[#FBF7F2] px-3 py-2.5 text-sm leading-6 text-black/70 outline-none focus:border-[#B59674]"
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[9px] uppercase tracking-[0.2em] text-black/40">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[#DED2C5] bg-[#FBF7F2] px-3 py-2.5 text-sm text-black/70 outline-none focus:border-[#B59674]"
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}