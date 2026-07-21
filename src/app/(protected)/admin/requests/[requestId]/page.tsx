"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  ActivityEvent,
  AdminRequest,
  Currency,
  FirestoreTimestampValue,
  RequestAdminWorkflow,
  RequestDetail,
  RequestItemOption,
  RequestStatus,
} from "../../admin-types";
import { getEmptyRequestAdminWorkflow } from "../../admin-types";
import {
  classNames,
  formatDateTime,
  formatStatusLabel,
  normalizeTimestamp,
  requestTone,
} from "../../admin-utils";

type PageProps = {
  params: Promise<{ requestId: string }>;
};

type ItemOptionForm = Omit<RequestItemOption, "costPrice" | "salePrice"> & {
  costPrice: string;
  salePrice: string;
};

const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  submitted: ["reviewing", "needs_info", "cancelled"],
  reviewing: ["sourcing", "needs_info", "cancelled"],
  needs_info: [],
  sourcing: ["options_sent", "needs_info", "cancelled"],
  options_sent: ["awaiting_client_approval", "sourcing", "needs_info", "cancelled"],
  awaiting_client_approval: ["approved", "sourcing", "needs_info", "cancelled"],
  approved: ["invoice_sent", "closed", "cancelled"],
  invoice_sent: ["paid", "cancelled"],
  paid: ["purchased", "cancelled"],
  purchased: ["quality_check", "cancelled"],
  quality_check: ["dispatched", "cancelled"],
  dispatched: ["delivered"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
};

const STATUS_ORDER: RequestStatus[] = [
  "submitted",
  "reviewing",
  "needs_info",
  "sourcing",
  "options_sent",
  "awaiting_client_approval",
  "approved",
  "invoice_sent",
  "paid",
  "purchased",
  "quality_check",
  "dispatched",
  "delivered",
  "closed",
  "cancelled",
];

export default function AdminRequestDetailPage({ params }: PageProps) {
  const { requestId } = use(params);
  const [request, setRequest] = useState<AdminRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSave, setActiveSave] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [missingInformation, setMissingInformation] = useState("");
  const [sourcingProgress, setSourcingProgress] = useState("");
  const [itemOptions, setItemOptions] = useState<ItemOptionForm[]>([]);
  const [approvedOptionId, setApprovedOptionId] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
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

    return onSnapshot(
      doc(db, "requests", requestId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRequest(null);
          setIsLoading(false);
          setError("Request not found.");
          return;
        }

        const data = snapshot.data() as {
          adminWorkflow?: Partial<RequestAdminWorkflow>;
          clientEmail?: string;
          clientId?: string;
          clientName?: string;
          clientPhone?: string;
          createdAt?: FirestoreTimestampValue;
          detail?: RequestDetail;
          source?: string;
          status?: RequestStatus;
          submittedFrom?: string;
          updatedAt?: FirestoreTimestampValue;
        };
        const status = data.status ?? data.detail?.status ?? "submitted";
        const workflow = normalizeAdminWorkflow(data.adminWorkflow);

        setRequest({
          id: snapshot.id,
          adminWorkflow: workflow,
          clientId: data.clientId ?? "",
          clientEmail: data.clientEmail ?? "",
          clientName: data.clientName ?? "",
          clientPhone: data.clientPhone ?? "",
          createdAt: normalizeTimestamp(data.createdAt),
          updatedAt: normalizeTimestamp(data.updatedAt),
          status,
          detail: data.detail ?? getFallbackRequestDetail(snapshot.id, status),
          source: data.source ?? "",
          submittedFrom: data.submittedFrom ?? "",
        });
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load request", snapshotError);
        setRequest(null);
        setIsLoading(false);
        setError("Could not load this request from Firestore.");
      },
    );
  }, [requestId]);

  useEffect(() => {
    if (!request) return;

    setInternalNotes(request.adminWorkflow.internalNotes);
    setMissingInformation(request.adminWorkflow.missingInformation);
    setSourcingProgress(request.adminWorkflow.sourcingProgress);
    setItemOptions(request.adminWorkflow.itemOptions.map(toItemOptionForm));
    setApprovedOptionId(request.adminWorkflow.approvedOptionId);
    setCreatedOrderId(
      request.adminWorkflow.orderId || request.detail.linkedOrder?.id || null,
    );
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

  const allowedTransitions = useMemo(
    () =>
      request
        ? getAllowedTransitions(
            request.status,
            request.adminWorkflow.needsInfoReturnStatus,
          )
        : [],
    [request],
  );

  const missingClientFields = useMemo(
    () => (request ? getMissingClientFields(request) : []),
    [request],
  );

  async function transitionRequest(nextStatus: RequestStatus) {
    if (!request || activeSave) return;

    if (nextStatus === "needs_info" && !missingInformation.trim()) {
      setError("Add a missing-information summary before changing the status.");
      return;
    }

    const isTerminal = nextStatus === "closed" || nextStatus === "cancelled";
    const isBackward =
      STATUS_ORDER.indexOf(nextStatus) < STATUS_ORDER.indexOf(request.status) &&
      request.status !== "needs_info";

    if (
      (isTerminal || isBackward) &&
      !window.confirm(
        `Confirm changing this request from ${formatStatusLabel(request.status)} to ${formatStatusLabel(nextStatus)}.`,
      )
    ) {
      return;
    }

    setActiveSave("status");
    clearMessages();

    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "requests", request.id);
        const snapshot = await transaction.get(requestRef);

        if (!snapshot.exists()) throw new Error("REQUEST_NOT_FOUND");

        const data = snapshot.data() as {
          adminWorkflow?: Partial<RequestAdminWorkflow>;
          detail?: RequestDetail;
          status?: RequestStatus;
        };
        const currentStatus = data.status ?? data.detail?.status ?? "submitted";
        const workflow = normalizeAdminWorkflow(data.adminWorkflow);
        const validTransitions = getAllowedTransitions(
          currentStatus,
          workflow.needsInfoReturnStatus,
        );

        if (!validTransitions.includes(nextStatus)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }

        const summary = missingInformation.trim();
        if (nextStatus === "needs_info" && !summary) {
          throw new Error("MISSING_INFORMATION_REQUIRED");
        }

        const event = createStatusEvent(currentStatus, nextStatus);
        const updates: Record<string, unknown> = {
          status: nextStatus,
          "detail.status": nextStatus,
          "detail.whatHappensNext": getNextStepText(nextStatus),
          "detail.statusTimeline": [
            ...(data.detail?.statusTimeline ?? []),
            event,
          ],
          "detail.activitySummary": [
            event,
            ...(data.detail?.activitySummary ?? []),
          ],
          updatedAt: serverTimestamp(),
        };

        if (nextStatus === "needs_info") {
          updates["adminWorkflow.missingInformation"] = summary;
          updates["adminWorkflow.needsInfoReturnStatus"] = currentStatus;
        } else if (currentStatus === "needs_info") {
          updates["adminWorkflow.needsInfoReturnStatus"] = null;
        }

        transaction.update(requestRef, updates);
      });

      setFeedback(`Request status changed to ${formatStatusLabel(nextStatus)}.`);
    } catch (transitionError) {
      console.error("Failed to update request status", transitionError);
      setError(
        transitionError instanceof Error &&
          transitionError.message === "INVALID_STATUS_TRANSITION"
          ? "The request changed while you were viewing it. Refresh and try the next valid action."
          : "Could not update request status.",
      );
    } finally {
      setActiveSave(null);
    }
  }

  async function saveAdminField(
    field: "internalNotes" | "missingInformation",
    value: string,
  ) {
    if (!request || activeSave) return;

    if (
      field === "missingInformation" &&
      request.status === "needs_info" &&
      !value.trim()
    ) {
      setError("A request marked as needing information must keep a summary.");
      return;
    }

    setActiveSave(field);
    clearMessages();

    try {
      await updateDoc(doc(db, "requests", request.id), {
        [`adminWorkflow.${field}`]: value.trim(),
        updatedAt: serverTimestamp(),
      });
      setFeedback(
        field === "internalNotes"
          ? "Internal notes saved."
          : "Missing-information summary saved.",
      );
    } catch (saveError) {
      console.error(`Failed to save ${field}`, saveError);
      setError("Could not save the request workflow details.");
    } finally {
      setActiveSave(null);
    }
  }

  async function saveSourcingDetails() {
    if (!request || activeSave) return;

    const normalizedOptions = itemOptions.map(fromItemOptionForm);
    if (
      approvedOptionId &&
      !normalizedOptions.some((option) => option.id === approvedOptionId)
    ) {
      setError("Select an approved option that still exists.");
      return;
    }

    setActiveSave("sourcing");
    clearMessages();

    try {
      await updateDoc(doc(db, "requests", request.id), {
        "adminWorkflow.sourcingProgress": sourcingProgress.trim(),
        "adminWorkflow.itemOptions": normalizedOptions,
        "adminWorkflow.approvedOptionId": approvedOptionId,
        updatedAt: serverTimestamp(),
      });
      setFeedback("Sourcing progress and item options saved.");
    } catch (saveError) {
      console.error("Failed to save sourcing details", saveError);
      setError("Could not save sourcing progress or item options.");
    } finally {
      setActiveSave(null);
    }
  }

  async function saveInvoiceDetails() {
    if (!request || activeSave) return;
    setActiveSave("invoice");
    clearMessages();

    try {
      await updateDoc(doc(db, "requests", request.id), {
        "detail.invoice": {
          invoiceNumber: invoiceForm.invoiceNumber.trim(),
          amount: parseMoney(invoiceForm.amount),
          currency: invoiceForm.currency,
          invoiceUrl: invoiceForm.invoiceUrl.trim(),
          paymentMethod: invoiceForm.paymentMethod.trim(),
          sentAt: request.detail.invoice?.sentAt ?? null,
          paidAt: request.detail.invoice?.paidAt ?? null,
        },
        updatedAt: serverTimestamp(),
      });
      setFeedback("Invoice details saved.");
    } catch (saveError) {
      console.error("Failed to save invoice details", saveError);
      setError("Could not save invoice details.");
    } finally {
      setActiveSave(null);
    }
  }

  async function saveFulfilmentDetails() {
    if (!request || activeSave) return;
    setActiveSave("fulfilment");
    clearMessages();

    try {
      await updateDoc(doc(db, "requests", request.id), {
        "detail.fulfilment": {
          supplier: fulfilmentForm.supplier.trim(),
          purchasePrice: parseMoney(fulfilmentForm.purchasePrice),
          courier: fulfilmentForm.courier.trim(),
          trackingNumber: fulfilmentForm.trackingNumber.trim(),
          trackingUrl: fulfilmentForm.trackingUrl.trim(),
          purchasedAt: request.detail.fulfilment?.purchasedAt ?? null,
          dispatchedAt: request.detail.fulfilment?.dispatchedAt ?? null,
          deliveredAt: request.detail.fulfilment?.deliveredAt ?? null,
        },
        updatedAt: serverTimestamp(),
      });
      setFeedback("Fulfilment details saved.");
    } catch (saveError) {
      console.error("Failed to save fulfilment details", saveError);
      setError("Could not save fulfilment details.");
    } finally {
      setActiveSave(null);
    }
  }

  async function convertToOrder() {
    if (!request || activeSave || createdOrderId) return;

    const selectedOption = itemOptions
      .map(fromItemOptionForm)
      .find((option) => option.id === approvedOptionId);

    if (request.status !== "approved") {
      setError("Only an approved request can be converted into an order.");
      return;
    }
    if (!selectedOption?.title.trim() || selectedOption.salePrice <= 0) {
      setError("Select an approved option with a title and agreed sale price.");
      return;
    }
    if (!window.confirm("Create one order from the approved item option?")) return;

    setActiveSave("conversion");
    clearMessages();

    try {
      const existingOrders = await getDocs(
        query(
          collection(db, "orders"),
          where("requestId", "==", request.id),
          limit(1),
        ),
      );
      const existingOrderId = existingOrders.docs[0]?.id ?? null;

      const result = await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "requests", request.id);
        const orderId = existingOrderId ?? `request_${request.id}`;
        const orderRef = doc(db, "orders", orderId);
        const requestSnapshot = await transaction.get(requestRef);
        const orderSnapshot = await transaction.get(orderRef);

        if (!requestSnapshot.exists()) throw new Error("REQUEST_NOT_FOUND");

        const data = requestSnapshot.data() as {
          adminWorkflow?: Partial<RequestAdminWorkflow>;
          clientEmail?: string;
          clientId?: string;
          clientName?: string;
          clientPhone?: string;
          detail?: RequestDetail;
          status?: RequestStatus;
        };
        const status = data.status ?? data.detail?.status ?? "submitted";
        const workflow = normalizeAdminWorkflow(data.adminWorkflow);
        const approvedOption = workflow.itemOptions.find(
          (option) => option.id === workflow.approvedOptionId,
        );
        const linkedOrderId = workflow.orderId || data.detail?.linkedOrder?.id;

        if (linkedOrderId) {
          return { created: false, orderId: linkedOrderId };
        }
        if (status !== "approved") throw new Error("REQUEST_NOT_APPROVED");
        if (!approvedOption?.title.trim() || approvedOption.salePrice <= 0) {
          throw new Error("APPROVED_OPTION_REQUIRED");
        }

        if (orderSnapshot.exists()) {
          const existingRequestId = orderSnapshot.data().requestId;
          if (existingRequestId !== request.id) throw new Error("ORDER_ID_CONFLICT");
        } else {
          transaction.set(orderRef, {
            approvedOptionId: approvedOption.id,
            clientId: data.clientId ?? "",
            clientEmail: data.clientEmail ?? "",
            clientName: data.clientName ?? "",
            clientPhone: data.clientPhone ?? "",
            requestId: request.id,
            title: approvedOption.title.trim(),
            brand: approvedOption.brand.trim(),
            item: approvedOption.item.trim(),
            size: approvedOption.size.trim(),
            colour: approvedOption.colour.trim(),
            status: "created",
            salePrice: approvedOption.salePrice,
            costPrice: approvedOption.costPrice,
            currency: approvedOption.currency,
            invoiceNumber: data.detail?.invoice?.invoiceNumber ?? "",
            invoiceUrl: data.detail?.invoice?.invoiceUrl ?? "",
            paymentMethod: data.detail?.invoice?.paymentMethod ?? "",
            supplier:
              approvedOption.supplier.trim() ||
              data.detail?.fulfilment?.supplier ||
              "",
            courier: data.detail?.fulfilment?.courier ?? "",
            trackingNumber: data.detail?.fulfilment?.trackingNumber ?? "",
            trackingUrl: data.detail?.fulfilment?.trackingUrl ?? "",
            notes: approvedOption.notes.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        transaction.update(requestRef, {
          "adminWorkflow.orderId": orderId,
          "detail.linkedOrder": {
            id: orderId,
            href: `/admin/orders/${orderId}`,
            title: approvedOption.title.trim(),
            description: "Order created from the approved request option.",
          },
          updatedAt: serverTimestamp(),
        });

        return { created: !orderSnapshot.exists(), orderId };
      });

      setCreatedOrderId(result.orderId);
      setFeedback(
        result.created
          ? "Order created and linked to this request."
          : "The existing order was linked; no duplicate was created.",
      );
    } catch (conversionError) {
      console.error("Failed to convert request to order", conversionError);
      setError(
        conversionError instanceof Error &&
          conversionError.message === "REQUEST_NOT_APPROVED"
          ? "This request is no longer approved. Refresh before converting it."
          : "Could not convert this request into an order.",
      );
    } finally {
      setActiveSave(null);
    }
  }

  function clearMessages() {
    setError("");
    setFeedback("");
  }

  function addItemOption() {
    setItemOptions((current) => [
      ...current,
      createEmptyItemOptionForm(`option_${Date.now()}`),
    ]);
  }

  function updateItemOption(id: string, field: keyof ItemOptionForm, value: string) {
    setItemOptions((current) =>
      current.map((option) =>
        option.id === id ? { ...option, [field]: value } : option,
      ),
    );
  }

  function removeItemOption(id: string) {
    if (!window.confirm("Remove this item option from the request?")) return;
    setItemOptions((current) => current.filter((option) => option.id !== id));
    if (approvedOptionId === id) setApprovedOptionId(null);
  }

  return (
    <AdminShell active="requests">
      <div className="space-y-6">
        <Link href="/admin/requests" className="inline-flex rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">
          ← Back to requests
        </Link>

        {isLoading ? <EmptyState title="Loading request" body="Reading this request from Firestore." /> : null}
        {!isLoading && error ? <Alert tone="error">{error}</Alert> : null}
        {!isLoading && feedback ? <Alert tone="success">{feedback}</Alert> : null}

        {!isLoading && request ? (
          <>
            <section className="rounded-2xl border border-[#DED2C5] bg-white">
              <div className="flex flex-col justify-between gap-5 border-b border-[#EFE4DA] px-6 py-5 lg:flex-row lg:items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">Request workflow</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h1 className="font-serif text-4xl text-[#241E1A]">{request.detail.title || "Untitled request"}</h1>
                    <span className={classNames("rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", requestTone(request.status))}>
                      {formatStatusLabel(request.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-black/55">{request.clientName || request.clientEmail || request.clientId || "Unknown client"}</p>
                </div>
                <div className="grid min-w-[360px] grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <CompactMeta label="Created" value={formatDateTime(request.createdAt)} />
                  <CompactMeta label="Updated" value={formatDateTime(request.updatedAt)} />
                  <CompactMeta label="Type" value={request.detail.requestType || "Not set"} />
                  <CompactMeta label="Urgency" value={request.detail.urgency || "Not set"} />
                </div>
              </div>

              <div className="px-6 py-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">Next valid status actions</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {allowedTransitions.length ? allowedTransitions.map((status) => (
                    <button key={status} type="button" disabled={Boolean(activeSave)} onClick={() => transitionRequest(status)} className={classNames("rounded-xl border border-[#DED2C5] bg-white px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/65 transition hover:bg-[#221C18] hover:text-white", activeSave && "cursor-wait opacity-60")}>
                      {request.status === "needs_info" ? `Return to ${formatStatusLabel(status)}` : formatStatusLabel(status)}
                    </button>
                  )) : <p className="text-sm text-black/45">No further status transitions are available.</p>}
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="space-y-6">
                <CleanPanel title="Client and brief" eyebrow="Request details">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <TextBlock label="Client brief" value={request.detail.notes || "Not captured"} />
                    <TextBlock label="Style notes" value={request.detail.styleNotes || "Not captured"} />
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-[#EFE4DA]">
                    <InfoRow label="Client name" value={request.clientName || "Not set"} />
                    <InfoRow label="Email" value={request.clientEmail || "Not set"} />
                    <InfoRow label="Phone" value={request.clientPhone || "Not set"} />
                    <InfoRow label="Shipping country" value={request.detail.shippingCountry || "Not set"} />
                    <InfoRow label="Purchase mode" value={request.detail.purchaseMode || "Not set"} />
                    <InfoRow label="Assigned stylist" value={request.detail.assignedStylist || "Not assigned"} />
                    <InfoRow label="Deadline" value={request.detail.deadlineLabel || "Not set"} />
                    <InfoRow label="Categories" value={formatArray(request.detail.categories)} />
                    <InfoRow label="Favourite brands" value={formatArray(request.detail.favoriteBrands)} />
                    <InfoRow label="Disliked brands" value={formatArray(request.detail.dislikedBrands)} />
                    <InfoRow label="Source" value={request.source || "Not set"} />
                    <InfoRow label="Submitted from" value={request.submittedFrom || "Not set"} />
                  </div>
                  {request.clientId ? <Link href={`/admin/clients/${request.clientId}`} className="mt-5 inline-flex rounded-xl border border-[#DED2C5] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">Open linked client profile</Link> : <p className="mt-5 text-sm text-black/45">No client profile is linked to this request.</p>}
                </CleanPanel>

                <CleanPanel title="Internal notes" eyebrow="Admin only">
                  <FormTextarea label="Private operational notes" value={internalNotes} onChange={setInternalNotes} />
                  <p className="mt-2 text-xs leading-5 text-black/45">Stored separately from the client-submitted brief and client-facing next-step copy.</p>
                  <SaveButton busy={activeSave === "internalNotes"} disabled={Boolean(activeSave)} onClick={() => saveAdminField("internalNotes", internalNotes)} label="Save internal notes" />
                </CleanPanel>

                <CleanPanel title="Missing information" eyebrow="Admin workflow">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {missingClientFields.length ? missingClientFields.map((field) => <span key={field} className="rounded-full bg-[#FFF2D8] px-3 py-1 text-xs text-[#76561E]">Missing: {field}</span>) : <span className="rounded-full bg-[#E8F5E9] px-3 py-1 text-xs text-[#2F5A34]">Core submitted fields are present</span>}
                  </div>
                  <FormTextarea label="Internal missing-information summary" value={missingInformation} onChange={setMissingInformation} />
                  <div className="flex flex-wrap gap-3">
                    <SaveButton busy={activeSave === "missingInformation"} disabled={Boolean(activeSave)} onClick={() => saveAdminField("missingInformation", missingInformation)} label="Save summary" />
                    {request.status !== "needs_info" && allowedTransitions.includes("needs_info") ? <SaveButton busy={activeSave === "status"} disabled={Boolean(activeSave) || !missingInformation.trim()} onClick={() => transitionRequest("needs_info")} label="Mark as needing information" secondary /> : null}
                    {request.status === "needs_info" ? <p className="mt-7 text-sm text-[#76561E]">The next status action returns this request to its saved active workflow stage.</p> : null}
                  </div>
                </CleanPanel>

                <CleanPanel title="Sourcing progress and options" eyebrow="Sourcing">
                  <FormTextarea label="Internal sourcing progress" value={sourcingProgress} onChange={setSourcingProgress} />
                  <div className="mt-5 space-y-4">
                    {itemOptions.length ? itemOptions.map((option, index) => (
                      <div key={option.id} className="rounded-2xl border border-[#EFE4DA] bg-[#FBF7F2] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-black/70">
                            <input type="radio" name="approved-option" checked={approvedOptionId === option.id} onChange={() => setApprovedOptionId(option.id)} />
                            Approved option {index + 1}
                          </label>
                          <button type="button" onClick={() => removeItemOption(option.id)} className="text-xs text-[#8B3D2D]">Remove</button>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {(["title", "brand", "item", "size", "colour", "supplier"] as const).map((field) => <FormInput key={field} label={formatStatusLabel(field)} value={option[field]} onChange={(value) => updateItemOption(option.id, field, value)} />)}
                          <FormInput label="Agreed sale price" value={option.salePrice} keyboard="decimal" onChange={(value) => updateItemOption(option.id, "salePrice", value)} />
                          <FormInput label="Cost price" value={option.costPrice} keyboard="decimal" onChange={(value) => updateItemOption(option.id, "costPrice", value)} />
                          <FormSelect label="Currency" value={option.currency} options={["GBP", "EUR", "USD"]} onChange={(value) => updateItemOption(option.id, "currency", value)} />
                        </div>
                        <div className="mt-4"><FormTextarea label="Option notes" value={option.notes} onChange={(value) => updateItemOption(option.id, "notes", value)} compact /></div>
                      </div>
                    )) : <p className="text-sm text-black/45">No sourcing options recorded.</p>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={addItemOption} disabled={Boolean(activeSave)} className="rounded-xl border border-[#DED2C5] px-4 py-2.5 text-sm text-black/65 disabled:opacity-60">Add item option</button>
                    <SaveButton busy={activeSave === "sourcing"} disabled={Boolean(activeSave)} onClick={saveSourcingDetails} label="Save sourcing details" />
                  </div>
                </CleanPanel>

                <CleanPanel title="Convert to order" eyebrow="Approved request">
                  {createdOrderId ? <div><p className="text-sm text-black/60">This request is linked to an order.</p><Link href={`/admin/orders/${createdOrderId}`} className="mt-4 inline-flex rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white">Open linked order</Link></div> : <><p className="text-sm leading-7 text-black/60">Conversion is available only while the request is approved and an approved item option with an agreed price has been saved.</p><SaveButton busy={activeSave === "conversion"} disabled={Boolean(activeSave) || request.status !== "approved" || !approvedOptionId} onClick={convertToOrder} label="Create order from approved option" /></>}
                </CleanPanel>

                <CleanPanel title="Invoice and payment" eyebrow="Legacy request commercial data">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormInput label="Invoice number" value={invoiceForm.invoiceNumber} onChange={(value) => setInvoiceForm((current) => ({ ...current, invoiceNumber: value }))} />
                    <FormInput label="Amount" value={invoiceForm.amount} keyboard="decimal" onChange={(value) => setInvoiceForm((current) => ({ ...current, amount: value }))} />
                    <FormSelect label="Currency" value={invoiceForm.currency} options={["GBP", "EUR", "USD"]} onChange={(value) => setInvoiceForm((current) => ({ ...current, currency: value }))} />
                    <FormInput label="Payment method" value={invoiceForm.paymentMethod} onChange={(value) => setInvoiceForm((current) => ({ ...current, paymentMethod: value }))} />
                    <FormInput label="Invoice URL" value={invoiceForm.invoiceUrl} onChange={(value) => setInvoiceForm((current) => ({ ...current, invoiceUrl: value }))} />
                  </div>
                  <SaveButton busy={activeSave === "invoice"} disabled={Boolean(activeSave)} onClick={saveInvoiceDetails} label="Save invoice details" />
                  <div className="mt-5 overflow-hidden rounded-xl border border-[#EFE4DA]">
                    <InfoRow label="Invoice sent" value={request.detail.invoice?.sentAt || "Not sent"} />
                    <InfoRow label="Paid at" value={request.detail.invoice?.paidAt || "Not paid"} />
                  </div>
                </CleanPanel>

                <CleanPanel title="Fulfilment and delivery" eyebrow="Legacy request fulfilment data">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormInput label="Supplier" value={fulfilmentForm.supplier} onChange={(value) => setFulfilmentForm((current) => ({ ...current, supplier: value }))} />
                    <FormInput label="Purchase price" value={fulfilmentForm.purchasePrice} keyboard="decimal" onChange={(value) => setFulfilmentForm((current) => ({ ...current, purchasePrice: value }))} />
                    <FormInput label="Courier" value={fulfilmentForm.courier} onChange={(value) => setFulfilmentForm((current) => ({ ...current, courier: value }))} />
                    <FormInput label="Tracking number" value={fulfilmentForm.trackingNumber} onChange={(value) => setFulfilmentForm((current) => ({ ...current, trackingNumber: value }))} />
                    <FormInput label="Tracking URL" value={fulfilmentForm.trackingUrl} onChange={(value) => setFulfilmentForm((current) => ({ ...current, trackingUrl: value }))} />
                  </div>
                  <SaveButton busy={activeSave === "fulfilment"} disabled={Boolean(activeSave)} onClick={saveFulfilmentDetails} label="Save fulfilment details" />
                  <div className="mt-5 overflow-hidden rounded-xl border border-[#EFE4DA]">
                    <InfoRow label="Purchased" value={request.detail.fulfilment?.purchasedAt || "Not purchased"} />
                    <InfoRow label="Dispatched" value={request.detail.fulfilment?.dispatchedAt || "Not dispatched"} />
                    <InfoRow label="Delivered" value={request.detail.fulfilment?.deliveredAt || "Not delivered"} />
                  </div>
                </CleanPanel>
              </section>

              <aside className="space-y-6">
                <CleanPanel title="Next step" eyebrow="Client-facing"><p className="text-sm leading-7 text-black/65">{request.detail.whatHappensNext || "No next step message set."}</p></CleanPanel>
                <CleanPanel title="References" eyebrow="Submitted material">{request.detail.references.length ? <div className="space-y-2">{request.detail.references.map((reference) => reference.type === "link" ? <a key={reference.id} href={reference.value} target="_blank" rel="noreferrer" className="block rounded-xl border border-[#EFE4DA] p-3 text-sm text-black/65 hover:bg-[#FBF7F2]">{reference.label || reference.value}</a> : <p key={reference.id} className="rounded-xl border border-[#EFE4DA] p-3 text-sm text-black/55">{reference.label || "Upload reference"}</p>)}</div> : <p className="text-sm text-black/45">No references attached.</p>}</CleanPanel>
                <CleanPanel title="Linked messages" eyebrow="Communication">{request.detail.linkedMessagesPreview.length ? <div className="space-y-2">{request.detail.linkedMessagesPreview.map((message) => <Link key={message.id} href={`/admin/messages/${message.id}`} className="block rounded-xl border border-[#EFE4DA] p-3 hover:bg-[#FBF7F2]"><p className="text-sm font-medium text-black/70">{message.title}</p><p className="mt-1 text-xs text-black/45">{message.description}</p></Link>)}</div> : <p className="text-sm text-black/45">No request-linked message previews are stored.</p>}</CleanPanel>
                <CleanPanel title="Linked edits" eyebrow="Request options">{request.detail.linkedEdits.length ? <div className="space-y-2">{request.detail.linkedEdits.map((edit) => <Link key={edit.id} href={edit.href} className="block rounded-xl border border-[#EFE4DA] p-3 hover:bg-[#FBF7F2]"><p className="text-sm font-medium text-black/70">{edit.title}</p><p className="mt-1 text-xs text-black/45">{edit.description}</p></Link>)}</div> : <p className="text-sm text-black/45">No linked edits are stored.</p>}</CleanPanel>
                <CleanPanel title="Timeline" eyebrow="Audit trail"><TimelineList events={request.detail.statusTimeline} /></CleanPanel>
                <CleanPanel title="Recent activity" eyebrow="Activity"><TimelineList events={request.detail.activitySummary} /></CleanPanel>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function normalizeAdminWorkflow(value?: Partial<RequestAdminWorkflow>): RequestAdminWorkflow {
  const empty = getEmptyRequestAdminWorkflow();
  return {
    ...empty,
    ...value,
    itemOptions: Array.isArray(value?.itemOptions) ? value.itemOptions : [],
  };
}

function getAllowedTransitions(status: RequestStatus, returnStatus: RequestStatus | null) {
  if (status !== "needs_info") return STATUS_TRANSITIONS[status];
  const fallback = returnStatus && !["needs_info", "closed", "cancelled"].includes(returnStatus) ? returnStatus : "reviewing";
  return [fallback];
}

function createStatusEvent(previous: RequestStatus, next: RequestStatus): ActivityEvent {
  return {
    id: `${next}-${Date.now()}`,
    label: `Status changed to ${formatStatusLabel(next)}`,
    type: "status-updated",
    meta: new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
    description: `Request moved from ${formatStatusLabel(previous)} to ${formatStatusLabel(next)}.`,
    tone: "info",
    statusLabel: "Current",
    actorName: "Admin",
  };
}

function getMissingClientFields(request: AdminRequest) {
  return [
    ["client name", request.clientName],
    ["email", request.clientEmail],
    ["phone", request.clientPhone],
    ["request brief", request.detail.notes],
    ["shipping country", request.detail.shippingCountry],
  ].filter(([, value]) => !String(value ?? "").trim()).map(([label]) => label);
}

function toItemOptionForm(option: RequestItemOption): ItemOptionForm {
  return { ...option, costPrice: String(option.costPrice ?? 0), salePrice: String(option.salePrice ?? 0) };
}

function fromItemOptionForm(option: ItemOptionForm): RequestItemOption {
  return { ...option, costPrice: parseMoney(option.costPrice), salePrice: parseMoney(option.salePrice), currency: option.currency as Currency };
}

function createEmptyItemOptionForm(id: string): ItemOptionForm {
  return { id, title: "", brand: "", item: "", size: "", colour: "", supplier: "", salePrice: "", costPrice: "", currency: "GBP", notes: "" };
}

function parseMoney(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const amount = Number(normalized);
  return normalized && Number.isFinite(amount) ? amount : 0;
}

function Alert({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return <div role={tone === "error" ? "alert" : "status"} className={classNames("rounded-2xl border p-4 text-sm", tone === "error" ? "border-[#E2B8AA] bg-[#FFF2EF] text-[#8B3D2D]" : "border-[#B8D6BC] bg-[#E8F5E9] text-[#2F5A34]")}>{children}</div>;
}

function CompactMeta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-[0.22em] text-black/35">{label}</p><p className="mt-1 text-sm text-black/65">{value}</p></div>;
}

function CleanPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#DED2C5] bg-white p-5"><p className="text-[10px] uppercase tracking-[0.24em] text-black/40">{eyebrow}</p><h2 className="mt-2 font-serif text-2xl text-[#241E1A]">{title}</h2><div className="mt-5">{children}</div></section>;
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-[0.22em] text-black/40">{label}</p><div className="mt-2 min-h-[120px] rounded-2xl border border-[#EFE4DA] bg-[#FBF7F2] p-4"><p className="whitespace-pre-wrap text-sm leading-7 text-black/65">{value}</p></div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[190px_minmax(0,1fr)] border-b border-[#EFE4DA] last:border-b-0"><div className="bg-[#FBF7F2] px-4 py-3"><p className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</p></div><div className="px-4 py-3"><p className="break-words text-sm text-black/65">{value}</p></div></div>;
}

function TimelineList({ events }: { events: ActivityEvent[] }) {
  return <div className="space-y-3">{events?.length ? events.map((event) => <div key={event.id} className="rounded-2xl border border-[#EFE4DA] bg-[#FBF7F2] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-black">{event.label}</p>{event.actorName ? <p className="mt-1 text-xs text-black/50">{event.actorName}</p> : null}</div><div className="text-right text-xs text-black/45">{event.meta ? <p>{event.meta}</p> : null}{event.statusLabel ? <p className="mt-1">{event.statusLabel}</p> : null}</div></div>{event.description ? <p className="mt-3 text-sm leading-6 text-black/60">{event.description}</p> : null}</div>) : <p className="text-sm text-black/45">No activity recorded.</p>}</div>;
}

function FormInput({ label, value, onChange, keyboard = "text" }: { label: string; value: string; onChange: (value: string) => void; keyboard?: "text" | "decimal" }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-[0.22em] text-black/40">{label}</span><input value={value} type={keyboard === "decimal" ? "number" : "text"} step={keyboard === "decimal" ? "0.01" : undefined} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-black/70 outline-none focus:border-[#B59674]" /></label>;
}

function FormTextarea({ label, value, onChange, compact = false }: { label: string; value: string; onChange: (value: string) => void; compact?: boolean }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-[0.22em] text-black/40">{label}</span><textarea value={value} rows={compact ? 3 : 5} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-3 text-sm leading-6 text-black/70 outline-none focus:border-[#B59674]" /></label>;
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-[0.22em] text-black/40">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-black/70 outline-none focus:border-[#B59674]">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function SaveButton({ busy, disabled, label, onClick, secondary = false }: { busy: boolean; disabled: boolean; label: string; onClick: () => void; secondary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={classNames("mt-5 rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60", secondary ? "border border-[#DED2C5] bg-white text-[#221C18]" : "bg-[#221C18] text-white")}>{busy ? "Saving…" : label}</button>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#DED2C5] bg-[#FBF7F2] text-center"><div className="max-w-md px-8 py-8"><h2 className="font-serif text-3xl leading-tight text-[#241E1A]">{title}</h2><p className="mt-4 text-sm leading-7 text-black/55">{body}</p></div></div>;
}

function getNextStepText(status: RequestStatus) {
  const messages: Record<RequestStatus, string> = {
    submitted: "Your request has been received and is waiting to be reviewed.",
    reviewing: "Your request is being reviewed by the Tufffinds team.",
    needs_info: "We need a few more details before sourcing.",
    sourcing: "We are sourcing suitable options for your request.",
    options_sent: "Your options have been sent for review.",
    awaiting_client_approval: "Please approve your preferred option so we can move forward.",
    approved: "Your selected item has been approved.",
    invoice_sent: "Your invoice has been sent and is awaiting payment.",
    paid: "Payment has been received.",
    purchased: "Your item has been secured.",
    quality_check: "Your item is being checked and prepared before dispatch.",
    dispatched: "Your item has been dispatched.",
    delivered: "Your item has been delivered.",
    closed: "This request is now complete.",
    cancelled: "This request has been cancelled.",
  };
  return messages[status];
}

function formatArray(values?: string[]) {
  return values?.length ? values.join(", ") : "None captured";
}

function getFallbackRequestDetail(id: string, status: RequestStatus = "submitted"): RequestDetail {
  return { activitySummary: [], categories: [], createdDateLabel: "", dislikedBrands: [], favoriteBrands: [], href: `/requests/${id}`, id, linkedEdits: [], linkedMessagesPreview: [], notes: "", purchaseMode: "", references: [], requestType: "", shippingCountry: "", status, statusTimeline: [], styleNotes: "", title: "Untitled request", urgency: "", whatHappensNext: "" };
}
