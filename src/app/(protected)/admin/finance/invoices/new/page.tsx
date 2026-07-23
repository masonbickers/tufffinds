"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "@/app/lib/firebase";
import AdminShell from "../../../_components/AdminShell";
import { useAdminSession } from "../../../_components/AdminGuard";
import {
  AdminPage,
  AdminPageHeader,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../../_components/AdminUI";
import {
  addDaysInput,
  calculateInvoiceTotals,
  calculateLineItem,
  createLineItem,
  formatInvoiceMoney,
  isValidDateInput,
  todayInputValue,
  type InvoiceLineItem,
} from "../../invoice-data";
import {
  DEFAULT_VAT_SETTINGS,
  readVatSettings,
  type VatSettings,
} from "../../vat-settings";

type OrderOption = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  item: string;
  brand: string;
  currency: string;
  salePrice: number | null;
};

type ClientOption = {
  id: string;
  name: string;
  email: string;
  address: string;
};

type FormErrors = Record<string, string>;

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAdminSession();
  const today = useMemo(todayInputValue, []);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [clients, setClients] = useState<Map<string, ClientOption>>(new Map());
  const [vatSettings, setVatSettings] =
    useState<VatSettings>(DEFAULT_VAT_SETTINGS);
  const [orderId, setOrderId] = useState(searchParams.get("orderId") ?? "");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysInput(today, 14));
  const [currency, setCurrency] = useState("GBP");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    createLineItem("", 0, 20),
  ]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(
    () =>
      onSnapshot(collection(db, "orders"), (snapshot) => {
        setOrders(
          snapshot.docs
            .map((entry) =>
              normalizeOrder(entry.id, entry.data() as Record<string, unknown>),
            )
            .sort((left, right) =>
              (left.title || left.id).localeCompare(right.title || right.id),
            ),
        );
      }),
    [],
  );

  useEffect(
    () =>
      onSnapshot(collection(db, "client_profiles"), (snapshot) => {
        const next = new Map<string, ClientOption>();
        snapshot.docs.forEach((entry) => {
          next.set(
            entry.id,
            normalizeClient(entry.id, entry.data() as Record<string, unknown>),
          );
        });
        setClients(next);
      }),
    [],
  );

  useEffect(
    () =>
      onSnapshot(doc(db, "workspace_settings", "vat"), (snapshot) => {
        setVatSettings(
          snapshot.exists()
            ? readVatSettings(snapshot.data() as Record<string, unknown>)
            : DEFAULT_VAT_SETTINGS,
        );
      }),
    [],
  );

  useEffect(() => {
    if (!orderId || !orders.length) return;
    const selected = orders.find((order) => order.id === orderId);
    if (selected) applyOrder(selected);
    // Apply a deep-link selection only after the order collection first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length]);

  const totals = useMemo(() => calculateInvoiceTotals(lineItems), [lineItems]);

  function applyOrder(order: OrderOption) {
    const client = clients.get(order.clientId);
    setOrderId(order.id);
    setClientId(order.clientId);
    setClientName(client?.name || order.clientName);
    setClientEmail(client?.email || order.clientEmail);
    setClientAddress(client?.address || "");
    setCurrency(["GBP", "EUR", "USD"].includes(order.currency) ? order.currency : "GBP");

    if (order.salePrice !== null) {
      const unitNet =
        vatSettings.priceBasis === "inclusive"
          ? roundMoney(order.salePrice / 1.2)
          : order.salePrice;
      setLineItems([
        createLineItem(
          [order.brand, order.item || order.title].filter(Boolean).join(" - "),
          unitNet,
          20,
        ),
      ]);
    } else {
      setLineItems([
        createLineItem(
          [order.brand, order.item || order.title].filter(Boolean).join(" - "),
          0,
          20,
        ),
      ]);
    }
    setErrors({});
    setFeedback("");
  }

  function updateLine(
    id: string,
    key: "description" | "quantity" | "unitNet" | "vatRate",
    value: string,
  ) {
    setLineItems((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        return calculateLineItem({
          ...item,
          [key]:
            key === "description"
              ? value
              : Math.max(0, Number(value) || 0),
        });
      }),
    );
    setFeedback("");
  }

  function addLine() {
    if (lineItems.length >= 12) return;
    setLineItems((current) => [...current, createLineItem("", 0, 20)]);
  }

  function removeLine(id: string) {
    if (lineItems.length === 1) return;
    setLineItems((current) => current.filter((item) => item.id !== id));
  }

  async function createInvoice(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;
    const nextErrors = validateForm({
      orderId,
      clientName,
      clientEmail,
      issueDate,
      dueDate,
      lineItems,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setFeedback("Check the highlighted invoice fields.");
      return;
    }

    setCreating(true);
    setFeedback("");
    try {
      const invoiceId = doc(collection(db, "invoices")).id;
      const issueYear = Number(issueDate.slice(0, 4));
      const counterRef = doc(db, "finance_counters", `invoice-${issueYear}`);
      const invoiceRef = doc(db, "invoices", invoiceId);

      await runTransaction(db, async (transaction) => {
        const counterSnapshot = await transaction.get(counterRef);
        const storedLast = counterSnapshot.exists()
          ? readNumber(counterSnapshot.data().lastNumber)
          : 0;
        const sequence = storedLast + 1;
        const invoiceNumber = `TF-${issueYear}-${String(sequence).padStart(4, "0")}`;

        transaction.set(
          counterRef,
          {
            documentType: "invoice",
            year: issueYear,
            lastNumber: sequence,
            updatedAt: serverTimestamp(),
            updatedByUid: user.uid,
          },
          { merge: false },
        );
        transaction.set(invoiceRef, {
          type: "invoice",
          invoiceNumber,
          sequence,
          status: "issued",
          orderId,
          clientId,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          clientAddress: clientAddress.trim(),
          issueDate,
          dueDate,
          paidDate: "",
          currency,
          lineItems,
          ...totals,
          refundedTotal: 0,
          creditedTotal: 0,
          refunds: [],
          sourceInvoiceId: "",
          creditNoteIds: [],
          reason: "",
          notes: notes.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByUid: user.uid,
          createdByEmail: user.email || "",
          updatedByUid: user.uid,
          updatedByEmail: user.email || "",
        });
        if (orderId) {
          transaction.update(doc(db, "orders", orderId), {
            invoiceId,
            invoiceNumber,
            status: "invoice_sent",
            updatedAt: serverTimestamp(),
          });
        }
      });

      router.push(`/admin/finance/invoices/${invoiceId}`);
    } catch (error) {
      console.error("Failed to create invoice", error);
      setFeedback("The invoice could not be created.");
      setCreating(false);
    }
  }

  return (
    <AdminShell active="finance">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Accounts receivable"
          title="Create invoice"
          description="Issue a numbered invoice from an order or enter the client and line items manually."
          actions={
            <Link href="/admin/finance/invoices" className={adminSecondaryButton}>
              Cancel
            </Link>
          }
        />

        <form
          onSubmit={createInvoice}
          className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]"
          noValidate
        >
          <div className="space-y-8">
            <FormSection
              eyebrow="Source"
              title="Order and client"
              description="Choosing an order pre-fills the information already stored in Tufffinds."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Order" htmlFor="invoice-order" error={errors.orderId}>
                  <select
                    id="invoice-order"
                    value={orderId}
                    onChange={(event) => {
                      const selected = orders.find(
                        (order) => order.id === event.target.value,
                      );
                      if (selected) applyOrder(selected);
                      else setOrderId("");
                    }}
                    className={controlClass(errors.orderId)}
                  >
                    <option value="">Choose an order</option>
                    {orders.map((order) => (
                      <option value={order.id} key={order.id}>
                        {order.title || order.id}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency" htmlFor="invoice-currency">
                  <select
                    id="invoice-currency"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className={controlClass()}
                  >
                    <option value="GBP">GBP - British pound</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="USD">USD - US dollar</option>
                  </select>
                </Field>
                <Field
                  label="Client name"
                  htmlFor="invoice-client-name"
                  error={errors.clientName}
                >
                  <input
                    id="invoice-client-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    className={controlClass(errors.clientName)}
                  />
                </Field>
                <Field
                  label="Client email"
                  htmlFor="invoice-client-email"
                  error={errors.clientEmail}
                >
                  <input
                    id="invoice-client-email"
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    className={controlClass(errors.clientEmail)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Billing address" htmlFor="invoice-client-address">
                    <textarea
                      id="invoice-client-address"
                      rows={3}
                      value={clientAddress}
                      onChange={(event) => setClientAddress(event.target.value)}
                      className={controlClass()}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection
              eyebrow="Timing"
              title="Invoice dates"
              description="The payment due date must be on or after the invoice issue date."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Invoice date"
                  htmlFor="invoice-date"
                  error={errors.issueDate}
                >
                  <input
                    id="invoice-date"
                    type="date"
                    value={issueDate}
                    onChange={(event) => {
                      setIssueDate(event.target.value);
                      setDueDate(addDaysInput(event.target.value, 14));
                    }}
                    className={controlClass(errors.issueDate)}
                  />
                </Field>
                <Field
                  label="Payment due date"
                  htmlFor="invoice-due-date"
                  error={errors.dueDate}
                >
                  <input
                    id="invoice-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className={controlClass(errors.dueDate)}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection
              eyebrow="Charges"
              title="Line items"
              description="Enter VAT-exclusive unit prices. Net, VAT and gross amounts are calculated automatically."
            >
              <div className="overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
                <div className="hidden grid-cols-[minmax(12rem,1fr)_5rem_7rem_5rem_7rem_2rem] gap-3 border-b border-[#e5ddd5] bg-[#f8f5f1] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#81746a] md:grid">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit net</span>
                  <span>VAT</span>
                  <span className="text-right">Gross</span>
                  <span />
                </div>
                <div className="divide-y divide-[#ebe3dc]">
                  {lineItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(12rem,1fr)_5rem_7rem_5rem_7rem_2rem] md:items-start"
                    >
                      <label>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81746a] md:hidden">
                          Description
                        </span>
                        <input
                          value={item.description}
                          onChange={(event) =>
                            updateLine(item.id, "description", event.target.value)
                          }
                          className={controlClass(errors[`line-${index}`])}
                          placeholder="Item or service"
                        />
                        {errors[`line-${index}`] ? (
                          <span className="mt-1 block text-[10px] text-[#8c3c2d]">
                            {errors[`line-${index}`]}
                          </span>
                        ) : null}
                      </label>
                      <label>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81746a] md:hidden">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(event) =>
                            updateLine(item.id, "quantity", event.target.value)
                          }
                          className={controlClass()}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81746a] md:hidden">
                          Unit net
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitNet}
                          onChange={(event) =>
                            updateLine(item.id, "unitNet", event.target.value)
                          }
                          className={controlClass()}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#81746a] md:hidden">
                          VAT rate
                        </span>
                        <select
                          value={item.vatRate}
                          onChange={(event) =>
                            updateLine(item.id, "vatRate", event.target.value)
                          }
                          className={controlClass()}
                        >
                          <option value="20">20%</option>
                          <option value="5">5%</option>
                          <option value="0">0%</option>
                        </select>
                      </label>
                      <p className="self-center text-right text-sm font-semibold tabular-nums text-[#3f342d]">
                        {formatInvoiceMoney(item.grossAmount, currency)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeLine(item.id)}
                        disabled={lineItems.length === 1}
                        className="h-9 text-lg text-[#9a887c] hover:text-[#8c3c2d] disabled:opacity-25"
                        aria-label={`Remove line item ${index + 1}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={addLine}
                disabled={lineItems.length >= 12}
                className={`${adminSecondaryButton} mt-3`}
              >
                Add line item
              </button>
            </FormSection>

            <FormSection
              eyebrow="Additional information"
              title="Invoice notes"
              description="Optional payment instructions or a short client-facing note."
            >
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={controlClass()}
                placeholder="Thank you for choosing Tufffinds."
              />
            </FormSection>
          </div>

          <aside className="sticky top-20 rounded-[14px] border border-[#ded5cb] bg-white p-5 shadow-[0_1px_2px_rgba(43,35,30,0.04)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
              Invoice total
            </p>
            <h2 className="mt-1.5 font-serif text-xl text-[#302722]">
              Amount summary
            </h2>
            <dl className="mt-5 space-y-3">
              <TotalRow label="Net" value={totals.netTotal} currency={currency} />
              <TotalRow label="VAT" value={totals.vatTotal} currency={currency} />
              <div className="border-t border-[#d9cfc5] pt-3">
                <TotalRow
                  label="Gross total"
                  value={totals.grossTotal}
                  currency={currency}
                  strong
                />
              </div>
            </dl>
            <p className="mt-5 text-[11px] leading-5 text-[#81746a]">
              The invoice number is assigned automatically when this record is
              created.
            </p>
            <button
              type="submit"
              disabled={creating || totals.grossTotal <= 0}
              className={`${adminPrimaryButton} mt-5 w-full`}
            >
              {creating ? "Creating invoice…" : "Create and issue invoice"}
            </button>
            {feedback ? (
              <p className="mt-3 text-xs text-[#8c3c2d]" role="alert">
                {feedback}
              </p>
            ) : null}
          </aside>
        </form>
      </AdminPage>
    </AdminShell>
  );
}

function FormSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#ded5cb] pt-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 font-serif text-xl text-[#302722]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#766960]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[#62554c]">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-[11px] text-[#8c3c2d]">{error}</p> : null}
    </div>
  );
}

function TotalRow({
  label,
  value,
  currency,
  strong = false,
}: {
  label: string;
  value: number;
  currency: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={`${strong ? "font-semibold text-[#3b302a]" : "text-[#766960]"} text-sm`}>
        {label}
      </dt>
      <dd
        className={`tabular-nums text-[#302722] ${
          strong ? "font-serif text-xl font-semibold" : "text-sm font-semibold"
        }`}
      >
        {formatInvoiceMoney(value, currency)}
      </dd>
    </div>
  );
}

function validateForm({
  orderId,
  clientName,
  clientEmail,
  issueDate,
  dueDate,
  lineItems,
}: {
  orderId: string;
  clientName: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
}) {
  const errors: FormErrors = {};
  if (!orderId) errors.orderId = "Choose the order this invoice belongs to.";
  if (!clientName.trim()) errors.clientName = "Enter the client name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail.trim())) {
    errors.clientEmail = "Enter a valid client email.";
  }
  if (!isValidDateInput(issueDate)) errors.issueDate = "Enter an invoice date.";
  if (!isValidDateInput(dueDate)) {
    errors.dueDate = "Enter a payment due date.";
  } else if (issueDate && dueDate < issueDate) {
    errors.dueDate = "The due date cannot be before the invoice date.";
  }
  lineItems.forEach((item, index) => {
    if (!item.description.trim()) {
      errors[`line-${index}`] = "Enter a description.";
    } else if (item.quantity <= 0) {
      errors[`line-${index}`] = "Quantity must be greater than zero.";
    } else if (item.unitNet < 0) {
      errors[`line-${index}`] = "The unit amount cannot be negative.";
    }
  });
  if (!lineItems.some((item) => item.grossAmount > 0)) {
    errors["line-0"] = "At least one line must have a value.";
  }
  return errors;
}

function normalizeOrder(id: string, data: Record<string, unknown>): OrderOption {
  return {
    id,
    clientId: readString(data.clientId),
    clientName: readString(data.clientName),
    clientEmail: readString(data.clientEmail),
    title: readString(data.title),
    item: readString(data.item),
    brand: readString(data.brand),
    currency: readString(data.currency).toUpperCase(),
    salePrice: readOptionalNumber(data.salePrice),
  };
}

function normalizeClient(id: string, data: Record<string, unknown>): ClientOption {
  const profile = isRecord(data.profile) ? data.profile : {};
  const shipping = isRecord(profile.shippingAddress) ? profile.shippingAddress : {};
  const address = [
    readString(shipping.line1),
    readString(shipping.line2),
    readString(shipping.city),
    readString(shipping.postcode),
    readString(shipping.country),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    id,
    name: readString(profile.fullName) || readString(data.fullName),
    email: readString(data.email),
    address,
  };
}

function controlClass(error?: string) {
  return `block min-h-10 w-full rounded-[9px] border bg-white px-3 py-2 text-sm text-[#302722] outline-none transition focus:ring-2 ${
    error
      ? "border-[#b85b46] focus:border-[#b85b46] focus:ring-[#b85b46]/15"
      : "border-[#d3c8bd] focus:border-[#806650] focus:ring-[#806650]/20"
  }`;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
