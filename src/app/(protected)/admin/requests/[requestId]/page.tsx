"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  ActivityEvent,
  AdminRequest,
  RequestDetail,
  RequestStatus,
} from "../../admin-types";
import {
  classNames,
  formatDateTime,
  formatStatusLabel,
  normalizeTimestamp,
  requestTone,
} from "../../admin-utils";

type PageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

const WORKFLOW_ACTIONS: Array<{ label: string; status: RequestStatus }> = [
  { label: "Reviewing", status: "reviewing" },
  { label: "Needs info", status: "needs_info" },
  { label: "Sourcing", status: "sourcing" },
  { label: "Options sent", status: "options_sent" },
  { label: "Awaiting approval", status: "awaiting_client_approval" },
  { label: "Approved", status: "approved" },
  { label: "Invoice sent", status: "invoice_sent" },
  { label: "Paid", status: "paid" },
  { label: "Purchased", status: "purchased" },
  { label: "Quality check", status: "quality_check" },
  { label: "Dispatched", status: "dispatched" },
  { label: "Delivered", status: "delivered" },
  { label: "Closed", status: "closed" },
  { label: "Cancelled", status: "cancelled" },
];

export default function AdminRequestDetailPage({ params }: PageProps) {
  const { requestId } = use(params);

  const [request, setRequest] = useState<AdminRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isSavingFulfilment, setIsSavingFulfilment] = useState(false);
  const [error, setError] = useState("");

  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: "",
    amount: "",
    currency: "GBP",
    invoiceUrl: "",
    paymentMethod: "",
  });

  const [fulfilmentForm, setFulfilmentForm] = useState({
    supplier: "",
    purchasePrice: "",
    courier: "",
    trackingNumber: "",
    trackingUrl: "",
  });

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const unsubscribe = onSnapshot(
      doc(db, "requests", requestId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRequest(null);
          setIsLoading(false);
          setError("Request not found.");
          return;
        }

        const data = snapshot.data() as {
          clientEmail?: string;
          clientId?: string;
          createdAt?: any;
          detail?: RequestDetail;
          status?: RequestStatus;
          updatedAt?: any;
        };

        const status = data.status ?? data.detail?.status ?? "submitted";

        setRequest({
          id: snapshot.id,
          clientId: data.clientId ?? "",
          clientEmail: data.clientEmail ?? "",
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
          status,
          detail: data.detail ?? getFallbackRequestDetail(snapshot.id, status),
        });

        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load request", error);
        setRequest(null);
        setIsLoading(false);
        setError("Could not load this request from Firestore.");
      },
    );

    return unsubscribe;
  }, [requestId]);

  useEffect(() => {
    if (!request) return;

    setInvoiceForm({
      invoiceNumber: request.detail.invoice?.invoiceNumber ?? "",
      amount:
        typeof request.detail.invoice?.amount === "number"
          ? String(request.detail.invoice.amount)
          : "",
      currency: request.detail.invoice?.currency ?? "GBP",
      invoiceUrl: request.detail.invoice?.invoiceUrl ?? "",
      paymentMethod: request.detail.invoice?.paymentMethod ?? "",
    });

    setFulfilmentForm({
      supplier: request.detail.fulfilment?.supplier ?? "",
      purchasePrice:
        typeof request.detail.fulfilment?.purchasePrice === "number"
          ? String(request.detail.fulfilment.purchasePrice)
          : "",
      courier: request.detail.fulfilment?.courier ?? "",
      trackingNumber: request.detail.fulfilment?.trackingNumber ?? "",
      trackingUrl: request.detail.fulfilment?.trackingUrl ?? "",
    });
  }, [request]);

  async function updateRequestStatus(nextStatus: RequestStatus) {
    if (!request) return;

    setIsUpdating(true);
    setError("");

    try {
      const requestRef = doc(db, "requests", request.id);

      const nowLabel = new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());

      const activityEvent: ActivityEvent = {
        id: `${nextStatus}-${Date.now()}`,
        label: `Status changed to ${formatStatusLabel(nextStatus)}`,
        type: "status-updated",
        meta: nowLabel,
        description: `Request moved from ${formatStatusLabel(
          request.status,
        )} to ${formatStatusLabel(nextStatus)}.`,
        tone: "info",
        statusLabel: "Current",
        actorName: "Admin",
      };

      await updateDoc(requestRef, {
        status: nextStatus,
        "detail.status": nextStatus,
        "detail.whatHappensNext": getNextStepText(nextStatus),
        "detail.statusTimeline": [
          ...(request.detail.statusTimeline ?? []),
          activityEvent,
        ],
        "detail.activitySummary": [
          activityEvent,
          ...(request.detail.activitySummary ?? []),
        ],
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to update request status", error);
      setError("Could not update request status.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function saveInvoiceDetails() {
    if (!request) return;

    setIsSavingInvoice(true);
    setError("");

    try {
      const amount = Number(invoiceForm.amount);

      await updateDoc(doc(db, "requests", request.id), {
        "detail.invoice": {
          invoiceNumber: invoiceForm.invoiceNumber.trim(),
          amount: Number.isFinite(amount) && invoiceForm.amount.trim() ? amount : 0,
          currency: invoiceForm.currency,
          invoiceUrl: invoiceForm.invoiceUrl.trim(),
          paymentMethod: invoiceForm.paymentMethod.trim(),
          sentAt: request.detail.invoice?.sentAt ?? null,
          paidAt: request.detail.invoice?.paidAt ?? null,
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to save invoice details", error);
      setError("Could not save invoice details.");
    } finally {
      setIsSavingInvoice(false);
    }
  }

  async function saveFulfilmentDetails() {
    if (!request) return;

    setIsSavingFulfilment(true);
    setError("");

    try {
      const purchasePrice = Number(fulfilmentForm.purchasePrice);

      await updateDoc(doc(db, "requests", request.id), {
        "detail.fulfilment": {
          supplier: fulfilmentForm.supplier.trim(),
          purchasePrice:
            Number.isFinite(purchasePrice) && fulfilmentForm.purchasePrice.trim()
              ? purchasePrice
              : 0,
          courier: fulfilmentForm.courier.trim(),
          trackingNumber: fulfilmentForm.trackingNumber.trim(),
          trackingUrl: fulfilmentForm.trackingUrl.trim(),
          purchasedAt: request.detail.fulfilment?.purchasedAt ?? null,
          dispatchedAt: request.detail.fulfilment?.dispatchedAt ?? null,
          deliveredAt: request.detail.fulfilment?.deliveredAt ?? null,
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to save fulfilment details", error);
      setError("Could not save fulfilment details.");
    } finally {
      setIsSavingFulfilment(false);
    }
  }

  return (
    <AdminShell active="requests">
      <div className="space-y-6">
        <Link
          href="/admin/requests"
          className="inline-flex rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]"
        >
          ← Back to requests
        </Link>

        {isLoading ? (
          <EmptyState
            title="Loading request"
            body="Reading this request from Firestore."
          />
        ) : null}

        {!isLoading && error ? (
          <div className="rounded-2xl border border-[#E2B8AA] bg-[#FFF2EF] p-4 text-sm text-[#8B3D2D]">
            {error}
          </div>
        ) : null}

        {!isLoading && request ? (
          <>
            <section className="rounded-2xl border border-[#DED2C5] bg-white">
              <div className="flex flex-col justify-between gap-5 border-b border-[#EFE4DA] px-6 py-5 lg:flex-row lg:items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                    Request workflow
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h1 className="font-serif text-4xl text-[#241E1A]">
                      {request.detail.title || "Untitled request"}
                    </h1>

                    <span
                      className={classNames(
                        "rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                        requestTone(request.status),
                      )}
                    >
                      {formatStatusLabel(request.status)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-black/55">
                    {request.clientEmail || request.clientId || "Unknown client"}
                  </p>
                </div>

                <div className="grid min-w-[360px] grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <CompactMeta label="Created" value={formatDateTime(request.createdAt)} />
                  <CompactMeta label="Updated" value={formatDateTime(request.updatedAt)} />
                  <CompactMeta label="Type" value={request.detail.requestType || "Not set"} />
                  <CompactMeta label="Urgency" value={request.detail.urgency || "Not set"} />
                </div>
              </div>

              <div className="px-6 py-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
                  Workflow actions
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {WORKFLOW_ACTIONS.map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      disabled={isUpdating || request.status === action.status}
                      onClick={() => updateRequestStatus(action.status)}
                      className={classNames(
                        "rounded-xl border px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                        request.status === action.status
                          ? "border-[#DED2C5] bg-[#F3EEE6] text-black/35"
                          : "border-[#DED2C5] bg-white text-black/65 hover:bg-[#221C18] hover:text-white",
                        isUpdating && "cursor-wait opacity-60",
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="space-y-6">
                <CleanPanel title="Brief" eyebrow="Request details">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <TextBlock
                      label="Full brief"
                      value={request.detail.notes || "Not captured"}
                    />

                    <TextBlock
                      label="Style notes"
                      value={request.detail.styleNotes || "Not captured"}
                    />
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#EFE4DA]">
                    <InfoRow label="Shipping country" value={request.detail.shippingCountry || "Not set"} />
                    <InfoRow label="Categories" value={formatArray(request.detail.categories)} />
                    <InfoRow label="Favourite brands" value={formatArray(request.detail.favoriteBrands)} />
                    <InfoRow label="Disliked brands" value={formatArray(request.detail.dislikedBrands)} />
                  </div>
                </CleanPanel>

                <CleanPanel title="Invoice and payment" eyebrow="Commercial">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormInput
                      label="Invoice number"
                      value={invoiceForm.invoiceNumber}
                      onChange={(value) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          invoiceNumber: value,
                        }))
                      }
                    />

                    <FormInput
                      label="Amount"
                      value={invoiceForm.amount}
                      keyboard="decimal"
                      onChange={(value) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          amount: value,
                        }))
                      }
                    />

                    <FormSelect
                      label="Currency"
                      value={invoiceForm.currency}
                      options={["GBP", "EUR", "USD"]}
                      onChange={(value) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          currency: value,
                        }))
                      }
                    />

                    <FormInput
                      label="Payment method"
                      value={invoiceForm.paymentMethod}
                      onChange={(value) =>
                        setInvoiceForm((current) => ({
                          ...current,
                          paymentMethod: value,
                        }))
                      }
                    />

                    <div className="md:col-span-2">
                      <FormInput
                        label="Invoice URL"
                        value={invoiceForm.invoiceUrl}
                        onChange={(value) =>
                          setInvoiceForm((current) => ({
                            ...current,
                            invoiceUrl: value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#EFE4DA]">
                    <InfoRow
                      label="Current amount"
                      value={formatMoney(
                        request.detail.invoice?.amount,
                        request.detail.invoice?.currency,
                      )}
                    />
                    <InfoRow
                      label="Invoice sent"
                      value={request.detail.invoice?.sentAt || "Not sent"}
                    />
                    <InfoRow
                      label="Paid at"
                      value={request.detail.invoice?.paidAt || "Not paid"}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={saveInvoiceDetails}
                    disabled={isSavingInvoice}
                    className="mt-5 rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSavingInvoice ? "Saving invoice..." : "Save invoice details"}
                  </button>
                </CleanPanel>

                <CleanPanel title="Fulfilment and delivery" eyebrow="Operations">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormInput
                      label="Supplier"
                      value={fulfilmentForm.supplier}
                      onChange={(value) =>
                        setFulfilmentForm((current) => ({
                          ...current,
                          supplier: value,
                        }))
                      }
                    />

                    <FormInput
                      label="Purchase price"
                      value={fulfilmentForm.purchasePrice}
                      keyboard="decimal"
                      onChange={(value) =>
                        setFulfilmentForm((current) => ({
                          ...current,
                          purchasePrice: value,
                        }))
                      }
                    />

                    <FormInput
                      label="Courier"
                      value={fulfilmentForm.courier}
                      onChange={(value) =>
                        setFulfilmentForm((current) => ({
                          ...current,
                          courier: value,
                        }))
                      }
                    />

                    <FormInput
                      label="Tracking number"
                      value={fulfilmentForm.trackingNumber}
                      onChange={(value) =>
                        setFulfilmentForm((current) => ({
                          ...current,
                          trackingNumber: value,
                        }))
                      }
                    />

                    <div className="md:col-span-2">
                      <FormInput
                        label="Tracking URL"
                        value={fulfilmentForm.trackingUrl}
                        onChange={(value) =>
                          setFulfilmentForm((current) => ({
                            ...current,
                            trackingUrl: value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#EFE4DA]">
                    <InfoRow
                      label="Purchased"
                      value={request.detail.fulfilment?.purchasedAt || "Not purchased"}
                    />
                    <InfoRow
                      label="Dispatched"
                      value={request.detail.fulfilment?.dispatchedAt || "Not dispatched"}
                    />
                    <InfoRow
                      label="Delivered"
                      value={request.detail.fulfilment?.deliveredAt || "Not delivered"}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={saveFulfilmentDetails}
                    disabled={isSavingFulfilment}
                    className="mt-5 rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSavingFulfilment
                      ? "Saving fulfilment..."
                      : "Save fulfilment details"}
                  </button>
                </CleanPanel>
              </section>

              <aside className="space-y-6">
                <CleanPanel title="Next step" eyebrow="Client-facing">
                  <p className="text-sm leading-7 text-black/65">
                    {request.detail.whatHappensNext || "No next step message set."}
                  </p>
                </CleanPanel>

                <CleanPanel title="Timeline" eyebrow="Audit trail">
                  <TimelineList events={request.detail.statusTimeline} />
                </CleanPanel>

                <CleanPanel title="Recent activity" eyebrow="Activity">
                  <TimelineList events={request.detail.activitySummary} />
                </CleanPanel>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function CompactMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/35">
        {label}
      </p>
      <p className="mt-1 text-sm text-black/65">{value}</p>
    </div>
  );
}

function CleanPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#DED2C5] bg-white p-5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        {label}
      </p>

      <div className="mt-2 min-h-[120px] rounded-2xl border border-[#EFE4DA] bg-[#FBF7F2] p-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-black/65">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[190px_minmax(0,1fr)] border-b border-[#EFE4DA] last:border-b-0">
      <div className="bg-[#FBF7F2] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">
          {label}
        </p>
      </div>
      <div className="px-4 py-3">
        <p className="break-words text-sm text-black/65">{value}</p>
      </div>
    </div>
  );
}

function TimelineList({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="space-y-3">
      {events?.length ? (
        events.map((event) => (
          <div
            key={event.id}
            className="rounded-2xl border border-[#EFE4DA] bg-[#FBF7F2] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-black">{event.label}</p>
                {event.actorName ? (
                  <p className="mt-1 text-xs text-black/50">{event.actorName}</p>
                ) : null}
              </div>

              <div className="text-right text-xs text-black/45">
                {event.meta ? <p>{event.meta}</p> : null}
                {event.statusLabel ? <p className="mt-1">{event.statusLabel}</p> : null}
              </div>
            </div>

            {event.description ? (
              <p className="mt-3 text-sm leading-6 text-black/60">
                {event.description}
              </p>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-sm text-black/45">No activity recorded.</p>
      )}
    </div>
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
      <span className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        {label}
      </span>

      <input
        value={value}
        type={keyboard === "decimal" ? "number" : "text"}
        step={keyboard === "decimal" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-3 text-sm text-black/70 outline-none focus:border-[#B59674]"
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
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-3 text-sm text-black/70 outline-none focus:border-[#B59674]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#DED2C5] bg-[#FBF7F2] text-center">
      <div className="max-w-md px-8 py-8">
        <h2 className="font-serif text-3xl leading-tight text-[#241E1A]">
          {title}
        </h2>
        <p className="mt-4 text-sm leading-7 text-black/55">{body}</p>
      </div>
    </div>
  );
}

function getNextStepText(status: RequestStatus) {
  switch (status) {
    case "submitted":
      return "Your request has been received and is waiting to be reviewed.";
    case "reviewing":
      return "Your request is being reviewed by the Tufffinds team.";
    case "needs_info":
      return "We need a few more details before sourcing.";
    case "sourcing":
      return "We are sourcing suitable options for your request.";
    case "options_sent":
      return "Your options have been sent for review.";
    case "awaiting_client_approval":
      return "Please approve your preferred option so we can move forward.";
    case "approved":
      return "Your selected item has been approved.";
    case "invoice_sent":
      return "Your invoice has been sent and is awaiting payment.";
    case "paid":
      return "Payment has been received.";
    case "purchased":
      return "Your item has been secured.";
    case "quality_check":
      return "Your item is being checked and prepared before dispatch.";
    case "dispatched":
      return "Your item has been dispatched.";
    case "delivered":
      return "Your item has been delivered.";
    case "closed":
      return "This request is now complete.";
    case "cancelled":
      return "This request has been cancelled.";
    default:
      return "Your request has been updated.";
  }
}

function formatArray(values?: string[]) {
  return values?.length ? values.join(", ") : "None captured";
}

function formatMoney(amount?: number, currency = "GBP") {
  if (typeof amount !== "number") return "Not set";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

function getFallbackRequestDetail(
  id: string,
  status: RequestStatus = "submitted",
): RequestDetail {
  return {
    activitySummary: [],
    categories: [],
    createdDateLabel: "",
    dislikedBrands: [],
    favoriteBrands: [],
    href: `/requests/${id}`,
    id,
    linkedEdits: [],
    linkedMessagesPreview: [],
    notes: "",
    purchaseMode: "",
    references: [],
    requestType: "",
    shippingCountry: "",
    status,
    statusTimeline: [],
    styleNotes: "",
    title: "Untitled request",
    urgency: "",
    whatHappensNext: "",
  };
}