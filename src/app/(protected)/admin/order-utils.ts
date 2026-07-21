import type {
  AdminOrder,
  Currency,
  FirestoreTimestampValue,
  OrderStatus,
  OrderWorkflow,
  QualityCheckStatus,
  RefundStatus,
} from "./admin-types";
import { normalizeTimestamp } from "./admin-utils";

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ["invoice_sent"],
  invoice_sent: ["created", "paid"],
  paid: ["invoice_sent", "purchased"],
  purchased: ["paid", "quality_check"],
  quality_check: ["purchased", "dispatched"],
  dispatched: ["quality_check", "delivered"],
  delivered: ["dispatched", "closed"],
  closed: [],
  cancelled: [],
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "created",
  "invoice_sent",
  "paid",
  "purchased",
  "quality_check",
  "dispatched",
  "delivered",
  "closed",
  "cancelled",
];

export function getEmptyOrderWorkflow(): OrderWorkflow {
  return {
    cancellation: {
      cancelledAt: null,
      previousStatus: null,
      reason: "",
    },
    fulfilment: {
      deliveredDate: "",
      dispatchDate: "",
      expectedDeliveryDate: "",
      noTrackingConfirmed: false,
      qualityCheckNotes: "",
      qualityCheckStatus: "pending",
      qualityCheckedAt: null,
    },
    payment: {
      invoiceAmount: null,
      invoiceDate: "",
      paidAmount: null,
      paymentDate: "",
      paymentNotes: "",
      paymentReference: "",
    },
    purchase: {
      purchaseDate: "",
      purchaseNotes: "",
      purchaseWithoutReferenceConfirmed: false,
      supplierContact: "",
      supplierReference: "",
    },
    refund: {
      amount: null,
      date: "",
      notes: "",
      reference: "",
      status: "not_required",
    },
  };
}

export function normalizeOrderWorkflow(
  value?: Partial<OrderWorkflow>,
): OrderWorkflow {
  const empty = getEmptyOrderWorkflow();

  return {
    cancellation: { ...empty.cancellation, ...(value?.cancellation ?? {}) },
    fulfilment: {
      ...empty.fulfilment,
      ...(value?.fulfilment ?? {}),
      qualityCheckStatus: isQualityCheckStatus(
        value?.fulfilment?.qualityCheckStatus,
      )
        ? value.fulfilment.qualityCheckStatus
        : "pending",
    },
    payment: { ...empty.payment, ...(value?.payment ?? {}) },
    purchase: { ...empty.purchase, ...(value?.purchase ?? {}) },
    refund: {
      ...empty.refund,
      ...(value?.refund ?? {}),
      status: isRefundStatus(value?.refund?.status)
        ? value.refund.status
        : "not_required",
    },
  };
}

export function parseAdminOrder(
  id: string,
  data: Record<string, unknown>,
): AdminOrder {
  return {
    id,
    approvedOptionId: stringValue(data.approvedOptionId),
    brand: stringValue(data.brand),
    clientEmail: stringValue(data.clientEmail),
    clientId: stringValue(data.clientId),
    clientName: stringValue(data.clientName),
    clientPhone: stringValue(data.clientPhone),
    colour: stringValue(data.colour),
    costPrice: numberValue(data.costPrice),
    courier: stringValue(data.courier),
    createdAt: normalizeTimestamp(data.createdAt as FirestoreTimestampValue),
    currency: isCurrency(data.currency) ? data.currency : "GBP",
    invoiceNumber: stringValue(data.invoiceNumber),
    invoiceUrl: stringValue(data.invoiceUrl),
    item: stringValue(data.item),
    notes: stringValue(data.notes),
    orderWorkflow: normalizeOrderWorkflow(
      data.orderWorkflow as Partial<OrderWorkflow> | undefined,
    ),
    paymentMethod: stringValue(data.paymentMethod),
    requestId: stringValue(data.requestId),
    salePrice: numberValue(data.salePrice),
    size: stringValue(data.size),
    status: isOrderStatus(data.status) ? data.status : "created",
    supplier: stringValue(data.supplier),
    title: stringValue(data.title) || "Untitled order",
    trackingNumber: stringValue(data.trackingNumber),
    trackingUrl: stringValue(data.trackingUrl),
    updatedAt: normalizeTimestamp(data.updatedAt as FirestoreTimestampValue),
  };
}

export function isCurrency(value: unknown): value is Currency {
  return value === "GBP" || value === "EUR" || value === "USD";
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return [
    "created",
    "invoice_sent",
    "paid",
    "purchased",
    "quality_check",
    "dispatched",
    "delivered",
    "closed",
    "cancelled",
  ].includes(String(value));
}

export function isRefundStatus(value: unknown): value is RefundStatus {
  return ["not_required", "pending", "partial", "completed", "failed"].includes(
    String(value),
  );
}

export function isQualityCheckStatus(
  value: unknown,
): value is QualityCheckStatus {
  return ["pending", "passed", "issue"].includes(String(value));
}

export function getOrderNextAction(order: AdminOrder) {
  switch (order.status) {
    case "created":
      return "Prepare invoice";
    case "invoice_sent":
      return "Confirm payment";
    case "paid":
      return "Record supplier purchase";
    case "purchased":
      return "Complete quality check";
    case "quality_check":
      return "Prepare dispatch";
    case "dispatched":
      return "Confirm delivery";
    case "delivered":
      return "Close order";
    case "closed":
      return "No action";
    case "cancelled":
      return order.orderWorkflow.refund.status === "pending"
        ? "Complete refund"
        : "Review cancellation";
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
