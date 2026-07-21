"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  AdminOrder,
  Currency,
  OrderStatus,
  QualityCheckStatus,
  RefundStatus,
} from "../../admin-types";
import {
  classNames,
  formatDateTime,
  formatStatusLabel,
} from "../../admin-utils";
import {
  ORDER_STATUS_ORDER,
  ORDER_TRANSITIONS,
  parseAdminOrder,
} from "../../order-utils";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default function OrderDetailPage({ params }: PageProps) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSave, setActiveSave] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [commercialForm, setCommercialForm] = useState({
    title: "",
    brand: "",
    item: "",
    size: "",
    colour: "",
    salePrice: "",
    costPrice: "",
    currency: "GBP",
  });
  const [paymentForm, setPaymentForm] = useState({
    invoiceNumber: "",
    invoiceUrl: "",
    invoiceAmount: "",
    invoiceDate: "",
    paidAmount: "",
    paymentDate: "",
    paymentMethod: "",
    paymentReference: "",
    paymentNotes: "",
  });
  const [purchaseForm, setPurchaseForm] = useState({
    supplier: "",
    supplierContact: "",
    supplierReference: "",
    purchaseDate: "",
    purchaseNotes: "",
    purchaseWithoutReferenceConfirmed: false,
  });
  const [fulfilmentForm, setFulfilmentForm] = useState({
    courier: "",
    trackingNumber: "",
    trackingUrl: "",
    dispatchDate: "",
    expectedDeliveryDate: "",
    deliveredDate: "",
    noTrackingConfirmed: false,
    qualityCheckStatus: "pending" as QualityCheckStatus,
    qualityCheckNotes: "",
  });
  const [refundForm, setRefundForm] = useState({
    status: "not_required" as RefundStatus,
    amount: "",
    date: "",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    setIsLoading(true);
    setError("");

    return onSnapshot(
      doc(db, "orders", orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrder(null);
          setError("Order not found.");
          setIsLoading(false);
          return;
        }

        setOrder(parseAdminOrder(snapshot.id, snapshot.data()));
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load order", snapshotError);
        setOrder(null);
        setError("Could not load this order from Firestore.");
        setIsLoading(false);
      },
    );
  }, [orderId]);

  useEffect(() => {
    if (!order) return;

    setCommercialForm({
      title: order.title,
      brand: order.brand,
      item: order.item,
      size: order.size,
      colour: order.colour,
      salePrice: order.salePrice ? String(order.salePrice) : "",
      costPrice: order.costPrice ? String(order.costPrice) : "",
      currency: order.currency,
    });
    setPaymentForm({
      invoiceNumber: order.invoiceNumber,
      invoiceUrl: order.invoiceUrl,
      invoiceAmount: nullableMoneyString(order.orderWorkflow.payment.invoiceAmount),
      invoiceDate: order.orderWorkflow.payment.invoiceDate,
      paidAmount: nullableMoneyString(order.orderWorkflow.payment.paidAmount),
      paymentDate: order.orderWorkflow.payment.paymentDate,
      paymentMethod: order.paymentMethod,
      paymentReference: order.orderWorkflow.payment.paymentReference,
      paymentNotes: order.orderWorkflow.payment.paymentNotes,
    });
    setPurchaseForm({
      supplier: order.supplier,
      supplierContact: order.orderWorkflow.purchase.supplierContact,
      supplierReference: order.orderWorkflow.purchase.supplierReference,
      purchaseDate: order.orderWorkflow.purchase.purchaseDate,
      purchaseNotes: order.orderWorkflow.purchase.purchaseNotes,
      purchaseWithoutReferenceConfirmed:
        order.orderWorkflow.purchase.purchaseWithoutReferenceConfirmed,
    });
    setFulfilmentForm({
      courier: order.courier,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      dispatchDate: order.orderWorkflow.fulfilment.dispatchDate,
      expectedDeliveryDate:
        order.orderWorkflow.fulfilment.expectedDeliveryDate,
      deliveredDate: order.orderWorkflow.fulfilment.deliveredDate,
      noTrackingConfirmed:
        order.orderWorkflow.fulfilment.noTrackingConfirmed,
      qualityCheckStatus:
        order.orderWorkflow.fulfilment.qualityCheckStatus,
      qualityCheckNotes: order.orderWorkflow.fulfilment.qualityCheckNotes,
    });
    setInternalNotes(order.notes);
    setCancellationReason(order.orderWorkflow.cancellation.reason);
    setRefundForm({
      status: order.orderWorkflow.refund.status,
      amount: nullableMoneyString(order.orderWorkflow.refund.amount),
      date: order.orderWorkflow.refund.date,
      reference: order.orderWorkflow.refund.reference,
      notes: order.orderWorkflow.refund.notes,
    });
  }, [order]);

  const margin = useMemo(
    () => calculateMargin(commercialForm.salePrice, commercialForm.costPrice),
    [commercialForm.costPrice, commercialForm.salePrice],
  );

  async function saveCommercialDetails() {
    if (!order || activeSave) return;
    if (!commercialForm.title.trim()) {
      setError("Order title is required.");
      return;
    }
    if (
      !isValidMoneyInput(commercialForm.salePrice) ||
      !isValidMoneyInput(commercialForm.costPrice)
    ) {
      setError("Sale price and supplier cost must be valid non-negative amounts.");
      return;
    }

    await saveFields(
      "commercial",
      {
        title: commercialForm.title.trim(),
        brand: commercialForm.brand.trim(),
        item: commercialForm.item.trim(),
        size: commercialForm.size.trim(),
        colour: commercialForm.colour.trim(),
        salePrice: parseMoney(commercialForm.salePrice),
        costPrice: parseMoney(commercialForm.costPrice),
        currency: commercialForm.currency,
      },
      "Commercial and item details saved.",
    );
  }

  async function savePaymentDetails() {
    if (!order || activeSave) return;
    if (
      !isValidOptionalMoneyInput(paymentForm.invoiceAmount) ||
      !isValidOptionalMoneyInput(paymentForm.paidAmount)
    ) {
      setError("Invoice and paid amounts must be valid non-negative amounts.");
      return;
    }

    await saveFields(
      "payment",
      {
        invoiceNumber: paymentForm.invoiceNumber.trim(),
        invoiceUrl: paymentForm.invoiceUrl.trim(),
        paymentMethod: paymentForm.paymentMethod.trim(),
        "orderWorkflow.payment.invoiceAmount": parseOptionalMoney(
          paymentForm.invoiceAmount,
        ),
        "orderWorkflow.payment.invoiceDate": paymentForm.invoiceDate,
        "orderWorkflow.payment.paidAmount": parseOptionalMoney(
          paymentForm.paidAmount,
        ),
        "orderWorkflow.payment.paymentDate": paymentForm.paymentDate,
        "orderWorkflow.payment.paymentReference":
          paymentForm.paymentReference.trim(),
        "orderWorkflow.payment.paymentNotes": paymentForm.paymentNotes.trim(),
      },
      "Invoice and payment details saved.",
    );
  }

  async function savePurchaseDetails() {
    if (!order || activeSave) return;

    await saveFields(
      "purchase",
      {
        supplier: purchaseForm.supplier.trim(),
        "orderWorkflow.purchase.supplierContact":
          purchaseForm.supplierContact.trim(),
        "orderWorkflow.purchase.supplierReference":
          purchaseForm.supplierReference.trim(),
        "orderWorkflow.purchase.purchaseDate": purchaseForm.purchaseDate,
        "orderWorkflow.purchase.purchaseNotes":
          purchaseForm.purchaseNotes.trim(),
        "orderWorkflow.purchase.purchaseWithoutReferenceConfirmed":
          purchaseForm.purchaseWithoutReferenceConfirmed,
      },
      "Supplier purchase details saved.",
    );
  }

  async function saveFulfilmentDetails() {
    if (!order || activeSave) return;

    setActiveSave("fulfilment");
    clearMessages();

    try {
      const updates: Record<string, unknown> = {
        courier: fulfilmentForm.courier.trim(),
        trackingNumber: fulfilmentForm.trackingNumber.trim(),
        trackingUrl: fulfilmentForm.trackingUrl.trim(),
        "orderWorkflow.fulfilment.dispatchDate":
          fulfilmentForm.dispatchDate,
        "orderWorkflow.fulfilment.expectedDeliveryDate":
          fulfilmentForm.expectedDeliveryDate,
        "orderWorkflow.fulfilment.deliveredDate":
          fulfilmentForm.deliveredDate,
        "orderWorkflow.fulfilment.noTrackingConfirmed":
          fulfilmentForm.noTrackingConfirmed,
        "orderWorkflow.fulfilment.qualityCheckStatus":
          fulfilmentForm.qualityCheckStatus,
        "orderWorkflow.fulfilment.qualityCheckNotes":
          fulfilmentForm.qualityCheckNotes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (fulfilmentForm.qualityCheckStatus === "pending") {
        updates["orderWorkflow.fulfilment.qualityCheckedAt"] = null;
      } else if (
        fulfilmentForm.qualityCheckStatus !==
          order.orderWorkflow.fulfilment.qualityCheckStatus ||
        !order.orderWorkflow.fulfilment.qualityCheckedAt
      ) {
        updates["orderWorkflow.fulfilment.qualityCheckedAt"] =
          serverTimestamp();
      }

      await updateDoc(doc(db, "orders", order.id), updates);
      setFeedback("Quality-check, tracking, and delivery details saved.");
    } catch (saveError) {
      console.error("Failed to save fulfilment details", saveError);
      setError("Could not save fulfilment details.");
    } finally {
      setActiveSave(null);
    }
  }

  async function saveInternalNotes() {
    if (!order || activeSave) return;

    await saveFields(
      "notes",
      { notes: internalNotes.trim() },
      "Internal order notes saved.",
    );
  }

  async function saveRefundDetails() {
    if (!order || activeSave) return;

    const amount = parseOptionalMoney(refundForm.amount);
    if (!isValidOptionalMoneyInput(refundForm.amount)) {
      setError("Refund amount must be a valid non-negative amount.");
      return;
    }
    if (
      ["partial", "completed"].includes(refundForm.status) &&
      (!amount || amount <= 0)
    ) {
      setError("Partial and completed refunds require a positive refund amount.");
      return;
    }
    if (refundForm.status === "completed" && !refundForm.date) {
      setError("A completed refund requires a refund date.");
      return;
    }
    if (refundForm.status === "completed" && !refundForm.reference.trim()) {
      setError("A completed refund requires a refund reference.");
      return;
    }
    if (!window.confirm("Save these refund details? This does not send money.")) {
      return;
    }

    await saveFields(
      "refund",
      {
        "orderWorkflow.refund.status": refundForm.status,
        "orderWorkflow.refund.amount": amount,
        "orderWorkflow.refund.date": refundForm.date,
        "orderWorkflow.refund.reference": refundForm.reference.trim(),
        "orderWorkflow.refund.notes": refundForm.notes.trim(),
      },
      "Refund record saved. No payment was sent.",
    );
  }

  async function transitionStatus(nextStatus: OrderStatus) {
    if (!order || activeSave) return;

    const isBackward =
      ORDER_STATUS_ORDER.indexOf(nextStatus) <
      ORDER_STATUS_ORDER.indexOf(order.status);
    const needsConfirmation = isBackward || nextStatus === "closed";

    if (
      needsConfirmation &&
      !window.confirm(
        `Confirm changing this order from ${formatStatusLabel(order.status)} to ${formatStatusLabel(nextStatus)}.`,
      )
    ) {
      return;
    }

    setActiveSave("status");
    clearMessages();

    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, "orders", order.id);
        const snapshot = await transaction.get(orderRef);
        if (!snapshot.exists()) throw new Error("ORDER_NOT_FOUND");

        const current = parseAdminOrder(snapshot.id, snapshot.data());
        if (!ORDER_TRANSITIONS[current.status].includes(nextStatus)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }

        validateStatusPrerequisites(current, nextStatus);
        transaction.update(orderRef, {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      });
      setFeedback(`Order status changed to ${formatStatusLabel(nextStatus)}.`);
    } catch (transitionError) {
      console.error("Failed to update order status", transitionError);
      setError(getTransitionErrorMessage(transitionError));
    } finally {
      setActiveSave(null);
    }
  }

  async function cancelOrder() {
    if (!order || activeSave) return;
    const reason = cancellationReason.trim();

    if (!reason) {
      setError("Add a cancellation reason before cancelling this order.");
      return;
    }
    if (
      !window.confirm(
        `Cancel this ${formatStatusLabel(order.status)} order? Financial records will be preserved.`,
      )
    ) {
      return;
    }

    setActiveSave("cancellation");
    clearMessages();

    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, "orders", order.id);
        const snapshot = await transaction.get(orderRef);
        if (!snapshot.exists()) throw new Error("ORDER_NOT_FOUND");

        const current = parseAdminOrder(snapshot.id, snapshot.data());
        if (["closed", "cancelled"].includes(current.status)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }

        transaction.update(orderRef, {
          status: "cancelled",
          "orderWorkflow.cancellation.reason": reason,
          "orderWorkflow.cancellation.previousStatus": current.status,
          "orderWorkflow.cancellation.cancelledAt": serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      setFeedback("Order cancelled. Financial and fulfilment history was preserved.");
    } catch (cancelError) {
      console.error("Failed to cancel order", cancelError);
      setError(getTransitionErrorMessage(cancelError));
    } finally {
      setActiveSave(null);
    }
  }

  async function saveFields(
    saveName: string,
    fields: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!order || activeSave) return;
    setActiveSave(saveName);
    clearMessages();

    try {
      await updateDoc(doc(db, "orders", order.id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
      setFeedback(successMessage);
    } catch (saveError) {
      console.error(`Failed to save order ${saveName}`, saveError);
      setError("Could not save the order changes.");
    } finally {
      setActiveSave(null);
    }
  }

  function clearMessages() {
    setError("");
    setFeedback("");
  }

  return (
    <AdminShell active="orders">
      <div className="space-y-6">
        <Link href="/admin/orders" className="inline-flex rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">← Back to orders</Link>

        {isLoading ? <EmptyState title="Loading order" body="Reading this order from Firestore." /> : null}
        {!isLoading && error ? <Alert tone="error">{error}</Alert> : null}
        {!isLoading && feedback ? <Alert tone="success">{feedback}</Alert> : null}

        {!isLoading && order ? (
          <>
            <section className="rounded-2xl border border-[#DED2C5] bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">Order workflow</p>
              <div className="mt-3 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-serif text-4xl text-[#241E1A]">{order.title}</h1>
                    <span className={classNames("rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", orderTone(order.status))}>{formatStatusLabel(order.status)}</span>
                  </div>
                  <p className="mt-3 text-sm text-black/55">{order.clientName || order.clientEmail || "Unknown client"}</p>
                </div>
                <div className="grid min-w-[340px] grid-cols-2 gap-3">
                  <InfoCard label="Created" value={formatDateTime(order.createdAt)} />
                  <InfoCard label="Updated" value={formatDateTime(order.updatedAt)} />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {order.clientId ? <Link href={`/admin/clients/${order.clientId}`} className="rounded-xl border border-[#DED2C5] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">Open client</Link> : null}
                {order.requestId ? <Link href={`/admin/requests/${order.requestId}`} className="rounded-xl border border-[#DED2C5] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">Open request</Link> : null}
              </div>
              <div className="mt-5 border-t border-[#EFE4DA] pt-5">
                <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">Next valid status actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ORDER_TRANSITIONS[order.status].length ? ORDER_TRANSITIONS[order.status].map((status) => <button key={status} type="button" onClick={() => transitionStatus(status)} disabled={Boolean(activeSave)} className="rounded-xl border border-[#DED2C5] px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/65 transition hover:bg-[#221C18] hover:text-white disabled:cursor-wait disabled:opacity-60">{formatStatusLabel(status)}</button>) : <p className="text-sm text-black/45">No further status transitions are available.</p>}
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="space-y-6">
                <Panel title="Item and commercial values" eyebrow="Order">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormInput label="Order title" value={commercialForm.title} onChange={(value) => setCommercialForm((current) => ({ ...current, title: value }))} />
                    <FormInput label="Brand" value={commercialForm.brand} onChange={(value) => setCommercialForm((current) => ({ ...current, brand: value }))} />
                    <FormInput label="Item" value={commercialForm.item} onChange={(value) => setCommercialForm((current) => ({ ...current, item: value }))} />
                    <FormInput label="Size" value={commercialForm.size} onChange={(value) => setCommercialForm((current) => ({ ...current, size: value }))} />
                    <FormInput label="Colour" value={commercialForm.colour} onChange={(value) => setCommercialForm((current) => ({ ...current, colour: value }))} />
                    <FormSelect label="Currency" value={commercialForm.currency} options={["GBP", "EUR", "USD"]} onChange={(value) => setCommercialForm((current) => ({ ...current, currency: value }))} />
                    <FormInput label="Sale price" value={commercialForm.salePrice} type="number" onChange={(value) => setCommercialForm((current) => ({ ...current, salePrice: value }))} />
                    <FormInput label="Supplier cost" value={commercialForm.costPrice} type="number" onChange={(value) => setCommercialForm((current) => ({ ...current, costPrice: value }))} />
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Metric label="Gross profit" value={margin ? formatMoney(margin.profit, commercialForm.currency as Currency) : "Unavailable"} />
                    <Metric label="Gross margin" value={margin ? `${margin.percentage.toFixed(1)}%` : "Unavailable"} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-black/45">Gross margin before fees, tax, shipping, duties, refunds, and other costs.</p>
                  <SaveButton label="Save item and values" busy={activeSave === "commercial"} disabled={Boolean(activeSave)} onClick={saveCommercialDetails} />
                </Panel>

                <Panel title="Invoice and payment" eyebrow="Commercial">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormInput label="Invoice reference" value={paymentForm.invoiceNumber} onChange={(value) => setPaymentForm((current) => ({ ...current, invoiceNumber: value }))} />
                    <FormInput label="Invoice amount" value={paymentForm.invoiceAmount} type="number" onChange={(value) => setPaymentForm((current) => ({ ...current, invoiceAmount: value }))} />
                    <FormInput label="Invoice date" value={paymentForm.invoiceDate} type="date" onChange={(value) => setPaymentForm((current) => ({ ...current, invoiceDate: value }))} />
                    <FormInput label="Paid amount" value={paymentForm.paidAmount} type="number" onChange={(value) => setPaymentForm((current) => ({ ...current, paidAmount: value }))} />
                    <FormInput label="Payment date" value={paymentForm.paymentDate} type="date" onChange={(value) => setPaymentForm((current) => ({ ...current, paymentDate: value }))} />
                    <FormInput label="Payment method" value={paymentForm.paymentMethod} onChange={(value) => setPaymentForm((current) => ({ ...current, paymentMethod: value }))} />
                    <FormInput label="Payment reference" value={paymentForm.paymentReference} onChange={(value) => setPaymentForm((current) => ({ ...current, paymentReference: value }))} />
                    <FormInput label="Invoice URL" value={paymentForm.invoiceUrl} onChange={(value) => setPaymentForm((current) => ({ ...current, invoiceUrl: value }))} />
                  </div>
                  <div className="mt-4"><FormTextarea label="Payment notes" value={paymentForm.paymentNotes} onChange={(value) => setPaymentForm((current) => ({ ...current, paymentNotes: value }))} /></div>
                  <p className="mt-3 text-xs text-black/45">This records administrative payment details only. It does not process payment.</p>
                  <SaveButton label="Save payment details" busy={activeSave === "payment"} disabled={Boolean(activeSave)} onClick={savePaymentDetails} />
                </Panel>

                <Panel title="Supplier purchase" eyebrow="Purchasing">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormInput label="Supplier name" value={purchaseForm.supplier} onChange={(value) => setPurchaseForm((current) => ({ ...current, supplier: value }))} />
                    <FormInput label="Supplier contact" value={purchaseForm.supplierContact} onChange={(value) => setPurchaseForm((current) => ({ ...current, supplierContact: value }))} />
                    <FormInput label="Supplier reference" value={purchaseForm.supplierReference} onChange={(value) => setPurchaseForm((current) => ({ ...current, supplierReference: value }))} />
                    <FormInput label="Purchase date" value={purchaseForm.purchaseDate} type="date" onChange={(value) => setPurchaseForm((current) => ({ ...current, purchaseDate: value }))} />
                  </div>
                  <div className="mt-4"><FormTextarea label="Purchase notes" value={purchaseForm.purchaseNotes} onChange={(value) => setPurchaseForm((current) => ({ ...current, purchaseNotes: value }))} /></div>
                  <Checkbox label="Purchase has no supplier reference" checked={purchaseForm.purchaseWithoutReferenceConfirmed} onChange={(checked) => setPurchaseForm((current) => ({ ...current, purchaseWithoutReferenceConfirmed: checked }))} />
                  <p className="mt-3 text-xs text-black/45">Supplier cost and currency are maintained in the item and commercial values panel.</p>
                  <SaveButton label="Save purchase details" busy={activeSave === "purchase"} disabled={Boolean(activeSave)} onClick={savePurchaseDetails} />
                </Panel>

                <Panel title="Quality check and fulfilment" eyebrow="Delivery">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormSelect label="Quality-check status" value={fulfilmentForm.qualityCheckStatus} options={["pending", "passed", "issue"]} onChange={(value) => setFulfilmentForm((current) => ({ ...current, qualityCheckStatus: value as QualityCheckStatus }))} />
                    <FormInput label="Courier" value={fulfilmentForm.courier} onChange={(value) => setFulfilmentForm((current) => ({ ...current, courier: value }))} />
                    <FormInput label="Tracking number" value={fulfilmentForm.trackingNumber} onChange={(value) => setFulfilmentForm((current) => ({ ...current, trackingNumber: value }))} />
                    <FormInput label="Tracking URL" value={fulfilmentForm.trackingUrl} onChange={(value) => setFulfilmentForm((current) => ({ ...current, trackingUrl: value }))} />
                    <FormInput label="Dispatch date" value={fulfilmentForm.dispatchDate} type="date" onChange={(value) => setFulfilmentForm((current) => ({ ...current, dispatchDate: value }))} />
                    <FormInput label="Expected delivery" value={fulfilmentForm.expectedDeliveryDate} type="date" onChange={(value) => setFulfilmentForm((current) => ({ ...current, expectedDeliveryDate: value }))} />
                    <FormInput label="Delivered date" value={fulfilmentForm.deliveredDate} type="date" onChange={(value) => setFulfilmentForm((current) => ({ ...current, deliveredDate: value }))} />
                  </div>
                  <div className="mt-4"><FormTextarea label="Quality-check notes" value={fulfilmentForm.qualityCheckNotes} onChange={(value) => setFulfilmentForm((current) => ({ ...current, qualityCheckNotes: value }))} /></div>
                  <Checkbox label="Dispatch is intentionally proceeding without tracking" checked={fulfilmentForm.noTrackingConfirmed} onChange={(checked) => setFulfilmentForm((current) => ({ ...current, noTrackingConfirmed: checked }))} />
                  <SaveButton label="Save fulfilment details" busy={activeSave === "fulfilment"} disabled={Boolean(activeSave)} onClick={saveFulfilmentDetails} />
                </Panel>

                <Panel title="Internal notes" eyebrow="Admin only">
                  <FormTextarea label="Private order notes" value={internalNotes} onChange={setInternalNotes} />
                  <SaveButton label="Save internal notes" busy={activeSave === "notes"} disabled={Boolean(activeSave)} onClick={saveInternalNotes} />
                </Panel>
              </section>

              <aside className="space-y-6">
                <Panel title="Client and links" eyebrow="Relationships">
                  <InfoRow label="Client name" value={order.clientName || "Not set"} />
                  <InfoRow label="Email" value={order.clientEmail || "Not set"} />
                  <InfoRow label="Phone" value={order.clientPhone || "Not set"} />
                  <InfoRow label="Request link" value={order.requestId || "Not linked"} />
                  <InfoRow label="Approved option" value={order.approvedOptionId || "Not linked"} />
                </Panel>

                <Panel title="Cancellation" eyebrow="Terminal action">
                  {order.status === "cancelled" ? <><InfoRow label="Previous status" value={order.orderWorkflow.cancellation.previousStatus ? formatStatusLabel(order.orderWorkflow.cancellation.previousStatus) : "Not recorded"} /><InfoRow label="Cancelled" value={formatDateTimeValue(order.orderWorkflow.cancellation.cancelledAt)} /><div className="mt-4"><TextBlock value={order.orderWorkflow.cancellation.reason || "No reason recorded"} /></div></> : order.status === "closed" ? <p className="text-sm text-black/45">Closed orders cannot be cancelled.</p> : <><FormTextarea label="Required cancellation reason" value={cancellationReason} onChange={setCancellationReason} /><button type="button" onClick={cancelOrder} disabled={Boolean(activeSave) || !cancellationReason.trim()} className="mt-5 rounded-xl bg-[#8B3D2D] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{activeSave === "cancellation" ? "Cancelling…" : "Cancel order"}</button></>}
                </Panel>

                <Panel title="Refund record" eyebrow="Financial administration">
                  <FormSelect label="Refund status" value={refundForm.status} options={["not_required", "pending", "partial", "completed", "failed"]} onChange={(value) => setRefundForm((current) => ({ ...current, status: value as RefundStatus }))} />
                  <div className="mt-4 space-y-4">
                    <FormInput label="Refund amount" value={refundForm.amount} type="number" onChange={(value) => setRefundForm((current) => ({ ...current, amount: value }))} />
                    <FormInput label="Refund date" value={refundForm.date} type="date" onChange={(value) => setRefundForm((current) => ({ ...current, date: value }))} />
                    <FormInput label="Refund reference" value={refundForm.reference} onChange={(value) => setRefundForm((current) => ({ ...current, reference: value }))} />
                    <FormTextarea label="Internal refund notes" value={refundForm.notes} onChange={(value) => setRefundForm((current) => ({ ...current, notes: value }))} />
                  </div>
                  <p className="mt-3 text-xs text-black/45">Saving this record does not send or modify a real payment.</p>
                  <SaveButton label="Save refund record" busy={activeSave === "refund"} disabled={Boolean(activeSave)} onClick={saveRefundDetails} />
                </Panel>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function validateStatusPrerequisites(order: AdminOrder, nextStatus: OrderStatus) {
  const { payment, purchase, fulfilment } = order.orderWorkflow;

  if (nextStatus === "invoice_sent" && (!order.invoiceNumber || !payment.invoiceAmount || !payment.invoiceDate)) {
    throw new Error("INVOICE_DETAILS_REQUIRED");
  }
  if (nextStatus === "paid" && (!payment.paidAmount || !payment.paymentDate || (!order.paymentMethod && !payment.paymentReference))) {
    throw new Error("PAYMENT_DETAILS_REQUIRED");
  }
  if (nextStatus === "purchased" && (!order.supplier || !purchase.purchaseDate || (!purchase.supplierReference && !purchase.purchaseWithoutReferenceConfirmed))) {
    throw new Error("PURCHASE_DETAILS_REQUIRED");
  }
  if (
    nextStatus === "dispatched" &&
    fulfilment.qualityCheckStatus !== "passed"
  ) {
    throw new Error("QUALITY_CHECK_REQUIRED");
  }
  if (nextStatus === "dispatched" && (!fulfilment.dispatchDate || ((!order.courier || !order.trackingNumber) && !fulfilment.noTrackingConfirmed))) {
    throw new Error("TRACKING_DETAILS_REQUIRED");
  }
  if (nextStatus === "delivered" && !fulfilment.deliveredDate) {
    throw new Error("DELIVERY_DATE_REQUIRED");
  }
}

function getTransitionErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    INVALID_STATUS_TRANSITION: "The order changed while you were viewing it. Refresh and use the next valid action.",
    INVOICE_DETAILS_REQUIRED: "Save an invoice reference, positive invoice amount, and invoice date first.",
    PAYMENT_DETAILS_REQUIRED: "Save a positive paid amount, payment date, and payment method or reference first.",
    PURCHASE_DETAILS_REQUIRED: "Save the supplier, purchase date, and supplier reference or explicit no-reference confirmation first.",
    QUALITY_CHECK_REQUIRED: "Record a passed quality check before dispatching this order.",
    TRACKING_DETAILS_REQUIRED: "Save a dispatch date plus courier and tracking number, or explicitly confirm no tracking.",
    DELIVERY_DATE_REQUIRED: "Save the confirmed delivered date first.",
  };
  return messages[code] ?? "Could not update the order status.";
}

function calculateMargin(saleValue: string, costValue: string) {
  const sale = Number(saleValue);
  const cost = Number(costValue);
  if (!Number.isFinite(sale) || !Number.isFinite(cost) || sale <= 0) return null;
  const profit = sale - cost;
  return { profit, percentage: (profit / sale) * 100 };
}

function parseMoney(value: string) {
  const amount = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(amount) ? amount : 0;
}

function parseOptionalMoney(value: string) {
  if (!value.trim()) return null;
  const amount = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(amount) ? amount : null;
}

function isValidMoneyInput(value: string) {
  const amount = Number(value.replace(/,/g, "").trim() || "0");
  return Number.isFinite(amount) && amount >= 0;
}

function isValidOptionalMoneyInput(value: string) {
  return !value.trim() || isValidMoneyInput(value);
}

function nullableMoneyString(value: number | null) {
  return typeof value === "number" ? String(value) : "";
}

function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatDateTimeValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return formatDateTime(value.toDate().toISOString());
  }
  return typeof value === "string" && value ? formatDateTime(value) : "Not recorded";
}

function orderTone(status: OrderStatus) {
  if (status === "cancelled") return "bg-[#F6D9D3] text-[#8B3D2D]";
  if (["dispatched", "delivered"].includes(status)) return "bg-[#DDECDD] text-[#2F5A34]";
  if (["paid", "purchased", "quality_check"].includes(status)) return "bg-[#EAE1F8] text-[#574276]";
  if (status === "invoice_sent") return "bg-[#F5E6C8] text-[#76561E]";
  return "bg-[#ECE7E1] text-[#65584E]";
}

function Alert({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return <div role={tone === "error" ? "alert" : "status"} className={classNames("rounded-2xl border p-4 text-sm", tone === "error" ? "border-[#E2B8AA] bg-[#FFF2EF] text-[#8B3D2D]" : "border-[#B8D6BC] bg-[#E8F5E9] text-[#2F5A34]")}>{children}</div>;
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#DED2C5] bg-white p-5"><p className="text-[10px] uppercase tracking-[0.24em] text-black/40">{eyebrow}</p><h2 className="mt-2 font-serif text-2xl text-[#241E1A]">{title}</h2><div className="mt-5">{children}</div></section>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#FBF7F2] p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</p><p className="mt-2 text-sm text-black/65">{value}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[130px_minmax(0,1fr)] border-b border-[#EFE4DA] last:border-b-0"><div className="bg-[#FBF7F2] px-3 py-3"><p className="text-[9px] uppercase tracking-[0.16em] text-black/40">{label}</p></div><p className="break-words px-3 py-3 text-sm text-black/65">{value}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#FBF7F2] p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</p><p className="mt-2 font-serif text-2xl text-[#241E1A]">{value}</p></div>;
}

function TextBlock({ value }: { value: string }) {
  return <p className="whitespace-pre-wrap rounded-xl bg-[#FBF7F2] p-4 text-sm leading-6 text-black/60">{value}</p>;
}

function FormInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: "text" | "number" | "date" }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</span><input value={value} type={type} step={type === "number" ? "0.01" : undefined} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-3 text-sm text-black/70 outline-none focus:border-[#B59674]" /></label>;
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</span><textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-3 text-sm leading-6 text-black/70 outline-none focus:border-[#B59674]" /></label>;
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-3 text-sm text-black/70 outline-none focus:border-[#B59674]">{options.map((option) => <option key={option} value={option}>{formatStatusLabel(option)}</option>)}</select></label>;
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="mt-4 flex items-start gap-3 rounded-xl bg-[#FBF7F2] p-4 text-sm text-black/65"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5" /><span>{label}</span></label>;
}

function SaveButton({ label, busy, disabled, onClick }: { label: string; busy: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="mt-5 rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{busy ? "Saving…" : label}</button>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-[#DED2C5] bg-[#FBF7F2] text-center"><div className="max-w-md px-8 py-8"><h2 className="font-serif text-3xl text-[#241E1A]">{title}</h2><p className="mt-4 text-sm leading-7 text-black/55">{body}</p></div></div>;
}
