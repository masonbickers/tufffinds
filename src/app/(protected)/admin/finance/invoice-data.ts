export type InvoiceDocumentType = "invoice" | "credit_note";
export type InvoiceStatus =
  | "issued"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "credited";

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  unitNet: number;
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
};

export type InvoiceRefund = {
  id: string;
  date: string;
  amount: number;
  reason: string;
  recordedByEmail: string;
};

export type InvoiceRecord = {
  id: string;
  type: InvoiceDocumentType;
  invoiceNumber: string;
  sequence: number;
  status: InvoiceStatus;
  orderId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  issueDate: string;
  dueDate: string;
  paidDate: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  refundedTotal: number;
  creditedTotal: number;
  refunds: InvoiceRefund[];
  sourceInvoiceId: string;
  creditNoteIds: string[];
  reason: string;
  notes: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  issued: "Awaiting payment",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  credited: "Credited",
};

export function invoiceStatusTone(
  status: InvoiceStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "paid") return "success";
  if (status === "issued") return "warning";
  if (status === "partially_refunded") return "info";
  if (status === "refunded" || status === "credited") return "neutral";
  return "neutral";
}

export function calculateLineItem(
  item: Pick<InvoiceLineItem, "id" | "description" | "quantity" | "unitNet" | "vatRate">,
): InvoiceLineItem {
  const netAmount = roundMoney(item.quantity * item.unitNet);
  const vatAmount = roundMoney(netAmount * (item.vatRate / 100));
  return {
    ...item,
    netAmount,
    vatAmount,
    grossAmount: roundMoney(netAmount + vatAmount),
  };
}

export function calculateInvoiceTotals(lineItems: InvoiceLineItem[]) {
  const netTotal = roundMoney(
    lineItems.reduce((total, item) => total + item.netAmount, 0),
  );
  const vatTotal = roundMoney(
    lineItems.reduce((total, item) => total + item.vatAmount, 0),
  );
  return {
    netTotal,
    vatTotal,
    grossTotal: roundMoney(netTotal + vatTotal),
  };
}

export function normalizeInvoice(
  id: string,
  data: Record<string, unknown>,
): InvoiceRecord {
  const type = data.type === "credit_note" ? "credit_note" : "invoice";
  const status = isInvoiceStatus(data.status) ? data.status : "issued";
  const rawItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const lineItems = rawItems
    .filter(isRecord)
    .map((item, index) =>
      calculateLineItem({
        id: readString(item.id) || `line-${index + 1}`,
        description: readString(item.description) || "Item",
        quantity: readPositiveNumber(item.quantity, 1),
        unitNet: readNonNegativeNumber(item.unitNet, 0),
        vatRate: readNonNegativeNumber(item.vatRate, 0),
      }),
    );
  const computed = calculateInvoiceTotals(lineItems);
  const rawRefunds = Array.isArray(data.refunds) ? data.refunds : [];

  return {
    id,
    type,
    invoiceNumber: readString(data.invoiceNumber),
    sequence: readNonNegativeNumber(data.sequence, 0),
    status,
    orderId: readString(data.orderId),
    clientId: readString(data.clientId),
    clientName: readString(data.clientName),
    clientEmail: readString(data.clientEmail),
    clientAddress: readString(data.clientAddress),
    issueDate: readString(data.issueDate),
    dueDate: readString(data.dueDate),
    paidDate: readString(data.paidDate),
    currency: readString(data.currency) || "GBP",
    lineItems,
    netTotal: readNonNegativeNumber(data.netTotal, computed.netTotal),
    vatTotal: readNonNegativeNumber(data.vatTotal, computed.vatTotal),
    grossTotal: readNonNegativeNumber(data.grossTotal, computed.grossTotal),
    refundedTotal: readNonNegativeNumber(data.refundedTotal, 0),
    creditedTotal: readNonNegativeNumber(data.creditedTotal, 0),
    refunds: rawRefunds.filter(isRecord).map((refund, index) => ({
      id: readString(refund.id) || `refund-${index + 1}`,
      date: readString(refund.date),
      amount: readNonNegativeNumber(refund.amount, 0),
      reason: readString(refund.reason),
      recordedByEmail: readString(refund.recordedByEmail),
    })),
    sourceInvoiceId: readString(data.sourceInvoiceId),
    creditNoteIds: Array.isArray(data.creditNoteIds)
      ? data.creditNoteIds.filter((value): value is string => typeof value === "string")
      : [],
    reason: readString(data.reason),
    notes: readString(data.notes),
    createdAt: readDate(data.createdAt),
    updatedAt: readDate(data.updatedAt),
  };
}

export function formatInvoiceMoney(value: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`.trim();
  }
}

export function formatInvoiceDate(value: string) {
  if (!value) return "Not recorded";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function todayInputValue() {
  const now = new Date();
  return formatInputDate(now);
}

export function addDaysInput(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatInputDate(date);
}

export function createLineItem(
  description = "",
  unitNet = 0,
  vatRate = 20,
): InvoiceLineItem {
  return calculateLineItem({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description,
    quantity: 1,
    unitNet,
    vatRate,
  });
}

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return (
    typeof value === "string" &&
    ["issued", "paid", "partially_refunded", "refunded", "credited"].includes(
      value,
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNonNegativeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function readPositiveNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === "function") {
      const date = toDate.call(value);
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    }
  }
  return null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
