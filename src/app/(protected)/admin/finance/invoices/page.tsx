"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";

import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import {
  AdminFilterSelect,
  AdminPage,
  AdminPageHeader,
  AdminSearchInput,
  AdminStatusBadge,
  AdminToolbar,
  adminPrimaryButton,
} from "../../_components/AdminUI";
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  INVOICE_STATUS_LABELS,
  invoiceStatusTone,
  normalizeInvoice,
  type InvoiceDocumentType,
  type InvoiceRecord,
  type InvoiceStatus,
} from "../invoice-data";

type StatusFilter = "all" | InvoiceStatus;
type TypeFilter = "all" | InvoiceDocumentType;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "invoices")),
        (snapshot) => {
          setInvoices(
            snapshot.docs.map((entry) =>
              normalizeInvoice(
                entry.id,
                entry.data() as Record<string, unknown>,
              ),
            ),
          );
          setLoading(false);
          setLoadError("");
        },
        (error) => {
          console.error("Failed to load invoices", error);
          setInvoices([]);
          setLoading(false);
          setLoadError("Invoice records could not be loaded.");
        },
      ),
    [],
  );

  const visibleInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices
      .filter((invoice) => {
        if (status !== "all" && invoice.status !== status) return false;
        if (type !== "all" && invoice.type !== type) return false;
        if (
          term &&
          ![
            invoice.invoiceNumber,
            invoice.clientName,
            invoice.clientEmail,
            invoice.orderId,
          ].some((value) => value.toLowerCase().includes(term))
        ) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.issueDate.localeCompare(left.issueDate));
  }, [invoices, search, status, type]);

  const summary = useMemo(() => {
    const issued = invoices.filter(
      (invoice) => invoice.type === "invoice" && invoice.status === "issued",
    );
    const paid = invoices.filter(
      (invoice) => invoice.type === "invoice" && invoice.status === "paid",
    );
    const creditNotes = invoices.filter(
      (invoice) => invoice.type === "credit_note",
    );
    return {
      outstanding: issued.reduce((total, invoice) => total + invoice.grossTotal, 0),
      paid: paid.reduce((total, invoice) => total + invoice.grossTotal, 0),
      credited: creditNotes.reduce(
        (total, invoice) => total + invoice.grossTotal,
        0,
      ),
      count: invoices.length,
    };
  }, [invoices]);

  return (
    <AdminShell active="finance">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Accounts receivable"
          title="Invoices"
          description="Issue, track and download invoices, refunds and credit notes."
          actions={
            <Link href="/admin/finance/invoices/new" className={adminPrimaryButton}>
              Create invoice
            </Link>
          }
        />

        <section className="grid divide-y divide-[#e2d9cf] border-y border-[#e2d9cf] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <Summary label="Documents" value={String(summary.count)} detail="Invoices and credits" />
          <Summary
            label="Outstanding"
            value={formatInvoiceMoney(summary.outstanding)}
            detail="Awaiting payment"
            tone="warning"
          />
          <Summary
            label="Paid"
            value={formatInvoiceMoney(summary.paid)}
            detail="Fully paid invoices"
            tone="success"
          />
          <Summary
            label="Credits issued"
            value={formatInvoiceMoney(summary.credited)}
            detail="Credit-note value"
          />
        </section>

        <section className="overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
          <AdminToolbar>
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search invoice, client or order"
              label="Search invoices"
            />
            <AdminFilterSelect
              label="Filter by document type"
              value={type}
              onChange={(value) => setType(value as TypeFilter)}
            >
              <option value="all">All documents</option>
              <option value="invoice">Invoices</option>
              <option value="credit_note">Credit notes</option>
            </AdminFilterSelect>
            <AdminFilterSelect
              label="Filter by invoice status"
              value={status}
              onChange={(value) => setStatus(value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </AdminFilterSelect>
          </AdminToolbar>

          {loading ? (
            <State message="Loading invoice records…" />
          ) : loadError ? (
            <State message={loadError} error />
          ) : visibleInvoices.length ? (
            <>
              <div className="hidden grid-cols-[minmax(12rem,1fr)_9rem_8rem_9rem_8rem] gap-4 border-y border-[#e5ddd5] bg-[#f8f5f1] px-4 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#81746a] md:grid">
                <span>Document</span>
                <span>Issued / due</span>
                <span>Status</span>
                <span className="text-right">Net / VAT</span>
                <span className="text-right">Gross</span>
              </div>
              <div className="divide-y divide-[#ebe3dc]">
                {visibleInvoices.map((invoice) => (
                  <Link
                    href={`/admin/finance/invoices/${invoice.id}`}
                    key={invoice.id}
                    className="grid gap-3 px-4 py-4 transition hover:bg-[#faf7f3] md:grid-cols-[minmax(12rem,1fr)_9rem_8rem_9rem_8rem] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#342a24]">
                          {invoice.invoiceNumber}
                        </p>
                        <span className="rounded-full bg-[#f1ebe5] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#725f52]">
                          {invoice.type === "credit_note" ? "Credit note" : "Invoice"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-[#766960]">
                        {invoice.clientName || invoice.clientEmail || "Client not recorded"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#51443c]">
                        {formatInvoiceDate(invoice.issueDate)}
                      </p>
                      <p className="mt-1 text-[10px] text-[#8a7d74]">
                        Due {formatInvoiceDate(invoice.dueDate)}
                      </p>
                    </div>
                    <div>
                      <AdminStatusBadge tone={invoiceStatusTone(invoice.status)}>
                        {INVOICE_STATUS_LABELS[invoice.status]}
                      </AdminStatusBadge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium tabular-nums text-[#51443c]">
                        {formatInvoiceMoney(invoice.netTotal, invoice.currency)}
                      </p>
                      <p className="mt-1 text-[10px] tabular-nums text-[#8a7d74]">
                        VAT {formatInvoiceMoney(invoice.vatTotal, invoice.currency)}
                      </p>
                    </div>
                    <p className="text-right font-semibold tabular-nums text-[#342a24]">
                      {formatInvoiceMoney(invoice.grossTotal, invoice.currency)}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <State message="No invoices match this view." />
          )}
        </section>
      </AdminPage>
    </AdminShell>
  );
}

function Summary({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-[#8b5e28]"
      : tone === "success"
        ? "text-[#35633c]"
        : "text-[#2c241f]";
  return (
    <div className="px-3 py-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#81746a]">
        {label}
      </p>
      <p className={`mt-1 font-serif text-xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] text-[#8a7d74]">{detail}</p>
    </div>
  );
}

function State({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div
      className={`border-t border-[#e5ddd5] px-5 py-12 text-center text-sm ${
        error ? "text-[#8c3c2d]" : "text-[#766960]"
      }`}
      role={error ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
