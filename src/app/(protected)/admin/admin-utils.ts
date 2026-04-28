import type { FirestoreTimestampValue, RequestStatus } from "./admin-types";

export function normalizeTimestamp(value?: FirestoreTimestampValue) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.toDate().toISOString();
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