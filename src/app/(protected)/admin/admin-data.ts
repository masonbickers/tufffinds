export type ActivityEventType =
  | "request-submitted"
  | "request-updated"
  | "edit-published"
  | "edit-revised"
  | "item-approved"
  | "revision-requested"
  | "payment-received"
  | "order-shipped"
  | "order-delivered"
  | "support-request-created";

export type ActivityTone = "neutral" | "info" | "success" | "warning" | "danger";

export type ActivityEvent = {
  actorName?: string;
  description?: string;
  id: string;
  label: string;
  meta?: string;
  statusLabel?: string;
  tone?: ActivityTone;
  type: ActivityEventType;
};

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

export type RequestStatus =
  | "draft"
  | "submitted"
  | "needs_info"
  | "assigned"
  | "curating"
  | "edit_ready"
  | "awaiting_client"
  | "approved"
  | "converted_to_order"
  | "closed";

export type PurchaseMode =
  | "recommendation-only"
  | "buy-on-my-behalf"
  | "invoice-me-first";

export type RequestReference = {
  id: string;
  label: string;
  type: "link" | "upload-placeholder";
  value: string;
};

export type LinkPreview = {
  description: string;
  href: string;
  id: string;
  title: string;
};

export type AdminRequest = {
  activitySummary: ActivityEvent[];
  assignedStylist?: string;
  categories: string[];
  clientId: string;
  closedReason?: "cancelled" | "completed";
  colorPreferences: string[];
  createdAt: string;
  createdDateLabel: string;
  deadlineAt?: string;
  deadlineLabel?: string;
  favoriteBrands: string[];
  href: string;
  id: string;
  linkedEdits: LinkPreview[];
  linkedMessagesPreview: LinkPreview[];
  linkedOrder?: LinkPreview;
  notes: string;
  purchaseMode: PurchaseMode;
  references: RequestReference[];
  requestType: string;
  shippingCountry: string;
  status: RequestStatus;
  statusTimeline: ActivityEvent[];
  styleNotes: string;
  title: string;
  urgency: "flexible" | "timely" | "urgent";
  whatHappensNext: string;
  dislikedBrands: string[];
};

export type EditStatus = "awaiting-feedback" | "revised" | "approved" | "archived";
export type EditDecision =
  | "approved"
  | "rejected"
  | "alternative-requested"
  | "saved-for-later";
export type EditAvailabilityStatus = "available" | "limited" | "low-stock" | "sold-out";

export type EditAlternativeOption = {
  id: string;
  label: string;
  priceLabel: string;
};

export type EditItem = {
  alternatives: EditAlternativeOption[];
  availabilityLabel: string;
  availabilityStatus: EditAvailabilityStatus;
  groupLabel: string;
  id: string;
  imageUri?: string;
  priceLabel: string;
  retailer: string;
  sizeNotes: string;
  title: string;
  whyChosen: string;
};

export type EditVersionChangeSummary = {
  addedItems: string[];
  budgetDifferenceLabel: string;
  removedItems: string[];
  replacedItems: Array<{
    nextItem: string;
    previousItem: string;
  }>;
};

export type EditVersion = {
  changeSummary?: EditVersionChangeSummary;
  id: string;
  itemCount: number;
  sentDateLabel: string;
  status: EditStatus;
  stylistNote: string;
  totalEstimatedSpend: string;
  versionLabel: string;
};

export type EditGroup = {
  id: string;
  itemIds: string[];
  summary: string;
  title: string;
};

export type AdminEdit = {
  awaitingClientAction: boolean;
  clientId: string;
  currentVersionId: string;
  id: string;
  groupedItems: EditGroup[];
  href: string;
  itemsById: Record<string, EditItem>;
  linkedMessageHref: string;
  linkedOrderHref?: string;
  requestId: string;
  requestTitle: string;
  stylistName: string;
  versionTimeline: ActivityEvent[];
  versions: EditVersion[];
};

export type OrderStatus =
  | "awaiting-payment"
  | "paid"
  | "sourcing"
  | "ordered"
  | "partially-shipped"
  | "shipped"
  | "delivered"
  | "completed"
  | "returned"
  | "refunded";

export type OrderPaymentStatus = "awaiting-payment" | "paid" | "refunded" | "failed";
export type OrderFulfillmentStatus =
  | "pending"
  | "sourcing"
  | "ordered"
  | "partially-shipped"
  | "shipped"
  | "delivered"
  | "completed"
  | "returned";

export type OrderLineItem = {
  id: string;
  imageUri?: string;
  priceLabel: string;
  quantityLabel: string;
  retailer: string;
  subtitle?: string;
  title: string;
};

export type ShipmentTrackingEntry = {
  id: string;
  label: string;
  meta?: string;
  description?: string;
};

export type OrderDocumentLink = {
  href?: string;
  id: string;
  label: string;
  summary: string;
};

export type OrderLinkedRecord = {
  description: string;
  href: string;
  label: string;
};

export type AdminOrder = {
  clientId: string;
  feesLabel: string;
  fulfillmentStatus: OrderFulfillmentStatus;
  fulfillmentStatusLabel: string;
  id: string;
  invoiceActions: OrderDocumentLink[];
  lineItems: OrderLineItem[];
  linkedApprovedEdit: OrderLinkedRecord;
  linkedRequest: OrderLinkedRecord;
  paymentStatus: OrderPaymentStatus;
  paymentStatusLabel: string;
  reorderAvailable: boolean;
  requestId: string;
  requestTitle: string;
  shipmentTracking: ShipmentTrackingEntry[];
  shippingTotalLabel: string;
  status: OrderStatus;
  statusTimeline: ActivityEvent[];
  subtotalLabel: string;
  supportThread: OrderLinkedRecord;
  totalLabel: string;
  updatedAt: string;
  updatedDateLabel: string;
  whatHappensNext: string;
};

export type MessageActorType = "client" | "stylist" | "system";

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
  type: MessageActorType;
};

export type AdminThread = {
  clientId: string;
  composerPlaceholder: string;
  id: string;
  isUnread: boolean;
  lastMessagePreview: string;
  lastUpdatedAt: string;
  lastUpdatedLabel: string;
  lifecycleLinks: ThreadLifecycleLink[];
  messages: MessageEntry[];
  participantName: string;
  requestId?: string;
  title: string;
  unreadCount: number;
};

export type BillingDocumentStatus = "paid" | "unpaid" | "refunded" | "failed";

export type BillingDocument = {
  amountLabel: string;
  id: string;
  issuedLabel: string;
  status: BillingDocumentStatus;
  subtitle: string;
  title: string;
};

export type PaymentMethodSummary = {
  brand: string;
  expiryLabel: string;
  id: string;
  isDefault: boolean;
  last4: string;
  typeLabel: string;
};

export type BillingHistoryItem = {
  description: string;
  id: string;
  label: string;
  meta: string;
};

export type MembershipSummary = {
  description: string;
  statusLabel: string;
  title: string;
};

export type BillingOverview = {
  billingHistory: BillingHistoryItem[];
  invoices: BillingDocument[];
  manageBillingLabel: string;
  membership?: MembershipSummary;
  paymentMethods: PaymentMethodSummary[];
  receipts: BillingDocument[];
};

export type AdminClient = {
  createdAt: string;
  email: string;
  fullName: string;
  id: string;
  onboardingCompleted: boolean;
  phoneNumber: string;
  phoneNumberNormalized?: string;
  profile: ClientProfile;
  updatedAt: string;
};

export type AdminSeedData = {
  billing: Record<string, BillingOverview>;
  clients: AdminClient[];
  edits: AdminEdit[];
  orders: AdminOrder[];
  requests: AdminRequest[];
  threads: AdminThread[];
};

export const adminSeed: AdminSeedData = {
  clients: [],
  requests: [],
  edits: [],
  orders: [],
  threads: [],
  billing: {},
};
