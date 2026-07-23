"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
  deleteField,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminState,
  AdminStatusBadge,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../_components/AdminUI";
import { ORDER_STATUSES, type OrderStatus } from "../../admin-types";
import {
  ORDER_NEXT_ACTIONS,
  ORDER_STATUS_LABELS,
  isOrderStatus,
  orderStatusToneName,
} from "../../admin-utils";

type PageProps = { params: Promise<{ orderId: string }> };
type LoadState = "loading" | "ready" | "stale" | "not_found" | "malformed" | "permission" | "error";
type LinkedState = "idle" | "loading" | "ready" | "not_found" | "malformed" | "permission" | "error";
type Feedback = { state: "idle" | "saving" | "success" | "error"; message: string };
type AmountValue =
  | { kind: "missing"; input: "" }
  | { kind: "valid"; value: number; input: string }
  | { kind: "malformed"; input: string };
type CurrencyValue =
  | { kind: "missing"; raw: "" }
  | { kind: "supported"; value: SupportedCurrency; raw: string }
  | { kind: "unsupported"; raw: string };
type TimestampValue =
  | { kind: "missing" }
  | { kind: "valid"; value: Date }
  | { kind: "malformed" };
type SupportedCurrency = "GBP" | "EUR" | "USD";

type OrderRecord = {
  id: string;
  title: string;
  clientId: string;
  clientEmail: string;
  requestId: string;
  status: OrderStatus | null;
  rawStatus: string;
  statusIssue: "missing" | "unknown" | "malformed" | null;
  brand: string;
  item: string;
  size: string;
  colour: string;
  salePrice: AmountValue;
  costPrice: AmountValue;
  currency: CurrencyValue;
  invoiceNumber: string;
  invoiceId: string;
  invoiceUrl: string;
  paymentMethod: string;
  supplier: string;
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  notes: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  issues: string[];
  commercialFingerprint: string;
  fulfilmentFingerprint: string;
  statusFingerprint: string;
};

type ClientRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  contactPreferences: string[];
  shippingCountry: string;
};

type RequestRecord = { id: string; title: string; status: string };
type CommercialForm = {
  currency: string;
  salePrice: string;
  invoiceNumber: string;
  invoiceUrl: string;
  paymentMethod: string;
};
type FulfilmentForm = {
  costPrice: string;
  supplier: string;
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  notes: string;
};

const EMPTY_FEEDBACK: Feedback = { state: "idle", message: "" };
const EMPTY_COMMERCIAL: CommercialForm = {
  currency: "",
  salePrice: "",
  invoiceNumber: "",
  invoiceUrl: "",
  paymentMethod: "",
};
const EMPTY_FULFILMENT: FulfilmentForm = {
  costPrice: "",
  supplier: "",
  courier: "",
  trackingNumber: "",
  trackingUrl: "",
  notes: "",
};

class ConcurrentEditError extends Error {}

export default function OrderDetailPage({ params }: PageProps) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [readError, setReadError] = useState("");
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [clientState, setClientState] = useState<LinkedState>("idle");
  const [clientError, setClientError] = useState("");
  const [request, setRequest] = useState<RequestRecord | null>(null);
  const [requestState, setRequestState] = useState<LinkedState>("idle");
  const [requestError, setRequestError] = useState("");
  const [commercialForm, setCommercialForm] = useState(EMPTY_COMMERCIAL);
  const [commercialDirty, setCommercialDirty] = useState(false);
  const [commercialErrors, setCommercialErrors] = useState<Record<string, string>>({});
  const [commercialFeedback, setCommercialFeedback] = useState(EMPTY_FEEDBACK);
  const [fulfilmentForm, setFulfilmentForm] = useState(EMPTY_FULFILMENT);
  const [fulfilmentDirty, setFulfilmentDirty] = useState(false);
  const [fulfilmentErrors, setFulfilmentErrors] = useState<Record<string, string>>({});
  const [fulfilmentFeedback, setFulfilmentFeedback] = useState(EMPTY_FEEDBACK);
  const [statusDraft, setStatusDraft] = useState("");
  const [statusDirty, setStatusDirty] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(EMPTY_FEEDBACK);
  const commercialLock = useRef(false);
  const fulfilmentLock = useRef(false);
  const statusLock = useRef(false);
  const currencyRef = useRef<HTMLSelectElement>(null);
  const salePriceRef = useRef<HTMLInputElement>(null);
  const invoiceUrlRef = useRef<HTMLInputElement>(null);
  const costPriceRef = useRef<HTMLInputElement>(null);
  const trackingUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrder(null);
    setReadError("");
    if (!isSafeDocumentId(orderId)) {
      setLoadState("malformed");
      return;
    }

    setLoadState("loading");
    return onSnapshot(
      doc(db, "orders", orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrder(null);
          setLoadState("not_found");
          return;
        }
        setOrder(normalizeOrder(snapshot.id, snapshot.data() as Record<string, unknown>));
        setReadError("");
        setLoadState("ready");
      },
      (error) => {
        console.error("Failed to load order", error);
        const permission = isPermissionError(error);
        setReadError(readFailureMessage(error, "order"));
        setLoadState((current) =>
          current === "ready" || current === "stale"
            ? "stale"
            : permission
              ? "permission"
              : "error",
        );
      },
    );
  }, [orderId]);

  useEffect(() => {
    if (!order || commercialDirty) return;
    setCommercialForm(commercialFormFromOrder(order));
  }, [commercialDirty, order]);

  useEffect(() => {
    if (!order || fulfilmentDirty) return;
    setFulfilmentForm(fulfilmentFormFromOrder(order));
  }, [fulfilmentDirty, order]);

  useEffect(() => {
    if (!order || statusDirty) return;
    setStatusDraft(order.status ?? "");
  }, [order, statusDirty]);

  useEffect(() => {
    const clientId = order?.clientId ?? "";
    setClient(null);
    setClientError("");
    if (!clientId) {
      setClientState("idle");
      return;
    }
    if (!isSafeDocumentId(clientId)) {
      setClientState("malformed");
      return;
    }
    setClientState("loading");
    return onSnapshot(
      doc(db, "client_profiles", clientId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setClientState("not_found");
          setClient(null);
          return;
        }
        setClient(normalizeClient(snapshot.id, snapshot.data() as Record<string, unknown>));
        setClientState("ready");
      },
      (error) => {
        console.error("Failed to load linked client", error);
        setClient(null);
        setClientError(readFailureMessage(error, "linked client"));
        setClientState(isPermissionError(error) ? "permission" : "error");
      },
    );
  }, [order?.clientId]);

  useEffect(() => {
    const requestId = order?.requestId ?? "";
    setRequest(null);
    setRequestError("");
    if (!requestId) {
      setRequestState("idle");
      return;
    }
    if (!isSafeDocumentId(requestId)) {
      setRequestState("malformed");
      return;
    }
    setRequestState("loading");
    return onSnapshot(
      doc(db, "requests", requestId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRequestState("not_found");
          setRequest(null);
          return;
        }
        const data = snapshot.data() as Record<string, unknown>;
        const detail = isRecord(data.detail) ? data.detail : {};
        setRequest({
          id: snapshot.id,
          title: readString(data.title) || readString(detail.title) || "Untitled request",
          status: readString(data.status) || readString(detail.status),
        });
        setRequestState("ready");
      },
      (error) => {
        console.error("Failed to load linked request", error);
        setRequest(null);
        setRequestError(readFailureMessage(error, "linked request"));
        setRequestState(isPermissionError(error) ? "permission" : "error");
      },
    );
  }, [order?.requestId]);

  async function saveCommercial() {
    if (!order || commercialLock.current) return;
    const errors: Record<string, string> = {};
    const salePrice = parseOptionalMoney(commercialForm.salePrice, "Sale price");
    const invoiceUrl = parseOptionalHttpUrl(commercialForm.invoiceUrl);
    if (!isSupportedCurrency(commercialForm.currency)) errors.currency = "Choose GBP, EUR, or USD.";
    if (salePrice.error) errors.salePrice = salePrice.error;
    if (commercialForm.invoiceUrl.trim() && !invoiceUrl) errors.invoiceUrl = "Enter a valid http or https URL.";
    setCommercialErrors(errors);
    if (Object.keys(errors).length) {
      setCommercialFeedback({ state: "error", message: "Correct the highlighted commercial fields." });
      if (errors.currency) currencyRef.current?.focus();
      else if (errors.salePrice) salePriceRef.current?.focus();
      else if (errors.invoiceUrl) invoiceUrlRef.current?.focus();
      return;
    }

    commercialLock.current = true;
    setCommercialFeedback({ state: "saving", message: "Saving commercial details…" });
    try {
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, "orders", order.id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("Order not found.");
        const latest = snapshot.data() as Record<string, unknown>;
        if (commercialFingerprint(latest) !== order.commercialFingerprint) {
          throw new ConcurrentEditError("Commercial details changed in another session. Review the latest values before saving again.");
        }
        transaction.update(reference, {
          currency: commercialForm.currency,
          salePrice: salePrice.value === undefined ? deleteField() : salePrice.value,
          invoiceNumber: optionalField(commercialForm.invoiceNumber),
          invoiceUrl: invoiceUrl ? invoiceUrl : deleteField(),
          paymentMethod: optionalField(commercialForm.paymentMethod),
          updatedAt: serverTimestamp(),
        });
      });
      setCommercialDirty(false);
      setCommercialFeedback({ state: "success", message: "Commercial details saved." });
    } catch (error) {
      console.error("Failed to save commercial details", error);
      setCommercialFeedback({ state: "error", message: mutationFailureMessage(error, "commercial details") });
    } finally {
      commercialLock.current = false;
    }
  }

  async function saveFulfilment() {
    if (!order || fulfilmentLock.current) return;
    const errors: Record<string, string> = {};
    const costPrice = parseOptionalMoney(fulfilmentForm.costPrice, "Purchase price");
    const trackingUrl = parseOptionalHttpUrl(fulfilmentForm.trackingUrl);
    if (costPrice.error) errors.costPrice = costPrice.error;
    if (fulfilmentForm.trackingUrl.trim() && !trackingUrl) errors.trackingUrl = "Enter a valid http or https URL.";
    setFulfilmentErrors(errors);
    if (Object.keys(errors).length) {
      setFulfilmentFeedback({ state: "error", message: "Correct the highlighted fulfilment fields." });
      if (errors.costPrice) costPriceRef.current?.focus();
      else trackingUrlRef.current?.focus();
      return;
    }

    fulfilmentLock.current = true;
    setFulfilmentFeedback({ state: "saving", message: "Saving fulfilment details…" });
    try {
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, "orders", order.id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("Order not found.");
        const latest = snapshot.data() as Record<string, unknown>;
        if (fulfilmentFingerprint(latest) !== order.fulfilmentFingerprint) {
          throw new ConcurrentEditError("Fulfilment details changed in another session. Review the latest values before saving again.");
        }
        transaction.update(reference, {
          costPrice: costPrice.value === undefined ? deleteField() : costPrice.value,
          supplier: optionalField(fulfilmentForm.supplier),
          courier: optionalField(fulfilmentForm.courier),
          trackingNumber: optionalField(fulfilmentForm.trackingNumber),
          trackingUrl: trackingUrl ? trackingUrl : deleteField(),
          notes: optionalField(fulfilmentForm.notes),
          updatedAt: serverTimestamp(),
        });
      });
      setFulfilmentDirty(false);
      setFulfilmentFeedback({ state: "success", message: "Fulfilment details saved." });
    } catch (error) {
      console.error("Failed to save fulfilment details", error);
      setFulfilmentFeedback({ state: "error", message: mutationFailureMessage(error, "fulfilment details") });
    } finally {
      fulfilmentLock.current = false;
    }
  }

  async function saveStatus() {
    if (!order || statusLock.current || !isOrderStatus(statusDraft)) return;
    if (order.status === statusDraft) return;
    const currentIndex = order.status ? ORDER_STATUSES.indexOf(order.status) : -1;
    const nextIndex = ORDER_STATUSES.indexOf(statusDraft);
    const backwards = currentIndex >= 0 && nextIndex < currentIndex;
    const nextTerminal = statusDraft === "closed" || statusDraft === "cancelled";
    const reopening = Boolean(order.status && ["closed", "cancelled"].includes(order.status) && !nextTerminal);
    if ((backwards || nextTerminal || reopening) && !window.confirm(statusConfirmationMessage(statusDraft, backwards, reopening))) return;

    statusLock.current = true;
    setStatusFeedback({ state: "saving", message: "Saving status…" });
    try {
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, "orders", order.id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("Order not found.");
        const latest = snapshot.data() as Record<string, unknown>;
        if (statusFingerprint(latest) !== order.statusFingerprint) {
          throw new ConcurrentEditError("Order status changed in another session. Review the latest status before saving again.");
        }
        transaction.update(reference, { status: statusDraft, updatedAt: serverTimestamp() });
      });
      setStatusDirty(false);
      setStatusFeedback({ state: "success", message: `Status changed to ${ORDER_STATUS_LABELS[statusDraft]}.` });
    } catch (error) {
      console.error("Failed to save order status", error);
      setStatusFeedback({ state: "error", message: mutationFailureMessage(error, "status") });
    } finally {
      statusLock.current = false;
    }
  }

  const contactEmail = firstValidEmail(client?.email, order?.clientEmail);
  const contactPhone = client?.phone ?? "";
  const relationshipWarnings = order ? buildRelationshipWarnings(order, client, clientState, requestState) : [];
  const allWarnings = order ? [...order.issues, ...relationshipWarnings] : [];

  return (
    <AdminShell active="orders">
      <AdminPage>
        <div><Link href="/admin/orders" className={adminSecondaryButton}>← Back to orders</Link></div>

        {loadState === "loading" ? <StateSurface><AdminState title="Loading order" body="Reading this order from Firestore." /></StateSurface> : null}
        {loadState === "malformed" ? <StateSurface><AdminState title="Malformed order identifier" body="This URL does not contain a safe Firestore order identifier. Return to the Orders queue and choose a valid record." tone="error" /></StateSurface> : null}
        {loadState === "not_found" ? <StateSurface><AdminState title="Order not found" body="No order exists for this identifier. Return to the Orders queue to choose another record." tone="error" /></StateSurface> : null}
        {loadState === "permission" ? <StateSurface><AdminState title="Order access denied" body={readError || "Your current account cannot read this order."} tone="error" /></StateSurface> : null}
        {loadState === "error" ? <StateSurface><AdminState title="Could not load order" body={readError} tone="error" /></StateSurface> : null}

        {order && (loadState === "ready" || loadState === "stale") ? (
          <>
            <AdminPageHeader
              eyebrow="Order detail"
              title={order.title || "Untitled order"}
              description={client?.name || order.clientEmail || order.clientId || "Client information is missing"}
              actions={<>
                {order.invoiceId ? (
                  <Link href={`/admin/finance/invoices/${order.invoiceId}`} className={adminPrimaryButton}>
                    View invoice
                  </Link>
                ) : (
                  <Link href={`/admin/finance/invoices/new?orderId=${encodeURIComponent(order.id)}`} className={adminPrimaryButton}>
                    Create invoice
                  </Link>
                )}
                {contactEmail ? <a href={`mailto:${contactEmail}`} className={adminSecondaryButton}>Email client</a> : null}
                {contactPhone ? <a href={`tel:${contactPhone}`} className={adminSecondaryButton}>Call client</a> : null}
                <AdminStatusBadge tone={orderStatusToneName(order.status)}>{statusLabel(order)}</AdminStatusBadge>
              </>}
            />

            <div className="grid divide-y divide-[#e5ddd4] border-y border-[#e5ddd4] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
              <Meta label="Order ID" value={order.id} />
              <Meta label="Created" value={formatTimestamp(order.createdAt)} />
              <Meta label="Updated" value={formatTimestamp(order.updatedAt)} />
              <Meta label="Sale value" value={formatMoneyValue(order.salePrice, order.currency)} />
            </div>

            {loadState === "stale" ? <WarningSurface title="Live updates stopped" messages={[`${readError} Previously loaded data remains visible and forms are preserved.`]} /> : null}
            {allWarnings.length ? <WarningSurface title="Review order data" messages={allWarnings} /> : null}

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
              <div className="order-2 min-w-0 space-y-8 xl:order-1">
                <AdminSection title="Order summary" description="The stored item and product details for this order.">
                  <DetailRows rows={[
                    ["Title", displayString(order.title)], ["Brand", displayString(order.brand)], ["Item or service", displayString(order.item)],
                    ["Size", displayString(order.size)], ["Colour", displayString(order.colour)], ["Supplier", displayString(order.supplier)],
                    ["Source", order.requestId ? "Linked request" : "Manual order"],
                  ]} />
                </AdminSection>

                <AdminSection title="Commercial workspace" description="Stored invoice and sale details. Saving does not change order status.">
                  <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveCommercial(); }} noValidate>
                    <fieldset disabled={commercialFeedback.state === "saving"} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Currency" id="currency" error={commercialErrors.currency}>
                        <select ref={currencyRef} id="currency" value={commercialForm.currency} aria-invalid={Boolean(commercialErrors.currency)} aria-describedby={commercialErrors.currency ? "currency-error" : undefined} className={controlClass} onChange={(event) => { setCommercialForm({ ...commercialForm, currency: event.target.value }); setCommercialDirty(true); }}>
                          <option value="">Select currency</option><option value="GBP">GBP — British pound</option><option value="EUR">EUR — Euro</option><option value="USD">USD — US dollar</option>
                        </select>
                      </Field>
                      <Field label="Sale / invoice amount" id="salePrice" hint="Major currency units, maximum two decimal places." error={commercialErrors.salePrice}>
                        <input ref={salePriceRef} id="salePrice" inputMode="decimal" value={commercialForm.salePrice} aria-invalid={Boolean(commercialErrors.salePrice)} aria-describedby={commercialErrors.salePrice ? "salePrice-error" : "salePrice-hint"} className={controlClass} onChange={(event) => { setCommercialForm({ ...commercialForm, salePrice: event.target.value }); setCommercialDirty(true); }} />
                      </Field>
                      <Field label="Invoice number" id="invoiceNumber"><input id="invoiceNumber" value={commercialForm.invoiceNumber} className={controlClass} onChange={(event) => { setCommercialForm({ ...commercialForm, invoiceNumber: event.target.value }); setCommercialDirty(true); }} /></Field>
                      <Field label="Payment method" id="paymentMethod"><input id="paymentMethod" value={commercialForm.paymentMethod} className={controlClass} onChange={(event) => { setCommercialForm({ ...commercialForm, paymentMethod: event.target.value }); setCommercialDirty(true); }} /></Field>
                    </div>
                    <Field label="Invoice URL" id="invoiceUrl" error={commercialErrors.invoiceUrl} hint="HTTP or HTTPS only."><input ref={invoiceUrlRef} id="invoiceUrl" type="url" value={commercialForm.invoiceUrl} aria-invalid={Boolean(commercialErrors.invoiceUrl)} aria-describedby={commercialErrors.invoiceUrl ? "invoiceUrl-error" : "invoiceUrl-hint"} className={controlClass} onChange={(event) => { setCommercialForm({ ...commercialForm, invoiceUrl: event.target.value }); setCommercialDirty(true); }} /></Field>
                    {isValidHttpUrl(order.invoiceUrl) ? <ExternalLink href={order.invoiceUrl} label="Open stored invoice" /> : null}
                    <div className="flex flex-wrap items-center gap-3"><button type="submit" className={adminPrimaryButton} disabled={!commercialDirty || commercialFeedback.state === "saving"}>{commercialFeedback.state === "saving" ? "Saving…" : "Save commercial details"}</button><MutationMessage feedback={commercialFeedback} /></div>
                    </fieldset>
                  </form>
                </AdminSection>

                <AdminSection title="Fulfilment workspace" description="Purchasing, delivery and internal operational details. Saving does not change order status.">
                  <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveFulfilment(); }} noValidate>
                    <fieldset disabled={fulfilmentFeedback.state === "saving"} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Supplier" id="supplier"><input id="supplier" value={fulfilmentForm.supplier} className={controlClass} onChange={(event) => { setFulfilmentForm({ ...fulfilmentForm, supplier: event.target.value }); setFulfilmentDirty(true); }} /></Field>
                      <Field label="Purchase price" id="costPrice" hint={`Major ${commercialForm.currency || "currency"} units, maximum two decimal places.`} error={fulfilmentErrors.costPrice}><input ref={costPriceRef} id="costPrice" inputMode="decimal" value={fulfilmentForm.costPrice} aria-invalid={Boolean(fulfilmentErrors.costPrice)} aria-describedby={fulfilmentErrors.costPrice ? "costPrice-error" : "costPrice-hint"} className={controlClass} onChange={(event) => { setFulfilmentForm({ ...fulfilmentForm, costPrice: event.target.value }); setFulfilmentDirty(true); }} /></Field>
                      <Field label="Courier" id="courier"><input id="courier" value={fulfilmentForm.courier} className={controlClass} onChange={(event) => { setFulfilmentForm({ ...fulfilmentForm, courier: event.target.value }); setFulfilmentDirty(true); }} /></Field>
                      <Field label="Tracking number" id="trackingNumber"><input id="trackingNumber" value={fulfilmentForm.trackingNumber} className={controlClass} onChange={(event) => { setFulfilmentForm({ ...fulfilmentForm, trackingNumber: event.target.value }); setFulfilmentDirty(true); }} /></Field>
                    </div>
                    <Field label="Tracking URL" id="trackingUrl" error={fulfilmentErrors.trackingUrl} hint="HTTP or HTTPS only."><input ref={trackingUrlRef} id="trackingUrl" type="url" value={fulfilmentForm.trackingUrl} aria-invalid={Boolean(fulfilmentErrors.trackingUrl)} aria-describedby={fulfilmentErrors.trackingUrl ? "trackingUrl-error" : "trackingUrl-hint"} className={controlClass} onChange={(event) => { setFulfilmentForm({ ...fulfilmentForm, trackingUrl: event.target.value }); setFulfilmentDirty(true); }} /></Field>
                    {isValidHttpUrl(order.trackingUrl) ? <ExternalLink href={order.trackingUrl} label="Open stored tracking page" /> : null}
                    <Field label="Internal notes" id="notes"><textarea id="notes" rows={5} value={fulfilmentForm.notes} className={controlClass} onChange={(event) => { setFulfilmentForm({ ...fulfilmentForm, notes: event.target.value }); setFulfilmentDirty(true); }} /></Field>
                    <div className="flex flex-wrap items-center gap-3"><button type="submit" className={adminPrimaryButton} disabled={!fulfilmentDirty || fulfilmentFeedback.state === "saving"}>{fulfilmentFeedback.state === "saving" ? "Saving…" : "Save fulfilment details"}</button><MutationMessage feedback={fulfilmentFeedback} /></div>
                    </fieldset>
                  </form>
                </AdminSection>

                <AdminSection title="Record activity" description="Record timestamps only; this is not a complete order audit trail.">
                  <DetailRows rows={[["Order created", formatTimestamp(order.createdAt)], ["Record last updated", formatTimestamp(order.updatedAt)]]} />
                </AdminSection>
              </div>

              <aside className="order-1 min-w-0 space-y-8 xl:order-2" aria-label="Order operations and relationships">
                <OperationalPanel eyebrow="Workflow" title="Status and next action">
                  <div className="flex flex-wrap items-center gap-2"><AdminStatusBadge tone={orderStatusToneName(order.status)}>{statusLabel(order)}</AdminStatusBadge></div>
                  <p className="mt-3 text-sm leading-6 text-[#665950]">{order.status ? ORDER_NEXT_ACTIONS[order.status] : "Select a recognised status to repair the workflow state."}</p>
                  <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); void saveStatus(); }}>
                    <fieldset disabled={statusFeedback.state === "saving"} className="space-y-3">
                    <Field label="Order status" id="orderStatus"><select id="orderStatus" value={statusDraft} className={controlClass} onChange={(event) => { setStatusDraft(event.target.value); setStatusDirty(true); setStatusFeedback(EMPTY_FEEDBACK); }}><option value="">Select status</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]} — {ORDER_NEXT_ACTIONS[status]}</option>)}</select></Field>
                    <button type="submit" className={adminPrimaryButton} disabled={!isOrderStatus(statusDraft) || statusDraft === order.status || statusFeedback.state === "saving"}>{statusFeedback.state === "saving" ? "Saving…" : "Save status"}</button>
                    <MutationMessage feedback={statusFeedback} />
                    </fieldset>
                  </form>
                </OperationalPanel>

                <OperationalPanel eyebrow="Relationship" title="Client">
                  <RelationshipState state={clientState} missing="No client ID is stored." notFound="The stored client ID does not resolve to a client profile." malformed="The stored client ID is malformed and cannot be opened." error={clientError} />
                  {client ? <div className="space-y-3 text-sm text-[#5d5047]"><p className="font-medium text-[#302722]">{client.name}</p><SnapshotLine label="Live email" value={client.email} /><SnapshotLine label="Live phone" value={client.phone} /><SnapshotLine label="Contact preference" value={client.contactPreferences.join(", ")} /><SnapshotLine label="Shipping country" value={client.shippingCountry} /><Link href={`/admin/clients/${client.id}`} className={adminSecondaryButton}>Open client profile</Link></div> : null}
                  <div className="mt-4 border-t border-[#e5ddd4] pt-4"><SnapshotLine label="Stored client ID" value={order.clientId} /><SnapshotLine label="Stored email snapshot" value={order.clientEmail} /></div>
                </OperationalPanel>

                <OperationalPanel eyebrow="Relationship" title="Request source">
                  <RelationshipState state={requestState} missing="This is a manual order with no request ID." notFound="The stored request ID does not resolve to a request." malformed="The stored request ID is malformed and cannot be opened." error={requestError} />
                  {request ? <div className="space-y-3 text-sm text-[#5d5047]"><p className="font-medium text-[#302722]">{request.title}</p><SnapshotLine label="Live request status" value={request.status ? request.status.replace(/[_-]/g, " ") : "Missing"} /><Link href={`/admin/requests/${request.id}`} className={adminSecondaryButton}>Open linked request</Link></div> : null}
                  {order.requestId ? <div className="mt-4 border-t border-[#e5ddd4] pt-4"><SnapshotLine label="Stored request ID" value={order.requestId} /></div> : null}
                </OperationalPanel>
              </aside>
            </div>
          </>
        ) : null}
      </AdminPage>
    </AdminShell>
  );
}

function StateSurface({ children }: { children: React.ReactNode }) { return <div className="rounded-[12px] border border-[#e5ddd4] bg-white">{children}</div>; }
function WarningSurface({ title, messages }: { title: string; messages: string[] }) { return <section className="rounded-[12px] border border-[#e5d3a9] bg-[#fbf6e8] px-4 py-3" aria-labelledby={`${title.replace(/\s/g, "-")}-title`}><h2 id={`${title.replace(/\s/g, "-")}-title`} className="text-sm font-semibold text-[#664e1d]">{title}</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-[#725820]">{messages.map((message) => <li key={message}>{message}</li>)}</ul></section>; }
function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0 px-4 py-3 first:pl-0"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#807269]">{label}</p><p className="mt-1 break-words text-sm text-[#4e4138]">{value}</p></div>; }
function DetailRows({ rows }: { rows: Array<[string, string]> }) { return <dl className="divide-y divide-[#e8e1d9] border-y border-[#e8e1d9]">{rows.map(([label, value]) => <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]"><dt className="text-xs font-medium text-[#81746a]">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-[#43372f]">{value}</dd></div>)}</dl>; }
function OperationalPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <section className="rounded-[12px] border border-[#ded5cb] bg-[#faf8f5] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#81746a]">{eyebrow}</p><h2 className="mt-2 text-lg font-semibold text-[#302722]">{title}</h2><div className="mt-4">{children}</div></section>; }
function Field({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: string; children: React.ReactNode }) { return <div><label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[#62554c]">{label}</label>{children}{hint && !error ? <p id={`${id}-hint`} className="mt-1 text-xs text-[#81746a]">{hint}</p> : null}{error ? <p id={`${id}-error`} className="mt-1 text-xs text-[#9a4030]" role="alert">{error}</p> : null}</div>; }
function MutationMessage({ feedback }: { feedback: Feedback }) { if (!feedback.message) return null; return <p className={`text-sm ${feedback.state === "error" ? "text-[#9a4030]" : feedback.state === "success" ? "text-[#35633c]" : "text-[#665950]"}`} role={feedback.state === "error" ? "alert" : "status"} aria-live="polite">{feedback.message}</p>; }
function ExternalLink({ href, label }: { href: string; label: string }) { return <a href={href} target="_blank" rel="noreferrer" className="inline-flex text-sm font-semibold text-[#4f4239] underline underline-offset-4">{label} <span className="sr-only">(opens an external site in a new tab)</span></a>; }
function SnapshotLine({ label, value }: { label: string; value: string }) { return <p className="break-words text-sm text-[#665950]"><span className="font-medium text-[#43372f]">{label}:</span> {value || "Not stored"}</p>; }
function RelationshipState({ state, missing, notFound, malformed, error }: { state: LinkedState; missing: string; notFound: string; malformed: string; error: string }) { if (state === "ready") return null; const message = state === "idle" ? missing : state === "loading" ? "Loading linked record…" : state === "not_found" ? notFound : state === "malformed" ? malformed : error || (state === "permission" ? "Access to this linked record was denied." : "The linked record could not be loaded."); return <p className={`mb-4 text-sm leading-5 ${["not_found", "malformed", "permission", "error"].includes(state) ? "text-[#8c3c2d]" : "text-[#81746a]"}`} role={["permission", "error"].includes(state) ? "alert" : "status"}>{message}</p>; }

const controlClass = "block min-h-10 w-full rounded-[10px] border border-[#d3c8bd] bg-white px-3 py-2 text-sm text-[#302722] outline-none transition focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/20 aria-[invalid=true]:border-[#a94b39] aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-[#a94b39]";

function normalizeOrder(id: string, data: Record<string, unknown>): OrderRecord {
  const rawStatus = readString(data.status);
  const status = isOrderStatus(rawStatus) ? rawStatus : null;
  const statusIssue = status ? null : data.status === undefined || data.status === null || rawStatus === "" ? "missing" : typeof data.status === "string" ? "unknown" : "malformed";
  const salePrice = readAmount(data.salePrice);
  const costPrice = readAmount(data.costPrice);
  const currency = readCurrency(data.currency);
  const createdAt = readTimestamp(data.createdAt);
  const updatedAt = readTimestamp(data.updatedAt);
  const title = readString(data.title);
  const clientId = readString(data.clientId);
  const requestId = readString(data.requestId);
  const invoiceUrl = readString(data.invoiceUrl);
  const trackingUrl = readString(data.trackingUrl);
  const issues = [
    statusIssue === "missing" ? "Order status is missing." : "",
    statusIssue === "unknown" ? `Order status “${rawStatus}” is not recognised.` : "",
    statusIssue === "malformed" ? "Order status is malformed." : "",
    salePrice.kind === "malformed" ? "Sale price is malformed." : "",
    costPrice.kind === "malformed" ? "Purchase price is malformed." : "",
    currency.kind === "missing" ? "Currency is missing." : "",
    currency.kind === "unsupported" ? `Currency “${currency.raw || "unknown"}” is unsupported.` : "",
    !title ? "Order title is missing." : "",
    !clientId ? "Client ID is missing." : "",
    clientId && !isSafeDocumentId(clientId) ? "Client ID is malformed." : "",
    requestId && !isSafeDocumentId(requestId) ? "Request ID is malformed." : "",
    invoiceUrl && !isValidHttpUrl(invoiceUrl) ? "Invoice URL is invalid." : "",
    trackingUrl && !isValidHttpUrl(trackingUrl) ? "Tracking URL is invalid." : "",
    createdAt.kind !== "valid" ? "Created timestamp is missing or invalid." : "",
    updatedAt.kind !== "valid" ? "Updated timestamp is missing or invalid." : "",
  ].filter(Boolean);
  return {
    id, title, clientId, clientEmail: readString(data.clientEmail), requestId, status, rawStatus, statusIssue,
    brand: readString(data.brand), item: readString(data.item), size: readString(data.size), colour: readString(data.colour),
    salePrice, costPrice, currency, invoiceNumber: readString(data.invoiceNumber), invoiceId: readString(data.invoiceId), invoiceUrl, paymentMethod: readString(data.paymentMethod),
    supplier: readString(data.supplier), courier: readString(data.courier), trackingNumber: readString(data.trackingNumber), trackingUrl,
    notes: readStringPreservingWhitespace(data.notes), createdAt, updatedAt, issues,
    commercialFingerprint: commercialFingerprint(data), fulfilmentFingerprint: fulfilmentFingerprint(data), statusFingerprint: statusFingerprint(data),
  };
}

function normalizeClient(id: string, data: Record<string, unknown>): ClientRecord {
  const profile = isRecord(data.profile) ? data.profile : {};
  const address = isRecord(profile.shippingAddress) ? profile.shippingAddress : {};
  return {
    id,
    name: readString(profile.fullName) || readString(data.fullName) || "Unnamed client",
    email: readString(data.email),
    phone: readString(profile.phoneNumber) || readString(data.phoneNumber),
    contactPreferences: Array.isArray(profile.contactPreferences) ? profile.contactPreferences.map(readString).filter(Boolean) : [],
    shippingCountry: readString(address.country),
  };
}

function buildRelationshipWarnings(order: OrderRecord, client: ClientRecord | null, clientState: LinkedState, requestState: LinkedState) {
  return [
    order.clientId && ["not_found", "permission", "error"].includes(clientState) ? "The linked client could not be verified." : "",
    order.requestId && ["not_found", "permission", "error"].includes(requestState) ? "The linked request could not be verified." : "",
    client && order.clientEmail && client.email && order.clientEmail.toLowerCase() !== client.email.toLowerCase() ? "The stored client email snapshot differs from the live client profile." : "",
  ].filter(Boolean);
}

function commercialFormFromOrder(order: OrderRecord): CommercialForm { return { currency: order.currency.kind === "supported" ? order.currency.value : "", salePrice: order.salePrice.input, invoiceNumber: order.invoiceNumber, invoiceUrl: order.invoiceUrl, paymentMethod: order.paymentMethod }; }
function fulfilmentFormFromOrder(order: OrderRecord): FulfilmentForm { return { costPrice: order.costPrice.input, supplier: order.supplier, courier: order.courier, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl, notes: order.notes }; }
function readString(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function readStringPreservingWhitespace(value: unknown) { return typeof value === "string" ? value : ""; }
function readAmount(value: unknown): AmountValue { if (value === undefined || value === null || value === "") return { kind: "missing", input: "" }; if (typeof value === "number" && Number.isFinite(value) && value >= 0 && hasAtMostTwoDecimals(value)) return { kind: "valid", value, input: String(value) }; return { kind: "malformed", input: typeof value === "string" || typeof value === "number" ? String(value) : "" }; }
function readCurrency(value: unknown): CurrencyValue { const raw = readString(value).toUpperCase(); if (!raw) return { kind: "missing", raw: "" }; return isSupportedCurrency(raw) ? { kind: "supported", value: raw, raw } : { kind: "unsupported", raw }; }
function readTimestamp(value: unknown): TimestampValue { if (value === undefined || value === null || value === "") return { kind: "missing" }; try { let date: Date | null = null; if (value instanceof Date) date = value; else if (typeof value === "string" || typeof value === "number") date = new Date(value); else if (isRecord(value) && typeof value.toDate === "function") date = (value.toDate as () => Date)(); else if (isRecord(value)) { const seconds = typeof value.seconds === "number" ? value.seconds : typeof value._seconds === "number" ? value._seconds : null; if (seconds !== null) date = new Date(seconds * 1000); } return date && !Number.isNaN(date.getTime()) ? { kind: "valid", value: date } : { kind: "malformed" }; } catch { return { kind: "malformed" }; } }
function parseOptionalMoney(value: string, label: string): { value?: number; error?: string } { const trimmed = value.trim(); if (!trimmed) return {}; if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return { error: `${label} must be a non-negative number with no more than two decimal places.` }; const amount = Number(trimmed); return Number.isFinite(amount) ? { value: amount } : { error: `${label} must be a finite number.` }; }
function parseOptionalHttpUrl(value: string) { const trimmed = value.trim(); if (!trimmed) return null; try { const url = new URL(trimmed); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; } catch { return null; } }
function isValidHttpUrl(value: string) { return Boolean(parseOptionalHttpUrl(value)); }
function isSupportedCurrency(value: string): value is SupportedCurrency { return value === "GBP" || value === "EUR" || value === "USD"; }
function hasAtMostTwoDecimals(value: number) { return Math.abs(value * 100 - Math.round(value * 100)) < Number.EPSILON * Math.max(1, Math.abs(value * 100)) * 4; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isSafeDocumentId(value: string) { return Boolean(value) && value !== "." && value !== ".." && !value.includes("/") && new TextEncoder().encode(value).length <= 1500; }
function firstValidEmail(...values: Array<string | undefined>) { return values.map((value) => value?.trim() || "").find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) || ""; }
function optionalField(value: string) { return value.trim() || deleteField(); }
function displayString(value: string) { return value || "Not stored"; }
function formatTimestamp(value: TimestampValue) { if (value.kind === "missing") return "Not stored"; if (value.kind === "malformed") return "Malformed timestamp"; return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value.value); }
function formatMoneyValue(amount: AmountValue, currency: CurrencyValue) { if (amount.kind === "missing") return "Not stored"; if (amount.kind === "malformed") return "Malformed amount"; if (currency.kind !== "supported") return `${amount.value.toFixed(2)} (${currency.kind === "unsupported" ? `unsupported ${currency.raw}` : "currency missing"})`; return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.value }).format(amount.value); }
function statusLabel(order: OrderRecord) { if (order.status) return ORDER_STATUS_LABELS[order.status]; if (order.statusIssue === "unknown") return `Unknown: ${order.rawStatus}`; if (order.statusIssue === "malformed") return "Malformed status"; return "Status missing"; }
function fingerprint(values: unknown[]) { return JSON.stringify(values.map((value) => value === undefined ? { missing: true } : value)); }
function commercialFingerprint(data: Record<string, unknown>) { return fingerprint([data.currency, data.salePrice, data.invoiceNumber, data.invoiceUrl, data.paymentMethod]); }
function fulfilmentFingerprint(data: Record<string, unknown>) { return fingerprint([data.costPrice, data.supplier, data.courier, data.trackingNumber, data.trackingUrl, data.notes]); }
function statusFingerprint(data: Record<string, unknown>) { return fingerprint([data.status]); }
function isPermissionError(error: unknown) { return isRecord(error) && typeof error.code === "string" && ["permission-denied", "firestore/permission-denied"].includes(error.code); }
function readFailureMessage(error: unknown, subject: string) { if (isPermissionError(error)) return `Permission denied while reading the ${subject}.`; return `Could not read the ${subject} from Firestore.`; }
function mutationFailureMessage(error: unknown, subject: string) { if (error instanceof ConcurrentEditError) return error.message; if (isPermissionError(error)) return `Permission denied while saving ${subject}. Your form values have been preserved.`; if (error instanceof Error && error.message === "Order not found.") return "The order no longer exists. Your form values have been preserved."; return `Could not save ${subject}. Your form values have been preserved.`; }
function statusConfirmationMessage(status: OrderStatus, backwards: boolean, reopening: boolean) { if (reopening) return `Reopen this order as ${ORDER_STATUS_LABELS[status]}? This changes the workflow state only.`; if (status === "cancelled") return "Cancel this order? This changes the workflow state only and sends no notification."; if (status === "closed") return "Close this order? Confirm the work is complete before continuing."; if (backwards) return `Move this order backwards to ${ORDER_STATUS_LABELS[status]}?`; return `Change status to ${ORDER_STATUS_LABELS[status]}?`; }
