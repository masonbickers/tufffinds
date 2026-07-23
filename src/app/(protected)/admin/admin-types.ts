import type { Timestamp } from "firebase/firestore";

export type AdminSection = "dashboard" | "clients" | "requests" | "messages";

export type ShippingAddress = {
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

export type ClientProfile = {
  budgetComfortRange: string;
  clothingSizes: Record<string, string>;
  contactPreferences: string[];
  dislikedBrands: string[];
  favoriteBrands: string[];
  fitNotes: string;
  fullName: string;
  giftingPreferences: string;
  phoneNumber: string;
  shoppingPriorities: string[];
  shippingAddress: ShippingAddress;
  stylePreferences: string[];
};

export type AdminClient = {
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  onboardingCompleted: boolean;
  phoneNumber: string;
  phoneNumberNormalized: string;
  profile: ClientProfile;
  updatedAt: string;
};

export const REQUEST_STATUSES = [
  "submitted",
  "reviewing",
  "needs_info",
  "sourcing",
  "options_sent",
  "awaiting_client_approval",
  "approved",
  "invoice_sent",
  "paid",
  "purchased",
  "quality_check",
  "dispatched",
  "delivered",
  "closed",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const ORDER_STATUSES = [
  "created",
  "invoice_sent",
  "paid",
  "purchased",
  "quality_check",
  "dispatched",
  "delivered",
  "closed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type RequestReference = {
  id: string;
  label: string;
  type: "link" | "upload-placeholder";
  value: string;
};

export type RequestLinkedPreview = {
  description: string;
  href: string;
  id: string;
  title: string;
};

export type ActivityEvent = {
  actorName?: string;
  description?: string;
  id: string;
  label: string;
  meta?: string;
  statusLabel?: string;
  tone?: string;
  type: string;
};

export type RequestInvoice = {
  amount?: number;
  currency?: "GBP" | "EUR" | "USD";
  invoiceNumber?: string;
  invoiceUrl?: string;
  paymentMethod?: string;
  sentAt?: string | null;
  paidAt?: string | null;
};

export type RequestFulfilment = {
  supplier?: string;
  purchasePrice?: number;
  purchasedAt?: string | null;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
};

export type RequestDetail = {
  activitySummary: ActivityEvent[];
  assignedStylist?: string;
  categories: string[];
  createdDateLabel: string;
  deadlineLabel?: string;
  favoriteBrands: string[];
  href: string;
  id: string;
  invoice?: RequestInvoice;
  fulfilment?: RequestFulfilment;
  isMutable?: boolean;
  linkedEdits: RequestLinkedPreview[];
  linkedMessagesPreview: RequestLinkedPreview[];
  linkedOrder?: RequestLinkedPreview;
  notes: string;
  purchaseMode: string;
  references: RequestReference[];
  requestType: string;
  shippingCountry: string;
  status: RequestStatus;
  statusTimeline: ActivityEvent[];
  styleNotes: string;
  title: string;
  urgency: string;
  whatHappensNext: string;
  dislikedBrands: string[];
};

export type AdminRequest = {
  clientEmail: string;
  clientId: string;
  createdAt: string;
  detail: RequestDetail;
  id: string;
  status: RequestStatus;
  updatedAt: string;
};

export type ThreadLifecycleLink = {
  href: string;
  label: string;
  type: "request" | "edit" | "order";
};

export type MessageEntry = {
  body: string;
  id: string;
  meta?: string;
  timestampLabel: string;
  type: "client" | "stylist" | "system";
};

export type ThreadDetail = {
  composerPlaceholder: string;
  id: string;
  lifecycleLinks: ThreadLifecycleLink[];
  messages: MessageEntry[];
  participantName: string;
  title: string;
};

export type AdminThread = {
  clientId: string;
  detail: ThreadDetail;
  id: string;
  lastMessagePreview: string;
  updatedAt: string;
};

export type FirestoreTimestampValue =
  | Timestamp
  | Date
  | string
  | number
  | {
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    }
  | null
  | undefined;
