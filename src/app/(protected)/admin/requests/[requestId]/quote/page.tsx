"use client";

import Link from "next/link";
import Image from "next/image";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../../_components/AdminShell";
import {
  AdminPage,
  AdminPageHeader,
  AdminState,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../../_components/AdminUI";
import styles from "./quote.module.css";

type PageProps = { params: Promise<{ requestId: string }> };
type Currency = "GBP" | "EUR" | "USD";
type LoadState = "loading" | "ready" | "not_found" | "error";
type Feedback = { state: "idle" | "saving" | "success" | "error"; message: string };
type QuoteItemForm = { id: string; description: string; quantity: string; unitPrice: string; url: string };
type QuoteForm = {
  quoteNumber: string;
  currency: Currency;
  validUntil: string;
  items: QuoteItemForm[];
  serviceFee: string;
  parcelWeight: string;
  shippingBase: string;
  shippingPerKg: string;
  dutyRate: string;
  taxRate: string;
  shipping: string;
  customsDuty: string;
  importTax: string;
  notes: string;
  terms: string;
};
type RequestSnapshot = {
  id: string;
  clientName: string;
  clientEmail: string;
  title: string;
  shippingCountry: string;
  createdAt: Date | null;
  storedQuote: Record<string, unknown> | null;
};

const CURRENCIES: Currency[] = ["GBP", "EUR", "USD"];
const controlClass = "block min-h-10 w-full rounded-[9px] border border-[#d3c8bd] bg-white px-3 py-2 text-sm text-[#302722] outline-none focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/20";
const moneyControlClass = `${controlClass} text-right tabular-nums`;

export default function QuoteBuilderPage({ params }: PageProps) {
  const { requestId } = use(params);
  const [request, setRequest] = useState<RequestSnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [readError, setReadError] = useState("");
  const [form, setForm] = useState<QuoteForm>(() => emptyQuote(requestId, ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback>({ state: "idle", message: "" });
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);
  const saveLock = useRef(false);

  useEffect(() => {
    if (!isSafeDocumentId(requestId)) {
      setLoadState("error");
      setReadError("The request ID is malformed.");
      return;
    }
    return onSnapshot(
      doc(db, "requests", requestId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRequest(null);
          setLoadState("not_found");
          return;
        }
        const normalized = normalizeRequest(snapshot.id, snapshot.data() as Record<string, unknown>);
        setRequest(normalized);
        setLoadState("ready");
        setReadError("");
        if (!initialized.current) {
          setForm(normalizeQuoteForm(normalized));
          initialized.current = true;
        }
      },
      (error) => {
        console.error("Failed to load quote request", error);
        setLoadState("error");
        setReadError("Could not load this request from Firestore.");
      },
    );
  }, [requestId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const totals = useMemo(() => calculateTotals(form), [form]);
  const estimate = useMemo(() => calculateImportEstimate(form), [form]);
  const createdDate = request?.createdAt ?? new Date();

  function change(next: QuoteForm) {
    setForm(next);
    setDirty(true);
    setFeedback({ state: "idle", message: "" });
  }

  function updateItem(id: string, field: keyof QuoteItemForm, value: string) {
    change({ ...form, items: form.items.map((item) => item.id === id ? { ...item, [field]: value } : item) });
  }

  function addItem() {
    change({ ...form, items: [...form.items, newQuoteItem()] });
  }

  function removeItem(id: string) {
    if (form.items.length === 1) return;
    change({ ...form, items: form.items.filter((item) => item.id !== id) });
  }

  function applyImportEstimate() {
    change({
      ...form,
      shipping: moneyInput(estimate.shipping),
      customsDuty: moneyInput(estimate.customsDuty),
      importTax: moneyInput(estimate.importTax),
    });
  }

  async function saveQuote() {
    if (!request || saveLock.current) return;
    const validation = validateQuote(form);
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length) {
      setFeedback({ state: "error", message: "Review the highlighted quote fields before saving." });
      return;
    }
    saveLock.current = true;
    setFeedback({ state: "saving", message: "Saving quote…" });
    try {
      const existingCreatedAt = request.storedQuote?.createdAt;
      await updateDoc(doc(db, "requests", request.id), {
        "detail.quote": {
          version: 1,
          status: "draft",
          quoteNumber: form.quoteNumber.trim(),
          currency: form.currency,
          validUntil: form.validUntil,
          items: validation.items,
          subtotal: validation.subtotal,
          serviceFee: validation.serviceFee,
          shipping: validation.shipping,
          customsDuty: validation.customsDuty,
          importTax: validation.importTax,
          duties: roundMoney(validation.customsDuty + validation.importTax),
          calculator: {
            destinationCountry: request.shippingCountry,
            parcelWeightKg: validation.parcelWeight,
            shippingBase: validation.shippingBase,
            shippingPerKg: validation.shippingPerKg,
            dutyRate: validation.dutyRate,
            taxRate: validation.taxRate,
          },
          total: validation.total,
          notes: form.notes.trim(),
          terms: form.terms.trim(),
          createdAt: existingCreatedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      setDirty(false);
      setFeedback({ state: "success", message: "Quote saved to this request." });
    } catch (error) {
      console.error("Failed to save quote", error);
      setFeedback({ state: "error", message: "The quote could not be saved. Your entries are still on this page." });
    } finally {
      saveLock.current = false;
    }
  }

  async function copySummary() {
    if (!request) return;
    try {
      await navigator.clipboard.writeText(buildQuoteSummary(request, form, totals));
      setFeedback({ state: "success", message: "Customer quote summary copied." });
    } catch (error) {
      console.error("Failed to copy quote summary", error);
      setFeedback({ state: "error", message: "Could not copy the quote summary." });
    }
  }

  return (
    <AdminShell active="requests">
      <AdminPage>
        <div className={styles.builderOnly}>
          <Link href={`/admin/requests/${encodeURIComponent(requestId)}`} className={adminSecondaryButton}>← Back to request</Link>
        </div>

        {loadState === "loading" ? <AdminState title="Loading quote builder" body="Reading the request and any saved quote." /> : null}
        {loadState === "not_found" ? <AdminState title="Request not found" body="This quote cannot be created because the request does not exist." tone="error" /> : null}
        {loadState === "error" ? <AdminState title="Quote builder unavailable" body={readError} tone="error" /> : null}

        {loadState === "ready" && request ? (
          <>
            <div className={styles.builderOnly}>
              <AdminPageHeader
                eyebrow="Request quote"
                title={request.storedQuote ? "Edit quote" : "Create quote"}
                description="Build the customer-facing quote, save it to the request, then print or save it as a PDF. Nothing is sent automatically."
                actions={<><button type="button" onClick={copySummary} className={adminSecondaryButton}>Copy summary</button><button type="button" onClick={() => window.print()} className={adminSecondaryButton}>Print / Save PDF</button><button type="button" onClick={saveQuote} disabled={feedback.state === "saving"} className={adminPrimaryButton}>{feedback.state === "saving" ? "Saving…" : "Save quote"}</button></>}
              />

              <QuoteFormPanel request={request} form={form} errors={errors} estimate={estimate} onChange={change} onUpdateItem={updateItem} onAddItem={addItem} onRemoveItem={removeItem} onApplyEstimate={applyImportEstimate} />
              {feedback.message ? <p className={`rounded-[10px] border px-4 py-3 text-sm ${feedback.state === "error" ? "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]" : "border-[#c9ddcc] bg-[#eff7f0] text-[#35633c]"}`} role={feedback.state === "error" ? "alert" : "status"}>{feedback.message}</p> : null}
              <div className="border-t border-[#ded5cb] pt-4"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">Customer preview</p></div>
            </div>

            <div className={`${styles.printRoot} quote-print-root`}>
              <QuotePreview request={request} form={form} totals={totals} createdDate={createdDate} />
            </div>
          </>
        ) : null}
      </AdminPage>
    </AdminShell>
  );
}

function QuoteFormPanel({ request, form, errors, estimate, onChange, onUpdateItem, onAddItem, onRemoveItem, onApplyEstimate }: { request: RequestSnapshot; form: QuoteForm; errors: Record<string, string>; estimate: ReturnType<typeof calculateImportEstimate>; onChange: (form: QuoteForm) => void; onUpdateItem: (id: string, field: keyof QuoteItemForm, value: string) => void; onAddItem: () => void; onRemoveItem: (id: string) => void; onApplyEstimate: () => void }) {
  return <div className="space-y-6 rounded-[12px] border border-[#ded5cb] bg-[#faf8f5] p-4 sm:p-5">
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Quote number" error={errors.quoteNumber}><input value={form.quoteNumber} onChange={(event) => onChange({ ...form, quoteNumber: event.target.value })} className={controlClass} /></Field>
      <Field label="Currency"><select value={form.currency} onChange={(event) => onChange({ ...form, currency: event.target.value as Currency })} className={controlClass}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
      <Field label="Valid until" error={errors.validUntil}><input type="date" value={form.validUntil} onChange={(event) => onChange({ ...form, validUntil: event.target.value })} className={controlClass} /></Field>
    </div>

    <fieldset className="space-y-3 border-t border-[#ded5cb] pt-5">
      <div className="flex items-center justify-between gap-3"><legend className="text-sm font-semibold text-[#43372f]">Quoted items</legend><button type="button" onClick={onAddItem} className={adminSecondaryButton}>Add item</button></div>
      {form.items.map((item, index) => <div key={item.id} className="grid gap-3 rounded-[10px] border border-[#ded5cb] bg-white p-3 lg:grid-cols-[minmax(0,1fr)_6rem_8rem_7rem]">
        <div className="space-y-3"><Field label={`Item ${index + 1}`} error={errors[`item-${index}-description`]}><input value={item.description} onChange={(event) => onUpdateItem(item.id, "description", event.target.value)} placeholder="Product or service description" className={controlClass} /></Field><Field label="Product link (optional)" error={errors[`item-${index}-url`]}><input type="url" value={item.url} onChange={(event) => onUpdateItem(item.id, "url", event.target.value)} placeholder="https://" className={controlClass} /></Field></div>
        <Field label="Quantity" error={errors[`item-${index}-quantity`]}><input inputMode="decimal" value={item.quantity} onChange={(event) => onUpdateItem(item.id, "quantity", event.target.value)} className={moneyControlClass} /></Field>
        <Field label="Unit price" error={errors[`item-${index}-unitPrice`]}><input inputMode="decimal" value={item.unitPrice} onChange={(event) => onUpdateItem(item.id, "unitPrice", event.target.value)} className={moneyControlClass} /></Field>
        <div className="flex items-end"><button type="button" onClick={() => onRemoveItem(item.id)} disabled={form.items.length === 1} className="h-10 w-full rounded-[9px] border border-[#e0c9c2] bg-white px-3 text-xs font-medium text-[#8c3c2d] disabled:opacity-40">Remove</button></div>
      </div>)}
    </fieldset>

    <fieldset className="space-y-4 border-t border-[#ded5cb] pt-5">
      <div><legend className="text-sm font-semibold text-[#43372f]">Shipping, duties and tax estimator</legend><p className="mt-1 max-w-4xl text-xs leading-5 text-[#74675e]">Destination: {request.shippingCountry || "Not captured"}. Enter carrier assumptions and the destination-specific duty and import-tax rates. Rates are not supplied automatically because they depend on product classification, origin and local rules.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Parcel weight (kg)" error={errors.parcelWeight}><input inputMode="decimal" value={form.parcelWeight} onChange={(event) => onChange({ ...form, parcelWeight: event.target.value })} className={moneyControlClass} /></Field>
        <Field label="Base shipping" error={errors.shippingBase}><input inputMode="decimal" value={form.shippingBase} onChange={(event) => onChange({ ...form, shippingBase: event.target.value })} className={moneyControlClass} /></Field>
        <Field label="Shipping per kg" error={errors.shippingPerKg}><input inputMode="decimal" value={form.shippingPerKg} onChange={(event) => onChange({ ...form, shippingPerKg: event.target.value })} className={moneyControlClass} /></Field>
        <Field label="Customs duty rate (%)" error={errors.dutyRate}><input inputMode="decimal" value={form.dutyRate} onChange={(event) => onChange({ ...form, dutyRate: event.target.value })} className={moneyControlClass} /></Field>
        <Field label="Import tax rate (%)" error={errors.taxRate}><input inputMode="decimal" value={form.taxRate} onChange={(event) => onChange({ ...form, taxRate: event.target.value })} className={moneyControlClass} /></Field>
      </div>
      <div className="flex flex-col gap-3 rounded-[10px] border border-[#d8cec3] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-3"><EstimateValue label="Shipping" value={estimate.shipping} currency={form.currency} /><EstimateValue label="Customs duty" value={estimate.customsDuty} currency={form.currency} /><EstimateValue label="Import tax" value={estimate.importTax} currency={form.currency} /></div><button type="button" onClick={onApplyEstimate} className={adminPrimaryButton}>Use estimates in quote</button></div>
      <p className="rounded-[9px] border border-[#e5d3a9] bg-[#fbf6e8] px-3 py-2 text-xs leading-5 text-[#725820]">Estimator only: customs duty uses goods plus estimated shipping; import tax uses that customs value plus duty. Confirm the commodity code, origin, destination rules and carrier charge before sending the quote.</p>
    </fieldset>

    <div className="grid gap-4 border-t border-[#ded5cb] pt-5 md:grid-cols-4">
      <Field label="Service fee" error={errors.serviceFee}><input inputMode="decimal" value={form.serviceFee} onChange={(event) => onChange({ ...form, serviceFee: event.target.value })} className={moneyControlClass} /></Field>
      <Field label="Shipping estimate" error={errors.shipping}><input inputMode="decimal" value={form.shipping} onChange={(event) => onChange({ ...form, shipping: event.target.value })} className={moneyControlClass} /></Field>
      <Field label="Customs duty estimate" error={errors.customsDuty}><input inputMode="decimal" value={form.customsDuty} onChange={(event) => onChange({ ...form, customsDuty: event.target.value })} className={moneyControlClass} /></Field>
      <Field label="Import tax estimate" error={errors.importTax}><input inputMode="decimal" value={form.importTax} onChange={(event) => onChange({ ...form, importTax: event.target.value })} className={moneyControlClass} /></Field>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Customer notes"><textarea rows={4} value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} className={controlClass} /></Field>
      <Field label="Terms"><textarea rows={4} value={form.terms} onChange={(event) => onChange({ ...form, terms: event.target.value })} className={controlClass} /></Field>
    </div>
  </div>;
}

function QuotePreview({ request, form, totals, createdDate }: { request: RequestSnapshot; form: QuoteForm; totals: ReturnType<typeof calculateTotals>; createdDate: Date }) {
  return <article className={styles.sheet} aria-label="Customer quote preview">
    <header className="flex flex-col justify-between gap-8 border-b border-[#ded5cb] pb-8 sm:flex-row sm:items-start">
      <div><Image src="/finallogobrown.png" alt="Tuff Finds" width={180} height={22} priority className="h-auto w-[180px]" /><p className="mt-3 text-xs uppercase tracking-[0.2em] text-[#806b5d]">Personal sourcing</p></div>
      <div className="sm:text-right"><h1 className="font-serif text-4xl">Quote</h1><p className="mt-3 text-sm text-[#62564e]">{form.quoteNumber || "Draft quote"}</p><p className="mt-1 text-xs text-[#81746a]">Prepared {formatDate(createdDate)}</p>{form.validUntil ? <p className="mt-1 text-xs text-[#81746a]">Valid until {formatStoredDate(form.validUntil)}</p> : null}</div>
    </header>
    <div className="grid gap-8 border-b border-[#ded5cb] py-8 sm:grid-cols-2">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">Prepared for</p><p className="mt-2 font-semibold">{request.clientName || "Client"}</p>{request.clientEmail ? <p className="mt-1 text-sm text-[#62564e]">{request.clientEmail}</p> : null}{request.shippingCountry ? <p className="mt-1 text-sm text-[#62564e]">{request.shippingCountry}</p> : null}</div>
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">Request</p><p className="mt-2 font-semibold">{request.title}</p><p className="mt-1 text-sm text-[#62564e]">Reference {request.id}</p></div>
    </div>
    <div className="py-8">
      <div className="grid grid-cols-[minmax(0,1fr)_4rem_7rem_7rem] gap-3 border-b border-[#302722] pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#806b5d]"><span>Description</span><span className="text-right">Qty</span><span className="text-right">Unit</span><span className="text-right">Amount</span></div>
      {form.items.map((item) => { const quantity = numberOrZero(item.quantity); const unitPrice = numberOrZero(item.unitPrice); return <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_4rem_7rem_7rem] gap-3 border-b border-[#eee8e2] py-4 text-sm"><div><p className="font-medium">{item.description || "Untitled item"}</p>{item.url ? <p className="mt-1 break-all text-xs text-[#81746a]">{item.url}</p> : null}</div><span className="text-right tabular-nums">{formatQuantity(quantity)}</span><span className="text-right tabular-nums">{formatMoney(unitPrice, form.currency)}</span><span className="text-right font-medium tabular-nums">{formatMoney(quantity * unitPrice, form.currency)}</span></div>; })}
      <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><TotalRow label="Subtotal" value={totals.subtotal} currency={form.currency} /><TotalRow label="Service fee" value={totals.serviceFee} currency={form.currency} /><TotalRow label="Shipping estimate" value={totals.shipping} currency={form.currency} /><TotalRow label="Customs duty estimate" value={totals.customsDuty} currency={form.currency} /><TotalRow label="Import tax estimate" value={totals.importTax} currency={form.currency} /><div className="mt-3 flex justify-between border-t border-[#302722] pt-3 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatMoney(totals.total, form.currency)}</span></div></div>
    </div>
    {(form.notes || form.terms) ? <div className="grid gap-8 border-t border-[#ded5cb] pt-8 sm:grid-cols-2">{form.notes ? <PreviewText title="Notes" text={form.notes} /> : null}{form.terms ? <PreviewText title="Terms" text={form.terms} /> : null}</div> : null}
    <footer className="mt-10 border-t border-[#ded5cb] pt-5 text-xs leading-5 text-[#81746a]">Thank you for choosing Tuff Finds. Availability and third-party costs remain subject to confirmation until payment is received.</footer>
  </article>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#62554c]">{label}</span>{children}{error ? <span className="mt-1 block text-xs text-[#9a4030]">{error}</span> : null}</label>; }
function TotalRow({ label, value, currency }: { label: string; value: number; currency: Currency }) { return <div className="flex justify-between gap-4 text-[#62564e]"><span>{label}</span><span className="tabular-nums">{formatMoney(value, currency)}</span></div>; }
function EstimateValue({ label, value, currency }: { label: string; value: number; currency: Currency }) { return <p><span className="text-[#74675e]">{label}: </span><strong className="tabular-nums text-[#302722]">{formatMoney(value, currency)}</strong></p>; }
function PreviewText({ title, text }: { title: string; text: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#62564e]">{text}</p></div>; }

function emptyQuote(requestId: string, title: string): QuoteForm {
  return {
    quoteNumber: defaultQuoteNumber(requestId),
    currency: "GBP",
    validUntil: dateInputDaysFromNow(7),
    items: [{ ...newQuoteItem(), description: title }],
    serviceFee: "0",
    parcelWeight: "1",
    shippingBase: "0",
    shippingPerKg: "0",
    dutyRate: "0",
    taxRate: "0",
    shipping: "0",
    customsDuty: "0",
    importTax: "0",
    notes: "",
    terms: "Quote valid while stock remains available. Payment is required before purchase.",
  };
}
function newQuoteItem(): QuoteItemForm { return { id: globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, description: "", quantity: "1", unitPrice: "", url: "" }; }
function defaultQuoteNumber(requestId: string) { return `Q-${requestId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() || "DRAFT"}`; }
function dateInputDaysFromNow(days: number) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }

function normalizeRequest(id: string, data: Record<string, unknown>): RequestSnapshot { const detail = isRecord(data.detail) ? data.detail : {}; return { id, clientName: readString(data.clientName) || readString(data.fullName), clientEmail: readString(data.clientEmail), title: readString(detail.title) || "Untitled request", shippingCountry: readString(detail.shippingCountry), createdAt: readDate(data.createdAt), storedQuote: isRecord(detail.quote) ? detail.quote : null }; }
function normalizeQuoteForm(request: RequestSnapshot): QuoteForm {
  const value = request.storedQuote;
  if (!value) return emptyQuote(request.id, request.title);
  const currency = CURRENCIES.includes(value.currency as Currency) ? value.currency as Currency : "GBP";
  const calculator = isRecord(value.calculator) ? value.calculator : {};
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    return [{ id: readString(entry.id) || `item-${index + 1}`, description: readString(entry.description), quantity: numberInput(entry.quantity, "1"), unitPrice: numberInput(entry.unitPrice, ""), url: readString(entry.url) }];
  });
  return {
    quoteNumber: readString(value.quoteNumber) || defaultQuoteNumber(request.id),
    currency,
    validUntil: readString(value.validUntil) || dateInputDaysFromNow(7),
    items: items.length ? items : [{ ...newQuoteItem(), description: request.title }],
    serviceFee: numberInput(value.serviceFee, "0"),
    parcelWeight: numberInput(calculator.parcelWeightKg, "1"),
    shippingBase: numberInput(calculator.shippingBase, "0"),
    shippingPerKg: numberInput(calculator.shippingPerKg, "0"),
    dutyRate: numberInput(calculator.dutyRate, "0"),
    taxRate: numberInput(calculator.taxRate, "0"),
    shipping: numberInput(value.shipping, "0"),
    customsDuty: numberInput(value.customsDuty, numberInput(value.duties, "0")),
    importTax: numberInput(value.importTax, "0"),
    notes: readString(value.notes),
    terms: readString(value.terms) || "Quote valid while stock remains available. Payment is required before purchase.",
  };
}

function validateQuote(form: QuoteForm) {
  const errors: Record<string, string> = {};
  if (!form.quoteNumber.trim()) errors.quoteNumber = "Enter a quote number.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.validUntil)) errors.validUntil = "Choose a valid expiry date.";
  const items = form.items.map((item, index) => {
    const quantity = parsePositive(item.quantity);
    const unitPrice = parseNonNegative(item.unitPrice);
    const url = optionalHttpUrl(item.url);
    if (!item.description.trim()) errors[`item-${index}-description`] = "Enter a description.";
    if (quantity === null) errors[`item-${index}-quantity`] = "Enter a quantity above zero.";
    if (unitPrice === null) errors[`item-${index}-unitPrice`] = "Enter a valid price.";
    if (item.url.trim() && !url) errors[`item-${index}-url`] = "Enter a complete http:// or https:// URL.";
    return { id: item.id, description: item.description.trim(), quantity: quantity ?? 0, unitPrice: unitPrice ?? 0, url: url ?? "" };
  });
  const serviceFee = validateExtra("serviceFee", form.serviceFee, errors);
  const parcelWeight = validateExtra("parcelWeight", form.parcelWeight, errors);
  const shippingBase = validateExtra("shippingBase", form.shippingBase, errors);
  const shippingPerKg = validateExtra("shippingPerKg", form.shippingPerKg, errors);
  const dutyRate = validateRate("dutyRate", form.dutyRate, errors);
  const taxRate = validateRate("taxRate", form.taxRate, errors);
  const shipping = validateExtra("shipping", form.shipping, errors);
  const customsDuty = validateExtra("customsDuty", form.customsDuty, errors);
  const importTax = validateExtra("importTax", form.importTax, errors);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const total = roundMoney(subtotal + serviceFee + shipping + customsDuty + importTax);
  return { errors, items, subtotal, serviceFee, parcelWeight, shippingBase, shippingPerKg, dutyRate, taxRate, shipping, customsDuty, importTax, total };
}
function validateExtra(key: string, value: string, errors: Record<string, string>) { const number = parseNonNegative(value); if (number === null) { errors[key] = "Enter zero or a positive amount."; return 0; } return number; }
function validateRate(key: string, value: string, errors: Record<string, string>) { const number = parseNonNegative(value); if (number === null || number > 100) { errors[key] = "Enter a rate from 0 to 100%."; return 0; } return number; }
function calculateTotals(form: QuoteForm) { const subtotal = roundMoney(form.items.reduce((sum, item) => sum + numberOrZero(item.quantity) * numberOrZero(item.unitPrice), 0)); const serviceFee = numberOrZero(form.serviceFee); const shipping = numberOrZero(form.shipping); const customsDuty = numberOrZero(form.customsDuty); const importTax = numberOrZero(form.importTax); return { subtotal, serviceFee, shipping, customsDuty, importTax, total: roundMoney(subtotal + serviceFee + shipping + customsDuty + importTax) }; }
function calculateImportEstimate(form: QuoteForm) { const subtotal = roundMoney(form.items.reduce((sum, item) => sum + numberOrZero(item.quantity) * numberOrZero(item.unitPrice), 0)); const shipping = roundMoney(numberOrZero(form.shippingBase) + numberOrZero(form.parcelWeight) * numberOrZero(form.shippingPerKg)); const customsValue = roundMoney(subtotal + shipping); const customsDuty = roundMoney(customsValue * numberOrZero(form.dutyRate) / 100); const importTax = roundMoney((customsValue + customsDuty) * numberOrZero(form.taxRate) / 100); return { shipping, customsValue, customsDuty, importTax }; }
function buildQuoteSummary(request: RequestSnapshot, form: QuoteForm, totals: ReturnType<typeof calculateTotals>) { const items = form.items.map((item) => `- ${item.description || "Item"} × ${formatQuantity(numberOrZero(item.quantity))}: ${formatMoney(numberOrZero(item.quantity) * numberOrZero(item.unitPrice), form.currency)}`).join("\n"); return `${form.quoteNumber || "Quote"} — ${request.title}\nFor: ${request.clientName || request.clientEmail || "Client"}\n\n${items}\n\nTotal: ${formatMoney(totals.total, form.currency)}${form.validUntil ? `\nValid until: ${formatStoredDate(form.validUntil)}` : ""}${form.notes ? `\n\nNotes: ${form.notes}` : ""}`; }

function parsePositive(value: string) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }
function parseNonNegative(value: string) { const number = Number(value); return value.trim() !== "" && Number.isFinite(number) && number >= 0 ? roundMoney(number) : null; }
function numberOrZero(value: string) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }
function numberInput(value: unknown, fallback: string) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? String(number) : fallback; }
function moneyInput(value: number) { return String(roundMoney(value)); }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function formatMoney(value: number, currency: Currency) { return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value); }
function formatQuantity(value: number) { return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(value); }
function formatStoredDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : formatDate(date); }
function optionalHttpUrl(value: string) { const trimmed = value.trim(); if (!trimmed) return null; try { const url = new URL(trimmed); return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null; } catch { return null; } }
function readString(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isSafeDocumentId(value: string) { return Boolean(value) && !value.includes("/"); }
function readDate(value: unknown): Date | null { if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value; if (isRecord(value) && typeof value.toDate === "function") { const date = (value.toDate as () => Date)(); return Number.isNaN(date.getTime()) ? null : date; } if (isRecord(value)) { const seconds = Number(value.seconds ?? value._seconds); if (Number.isFinite(seconds)) return new Date(seconds * 1000); } if (typeof value === "string" || typeof value === "number") { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; } return null; }
