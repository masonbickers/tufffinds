"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";

import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import { AdminPage, AdminPageHeader, AdminStatusBadge } from "../_components/AdminUI";
import { isOrderStatus, ORDER_STATUS_LABELS, orderStatusToneName } from "../admin-utils";
import type { OrderStatus } from "../admin-types";
import styles from "./finance.module.css";
import {
  addCalendarMonths,
  createVatSchedule,
  DEFAULT_VAT_SETTINGS,
  formatVatDate,
  parseDateInput,
  readVatSettings,
  VAT_SCHEME_LABELS,
  type VatSettings,
} from "./vat-settings";

type Period = "quarter" | "year" | "all";
type LoadState = "loading" | "ready" | "error";

type FinanceOrder = {
  id: string;
  clientName: string;
  title: string;
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  salePrice: number | null;
  costPrice: number | null;
  status: OrderStatus | null;
  createdAt: Date | null;
};

const PERIOD_LABELS: Record<Period, string> = {
  quarter: "This quarter",
  year: "This year",
  all: "All time",
};

const SETTLED_STATUSES = new Set<OrderStatus>([
  "paid",
  "purchased",
  "quality_check",
  "dispatched",
  "delivered",
  "closed",
]);

export default function FinancePage() {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [period, setPeriod] = useState<Period>("quarter");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [vatSettings, setVatSettings] =
    useState<VatSettings>(DEFAULT_VAT_SETTINGS);
  const [vatSettingsReady, setVatSettingsReady] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        collection(db, "orders"),
        (snapshot) => {
          setOrders(
            snapshot.docs.map((entry) =>
              normalizeOrder(entry.id, entry.data() as Record<string, unknown>),
            ),
          );
          setLoadState("ready");
        },
        (error) => {
          console.error("Failed to load finance orders", error);
          setOrders([]);
          setLoadState("error");
        },
      ),
    [],
  );

  useEffect(
    () =>
      onSnapshot(
        doc(db, "workspace_settings", "vat"),
        (snapshot) => {
          setVatSettings(
            snapshot.exists()
              ? readVatSettings(snapshot.data() as Record<string, unknown>)
              : DEFAULT_VAT_SETTINGS,
          );
          setVatSettingsReady(true);
        },
        (error) => {
          console.error("Failed to load VAT settings", error);
          setVatSettings(DEFAULT_VAT_SETTINGS);
          setVatSettingsReady(true);
        },
      ),
    [],
  );

  const periodStart = useMemo(() => getPeriodStart(period), [period]);
  const periodOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          !periodStart || (order.createdAt && order.createdAt >= periodStart),
      ),
    [orders, periodStart],
  );

  const summary = useMemo(() => {
    const gbpOrders = periodOrders.filter(
      (order) => order.currency === "GBP" && order.salePrice !== null,
    );
    const paidOrders = gbpOrders.filter(
      (order) => order.status && SETTLED_STATUSES.has(order.status),
    );
    const reportableOrders =
      vatSettings.scheme === "cash"
        ? paidOrders
        : gbpOrders.filter(
            (order) =>
              order.status === "invoice_sent" ||
              (order.status && SETTLED_STATUSES.has(order.status)),
          );
    const sales = reportableOrders.reduce(
      (total, order) => total + (order.salePrice ?? 0),
      0,
    );
    const costs = reportableOrders.reduce(
      (total, order) => total + (order.costPrice ?? 0),
      0,
    );
    const standardVatRate = 0.2;
    const vatFactor =
      vatSettings.priceBasis === "inclusive"
        ? standardVatRate / (1 + standardVatRate)
        : standardVatRate;
    const outputVat =
      vatSettings.scheme === "flat_rate"
        ? sales *
          (vatSettings.priceBasis === "exclusive" ? 1 + standardVatRate : 1) *
          ((vatSettings.flatRatePercentage ?? 0) / 100)
        : sales * vatFactor;
    const inputVat =
      vatSettings.scheme === "flat_rate" ? 0 : costs * vatFactor;
    const vatDue =
      vatSettings.scheme === "flat_rate"
        ? outputVat
        : Math.max(0, outputVat - inputVat);
    const grossProfit = sales - costs;
    const unpaid = gbpOrders
      .filter((order) => order.status === "invoice_sent")
      .reduce((total, order) => total + (order.salePrice ?? 0), 0);

    return {
      sales,
      costs,
      outputVat,
      inputVat,
      vatDue,
      grossProfit,
      unpaid,
      reportableCount: reportableOrders.length,
      unpaidCount: gbpOrders.filter((order) => order.status === "invoice_sent").length,
      missingFinanceData: periodOrders.filter(
        (order) =>
          order.salePrice === null ||
          !order.currency ||
          (order.currency === "GBP" && order.costPrice === null),
      ).length,
      excludedCurrencyCount: periodOrders.filter(
        (order) => order.currency && order.currency !== "GBP",
      ).length,
    };
  }, [periodOrders, vatSettings]);

  const recentInvoices = useMemo(
    () =>
      periodOrders
        .filter((order) => order.invoiceNumber || order.salePrice !== null)
        .sort(
          (left, right) =>
            (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0),
        )
        .slice(0, 6),
    [periodOrders],
  );

  const vatSchedule = useMemo(
    () => createVatSchedule(vatSettings),
    [vatSettings],
  );
  const vatDeadline = vatSchedule[0]?.deadline ?? "";
  const vatDeadlineDate = parseDateInput(vatDeadline);
  const isLoading = loadState === "loading" || !vatSettingsReady;

  function exportCsv() {
    const headings = [
      "Order",
      "Invoice",
      "Client",
      "Date",
      "Status",
      "Currency",
      "Sale",
      "Cost",
    ];
    const rows = periodOrders.map((order) => [
      order.title || order.id,
      order.invoiceNumber,
      order.clientName,
      order.createdAt?.toISOString().slice(0, 10) ?? "",
      order.status ? ORDER_STATUS_LABELS[order.status] : "",
      order.currency,
      order.salePrice ?? "",
      order.costPrice ?? "",
    ]);
    const csv = [headings, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\n");
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `tufffinds-finance-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <AdminShell active="finance">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Money overview"
          title="Finance"
          description="A clear view of sales, VAT, invoices and the amounts to set aside."
          actions={
            <div className={styles.headerActions}>
              <Link
                href="/admin/finance/invoices/new"
                className={styles.createInvoiceButton}
              >
                Create invoice
              </Link>
              <Link href="/admin/finance/settings" className={styles.settingsButton}>
                VAT settings
              </Link>
              <label className={styles.periodSelect}>
                <span className="sr-only">Reporting period</span>
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as Period)}
                  aria-label="Reporting period"
                >
                  {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.exportButton}
                onClick={exportCsv}
                disabled={!periodOrders.length}
              >
                Export CSV
              </button>
            </div>
          }
        />

        {loadState === "error" ? (
          <div className={styles.errorBanner} role="alert">
            Finance data could not be loaded. Check the connection and try again.
          </div>
        ) : null}

        {vatSettingsReady && !vatSettings.vatNumber ? (
          <div className={styles.setupBanner}>
            <div>
              <strong>Complete the VAT setup</strong>
              <span>
                Add the VAT number, scheme and current filing period to make these
                estimates relevant to Tufffinds.
              </span>
            </div>
            <Link href="/admin/finance/settings">Set up VAT <span aria-hidden="true">→</span></Link>
          </div>
        ) : null}

        <section className={styles.heroGrid} aria-label="Finance summary">
          <article className={styles.salesCard}>
            <div className={styles.cardTopline}>
              <p className={styles.cardEyebrow}>Sales collected</p>
              <span className={styles.liveMarker}>
                <span aria-hidden="true" /> Live from orders
              </span>
            </div>
            <p className={styles.heroValue}>
              {isLoading ? "—" : formatMoney(summary.sales)}
            </p>
            <div className={styles.salesMeta}>
              <p>
                <span>{summary.reportableCount}</span> reportable orders
              </p>
              <p>
                <span>{formatMoney(summary.grossProfit)}</span> gross profit
              </p>
            </div>
            <div className={styles.marginTrack} aria-hidden="true">
              <span
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, summary.sales ? (summary.grossProfit / summary.sales) * 100 : 0),
                  )}%`,
                }}
              />
            </div>
            <p className={styles.marginCaption}>
              {summary.sales
                ? `${Math.round((summary.grossProfit / summary.sales) * 100)}% gross margin`
                : "Margin appears when paid sales are recorded"}
            </p>
          </article>

          <article className={styles.vatCard}>
            <div className={styles.cardTopline}>
              <p className={styles.cardEyebrow}>Estimated VAT to set aside</p>
              <span className={styles.periodPill}>
                {VAT_SCHEME_LABELS[vatSettings.scheme]}
              </span>
            </div>
            <p className={styles.vatValue}>
              {isLoading ? "—" : formatMoney(summary.vatDue)}
            </p>
            <dl className={styles.vatBreakdown}>
              <div>
                <dt>
                  {vatSettings.scheme === "flat_rate"
                    ? "Flat-rate VAT on turnover"
                    : "Output VAT on sales"}
                </dt>
                <dd>{formatMoney(summary.outputVat)}</dd>
              </div>
              <div>
                <dt>
                  {vatSettings.scheme === "flat_rate"
                    ? "Input VAT deduction"
                    : "Less input VAT on costs"}
                </dt>
                <dd>−{formatMoney(summary.inputVat)}</dd>
              </div>
            </dl>
            <p className={styles.assumption}>
              {vatSettings.scheme === "flat_rate"
                ? `Applies the saved ${vatSettings.flatRatePercentage ?? 0}% flat rate to reportable GBP turnover.`
                : `Uses the saved ${vatSettings.priceBasis === "inclusive" ? "VAT-inclusive" : "VAT-exclusive"} price treatment at the 20% standard rate.`}
            </p>
          </article>
        </section>

        <section className={styles.metricStrip} aria-label="Sales and invoice metrics">
          <Metric
            label="Sales collected"
            value={isLoading ? "—" : formatMoney(summary.sales)}
            detail="Paid and fulfilled orders"
            tone="positive"
          />
          <Metric
            label="Outstanding"
            value={isLoading ? "—" : formatMoney(summary.unpaid)}
            detail={`${summary.unpaidCount} invoice${summary.unpaidCount === 1 ? "" : "s"} awaiting payment`}
            tone={summary.unpaidCount ? "warning" : "neutral"}
          />
          <Metric
            label="Purchase costs"
            value={isLoading ? "—" : formatMoney(summary.costs)}
            detail="For paid and fulfilled orders"
          />
          <Metric
            label="Tax reserve"
            value={isLoading ? "—" : formatMoney(Math.max(0, summary.grossProfit) * 0.25)}
            detail="25% planning estimate"
          />
        </section>

        <div className={styles.lowerGrid}>
          <section className={styles.panel} aria-labelledby="invoice-heading">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Receivables</p>
                <h2 id="invoice-heading">Recent invoices</h2>
              </div>
              <Link href="/admin/finance/invoices" className={styles.textLink}>
                View all invoices <span aria-hidden="true">→</span>
              </Link>
            </div>

            {isLoading ? (
              <div className={styles.emptyState}>Loading invoices…</div>
            ) : recentInvoices.length ? (
              <div className={styles.invoiceList}>
                {recentInvoices.map((invoice) => (
                  <Link
                    href={
                      invoice.invoiceId
                        ? `/admin/finance/invoices/${encodeURIComponent(invoice.invoiceId)}`
                        : `/admin/orders/${encodeURIComponent(invoice.id)}`
                    }
                    className={styles.invoiceRow}
                    key={invoice.id}
                  >
                    <div className={styles.invoiceIdentity}>
                      <span className={styles.invoiceIcon} aria-hidden="true">
                        {invoice.invoiceNumber ? invoice.invoiceNumber.slice(-2) : "—"}
                      </span>
                      <div>
                        <p>{invoice.invoiceNumber || "Invoice not numbered"}</p>
                        <span>{invoice.clientName || invoice.title || "Order"}</span>
                      </div>
                    </div>
                    <p className={styles.invoiceDate}>{formatDate(invoice.createdAt)}</p>
                    <div className={styles.invoiceStatus}>
                      {invoice.status ? (
                        <AdminStatusBadge tone={orderStatusToneName(invoice.status)}>
                          {invoice.status === "invoice_sent"
                            ? "Awaiting payment"
                            : ORDER_STATUS_LABELS[invoice.status]}
                        </AdminStatusBadge>
                      ) : (
                        <AdminStatusBadge>Unknown</AdminStatusBadge>
                      )}
                    </div>
                    <p className={styles.invoiceAmount}>
                      {formatOrderMoney(invoice.salePrice, invoice.currency)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                No invoices are recorded for this period yet.
              </div>
            )}
          </section>

          <aside className={styles.sideColumn} aria-label="Tax planning">
            <section className={`${styles.panel} ${styles.deadlinePanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Next deadline</p>
                  <h2>VAT return</h2>
                </div>
                <span className={styles.calendarMark} aria-hidden="true">
                  {vatDeadlineDate?.getDate() ?? "—"}
                </span>
              </div>
              <p className={styles.deadlineDate}>
                {vatDeadline ? formatVatDate(vatDeadline) : "Complete VAT settings"}
              </p>
              <p className={styles.deadlineCopy}>
                {vatSchedule[0]?.source === "confirmed"
                  ? "Confirmed deadline saved from the HMRC VAT account."
                  : "Calculated from the saved period end. Confirm the exact date in HMRC."}
              </p>
              <div className={styles.deadlineProgress}>
                <span>
                  <i style={{ width: `${getFilingPeriodProgress(vatSettings)}%` }} />
                </span>
                <p>
                  {vatDeadlineDate ? (
                    <>
                      <b>{daysUntil(vatDeadlineDate)} days</b> until filing
                    </>
                  ) : (
                    <Link href="/admin/finance/settings">Add filing period →</Link>
                  )}
                </p>
              </div>
            </section>

            <section className={`${styles.panel} ${styles.healthPanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.sectionEyebrow}>Record health</p>
                  <h2>Ready for review</h2>
                </div>
                <span
                  className={`${styles.healthScore} ${
                    summary.missingFinanceData ? styles.healthScoreWarning : ""
                  }`}
                >
                  {summary.missingFinanceData ? "Check" : "Good"}
                </span>
              </div>
              <ul className={styles.checkList}>
                <li>
                  <span className={summary.missingFinanceData ? styles.checkWarning : ""} />
                  <p>
                    <b>{summary.missingFinanceData}</b> orders missing price, cost or currency
                  </p>
                </li>
                <li>
                  <span className={summary.excludedCurrencyCount ? styles.checkWarning : ""} />
                  <p>
                    <b>{summary.excludedCurrencyCount}</b> non-GBP orders excluded from totals
                  </p>
                </li>
                <li>
                  <span />
                  <p>VAT estimate is clearly separated from collected sales</p>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </AdminPage>
    </AdminShell>
  );
}

function Metric({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  return (
    <div className={styles.metric}>
      <p>{label}</p>
      <strong className={styles[`metric_${tone}`]}>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function normalizeOrder(id: string, data: Record<string, unknown>): FinanceOrder {
  const rawStatus = readString(data.status);
  return {
    id,
    clientName: readString(data.clientName) || readString(data.clientEmail),
    title: readString(data.title) || readString(data.item),
    invoiceId: readString(data.invoiceId),
    invoiceNumber: readString(data.invoiceNumber),
    currency: readString(data.currency).toUpperCase(),
    salePrice: readMoney(data.salePrice),
    costPrice: readMoney(data.costPrice),
    status: isOrderStatus(rawStatus) ? rawStatus : null,
    createdAt: readDate(data.createdAt) || readDate(data.updatedAt),
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const date = toDate.call(value);
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }
  }
  return null;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatOrderMoney(value: number | null, currency: string) {
  if (value === null) return "Not recorded";
  if (!["GBP", "EUR", "USD"].includes(currency)) return `${value.toFixed(2)} ${currency}`.trim();
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) return "Date missing";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getPeriodStart(period: Period) {
  if (period === "all") return null;
  const now = new Date();
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}

function getFilingPeriodProgress(settings: VatSettings) {
  const end = parseDateInput(settings.currentPeriodEnd);
  if (!end) return 0;
  const months =
    settings.filingFrequency === "monthly"
      ? 1
      : settings.filingFrequency === "quarterly"
        ? 3
        : 12;
  const start = addCalendarMonths(end, -months);
  start.setDate(start.getDate() + 1);
  const now = new Date();
  return Math.max(
    0,
    Math.min(
      100,
      ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) *
        100,
    ),
  );
}

function daysUntil(value: Date) {
  return Math.max(0, Math.ceil((value.getTime() - Date.now()) / 86_400_000));
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
