import {
  ORDER_STATUSES,
  REQUEST_STATUSES,
  type FirestoreTimestampValue,
  type OrderStatus,
  type RequestStatus,
} from "./admin-types";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  created: "Created",
  invoice_sent: "Invoice sent",
  paid: "Paid",
  purchased: "Purchased",
  quality_check: "Quality check",
  dispatched: "Dispatched",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    ORDER_STATUSES.some((status) => status === value)
  );
}

export const ORDER_QUEUE_GROUPS = {
  needs_action: ["created", "paid", "purchased", "quality_check"],
  awaiting_payment: ["invoice_sent"],
  fulfilment: ["dispatched"],
  completed: ["delivered", "closed"],
  cancelled: ["cancelled"],
} as const satisfies Record<string, readonly OrderStatus[]>;

export type OrderQueueGroup = keyof typeof ORDER_QUEUE_GROUPS;

export const ORDER_QUEUE_GROUP_LABELS: Record<OrderQueueGroup, string> = {
  needs_action: "Needs action",
  awaiting_payment: "Awaiting payment",
  fulfilment: "Fulfilment",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const ORDER_NEXT_ACTIONS: Record<OrderStatus, string> = {
  created: "Prepare and send invoice",
  invoice_sent: "Await or record payment",
  paid: "Purchase the item",
  purchased: "Complete quality check",
  quality_check: "Prepare dispatch",
  dispatched: "Monitor delivery",
  delivered: "Close when complete",
  closed: "No further action",
  cancelled: "Order cancelled",
};

export function orderQueueGroup(
  status: OrderStatus,
): OrderQueueGroup | null {
  const group = (Object.keys(ORDER_QUEUE_GROUPS) as OrderQueueGroup[]).find(
    (candidate) =>
      ORDER_QUEUE_GROUPS[candidate].some((value) => value === status),
  );

  return group ?? null;
}

export function orderStatusToneName(
  status: OrderStatus | null,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "created") return "info";
  if (
    status === "invoice_sent" ||
    status === "paid" ||
    status === "purchased" ||
    status === "quality_check"
  ) {
    return "warning";
  }
  if (status === "dispatched" || status === "delivered") return "success";
  if (status === "cancelled") return "danger";
  return "neutral";
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  needs_info: "Needs information",
  sourcing: "Sourcing",
  options_sent: "Options sent",
  awaiting_client_approval: "Awaiting approval",
  approved: "Approved",
  invoice_sent: "Invoice sent",
  paid: "Paid",
  purchased: "Purchased",
  quality_check: "Quality check",
  dispatched: "Dispatched",
  delivered: "Delivered",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function isRequestStatus(value: unknown): value is RequestStatus {
  return (
    typeof value === "string" &&
    REQUEST_STATUSES.some((status) => status === value)
  );
}

export function isOpenRequestStatus(
  status: RequestStatus | null,
): status is RequestStatus {
  return (
    status !== null &&
    status !== "delivered" &&
    status !== "closed" &&
    status !== "cancelled"
  );
}

export function requestStatusToneName(
  status: RequestStatus | null,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "submitted" || status === "reviewing") return "info";
  if (status === "needs_info" || status === "invoice_sent") return "warning";
  if (
    status === "paid" ||
    status === "purchased" ||
    status === "quality_check" ||
    status === "dispatched" ||
    status === "delivered"
  ) {
    return "success";
  }
  if (status === "cancelled") return "danger";
  return "neutral";
}

export function normalizeTimestamp(value?: FirestoreTimestampValue) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();

  if ("toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date ? date.toISOString() : "";
  }

  const legacyValue = value as {
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
  };
  const seconds = legacyValue.seconds ?? legacyValue._seconds;
  const nanoseconds = legacyValue.nanoseconds ?? legacyValue._nanoseconds ?? 0;

  if (typeof seconds === "number") {
    return new Date(seconds * 1000 + nanoseconds / 1_000_000).toISOString();
  }

  return "";
}

export function formatDateTime(value: string) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatStatusLabel(value: string) {
  return value.replace(/[_-]/g, " ");
}

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function requestTone(status: RequestStatus) {
  switch (status) {
    case "needs_info":
      return "bg-[#F5E6C8] text-[#76561E]";

    case "submitted":
    case "reviewing":
      return "bg-[#DCEAF7] text-[#275073]";

    case "sourcing":
    case "options_sent":
    case "awaiting_client_approval":
      return "bg-[#EAE1F8] text-[#574276]";

    case "approved":
    case "invoice_sent":
      return "bg-[#F5E4D7] text-[#7E5130]";

    case "paid":
    case "purchased":
    case "quality_check":
    case "dispatched":
    case "delivered":
      return "bg-[#DDECDD] text-[#2F5A34]";

    case "closed":
    case "cancelled":
      return "bg-[#ECE7E1] text-[#65584E]";

    default:
      return "bg-[#ECE7E1] text-[#65584E]";
  }
}

export function getEmptyProfile() {
  return {
    budgetComfortRange: "",
    clothingSizes: {
      tops: "",
      bottoms: "",
      dresses: "",
      shoes: "",
    },
    contactPreferences: [],
    dislikedBrands: [],
    favoriteBrands: [],
    fitNotes: "",
    fullName: "",
    giftingPreferences: "",
    phoneNumber: "",
    shoppingPriorities: [],
    shippingAddress: {
      firstName: "",
      lastName: "",
      country: "",
      line1: "",
      line2: "",
      company: "",
      city: "",
      postcode: "",
      phone: "",
    },
    stylePreferences: [],
  };
}
