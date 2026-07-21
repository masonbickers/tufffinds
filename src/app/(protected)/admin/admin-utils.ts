import type {
  ClientArchive,
  ClientOnboardingAdmin,
  ClientProfile,
  FirestoreTimestampValue,
  ManagedAdminClient,
  RequestStatus,
} from "./admin-types";

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

type ClientDocumentData = {
  adminNotes?: unknown;
  archive?: Partial<Record<keyof ClientArchive, unknown>> | null;
  archived?: unknown;
  createdAt?: FirestoreTimestampValue;
  email?: unknown;
  fullName?: unknown;
  onboardingAdmin?: Partial<Record<keyof ClientOnboardingAdmin, unknown>> | null;
  onboardingCompleted?: unknown;
  phoneNumber?: unknown;
  phoneNumberNormalized?: unknown;
  profile?: Partial<ClientProfile> | null;
  updatedAt?: FirestoreTimestampValue;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function parseAdminClient(
  id: string,
  data: ClientDocumentData,
): ManagedAdminClient {
  const emptyProfile = getEmptyProfile();
  const profile = data.profile ?? {};
  const fallbackName = text(profile.fullName) || text(data.fullName);
  const fallbackPhone = text(profile.phoneNumber) || text(data.phoneNumber);
  const archive = data.archive ?? {};
  const onboardingAdmin = data.onboardingAdmin ?? {};

  return {
    id,
    adminNotes: text(data.adminNotes),
    archived: data.archived === true,
    archive: {
      archivedAt: normalizeTimestamp(archive.archivedAt as FirestoreTimestampValue),
      archivedByUid: text(archive.archivedByUid),
      reason: text(archive.reason),
      restoredAt: normalizeTimestamp(archive.restoredAt as FirestoreTimestampValue),
      restoredByUid: text(archive.restoredByUid),
    },
    email: text(data.email),
    fullName: fallbackName,
    phoneNumber: fallbackPhone,
    phoneNumberNormalized: text(data.phoneNumberNormalized),
    onboardingCompleted: data.onboardingCompleted === true,
    onboardingAdmin: {
      completedAt: normalizeTimestamp(
        onboardingAdmin.completedAt as FirestoreTimestampValue,
      ),
      completedByUid: text(onboardingAdmin.completedByUid),
      overrideReason: text(onboardingAdmin.overrideReason),
      overriddenMissingFields: textList(onboardingAdmin.overriddenMissingFields),
      reopenedAt: normalizeTimestamp(
        onboardingAdmin.reopenedAt as FirestoreTimestampValue,
      ),
      reopenedByUid: text(onboardingAdmin.reopenedByUid),
    },
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
    profile: {
      ...emptyProfile,
      ...profile,
      fullName: text(profile.fullName) || fallbackName,
      phoneNumber: text(profile.phoneNumber) || fallbackPhone,
      clothingSizes: {
        ...emptyProfile.clothingSizes,
        ...(profile.clothingSizes ?? {}),
      },
      shippingAddress: {
        ...emptyProfile.shippingAddress,
        ...(profile.shippingAddress ?? {}),
      },
      stylePreferences: textList(profile.stylePreferences),
      favoriteBrands: textList(profile.favoriteBrands),
      dislikedBrands: textList(profile.dislikedBrands),
      shoppingPriorities: textList(profile.shoppingPriorities),
      contactPreferences: textList(profile.contactPreferences),
    },
  };
}

export function getMissingOnboardingFields(client: ManagedAdminClient) {
  const fields: string[] = [];
  const address = client.profile.shippingAddress;

  if (!client.fullName.trim()) fields.push("Full name");
  if (!isValidEmail(client.email)) fields.push("Valid email address");
  if (!isValidPhone(client.phoneNumber)) fields.push("Valid phone number");
  if (!address.line1.trim()) fields.push("Shipping address line 1");
  if (!address.city.trim()) fields.push("Shipping city");
  if (!address.postcode.trim()) fields.push("Shipping postcode");
  if (!address.country.trim()) fields.push("Shipping country");

  return fields;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 254;
}

export function isValidPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return (
    trimmed.length >= 3 &&
    trimmed.length <= 40 &&
    digits.length >= 3 &&
    /^[+\d\s().-]+$/.test(trimmed)
  );
}

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}
