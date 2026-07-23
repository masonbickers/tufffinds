export type LoadState = "loading" | "ready" | "error";

export type TimestampValue =
  | { kind: "valid"; value: Date }
  | { kind: "missing" }
  | { kind: "malformed" };

export type ContactValue = {
  kind: "valid" | "missing" | "malformed";
  value: string;
  href: string;
};

export type OnboardingState = "complete" | "incomplete" | "missing" | "malformed";
export type IssueSeverity = "attention" | "warning";
export type ClientGender = "male" | "female" | "non_binary" | "not_specified";

export type ClientIssue = {
  editable: boolean;
  field: string;
  message: string;
  severity: IssueSeverity;
};

export type ManagedAddress = {
  firstName: string;
  lastName: string;
  country: string;
  line1: string;
  line2: string;
  company: string;
  city: string;
  postcode: string;
  phone: string;
};

export type ManagedProfile = {
  budgetComfortRange: string;
  clothingSizes: Record<string, string>;
  contactPreferences: string[];
  dislikedBrands: string[];
  favoriteBrands: string[];
  fitNotes: string;
  fullName: string;
  gender: ClientGender;
  giftingPreferences: string;
  phoneNumber: string;
  shoppingPriorities: string[];
  shippingAddress: ManagedAddress;
  stylePreferences: string[];
};

export type ManagedClient = {
  id: string;
  navigable: boolean;
  name: string;
  identityLabel: string;
  email: ContactValue;
  phone: ContactValue;
  phoneNumberNormalized: string;
  country: string;
  onboardingState: OnboardingState;
  onboardingRaw: unknown;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  issues: ClientIssue[];
  profile: ManagedProfile;
  profileIsMalformed: boolean;
  addressIsMalformed: boolean;
  sizesIsMalformed: boolean;
  addressMissing: boolean;
  searchTerms: string[];
};

export type ClientEditValues = {
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: ClientGender;
  onboardingCompleted: "true" | "false";
  contactPreferences: string;
  stylePreferences: string;
  favoriteBrands: string;
  dislikedBrands: string;
  shoppingPriorities: string;
  budgetComfortRange: string;
  fitNotes: string;
  giftingPreferences: string;
  shippingAddress: ManagedAddress;
  clothingSizes: Record<string, string>;
};

export const EMPTY_ADDRESS: ManagedAddress = {
  firstName: "",
  lastName: "",
  country: "",
  line1: "",
  line2: "",
  company: "",
  city: "",
  postcode: "",
  phone: "",
};

const DEFAULT_SIZES: Record<string, string> = {
  tops: "",
  bottoms: "",
  dresses: "",
  shoes: "",
};

export function normalizeClientDocument(
  id: string,
  data: Record<string, unknown>,
): ManagedClient {
  const profileIsMalformed =
    data.profile !== undefined && data.profile !== null && !isRecord(data.profile);
  const profile = isRecord(data.profile) ? data.profile : {};
  const addressIsMalformed =
    profile.shippingAddress !== undefined &&
    profile.shippingAddress !== null &&
    !isRecord(profile.shippingAddress);
  const address = isRecord(profile.shippingAddress) ? profile.shippingAddress : {};
  const sizesIsMalformed =
    profile.clothingSizes !== undefined &&
    profile.clothingSizes !== null &&
    !isRecord(profile.clothingSizes);
  const sizes = isRecord(profile.clothingSizes) ? profile.clothingSizes : {};

  const profileName = readString(profile.fullName);
  const topLevelName = readString(data.fullName);
  const name = profileName || topLevelName;
  const profilePhone = readString(profile.phoneNumber);
  const topLevelPhone = readString(data.phoneNumber);
  const email = readEmail(data.email);
  const phoneRaw = profilePhone
    ? profile.phoneNumber
    : topLevelPhone
      ? data.phoneNumber
      : profile.phoneNumber ?? data.phoneNumber;
  const phone = readPhone(profilePhone || topLevelPhone, phoneRaw);
  const createdAt = readTimestamp(data.createdAt);
  const updatedAt = readTimestamp(data.updatedAt);
  const navigable = isSafeDocumentId(id);
  const onboardingState = readOnboardingState(data.onboardingCompleted);
  const managedAddress: ManagedAddress = {
    firstName: readString(address.firstName),
    lastName: readString(address.lastName),
    country: readString(address.country),
    line1: readString(address.line1),
    line2: readString(address.line2),
    company: readString(address.company),
    city: readString(address.city),
    postcode: readString(address.postcode),
    phone: readString(address.phone),
  };
  const addressMissing = ![
    managedAddress.line1,
    managedAddress.city,
    managedAddress.postcode,
    managedAddress.country,
  ].some(Boolean);
  const stylePreferences = readStringArray(profile.stylePreferences);
  const favoriteBrands = readStringArray(profile.favoriteBrands);
  const dislikedBrands = readStringArray(profile.dislikedBrands);
  const shoppingPriorities = readStringArray(profile.shoppingPriorities);
  const contactPreferences = readStringArray(profile.contactPreferences);
  const gender = readClientGender(profile.gender ?? data.gender);
  const clothingSizes = Object.fromEntries(
    Object.entries({ ...DEFAULT_SIZES, ...sizes }).map(([key, value]) => [
      key,
      readString(value),
    ]),
  );
  const issues: ClientIssue[] = [
    !navigable
      ? issue("Client UID", "The client document ID is malformed and requires a separate authentication review.", false, "attention")
      : null,
    !name ? issue("Name", "Client name is missing.", true, "attention") : null,
    hasMalformedString(profile.fullName) || hasMalformedString(data.fullName)
      ? issue("Name", "A stored client name has an unsupported value type.", true, "attention")
      : null,
    email.kind === "missing" ? issue("Email", "Client email is missing.", true, "attention") : null,
    email.kind === "malformed" ? issue("Email", "Client email is invalid or malformed.", true, "attention") : null,
    phone.kind === "malformed" ? issue("Phone", "Client phone is invalid or malformed.", true, "attention") : null,
    onboardingState === "missing"
      ? issue("Onboarding", "Onboarding state is missing.", true, "warning")
      : null,
    onboardingState === "malformed"
      ? issue("Onboarding", `Onboarding state has an unsupported value (${safeRawValue(data.onboardingCompleted)}).`, true, "attention")
      : null,
    profileIsMalformed
      ? issue("Profile", "The stored profile is malformed; edit mode is disabled to avoid overwriting it.", false, "attention")
      : null,
    addressIsMalformed
      ? issue("Shipping address", "The stored shipping address is malformed.", false, "attention")
      : null,
    addressMissing
      ? issue("Shipping address", "No usable shipping address is stored.", true, "warning")
      : null,
    sizesIsMalformed
      ? issue("Sizing", "The stored clothing sizes are malformed.", false, "warning")
      : null,
    profileName && topLevelName && profileName !== topLevelName
      ? issue("Name", "Profile and top-level client names differ.", true, "warning")
      : null,
    profilePhone && topLevelPhone && profilePhone !== topLevelPhone
      ? issue("Phone", "Profile and top-level phone numbers differ.", true, "warning")
      : null,
    createdAt.kind !== "valid"
      ? issue("Created date", "Created timestamp is missing or malformed.", false, "warning")
      : null,
    updatedAt.kind !== "valid"
      ? issue("Updated date", "Updated timestamp is missing or malformed.", false, "warning")
      : null,
  ].filter((value): value is ClientIssue => value !== null);

  const identityLabel = name || email.value || phone.value || "Name and contact missing";

  return {
    id,
    navigable,
    name,
    identityLabel,
    email,
    phone,
    phoneNumberNormalized: readString(data.phoneNumberNormalized),
    country: managedAddress.country,
    onboardingState,
    onboardingRaw: data.onboardingCompleted,
    createdAt,
    updatedAt,
    issues,
    profileIsMalformed,
    addressIsMalformed,
    sizesIsMalformed,
    addressMissing,
    profile: {
      budgetComfortRange: readString(profile.budgetComfortRange),
      clothingSizes,
      contactPreferences,
      dislikedBrands,
      favoriteBrands,
      fitNotes: readString(profile.fitNotes),
      fullName: profileName || name,
      gender,
      giftingPreferences: readString(profile.giftingPreferences),
      phoneNumber: profilePhone || phone.value,
      shoppingPriorities,
      shippingAddress: managedAddress,
      stylePreferences,
    },
    searchTerms: [
      id,
      name,
      profileName,
      topLevelName,
      email.value,
      phone.value,
      managedAddress.country,
      gender,
      ...stylePreferences,
      ...favoriteBrands,
    ].filter(Boolean),
  };
}

export function editValuesFromClient(client: ManagedClient): ClientEditValues {
  return {
    fullName: client.name,
    email: client.email.value,
    phoneNumber: client.phone.value,
    gender: client.profile.gender,
    onboardingCompleted:
      client.onboardingState === "complete" ? "true" : "false",
    contactPreferences: client.profile.contactPreferences.join(", "),
    stylePreferences: client.profile.stylePreferences.join(", "),
    favoriteBrands: client.profile.favoriteBrands.join(", "),
    dislikedBrands: client.profile.dislikedBrands.join(", "),
    shoppingPriorities: client.profile.shoppingPriorities.join(", "),
    budgetComfortRange: client.profile.budgetComfortRange,
    fitNotes: client.profile.fitNotes,
    giftingPreferences: client.profile.giftingPreferences,
    shippingAddress: { ...client.profile.shippingAddress },
    clothingSizes: { ...client.profile.clothingSizes },
  };
}

export function validateClientEdit(values: ClientEditValues) {
  const errors: Record<string, string> = {};
  const name = values.fullName.trim();
  const email = values.email.trim().toLowerCase();
  const phone = values.phoneNumber.trim();
  if (!name) errors.fullName = "Enter the client’s name.";
  else if (name.length > 120) errors.fullName = "Keep the name to 120 characters or fewer.";
  if (!email) errors.email = "Enter the client’s email address.";
  else if (!isValidEmailAddress(email)) errors.email = "Enter a valid email address.";
  if (phone && readPhone(phone, phone).kind !== "valid") {
    errors.phoneNumber = "Enter a valid phone number containing 7 to 15 digits.";
  }
  if (values.onboardingCompleted !== "true" && values.onboardingCompleted !== "false") {
    errors.onboardingCompleted = "Choose a supported onboarding state.";
  }
  if (!["male", "female", "non_binary", "not_specified"].includes(values.gender)) {
    errors.gender = "Choose a supported gender.";
  }
  return { errors, name, email, phone };
}

export function clientGenderLabel(value: ClientGender) {
  if (value === "male") return "Male";
  if (value === "female") return "Female";
  if (value === "non_binary") return "Non-binary";
  return "Not specified";
}

export function parseListInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizePhoneForStorage(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/\D/g, "")}`;
}

export function whatsappHref(value: string) {
  const digits = normalizePhoneForStorage(value).replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function effectiveTimestamp(client: ManagedClient) {
  const updated = validTimestamp(client.updatedAt);
  if (updated) return { label: "Updated", value: updated };
  const created = validTimestamp(client.createdAt);
  return { label: created ? "Created" : "Updated", value: created };
}

export function validTimestamp(value: TimestampValue) {
  return value.kind === "valid" ? value.value : null;
}

export function formatDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value)
    : "Unavailable";
}

export function onboardingLabel(state: OnboardingState) {
  if (state === "complete") return "Onboarded";
  if (state === "incomplete") return "Incomplete";
  if (state === "missing") return "State missing";
  return "State malformed";
}

export function onboardingTone(state: OnboardingState) {
  if (state === "complete") return "success" as const;
  if (state === "incomplete") return "warning" as const;
  return "danger" as const;
}

export function readTimestamp(value: unknown): TimestampValue {
  if (value === undefined || value === null || value === "") return { kind: "missing" };
  try {
    let date: Date | null = null;
    if (value instanceof Date) date = value;
    else if (typeof value === "string" || typeof value === "number") date = new Date(value);
    else if (isRecord(value) && typeof value.toDate === "function") date = (value.toDate as () => Date)();
    else if (isRecord(value)) {
      const seconds = typeof value.seconds === "number" ? value.seconds : typeof value._seconds === "number" ? value._seconds : null;
      const nanoseconds = typeof value.nanoseconds === "number" ? value.nanoseconds : typeof value._nanoseconds === "number" ? value._nanoseconds : 0;
      if (seconds !== null) date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
    }
    return date && !Number.isNaN(date.getTime()) ? { kind: "valid", value: date } : { kind: "malformed" };
  } catch {
    return { kind: "malformed" };
  }
}

export function readUnreadCount(...values: unknown[]) {
  let sawValue = false;
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    sawValue = true;
    const count = Number(value);
    if (Number.isFinite(count) && count >= 0) {
      return { kind: "valid" as const, value: Math.floor(count) };
    }
  }
  return sawValue
    ? { kind: "malformed" as const }
    : { kind: "missing" as const };
}

export function isSafeDocumentId(value: string) {
  return Boolean(value) && value !== "." && value !== ".." && !value.includes("/") && new TextEncoder().encode(value).length <= 1500;
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function issue(
  field: string,
  message: string,
  editable: boolean,
  severity: IssueSeverity,
): ClientIssue {
  return { field, message, editable, severity };
}

function readOnboardingState(value: unknown): OnboardingState {
  if (value === true) return "complete";
  if (value === false) return "incomplete";
  if (value === undefined || value === null || value === "") return "missing";
  return "malformed";
}

function readClientGender(value: unknown): ClientGender {
  const normalized = readString(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "male" || normalized === "man") return "male";
  if (normalized === "female" || normalized === "woman") return "female";
  if (normalized === "non_binary" || normalized === "nonbinary") return "non_binary";
  return "not_specified";
}

function hasMalformedString(value: unknown) {
  return value !== undefined && value !== null && typeof value !== "string";
}

function readEmail(value: unknown): ContactValue {
  if (value === undefined || value === null || value === "") return { kind: "missing", value: "", href: "" };
  if (typeof value !== "string") return { kind: "malformed", value: "", href: "" };
  const email = value.trim();
  if (!email) return { kind: "missing", value: "", href: "" };
  if (!isValidEmailAddress(email)) return { kind: "malformed", value: email, href: "" };
  return { kind: "valid", value: email, href: `mailto:${email}` };
}

function isValidEmailAddress(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  const finalLabel = value.split("@").pop()?.split(".").pop()?.toLowerCase();
  return finalLabel !== "invalid" && finalLabel !== "localhost";
}

function readPhone(displayValue: string, rawValue: unknown): ContactValue {
  if (rawValue === undefined || rawValue === null || rawValue === "") return { kind: "missing", value: "", href: "" };
  if (typeof rawValue !== "string") return { kind: "malformed", value: "", href: "" };
  const display = displayValue.trim();
  if (!display) return { kind: "missing", value: "", href: "" };
  if (!/^\+?[\d\s().-]+$/.test(display)) return { kind: "malformed", value: display, href: "" };
  const normalized = `${display.startsWith("+") ? "+" : ""}${display.replace(/\D/g, "")}`;
  const digitCount = normalized.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) return { kind: "malformed", value: display, href: "" };
  return { kind: "valid", value: display, href: `tel:${normalized}` };
}

function safeRawValue(value: unknown) {
  if (typeof value === "string") return value.slice(0, 40);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "unsupported type";
}
