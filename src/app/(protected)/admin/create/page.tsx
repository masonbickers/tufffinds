"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentReference,
} from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminState,
  AdminStatusBadge,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../_components/AdminUI";
import type { OrderStatus, RequestStatus } from "../admin-types";
import {
  ORDER_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  isRequestStatus,
  requestStatusToneName,
} from "../admin-utils";

type Currency = "GBP" | "EUR" | "USD";
type RequestLoadState =
  | "idle"
  | "invalid"
  | "loading"
  | "ready"
  | "not_found"
  | "error";
type LinkedLoadState = "idle" | "loading" | "ready" | "not_found" | "error";
type LookupState = "idle" | "loading" | "ready" | "error";
type FeedbackState = "idle" | "saving" | "success" | "error";
type PrefillSource = "request" | "client";

type OrderForm = {
  clientId: string;
  clientEmail: string;
  title: string;
  brand: string;
  item: string;
  size: string;
  colour: string;
  salePrice: string;
  costPrice: string;
  currency: Currency;
  invoiceNumber: string;
  invoiceUrl: string;
  paymentMethod: string;
  supplier: string;
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  notes: string;
};

type FormField = keyof OrderForm;
type FormErrors = Partial<Record<FormField, string>>;

type ClientRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  shippingCountry: string;
};

type LinkedOrder = {
  id: string;
  title: string;
};

type RequestRecord = {
  id: string;
  title: string;
  requestType: string;
  purchaseMode: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  shippingCountry: string;
  rawStatus: string;
  status: RequestStatus | null;
  linkedOrder: LinkedOrder | null;
  references: Array<{ label: string; href: string }>;
  invoice: {
    amount?: number;
    currency: Currency;
    invoiceNumber: string;
    invoiceUrl: string;
    paymentMethod: string;
  };
  fulfilment: {
    purchasePrice?: number;
    supplier: string;
    courier: string;
    trackingNumber: string;
    trackingUrl: string;
  };
  issues: string[];
};

type Feedback = {
  state: FeedbackState;
  message: string;
};

const INITIAL_STATUS: OrderStatus = "created";

const EMPTY_FORM: OrderForm = {
  clientId: "",
  clientEmail: "",
  title: "",
  brand: "",
  item: "",
  size: "",
  colour: "",
  salePrice: "",
  costPrice: "",
  currency: "GBP",
  invoiceNumber: "",
  invoiceUrl: "",
  paymentMethod: "",
  supplier: "",
  courier: "",
  trackingNumber: "",
  trackingUrl: "",
  notes: "",
};

const IDLE_FEEDBACK: Feedback = { state: "idle", message: "" };

class DuplicateOrderError extends Error {}
class RequestChangedError extends Error {}

export default function CreateOrderPage() {
  const searchParams = useSearchParams();
  const hasRequestParameter = searchParams.has("requestId");
  const requestId = (searchParams.get("requestId") ?? "").trim();

  return (
    <CreateOrderWorkspace
      key={`${hasRequestParameter ? "linked" : "manual"}:${requestId}`}
      hasRequestParameter={hasRequestParameter}
      requestId={requestId}
    />
  );
}

function CreateOrderWorkspace({
  hasRequestParameter,
  requestId,
}: {
  hasRequestParameter: boolean;
  requestId: string;
}) {
  const router = useRouter();
  const isLinkedMode = hasRequestParameter;

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [request, setRequest] = useState<RequestRecord | null>(null);
  const [requestState, setRequestState] =
    useState<RequestLoadState>(isLinkedMode ? "loading" : "idle");
  const [requestError, setRequestError] = useState("");
  const [linkedClient, setLinkedClient] = useState<ClientRecord | null>(null);
  const [linkedClientState, setLinkedClientState] =
    useState<LinkedLoadState>("idle");
  const [linkedClientError, setLinkedClientError] = useState("");
  const [orderLookupState, setOrderLookupState] =
    useState<LookupState>(isLinkedMode ? "loading" : "idle");
  const [orderLookupError, setOrderLookupError] = useState("");
  const [existingOrderIds, setExistingOrderIds] = useState<string[]>([]);
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [prefillSources, setPrefillSources] =
    useState<Partial<Record<FormField, PrefillSource>>>({});
  const [feedback, setFeedback] = useState<Feedback>(IDLE_FEEDBACK);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [reservedOrderId, setReservedOrderId] = useState("");

  const dirtyFields = useRef(new Set<FormField>());
  const submissionLock = useRef(false);
  const orderReference = useRef<DocumentReference | null>(null);
  const relationshipRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLSelectElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const salePriceRef = useRef<HTMLInputElement>(null);
  const costPriceRef = useRef<HTMLInputElement>(null);
  const invoiceUrlRef = useRef<HTMLInputElement>(null);
  const trackingUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setClientsLoading(true);
    setClientsError("");

    return onSnapshot(
      query(collection(db, "client_profiles")),
      (snapshot) => {
        setClients(
          snapshot.docs
            .map((entry) =>
              normalizeClient(
                entry.id,
                entry.data() as Record<string, unknown>,
              ),
            )
            .sort((a, b) => a.fullName.localeCompare(b.fullName)),
        );
        setClientsLoading(false);
      },
      (error) => {
        console.error("Failed to load clients", error);
        setClients([]);
        setClientsLoading(false);
        setClientsError(readFailureMessage(error, "client selector"));
      },
    );
  }, []);

  useEffect(() => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setPrefillSources({});
    setFeedback(IDLE_FEEDBACK);
    setIsSubmitted(false);
    setReservedOrderId("");
    dirtyFields.current.clear();
    submissionLock.current = false;
    orderReference.current = null;
    setRequest(null);
    setRequestError("");

    if (!hasRequestParameter) {
      setRequestState("idle");
      return;
    }

    if (!isSafeDocumentId(requestId)) {
      setRequestState("invalid");
      setRequestError(
        "The request ID in the URL is empty or malformed. It has not been used.",
      );
      return;
    }

    setRequestState("loading");

    return onSnapshot(
      doc(db, "requests", requestId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRequest(null);
          setRequestState("not_found");
          return;
        }

        setRequest(
          normalizeRequest(
            snapshot.id,
            snapshot.data() as Record<string, unknown>,
          ),
        );
        setRequestState("ready");
      },
      (error) => {
        console.error("Failed to load linked request", error);
        setRequest(null);
        setRequestError(readFailureMessage(error, "linked request"));
        setRequestState("error");
      },
    );
  }, [hasRequestParameter, requestId]);

  useEffect(() => {
    setExistingOrderIds([]);
    setOrderLookupError("");

    if (!hasRequestParameter) {
      setOrderLookupState("idle");
      return;
    }

    if (!isSafeDocumentId(requestId)) {
      setOrderLookupState("idle");
      return;
    }

    setOrderLookupState("loading");

    return onSnapshot(
      query(
        collection(db, "orders"),
        where("requestId", "==", requestId),
        limit(5),
      ),
      (snapshot) => {
        setExistingOrderIds(snapshot.docs.map((entry) => entry.id));
        setOrderLookupState("ready");
      },
      (error) => {
        console.error("Failed to check linked orders", error);
        setExistingOrderIds([]);
        setOrderLookupError(readFailureMessage(error, "linked-order check"));
        setOrderLookupState("error");
      },
    );
  }, [hasRequestParameter, requestId]);

  useEffect(() => {
    const clientId = request?.clientId ?? "";
    setLinkedClient(null);
    setLinkedClientError("");

    if (!clientId) {
      setLinkedClientState("idle");
      return;
    }

    if (!isSafeDocumentId(clientId)) {
      setLinkedClientState("error");
      setLinkedClientError(
        "The request snapshot contains a malformed client ID. Select a verified client manually.",
      );
      return;
    }

    setLinkedClientState("loading");

    return onSnapshot(
      doc(db, "client_profiles", clientId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setLinkedClient(null);
          setLinkedClientState("not_found");
          return;
        }

        setLinkedClient(
          normalizeClient(
            snapshot.id,
            snapshot.data() as Record<string, unknown>,
          ),
        );
        setLinkedClientState("ready");
      },
      (error) => {
        console.error("Failed to load linked client", error);
        setLinkedClient(null);
        setLinkedClientError(readFailureMessage(error, "linked client"));
        setLinkedClientState("error");
      },
    );
  }, [request?.clientId]);

  useEffect(() => {
    if (!request || requestState !== "ready") return;

    const prefills: Partial<Record<FormField, string>> = {
      clientId: isSafeDocumentId(request.clientId) ? request.clientId : "",
      clientEmail: request.clientEmail,
      title: request.title,
      item: request.requestType,
      salePrice:
        request.invoice.amount === undefined
          ? ""
          : String(request.invoice.amount),
      costPrice:
        request.fulfilment.purchasePrice === undefined
          ? ""
          : String(request.fulfilment.purchasePrice),
      currency: request.invoice.currency,
      invoiceNumber: request.invoice.invoiceNumber,
      invoiceUrl: parseOptionalHttpUrl(request.invoice.invoiceUrl) ?? "",
      paymentMethod: request.invoice.paymentMethod,
      supplier: request.fulfilment.supplier,
      courier: request.fulfilment.courier,
      trackingNumber: request.fulfilment.trackingNumber,
      trackingUrl: parseOptionalHttpUrl(request.fulfilment.trackingUrl) ?? "",
    };

    const fieldsToApply = (Object.keys(prefills) as FormField[]).filter(
      (field) => Boolean(prefills[field]) && !dirtyFields.current.has(field),
    );

    setForm((current) => {
      const next = { ...current };

      fieldsToApply.forEach((field) => {
        const value = prefills[field];
        if (!value) return;
        next[field] = value as never;
      });
      return next;
    });

    setPrefillSources((currentSources) => {
      const nextSources = { ...currentSources };
      fieldsToApply.forEach((field) => {
        nextSources[field] = "request";
      });
      return nextSources;
    });
  }, [request, requestState]);

  useEffect(() => {
    if (!linkedClient || dirtyFields.current.has("clientEmail")) return;

    setForm((current) => {
      if (current.clientId !== linkedClient.id || !linkedClient.email) {
        return current;
      }
      return { ...current, clientEmail: linkedClient.email };
    });
    setPrefillSources((current) => ({ ...current, clientEmail: "client" }));
  }, [linkedClient]);

  const selectedClient =
    clients.find((client) => client.id === form.clientId) ??
    (linkedClient?.id === form.clientId ? linkedClient : null);

  const blockingOrderId = useMemo(() => {
    const ids = [request?.linkedOrder?.id ?? "", ...existingOrderIds].filter(
      Boolean,
    );
    return ids.find((id) => id !== reservedOrderId) ?? "";
  }, [existingOrderIds, request?.linkedOrder?.id, reservedOrderId]);

  const missingOptionalItems = useMemo(() => {
    const missing = [
      !form.item.trim() && "item description",
      !form.brand.trim() && "brand",
      !form.salePrice.trim() && "sale price",
      !form.costPrice.trim() && "purchase price",
      !form.invoiceNumber.trim() && "invoice number",
      !form.supplier.trim() && "supplier",
      !form.trackingNumber.trim() && "tracking details",
    ].filter((value): value is string => Boolean(value));
    return missing;
  }, [form]);

  function updateField<Field extends FormField>(
    field: Field,
    value: OrderForm[Field],
  ) {
    dirtyFields.current.add(field);
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setPrefillSources((current) => ({ ...current, [field]: undefined }));
    if (feedback.state === "error") setFeedback(IDLE_FEEDBACK);
  }

  function handleClientChange(clientId: string) {
    const client = clients.find((entry) => entry.id === clientId);
    dirtyFields.current.add("clientId");
    dirtyFields.current.add("clientEmail");
    setForm((current) => ({
      ...current,
      clientId,
      clientEmail: client?.email ?? "",
    }));
    setFormErrors((current) => ({
      ...current,
      clientId: undefined,
      clientEmail: undefined,
    }));
    setPrefillSources((current) => ({
      ...current,
      clientId: undefined,
      clientEmail: client?.email ? "client" : undefined,
    }));
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || isSubmitted) return;

    const validation = validateForm(form);
    setFormErrors(validation.errors);
    setFeedback(IDLE_FEEDBACK);

    const firstInvalidField = firstErrorField(validation.errors);
    if (firstInvalidField) {
      focusField(firstInvalidField, {
        clientId: clientRef,
        clientEmail: emailRef,
        title: titleRef,
        salePrice: salePriceRef,
        costPrice: costPriceRef,
        invoiceUrl: invoiceUrlRef,
        trackingUrl: trackingUrlRef,
      });
      setFeedback({
        state: "error",
        message: "Review the highlighted fields before creating the order.",
      });
      return;
    }

    if (isLinkedMode) {
      if (requestState !== "ready" || !request) {
        setFeedback({
          state: "error",
          message:
            "The linked request has not loaded successfully. Remove the request parameter to create a manual order.",
        });
        relationshipRef.current?.focus();
        return;
      }
      if (orderLookupState !== "ready") {
        setFeedback({
          state: "error",
          message:
            "Order creation is blocked until the duplicate-order check succeeds.",
        });
        relationshipRef.current?.focus();
        return;
      }
      if (blockingOrderId) {
        setFeedback({
          state: "error",
          message:
            "This request already has an order. A second order was not created.",
        });
        relationshipRef.current?.focus();
        return;
      }
    }

    submissionLock.current = true;
    setIsCreating(true);
    setFeedback({ state: "saving", message: "Creating order…" });

    const nextOrderReference =
      orderReference.current ?? doc(collection(db, "orders"));
    orderReference.current = nextOrderReference;
    setReservedOrderId(nextOrderReference.id);

    const orderData = buildOrderData(
      form,
      validation,
      isLinkedMode ? requestId : "",
    );

    try {
      await runTransaction(db, async (transaction) => {
        const orderSnapshot = await transaction.get(nextOrderReference);
        const requestReference = isLinkedMode
          ? doc(db, "requests", requestId)
          : null;
        const requestSnapshot = requestReference
          ? await transaction.get(requestReference)
          : null;

        if (requestReference && requestSnapshot && !requestSnapshot.exists()) {
          throw new RequestChangedError(
            "The linked request no longer exists. No order was created.",
          );
        }

        const latestLinkedOrderId = requestSnapshot?.exists()
          ? readLinkedOrderId(
              requestSnapshot.data() as Record<string, unknown>,
            )
          : "";

        if (
          latestLinkedOrderId &&
          latestLinkedOrderId !== nextOrderReference.id
        ) {
          throw new DuplicateOrderError(
            "Another order was linked to this request before this submission completed.",
          );
        }

        if (orderSnapshot.exists()) {
          if (!requestReference || latestLinkedOrderId === nextOrderReference.id) {
            return;
          }
          throw new DuplicateOrderError(
            "The reserved order reference is already in use.",
          );
        }

        transaction.set(nextOrderReference, {
          ...orderData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (requestReference) {
          transaction.update(requestReference, {
            "detail.linkedOrder": {
              id: nextOrderReference.id,
              title: form.title.trim(),
              description: "Order created from this request.",
              href: "/admin/orders",
            },
            updatedAt: serverTimestamp(),
          });
        }
      });

      setIsSubmitted(true);
      setFeedback({
        state: "success",
        message: `Order ${nextOrderReference.id} was created successfully. Opening Orders…`,
      });
      window.setTimeout(() => router.push("/admin/orders"), 500);
    } catch (error) {
      console.error("Failed to create order", error);
      const code = errorCode(error);
      const ambiguous =
        code === "unavailable" ||
        code === "deadline-exceeded" ||
        code === "aborted";

      setFeedback({
        state: "error",
        message:
          error instanceof DuplicateOrderError ||
          error instanceof RequestChangedError
            ? error.message
            : code === "permission-denied"
              ? "You do not have permission to create this order. No success has been assumed."
              : ambiguous
                ? "The write outcome could not be confirmed. Your form is preserved; retrying reuses the same reserved order reference."
                : "The order could not be created. No success has been assumed and your form values are preserved.",
      });
      setIsCreating(false);
      submissionLock.current = false;
    }
  }

  const clientOptions = [
    { label: clientsLoading ? "Loading clients…" : "Select a client", value: "" },
    ...clients.map((client) => ({
      label: `${client.fullName} — ${client.email || client.id}`,
      value: client.id,
    })),
  ];

  if (
    form.clientId &&
    !clientOptions.some((option) => option.value === form.clientId)
  ) {
    clientOptions.push({
      label: `${request?.clientName || "Request client"} — ${form.clientId}`,
      value: form.clientId,
    });
  }

  const linkedReadBlocked =
    isLinkedMode &&
    (requestState !== "ready" || orderLookupState !== "ready" || Boolean(blockingOrderId));

  return (
    <AdminShell
      active="orders"
      metrics={{ clients: clients.length, requests: 0, threads: 0, needsInfo: 0 }}
    >
      <AdminPage>
        <Link
          href="/admin/orders"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[#6f6259] transition hover:text-[#2b231e]"
        >
          <span aria-hidden="true">←</span>
          Back to orders
        </Link>

        <AdminPageHeader
          eyebrow={isLinkedMode ? "Request handoff" : "Manual order"}
          title="Create order"
          description="Review the client, commercial and fulfilment details before creating a reliable order record."
        />

        <form noValidate onSubmit={createOrder} className="space-y-7">
          <AdminSection
            title="Source and relationship"
            description="The source controls whether a request relationship is written with the order."
          >
            <div
              ref={relationshipRef}
              tabIndex={-1}
              className="rounded-[12px] border border-[#ded5cb] bg-white p-4 outline-none sm:p-5"
            >
              {isLinkedMode ? (
                <LinkedRequestContext
                  requestId={requestId}
                  request={request}
                  state={requestState}
                  error={requestError}
                  orderLookupState={orderLookupState}
                  orderLookupError={orderLookupError}
                  blockingOrderId={blockingOrderId}
                />
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <AdminStatusBadge tone="neutral">Manual order</AdminStatusBadge>
                    <p className="mt-3 text-sm font-medium text-[#2b231e]">
                      No request will be linked or changed.
                    </p>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[#75685f]">
                      Select an existing client and enter the order details directly.
                    </p>
                  </div>
                  <span className="text-xs text-[#81746a]">Request ID: none</span>
                </div>
              )}
            </div>
          </AdminSection>

          <AdminSection
            title="Client"
            description="The client ID is the relationship key. Contact details are copied to the order only as a snapshot."
          >
            <SectionSurface>
              {clientsError ? (
                <InlineNotice tone="error" title="Client selector unavailable">
                  {clientsError} A verified client already loaded from the request can
                  still be used.
                </InlineNotice>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FormSelect
                  id="clientId"
                  label="Client"
                  required
                  value={form.clientId}
                  options={clientOptions}
                  onChange={handleClientChange}
                  error={formErrors.clientId}
                  source={prefillSources.clientId}
                  selectRef={clientRef}
                  disabled={clientsLoading && !form.clientId}
                />
                <FormInput
                  id="clientEmail"
                  label="Client email snapshot"
                  type="email"
                  value={form.clientEmail}
                  onChange={(value) => updateField("clientEmail", value)}
                  error={formErrors.clientEmail}
                  source={prefillSources.clientEmail}
                  inputRef={emailRef}
                  hint="Optional; the client ID remains the relationship key."
                />
              </div>

              <ClientContext
                selectedClient={selectedClient}
                request={request}
                state={linkedClientState}
                error={linkedClientError}
                isLinkedMode={isLinkedMode}
              />
            </SectionSurface>
          </AdminSection>

          <AdminSection
            title="Order details"
            description="Describe the item or service in operational terms."
          >
            <SectionSurface>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-2">
                  <FormInput
                    id="title"
                    label="Order title"
                    required
                    value={form.title}
                    onChange={(value) => updateField("title", value)}
                    error={formErrors.title}
                    source={prefillSources.title}
                    inputRef={titleRef}
                  />
                </div>
                <FormInput
                  id="item"
                  label="Item or service"
                  value={form.item}
                  onChange={(value) => updateField("item", value)}
                  source={prefillSources.item}
                />
                <FormInput
                  id="brand"
                  label="Brand"
                  value={form.brand}
                  onChange={(value) => updateField("brand", value)}
                />
                <FormInput
                  id="size"
                  label="Size"
                  value={form.size}
                  onChange={(value) => updateField("size", value)}
                />
                <FormInput
                  id="colour"
                  label="Colour"
                  value={form.colour}
                  onChange={(value) => updateField("colour", value)}
                />
              </div>
            </SectionSurface>
          </AdminSection>

          <AdminSection
            title="Commercial details"
            description="Enter monetary values in major currency units, for example 125.50 rather than pence or cents."
          >
            <SectionSurface>
              <div className="grid gap-4 md:grid-cols-3">
                <FormSelect
                  id="currency"
                  label="Currency"
                  value={form.currency}
                  options={[
                    { label: "GBP", value: "GBP" },
                    { label: "EUR", value: "EUR" },
                    { label: "USD", value: "USD" },
                  ]}
                  onChange={(value) =>
                    updateField("currency", isCurrency(value) ? value : "GBP")
                  }
                  source={prefillSources.currency}
                />
                <FormInput
                  id="salePrice"
                  label="Sale price"
                  value={form.salePrice}
                  onChange={(value) => updateField("salePrice", value)}
                  error={formErrors.salePrice}
                  source={prefillSources.salePrice}
                  inputRef={salePriceRef}
                  inputMode="decimal"
                  hint={`${form.currency} major units; optional and zero is allowed.`}
                />
                <FormInput
                  id="costPrice"
                  label="Purchase price"
                  value={form.costPrice}
                  onChange={(value) => updateField("costPrice", value)}
                  error={formErrors.costPrice}
                  source={prefillSources.costPrice}
                  inputRef={costPriceRef}
                  inputMode="decimal"
                  hint={`${form.currency} major units; optional and zero is allowed.`}
                />
              </div>
            </SectionSurface>
          </AdminSection>

          <AdminSection
            title="Invoice and fulfilment"
            description="Optional operational information can be completed now or later in the established workflow."
          >
            <SectionSurface>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormInput
                  id="invoiceNumber"
                  label="Invoice number"
                  value={form.invoiceNumber}
                  onChange={(value) => updateField("invoiceNumber", value)}
                  source={prefillSources.invoiceNumber}
                />
                <FormInput
                  id="invoiceUrl"
                  label="Invoice URL"
                  type="url"
                  value={form.invoiceUrl}
                  onChange={(value) => updateField("invoiceUrl", value)}
                  error={formErrors.invoiceUrl}
                  source={prefillSources.invoiceUrl}
                  inputRef={invoiceUrlRef}
                  hint="Optional; must begin with http:// or https://."
                />
                <FormInput
                  id="paymentMethod"
                  label="Payment method"
                  value={form.paymentMethod}
                  onChange={(value) => updateField("paymentMethod", value)}
                  source={prefillSources.paymentMethod}
                />
                <FormInput
                  id="supplier"
                  label="Supplier"
                  value={form.supplier}
                  onChange={(value) => updateField("supplier", value)}
                  source={prefillSources.supplier}
                />
                <FormInput
                  id="courier"
                  label="Courier"
                  value={form.courier}
                  onChange={(value) => updateField("courier", value)}
                  source={prefillSources.courier}
                />
                <FormInput
                  id="trackingNumber"
                  label="Tracking number"
                  value={form.trackingNumber}
                  onChange={(value) => updateField("trackingNumber", value)}
                  source={prefillSources.trackingNumber}
                />
                <div className="md:col-span-2 xl:col-span-3">
                  <FormInput
                    id="trackingUrl"
                    label="Tracking URL"
                    type="url"
                    value={form.trackingUrl}
                    onChange={(value) => updateField("trackingUrl", value)}
                    error={formErrors.trackingUrl}
                    source={prefillSources.trackingUrl}
                    inputRef={trackingUrlRef}
                    hint="Optional; must begin with http:// or https://."
                  />
                </div>
                <div className="md:col-span-2 xl:col-span-3">
                  <FormTextarea
                    id="notes"
                    label="Internal operational notes"
                    value={form.notes}
                    onChange={(value) => updateField("notes", value)}
                    hint="Client brief content remains on the request and is not copied here automatically."
                  />
                </div>
              </div>
            </SectionSurface>
          </AdminSection>

          <AdminSection
            title="Review"
            description="Confirm the reliable relationships and initial order state before submission."
          >
            <SectionSurface>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReviewItem
                  label="Client"
                  value={
                    selectedClient?.fullName ||
                    request?.clientName ||
                    form.clientId ||
                    "Not selected"
                  }
                  detail={form.clientId || "Client ID required"}
                />
                <ReviewItem
                  label="Linked request"
                  value={isLinkedMode && requestState === "ready" ? requestId : "None"}
                  detail={
                    isLinkedMode
                      ? "Request status will remain unchanged"
                      : "Manual order"
                  }
                />
                <ReviewItem
                  label="Order title"
                  value={form.title.trim() || "Not provided"}
                />
                <ReviewItem
                  label="Sale value"
                  value={formatMoneyInput(form.salePrice, form.currency)}
                />
                <ReviewItem
                  label="Purchase value"
                  value={formatMoneyInput(form.costPrice, form.currency)}
                />
                <ReviewItem
                  label="Initial status"
                  value={ORDER_STATUS_LABELS[INITIAL_STATUS]}
                  detail="Creation does not imply payment or purchase"
                />
              </dl>

              <div className="mt-5 border-t border-[#e5ddd4] pt-4 text-sm text-[#75685f]">
                <span className="font-medium text-[#4e4138]">Optional information still missing: </span>
                {missingOptionalItems.length
                  ? missingOptionalItems.join(", ")
                  : "none from this review set"}
              </div>
            </SectionSurface>
          </AdminSection>

          {feedback.message ? (
            <div
              role={feedback.state === "error" ? "alert" : "status"}
              aria-live="polite"
              className={`rounded-[12px] border p-4 text-sm ${
                feedback.state === "error"
                  ? "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]"
                  : feedback.state === "success"
                    ? "border-[#c9ddcc] bg-[#eff7f0] text-[#35633c]"
                    : "border-[#d8d0c8] bg-[#f7f4f0] text-[#63574f]"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[#ded5cb] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[#81746a]">
              {isLinkedMode
                ? "The order relationship is written atomically. Request status will not change."
                : "Manual creation writes only the order document."}
            </p>
            <button
              type="submit"
              disabled={isCreating || isSubmitted || linkedReadBlocked}
              aria-describedby="create-order-help"
              className={`${adminPrimaryButton} w-full sm:w-auto`}
            >
              {isCreating
                ? "Creating order…"
                : isSubmitted
                  ? "Order created"
                  : "Create order"}
            </button>
            <span id="create-order-help" className="sr-only">
              All validation completes before Firestore is changed.
            </span>
          </div>
        </form>
      </AdminPage>
    </AdminShell>
  );
}

function LinkedRequestContext({
  requestId,
  request,
  state,
  error,
  orderLookupState,
  orderLookupError,
  blockingOrderId,
}: {
  requestId: string;
  request: RequestRecord | null;
  state: RequestLoadState;
  error: string;
  orderLookupState: LookupState;
  orderLookupError: string;
  blockingOrderId: string;
}) {
  if (state === "loading") {
    return <AdminState title="Loading linked request" body="Checking the request before prefilling the form." />;
  }

  if (state === "invalid") {
    return (
      <RelationshipFailure title="Invalid request link" body={error} />
    );
  }

  if (state === "not_found") {
    return (
      <RelationshipFailure
        title="Request not found"
        body={`No request exists for “${requestId}”. The page has not switched to manual mode.`}
      />
    );
  }

  if (state === "error") {
    return <RelationshipFailure title="Request read failed" body={error} />;
  }

  if (!request) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AdminStatusBadge tone="info">Linked request</AdminStatusBadge>
            <AdminStatusBadge tone={requestStatusToneName(request.status)}>
              {request.status
                ? REQUEST_STATUS_LABELS[request.status]
                : request.rawStatus
                  ? "Unknown request status"
                  : "Missing request status"}
            </AdminStatusBadge>
          </div>
          <h3 className="mt-3 break-words text-base font-semibold text-[#2b231e]">
            {request.title || "Untitled request"}
          </h3>
          <p className="mt-1 break-all text-xs text-[#81746a]">Request ID: {request.id}</p>
        </div>
        <Link
          href={`/admin/requests/${encodeURIComponent(request.id)}`}
          className={adminSecondaryButton}
        >
          Open request detail
        </Link>
      </div>

      <dl className="grid gap-3 rounded-[10px] bg-[#f8f5f1] p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <CompactDetail label="Client snapshot" value={request.clientName || request.clientEmail || "Not provided"} />
        <CompactDetail label="Request type" value={request.requestType || "Not provided"} />
        <CompactDetail label="Purchase mode" value={request.purchaseMode || "Not provided"} />
        <CompactDetail label="Shipping country" value={request.shippingCountry || "Not provided"} />
      </dl>

      {request.references.length ? (
        <p className="text-xs leading-5 text-[#75685f]">
          {request.references.length} valid request reference{request.references.length === 1 ? "" : "s"} remain available on Request detail.
        </p>
      ) : null}

      {request.issues.length ? (
        <InlineNotice tone="warning" title="Request data needs attention">
          <ul className="list-disc space-y-1 pl-5">
            {request.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
          Reliable fields can still be reviewed; malformed values were not prefilled.
        </InlineNotice>
      ) : null}

      {orderLookupState === "loading" ? (
        <InlineNotice tone="neutral" title="Checking for an existing order">
          Creation remains disabled until this check completes.
        </InlineNotice>
      ) : null}
      {orderLookupState === "error" ? (
        <InlineNotice tone="error" title="Duplicate-order check failed">
          {orderLookupError} Creation remains disabled.
        </InlineNotice>
      ) : null}
      {blockingOrderId ? (
        <InlineNotice tone="error" title="An order is already linked">
          Order {blockingOrderId} already uses this request. A second order cannot be
          created here. <Link href="/admin/orders" className="font-semibold underline">Open the Orders list</Link>.
        </InlineNotice>
      ) : null}
    </div>
  );
}

function RelationshipFailure({ title, body }: { title: string; body: string }) {
  return (
    <div role="alert">
      <h3 className="text-sm font-semibold text-[#8c3c2d]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[#75685f]">{body}</p>
      <Link href="/admin/create" className={`${adminSecondaryButton} mt-4`}>
        Start a manual order instead
      </Link>
    </div>
  );
}

function ClientContext({
  selectedClient,
  request,
  state,
  error,
  isLinkedMode,
}: {
  selectedClient: ClientRecord | null;
  request: RequestRecord | null;
  state: LinkedLoadState;
  error: string;
  isLinkedMode: boolean;
}) {
  if (!isLinkedMode && !selectedClient) return null;

  return (
    <div className="mt-5 grid gap-3 border-t border-[#e5ddd4] pt-4 md:grid-cols-2">
      {isLinkedMode ? (
        <div className="min-w-0 rounded-[10px] bg-[#f8f5f1] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#806b5d]">Request snapshot</p>
          <dl className="mt-2 space-y-2 text-sm">
            <CompactDetail label="Name" value={request?.clientName || "Not provided"} />
            <CompactDetail label="Email" value={request?.clientEmail || "Not provided"} />
            <CompactDetail label="Phone" value={request?.clientPhone || "Not provided"} />
            <CompactDetail label="Client ID" value={request?.clientId || "Not provided"} />
          </dl>
        </div>
      ) : null}

      <div className="min-w-0 rounded-[10px] bg-[#f8f5f1] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#806b5d]">Live client profile</p>
        {state === "loading" ? <p className="mt-2 text-sm text-[#75685f]">Loading live client…</p> : null}
        {state === "not_found" ? <p className="mt-2 text-sm text-[#8c3c2d]">The request client ID has no live profile. The verified ID remains visible, but review the snapshot carefully.</p> : null}
        {state === "error" ? <p role="alert" className="mt-2 text-sm text-[#8c3c2d]">{error}</p> : null}
        {selectedClient ? (
          <dl className="mt-2 space-y-2 text-sm">
            <CompactDetail label="Name" value={selectedClient.fullName} />
            <CompactDetail label="Email" value={selectedClient.email || "Not provided"} />
            <CompactDetail label="Phone" value={selectedClient.phone || "Not provided"} />
            <CompactDetail label="Shipping country" value={selectedClient.shippingCountry || "Not provided"} />
          </dl>
        ) : state === "idle" ? (
          <p className="mt-2 text-sm text-[#75685f]">Select a client to review live profile details.</p>
        ) : null}
      </div>
    </div>
  );
}

function SectionSurface({ children }: { children: ReactNode }) {
  return <div className="rounded-[12px] border border-[#ded5cb] bg-white p-4 sm:p-5">{children}</div>;
}

function InlineNotice({
  tone,
  title,
  children,
}: {
  tone: "neutral" | "warning" | "error";
  title: string;
  children: ReactNode;
}) {
  const classes = {
    neutral: "border-[#d8d0c8] bg-[#f7f4f0] text-[#63574f]",
    warning: "border-[#e5d3a9] bg-[#fbf6e8] text-[#725820]",
    error: "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-4 rounded-[10px] border p-3 text-sm leading-6 ${classes[tone]}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function FormInput({
  id,
  label,
  value,
  onChange,
  required = false,
  type = "text",
  inputMode,
  hint,
  error,
  source,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "url";
  inputMode?: "text" | "email" | "url" | "decimal";
  hint?: string;
  error?: string;
  source?: PrefillSource;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#4e4138]">
        {label}{required ? <span className="text-[#8c3c2d]">Required</span> : null}<PrefillLabel source={source} />
      </span>
      <input
        ref={inputRef}
        id={id}
        value={value}
        type={type}
        inputMode={inputMode}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 h-10 w-full min-w-0 rounded-[10px] border bg-white px-3 text-sm text-[#2b231e] outline-none focus:ring-2 focus:ring-[#806650]/15 ${error ? "border-[#b85c49]" : "border-[#d8d0c8] focus:border-[#806650]"}`}
      />
      {hint ? <span id={`${id}-hint`} className="mt-1.5 block text-xs leading-5 text-[#81746a]">{hint}</span> : null}
      {error ? <span id={`${id}-error`} className="mt-1.5 block text-xs font-medium text-[#8c3c2d]">{error}</span> : null}
    </label>
  );
}

function FormTextarea({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-medium text-[#4e4138]">{label}</span>
      <textarea
        id={id}
        value={value}
        rows={4}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full resize-y rounded-[10px] border border-[#d8d0c8] bg-white px-3 py-2.5 text-sm leading-6 text-[#2b231e] outline-none focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/15"
      />
      {hint ? <span id={`${id}-hint`} className="mt-1.5 block text-xs leading-5 text-[#81746a]">{hint}</span> : null}
    </label>
  );
}

function FormSelect({
  id,
  label,
  value,
  options,
  onChange,
  required = false,
  error,
  source,
  disabled = false,
  selectRef,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  source?: PrefillSource;
  disabled?: boolean;
  selectRef?: RefObject<HTMLSelectElement | null>;
}) {
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#4e4138]">
        {label}{required ? <span className="text-[#8c3c2d]">Required</span> : null}<PrefillLabel source={source} />
      </span>
      <select
        ref={selectRef}
        id={id}
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1.5 h-10 w-full min-w-0 rounded-[10px] border bg-white px-3 text-sm text-[#2b231e] outline-none focus:ring-2 focus:ring-[#806650]/15 disabled:cursor-not-allowed disabled:bg-[#f3efea] ${error ? "border-[#b85c49]" : "border-[#d8d0c8] focus:border-[#806650]"}`}
      >
        {options.map((option) => <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>)}
      </select>
      {error ? <span id={`${id}-error`} className="mt-1.5 block text-xs font-medium text-[#8c3c2d]">{error}</span> : null}
    </label>
  );
}

function PrefillLabel({ source }: { source?: PrefillSource }) {
  if (!source) return null;
  return <span className="rounded-full bg-[#edf5fa] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#315d76]">{source === "client" ? "Live client" : "Prefilled from request"}</span>;
}

function CompactDetail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-[#81746a]">{label}</dt><dd className="mt-0.5 break-words text-[#4e4138]">{value}</dd></div>;
}

function ReviewItem({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0"><dt className="text-xs font-medium uppercase tracking-[0.1em] text-[#81746a]">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-[#2b231e]">{value}</dd>{detail ? <dd className="mt-1 break-all text-xs text-[#81746a]">{detail}</dd> : null}</div>;
}

function validateForm(form: OrderForm) {
  const errors: FormErrors = {};
  if (!form.clientId) errors.clientId = "Select a client.";
  else if (!isSafeDocumentId(form.clientId)) errors.clientId = "Select a client with a valid document ID.";
  if (form.clientEmail.trim() && !isEmail(form.clientEmail.trim())) errors.clientEmail = "Enter a valid email address or leave this blank.";
  if (!form.title.trim()) errors.title = "Enter an order title.";

  const salePrice = parseOptionalMoney(form.salePrice, "Sale price");
  const costPrice = parseOptionalMoney(form.costPrice, "Purchase price");
  if (salePrice.error) errors.salePrice = salePrice.error;
  if (costPrice.error) errors.costPrice = costPrice.error;

  const invoiceUrl = parseOptionalHttpUrl(form.invoiceUrl);
  const trackingUrl = parseOptionalHttpUrl(form.trackingUrl);
  if (form.invoiceUrl.trim() && !invoiceUrl) errors.invoiceUrl = "Enter a complete http:// or https:// URL.";
  if (form.trackingUrl.trim() && !trackingUrl) errors.trackingUrl = "Enter a complete http:// or https:// URL.";

  return { errors, salePrice: salePrice.value, costPrice: costPrice.value, invoiceUrl, trackingUrl };
}

function buildOrderData(form: OrderForm, validation: ReturnType<typeof validateForm>, requestId: string) {
  const data: Record<string, unknown> = {
    clientId: form.clientId,
    title: form.title.trim(),
    status: INITIAL_STATUS,
    currency: form.currency,
  };
  addString(data, "clientEmail", form.clientEmail);
  addString(data, "requestId", requestId);
  addString(data, "brand", form.brand);
  addString(data, "item", form.item);
  addString(data, "size", form.size);
  addString(data, "colour", form.colour);
  addString(data, "invoiceNumber", form.invoiceNumber);
  addString(data, "invoiceUrl", validation.invoiceUrl ?? "");
  addString(data, "paymentMethod", form.paymentMethod);
  addString(data, "supplier", form.supplier);
  addString(data, "courier", form.courier);
  addString(data, "trackingNumber", form.trackingNumber);
  addString(data, "trackingUrl", validation.trackingUrl ?? "");
  addString(data, "notes", form.notes);
  if (validation.salePrice !== undefined) data.salePrice = validation.salePrice;
  if (validation.costPrice !== undefined) data.costPrice = validation.costPrice;
  return data;
}

function addString(target: Record<string, unknown>, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) target[key] = trimmed;
}

function parseOptionalMoney(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { value: undefined, error: "" };
  const validFormat = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$|^\.\d{1,2}$/.test(trimmed);
  if (!validFormat) return { value: undefined, error: `${label} must be a positive number or zero with no more than two decimal places.` };
  const amount = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return { value: undefined, error: `${label} must be a positive number or zero.` };
  return { value: amount, error: "" };
}

function parseOptionalHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeRequest(id: string, data: Record<string, unknown>): RequestRecord {
  const detailExists = isRecord(data.detail);
  const detail: Record<string, unknown> = isRecord(data.detail) ? data.detail : {};
  const invoice: Record<string, unknown> = isRecord(detail.invoice) ? detail.invoice : {};
  const fulfilment: Record<string, unknown> = isRecord(detail.fulfilment) ? detail.fulfilment : {};
  const rawStatus = readString(data.status) || readString(detail.status);
  const status = isRequestStatus(rawStatus) ? rawStatus : null;
  const clientId = readString(data.clientId);
  const rawLinkedOrder = detail.linkedOrder;
  const linkedOrder = normalizeLinkedOrder(rawLinkedOrder);
  const invoiceUrl = readString(invoice.invoiceUrl);
  const trackingUrl = readString(fulfilment.trackingUrl);
  const amount = readOptionalNonNegativeNumber(invoice.amount);
  const purchasePrice = readOptionalNonNegativeNumber(fulfilment.purchasePrice);
  const issues = [
    !detailExists ? "Request detail data is missing or malformed." : "",
    !status ? rawStatus ? `Status “${rawStatus}” is not recognised.` : "Request status is missing." : "",
    clientId && !isSafeDocumentId(clientId) ? "The client ID is malformed and was not prefilled." : "",
    rawLinkedOrder !== undefined && !linkedOrder ? "The stored linked-order preview is malformed." : "",
    invoice.amount !== undefined && amount === undefined ? "The request invoice amount is invalid and was not prefilled." : "",
    fulfilment.purchasePrice !== undefined && purchasePrice === undefined ? "The request purchase price is invalid and was not prefilled." : "",
    invoiceUrl && !parseOptionalHttpUrl(invoiceUrl) ? "The request invoice URL is invalid and was not prefilled." : "",
    trackingUrl && !parseOptionalHttpUrl(trackingUrl) ? "The request tracking URL is invalid and was not prefilled." : "",
  ].filter(Boolean);

  return {
    id,
    title: readString(detail.title),
    requestType: readString(detail.requestType),
    purchaseMode: readString(detail.purchaseMode),
    clientId,
    clientName: readString(data.clientName) || readString(data.fullName) || readString(data.name),
    clientEmail: readString(data.clientEmail),
    clientPhone: readString(data.clientPhone) || readString(data.phone),
    shippingCountry: readString(detail.shippingCountry),
    rawStatus,
    status,
    linkedOrder,
    references: normalizeReferences(detail.references),
    invoice: {
      amount,
      currency: isCurrency(invoice.currency) ? invoice.currency : "GBP",
      invoiceNumber: readString(invoice.invoiceNumber),
      invoiceUrl,
      paymentMethod: readString(invoice.paymentMethod),
    },
    fulfilment: {
      purchasePrice,
      supplier: readString(fulfilment.supplier),
      courier: readString(fulfilment.courier),
      trackingNumber: readString(fulfilment.trackingNumber),
      trackingUrl,
    },
    issues,
  };
}

function normalizeClient(id: string, data: Record<string, unknown>): ClientRecord {
  const profile = isRecord(data.profile) ? data.profile : {};
  const shippingAddress = isRecord(profile.shippingAddress) ? profile.shippingAddress : {};
  return {
    id,
    fullName: readString(profile.fullName) || readString(data.fullName) || "Unnamed client",
    email: readString(data.email),
    phone: readString(profile.phoneNumber) || readString(data.phoneNumber),
    shippingCountry: readString(shippingAddress.country),
  };
}

function normalizeLinkedOrder(value: unknown): LinkedOrder | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  if (!isSafeDocumentId(id)) return null;
  return { id, title: readString(value.title) || id };
}

function normalizeReferences(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.reduce<Array<{ label: string; href: string }>>((references, entry) => {
    if (!isRecord(entry) || readString(entry.type) !== "link") return references;
    const href = parseOptionalHttpUrl(readString(entry.value));
    if (href) references.push({ label: readString(entry.label) || href, href });
    return references;
  }, []);
}

function readLinkedOrderId(data: Record<string, unknown>) {
  const detail = isRecord(data.detail) ? data.detail : {};
  return normalizeLinkedOrder(detail.linkedOrder)?.id ?? "";
}

function firstErrorField(errors: FormErrors): FormField | null {
  const order: FormField[] = ["clientId", "clientEmail", "title", "salePrice", "costPrice", "invoiceUrl", "trackingUrl"];
  return order.find((field) => errors[field]) ?? null;
}

function focusField(field: FormField, refs: Partial<Record<FormField, RefObject<HTMLElement | null>>>) {
  window.requestAnimationFrame(() => refs[field]?.current?.focus());
}

function formatMoneyInput(value: string, currency: Currency) {
  const parsed = parseOptionalMoney(value, "Value");
  if (!value.trim()) return "Not set";
  if (parsed.value === undefined) return "Invalid value";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(parsed.value);
}

function readOptionalNonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isSafeDocumentId(value: string) {
  return Boolean(value) && value !== "." && value !== ".." && !value.includes("/") && new TextEncoder().encode(value).length <= 1_500;
}

function isCurrency(value: unknown): value is Currency {
  return value === "GBP" || value === "EUR" || value === "USD";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readFailureMessage(error: unknown, resource: string) {
  return errorCode(error) === "permission-denied"
    ? `You do not have permission to read the ${resource}.`
    : `The ${resource} failed. Existing values were not replaced with empty data.`;
}

function errorCode(error: unknown) {
  return isRecord(error) ? readString(error.code) : "";
}
