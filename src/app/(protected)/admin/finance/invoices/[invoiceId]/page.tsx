"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
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
  AdminState,
  AdminStatusBadge,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../../_components/AdminUI";
import {
  calculateInvoiceTotals,
  calculateLineItem,
  formatInvoiceDate,
  formatInvoiceMoney,
  INVOICE_STATUS_LABELS,
  invoiceStatusTone,
  isValidDateInput,
  normalizeInvoice,
  todayInputValue,
  type InvoiceRecord,
  type InvoiceRefund,
} from "../../invoice-data";
import { downloadInvoicePdf } from "../../invoice-pdf";
import {
  DEFAULT_VAT_SETTINGS,
  readVatSettings,
  type VatSettings,
} from "../../vat-settings";

type PageProps = { params: Promise<{ invoiceId: string }> };
type LoadState = "loading" | "ready" | "not_found" | "error";

export default function InvoiceDetailPage({ params }: PageProps) {
  const { invoiceId } = use(params);
  const { user } = useAdminSession();
  const today = useMemo(todayInputValue, []);
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [vatSettings, setVatSettings] =
    useState<VatSettings>(DEFAULT_VAT_SETTINGS);
  const [paidDate, setPaidDate] = useState(today);
  const [refundDate, setRefundDate] = useState(today);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [action, setAction] = useState<"idle" | "paid" | "refund" | "credit" | "pdf">(
    "idle",
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "invoices", invoiceId),
        (snapshot) => {
          if (!snapshot.exists()) {
            setInvoice(null);
            setLoadState("not_found");
            return;
          }
          setInvoice(
            normalizeInvoice(
              snapshot.id,
              snapshot.data() as Record<string, unknown>,
            ),
          );
          setLoadState("ready");
        },
        (error) => {
          console.error("Failed to load invoice", error);
          setInvoice(null);
          setLoadState("error");
        },
      ),
    [invoiceId],
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

  const remainingRefundable = invoice
    ? Math.max(
        0,
        invoice.grossTotal - invoice.refundedTotal - invoice.creditedTotal,
      )
    : 0;

  async function markPaid() {
    if (!invoice || action !== "idle") return;
    if (!isValidDateInput(paidDate)) {
      setFeedback({ tone: "error", message: "Enter a valid paid date." });
      return;
    }
    setAction("paid");
    setFeedback(null);
    try {
      await runTransaction(db, async (transaction) => {
        const invoiceRef = doc(db, "invoices", invoice.id);
        const snapshot = await transaction.get(invoiceRef);
        if (!snapshot.exists()) throw new Error("Invoice not found.");
        transaction.update(invoiceRef, {
          status: "paid",
          paidDate,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email || "",
        });
        if (invoice.orderId) {
          transaction.update(doc(db, "orders", invoice.orderId), {
            status: "paid",
            paidDate,
            updatedAt: serverTimestamp(),
          });
        }
      });
      setFeedback({ tone: "success", message: "Payment recorded." });
    } catch (error) {
      console.error("Failed to mark invoice paid", error);
      setFeedback({ tone: "error", message: "Payment could not be recorded." });
    } finally {
      setAction("idle");
    }
  }

  async function recordRefund(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice || action !== "idle") return;
    const amount = Number(refundAmount);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > remainingRefundable
    ) {
      setFeedback({
        tone: "error",
        message: `Enter a refund up to ${formatInvoiceMoney(remainingRefundable, invoice.currency)}.`,
      });
      return;
    }
    if (!isValidDateInput(refundDate) || !refundReason.trim()) {
      setFeedback({
        tone: "error",
        message: "Enter the refund date and reason.",
      });
      return;
    }

    setAction("refund");
    setFeedback(null);
    try {
      await runTransaction(db, async (transaction) => {
        const invoiceRef = doc(db, "invoices", invoice.id);
        const snapshot = await transaction.get(invoiceRef);
        if (!snapshot.exists()) throw new Error("Invoice not found.");
        const latest = normalizeInvoice(
          snapshot.id,
          snapshot.data() as Record<string, unknown>,
        );
        const latestRemaining = Math.max(
          0,
          latest.grossTotal - latest.refundedTotal - latest.creditedTotal,
        );
        if (amount > latestRemaining) {
          throw new Error("Refund exceeds the latest remaining invoice value.");
        }
        const refund: InvoiceRefund = {
          id: createId("refund"),
          date: refundDate,
          amount: roundMoney(amount),
          reason: refundReason.trim(),
          recordedByEmail: user.email || "",
        };
        const refundedTotal = roundMoney(latest.refundedTotal + amount);
        transaction.update(invoiceRef, {
          refunds: [...latest.refunds, refund],
          refundedTotal,
          status:
            refundedTotal + latest.creditedTotal >= latest.grossTotal
              ? "refunded"
              : "partially_refunded",
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email || "",
        });
      });
      setRefundAmount("");
      setRefundReason("");
      setFeedback({ tone: "success", message: "Refund recorded." });
    } catch (error) {
      console.error("Failed to record refund", error);
      setFeedback({ tone: "error", message: "Refund could not be recorded." });
    } finally {
      setAction("idle");
    }
  }

  async function createCreditNote(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice || action !== "idle") return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remainingRefundable) {
      setFeedback({
        tone: "error",
        message: `Enter a credit up to ${formatInvoiceMoney(remainingRefundable, invoice.currency)}.`,
      });
      return;
    }
    if (!creditReason.trim()) {
      setFeedback({ tone: "error", message: "Enter a reason for the credit note." });
      return;
    }

    setAction("credit");
    setFeedback(null);
    try {
      const creditId = doc(collection(db, "invoices")).id;
      const issueYear = Number(today.slice(0, 4));
      const counterRef = doc(db, "finance_counters", `credit-note-${issueYear}`);
      const creditRef = doc(db, "invoices", creditId);
      await runTransaction(db, async (transaction) => {
        const counterSnapshot = await transaction.get(counterRef);
        const sourceSnapshot = await transaction.get(
          doc(db, "invoices", invoice.id),
        );
        if (!sourceSnapshot.exists()) throw new Error("Source invoice not found.");
        const sequence = counterSnapshot.exists()
          ? readNumber(counterSnapshot.data().lastNumber) + 1
          : 1;
        const creditNumber = `CN-${issueYear}-${String(sequence).padStart(4, "0")}`;
        const effectiveVatRate =
          invoice.netTotal > 0
            ? roundMoney((invoice.vatTotal / invoice.netTotal) * 100)
            : 0;
        const creditNet = roundMoney(amount / (1 + effectiveVatRate / 100));
        const lineItem = calculateLineItem({
          id: createId("credit-line"),
          description: `Credit against ${invoice.invoiceNumber}: ${creditReason.trim()}`,
          quantity: 1,
          unitNet: creditNet,
          vatRate: effectiveVatRate,
        });
        const totals = calculateInvoiceTotals([lineItem]);

        transaction.set(counterRef, {
          documentType: "credit_note",
          year: issueYear,
          lastNumber: sequence,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
        });
        transaction.set(creditRef, {
          type: "credit_note",
          invoiceNumber: creditNumber,
          sequence,
          status: "credited",
          orderId: invoice.orderId,
          clientId: invoice.clientId,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          clientAddress: invoice.clientAddress,
          issueDate: today,
          dueDate: today,
          paidDate: "",
          currency: invoice.currency,
          lineItems: [lineItem],
          ...totals,
          refundedTotal: 0,
          creditedTotal: 0,
          refunds: [],
          sourceInvoiceId: invoice.id,
          creditNoteIds: [],
          reason: creditReason.trim(),
          notes: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdByUid: user.uid,
          createdByEmail: user.email || "",
          updatedByUid: user.uid,
          updatedByEmail: user.email || "",
        });
        const latestSource = normalizeInvoice(
          sourceSnapshot.id,
          sourceSnapshot.data() as Record<string, unknown>,
        );
        const latestAvailable = Math.max(
          0,
          latestSource.grossTotal -
            latestSource.refundedTotal -
            latestSource.creditedTotal,
        );
        if (amount > latestAvailable) {
          throw new Error("Credit exceeds the latest unadjusted invoice value.");
        }
        const creditedTotal = roundMoney(latestSource.creditedTotal + amount);
        transaction.update(doc(db, "invoices", invoice.id), {
          creditNoteIds: [...latestSource.creditNoteIds, creditId],
          creditedTotal,
          status:
            creditedTotal + latestSource.refundedTotal >= latestSource.grossTotal
              ? "credited"
              : latestSource.status,
          updatedAt: serverTimestamp(),
          updatedByUid: user.uid,
          updatedByEmail: user.email || "",
        });
      });
      setCreditAmount("");
      setCreditReason("");
      setFeedback({
        tone: "success",
        message: "Credit note created. Open it from the linked documents below.",
      });
    } catch (error) {
      console.error("Failed to create credit note", error);
      setFeedback({ tone: "error", message: "Credit note could not be created." });
    } finally {
      setAction("idle");
    }
  }

  async function downloadPdf() {
    if (!invoice || action !== "idle") return;
    setAction("pdf");
    setFeedback(null);
    try {
      await downloadInvoicePdf(invoice, vatSettings.vatNumber);
    } catch (error) {
      console.error("Failed to create invoice PDF", error);
      setFeedback({
        tone: "error",
        message: "The PDF could not be generated.",
      });
    } finally {
      setAction("idle");
    }
  }

  return (
    <AdminShell active="finance">
      <AdminPage>
        <div>
          <Link href="/admin/finance/invoices" className={adminSecondaryButton}>
            ← Back to invoices
          </Link>
        </div>

        {loadState === "loading" ? (
          <StateSurface>
            <AdminState title="Loading invoice" body="Reading this finance record." />
          </StateSurface>
        ) : null}
        {loadState === "not_found" ? (
          <StateSurface>
            <AdminState
              title="Invoice not found"
              body="No invoice exists for this identifier."
              tone="error"
            />
          </StateSurface>
        ) : null}
        {loadState === "error" ? (
          <StateSurface>
            <AdminState
              title="Could not load invoice"
              body="Check your connection and access, then try again."
              tone="error"
            />
          </StateSurface>
        ) : null}

        {invoice ? (
          <>
            <AdminPageHeader
              eyebrow={invoice.type === "credit_note" ? "Credit note" : "Invoice"}
              title={invoice.invoiceNumber}
              description={`${invoice.clientName || invoice.clientEmail} · Issued ${formatInvoiceDate(invoice.issueDate)}`}
              actions={
                <>
                  <button
                    type="button"
                    onClick={downloadPdf}
                    disabled={action !== "idle"}
                    className={adminSecondaryButton}
                  >
                    {action === "pdf" ? "Preparing PDF…" : "Download PDF"}
                  </button>
                  <AdminStatusBadge tone={invoiceStatusTone(invoice.status)}>
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </AdminStatusBadge>
                </>
              }
            />

            {feedback ? (
              <div
                className={`rounded-[10px] border px-4 py-3 text-xs ${
                  feedback.tone === "error"
                    ? "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]"
                    : "border-[#c9ddcc] bg-[#eff7f0] text-[#35633c]"
                }`}
                role={feedback.tone === "error" ? "alert" : "status"}
              >
                {feedback.message}
              </div>
            ) : null}

            <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
              <InvoiceDocument invoice={invoice} vatNumber={vatSettings.vatNumber} />

              <aside className="space-y-5">
                {invoice.type === "invoice" && invoice.status === "issued" ? (
                  <ActionCard eyebrow="Payment" title="Record payment">
                    <Field label="Paid date" htmlFor="paid-date">
                      <input
                        id="paid-date"
                        type="date"
                        value={paidDate}
                        onChange={(event) => setPaidDate(event.target.value)}
                        className={controlClass}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={markPaid}
                      disabled={action !== "idle"}
                      className={`${adminPrimaryButton} mt-4 w-full`}
                    >
                      {action === "paid" ? "Recording…" : "Mark as paid"}
                    </button>
                  </ActionCard>
                ) : null}

                {invoice.type === "invoice" &&
                invoice.status !== "issued" &&
                remainingRefundable > 0 ? (
                  <ActionCard eyebrow="Money returned" title="Record refund">
                    <form onSubmit={recordRefund} className="space-y-3">
                      <Field label="Refund date" htmlFor="refund-date">
                        <input
                          id="refund-date"
                          type="date"
                          value={refundDate}
                          onChange={(event) => setRefundDate(event.target.value)}
                          className={controlClass}
                        />
                      </Field>
                      <Field label="Amount" htmlFor="refund-amount">
                        <input
                          id="refund-amount"
                          type="number"
                          min="0.01"
                          max={remainingRefundable}
                          step="0.01"
                          value={refundAmount}
                          onChange={(event) => setRefundAmount(event.target.value)}
                          className={controlClass}
                          placeholder={remainingRefundable.toFixed(2)}
                        />
                      </Field>
                      <Field label="Reason" htmlFor="refund-reason">
                        <textarea
                          id="refund-reason"
                          rows={2}
                          value={refundReason}
                          onChange={(event) => setRefundReason(event.target.value)}
                          className={controlClass}
                        />
                      </Field>
                      <button
                        type="submit"
                        disabled={action !== "idle"}
                        className={`${adminSecondaryButton} w-full`}
                      >
                        {action === "refund" ? "Recording…" : "Record refund"}
                      </button>
                    </form>
                  </ActionCard>
                ) : null}

                {invoice.type === "invoice" ? (
                  <ActionCard eyebrow="Adjustment" title="Create credit note">
                    <form onSubmit={createCreditNote} className="space-y-3">
                      <Field label="Credit amount" htmlFor="credit-amount">
                        <input
                          id="credit-amount"
                          type="number"
                          min="0.01"
                          max={remainingRefundable}
                          step="0.01"
                          value={creditAmount}
                          onChange={(event) => setCreditAmount(event.target.value)}
                          className={controlClass}
                          placeholder={remainingRefundable.toFixed(2)}
                        />
                      </Field>
                      <Field label="Reason" htmlFor="credit-reason">
                        <textarea
                          id="credit-reason"
                          rows={2}
                          value={creditReason}
                          onChange={(event) => setCreditReason(event.target.value)}
                          className={controlClass}
                        />
                      </Field>
                      <button
                        type="submit"
                        disabled={action !== "idle"}
                        className={`${adminSecondaryButton} w-full`}
                      >
                        {action === "credit" ? "Creating…" : "Issue credit note"}
                      </button>
                    </form>
                  </ActionCard>
                ) : null}

                {invoice.refunds.length ? (
                  <ActionCard eyebrow="History" title="Refunds">
                    <ol className="divide-y divide-[#ebe3dc]">
                      {invoice.refunds.map((refund) => (
                        <li className="py-3 first:pt-0" key={refund.id}>
                          <div className="flex justify-between gap-3">
                            <span className="text-xs text-[#766960]">
                              {formatInvoiceDate(refund.date)}
                            </span>
                            <strong className="text-xs tabular-nums text-[#3f342d]">
                              {formatInvoiceMoney(refund.amount, invoice.currency)}
                            </strong>
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-[#81746a]">
                            {refund.reason}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </ActionCard>
                ) : null}

                {invoice.sourceInvoiceId || invoice.creditNoteIds.length ? (
                  <ActionCard eyebrow="Relationships" title="Linked documents">
                    <div className="space-y-2">
                      {invoice.sourceInvoiceId ? (
                        <Link
                          href={`/admin/finance/invoices/${invoice.sourceInvoiceId}`}
                          className="block text-xs font-semibold text-[#665044] underline decoration-[#c9b9ac] underline-offset-4"
                        >
                          Open source invoice
                        </Link>
                      ) : null}
                      {invoice.creditNoteIds.map((creditId, index) => (
                        <Link
                          href={`/admin/finance/invoices/${creditId}`}
                          className="block text-xs font-semibold text-[#665044] underline decoration-[#c9b9ac] underline-offset-4"
                          key={creditId}
                        >
                          Open credit note {index + 1}
                        </Link>
                      ))}
                    </div>
                  </ActionCard>
                ) : null}
              </aside>
            </div>
          </>
        ) : null}
      </AdminPage>
    </AdminShell>
  );
}

function InvoiceDocument({
  invoice,
  vatNumber,
}: {
  invoice: InvoiceRecord;
  vatNumber: string;
}) {
  return (
    <article className="overflow-hidden rounded-[14px] border border-[#d9cfc5] bg-white shadow-[0_12px_35px_rgba(43,35,30,0.08)]">
      <header className="flex items-start justify-between gap-6 bg-[#2c241f] px-6 py-6 text-white sm:px-8">
        <div>
          <p className="font-serif text-2xl italic tracking-[-0.03em]">TUFFFINDS</p>
          <p className="mt-1 text-[10px] text-[#cdbfb5]">
            Personal sourcing and luxury concierge
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#b8aaa0]">
            {invoice.type === "credit_note" ? "Credit note" : "Invoice"}
          </p>
          <p className="mt-1 text-sm font-semibold">{invoice.invoiceNumber}</p>
        </div>
      </header>

      <div className="px-6 py-7 sm:px-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">
              Bill to
            </p>
            <p className="mt-2 text-sm font-semibold text-[#342a24]">
              {invoice.clientName || "Client"}
            </p>
            <p className="mt-1 text-xs text-[#766960]">{invoice.clientEmail}</p>
            {invoice.clientAddress ? (
              <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#766960]">
                {invoice.clientAddress}
              </p>
            ) : null}
          </div>
          <dl className="space-y-2 sm:justify-self-end sm:text-right">
            <DocumentDefinition label="Issue date" value={formatInvoiceDate(invoice.issueDate)} />
            <DocumentDefinition
              label={invoice.type === "credit_note" ? "Credit date" : "Payment due"}
              value={formatInvoiceDate(
                invoice.type === "credit_note" ? invoice.issueDate : invoice.dueDate,
              )}
            />
            <DocumentDefinition label="Currency" value={invoice.currency} />
            {vatNumber ? <DocumentDefinition label="VAT number" value={vatNumber} /> : null}
          </dl>
        </div>

        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[minmax(15rem,1fr)_4rem_7rem_5rem_8rem] gap-3 bg-[#f4f0ea] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#806b5d]">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Net</span>
              <span className="text-right">VAT</span>
              <span className="text-right">Total</span>
            </div>
            <div className="divide-y divide-[#ebe3dc]">
              {invoice.lineItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(15rem,1fr)_4rem_7rem_5rem_8rem] gap-3 px-3 py-4 text-xs text-[#51443c]"
                >
                  <span className="font-medium text-[#342a24]">{item.description}</span>
                  <span className="text-right">{item.quantity}</span>
                  <span className="text-right tabular-nums">
                    {formatInvoiceMoney(item.netAmount, invoice.currency)}
                  </span>
                  <span className="text-right">{item.vatRate}%</span>
                  <span className="text-right font-semibold tabular-nums">
                    {formatInvoiceMoney(item.grossAmount, invoice.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <dl className="ml-auto mt-6 max-w-xs space-y-3">
          <DocumentTotal label="Net" value={invoice.netTotal} currency={invoice.currency} />
          <DocumentTotal label="VAT" value={invoice.vatTotal} currency={invoice.currency} />
          <div className="border-t border-[#cfc2b7] pt-3">
            <DocumentTotal
              label={invoice.type === "credit_note" ? "Credit total" : "Total due"}
              value={invoice.grossTotal}
              currency={invoice.currency}
              strong
            />
          </div>
          {invoice.refundedTotal ? (
            <DocumentTotal
              label="Refunded"
              value={invoice.refundedTotal}
              currency={invoice.currency}
            />
          ) : null}
          {invoice.creditedTotal ? (
            <DocumentTotal
              label="Credited"
              value={invoice.creditedTotal}
              currency={invoice.currency}
            />
          ) : null}
        </dl>

        {invoice.notes || invoice.reason ? (
          <div className="mt-8 border-t border-[#ebe3dc] pt-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#806b5d]">
              {invoice.type === "credit_note" ? "Reason" : "Notes"}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#766960]">
              {invoice.reason || invoice.notes}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ActionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#ded5cb] bg-white p-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-serif text-lg text-[#302722]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor}>
      <span className="mb-1.5 block text-xs font-semibold text-[#62554c]">
        {label}
      </span>
      {children}
    </label>
  );
}

function DocumentDefinition({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a7d74]">
        {label}
      </dt>
      <dd className="mt-0.5 text-xs font-medium text-[#443830]">{value}</dd>
    </div>
  );
}

function DocumentTotal({
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
    <div className="flex items-center justify-between gap-5">
      <dt className={`${strong ? "font-semibold text-[#342a24]" : "text-[#766960]"} text-sm`}>
        {label}
      </dt>
      <dd
        className={`tabular-nums text-[#342a24] ${
          strong ? "font-serif text-xl font-semibold" : "text-sm font-semibold"
        }`}
      >
        {formatInvoiceMoney(value, currency)}
      </dd>
    </div>
  );
}

function StateSurface({ children }: { children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
      {children}
    </section>
  );
}

const controlClass =
  "block min-h-10 w-full rounded-[9px] border border-[#d3c8bd] bg-white px-3 py-2 text-sm text-[#302722] outline-none transition focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/20";

function createId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
