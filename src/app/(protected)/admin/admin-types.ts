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

export type RequestStatus =
  | "submitted"
  | "reviewing"
  | "needs_info"
  | "sourcing"
  | "options_sent"
  | "awaiting_client_approval"
  | "approved"
  | "invoice_sent"
  | "paid"
  | "purchased"
  | "quality_check"
  | "dispatched"
  | "delivered"
  | "closed"
  | "cancelled";

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

export type Currency = "GBP" | "EUR" | "USD";

export type RequestItemOption = {
  brand: string;
  colour: string;
  costPrice: number;
  currency: Currency;
  id: string;
  item: string;
  notes: string;
  salePrice: number;
  size: string;
  supplier: string;
  title: string;
};

export type RequestAdminWorkflow = {
  approvedOptionId: string | null;
  internalNotes: string;
  itemOptions: RequestItemOption[];
  missingInformation: string;
  needsInfoReturnStatus: RequestStatus | null;
  orderId: string | null;
  sourcingProgress: string;
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
  adminWorkflow: RequestAdminWorkflow;
  clientEmail: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  createdAt: string;
  detail: RequestDetail;
  id: string;
  source: string;
  status: RequestStatus;
  submittedFrom: string;
  updatedAt: string;
};

export type OrderStatus =
  | "created"
  | "invoice_sent"
  | "paid"
  | "purchased"
  | "quality_check"
  | "dispatched"
  | "delivered"
  | "closed"
  | "cancelled";

export type AdminOrder = {
  approvedOptionId: string;
  brand: string;
  clientEmail: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  colour: string;
  costPrice: number;
  courier: string;
  createdAt: string;
  currency: Currency;
  id: string;
  invoiceNumber: string;
  invoiceUrl: string;
  item: string;
  notes: string;
  paymentMethod: string;
  requestId: string;
  salePrice: number;
  size: string;
  status: OrderStatus;
  supplier: string;
  title: string;
  trackingNumber: string;
  trackingUrl: string;
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

export type FirestoreTimestampValue = Timestamp | string | null | undefined;

export function getEmptyRequestAdminWorkflow(): RequestAdminWorkflow {
  return {
    approvedOptionId: null,
    internalNotes: "",
    itemOptions: [],
    missingInformation: "",
    needsInfoReturnStatus: null,
    orderId: null,
    sourcingProgress: "",
  };
}
