"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminState,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../_components/AdminUI";
import {
  REQUEST_STATUSES,
  type ActivityEvent,
  type RequestStatus,
} from "../../admin-types";
import {
  isRequestStatus,
  REQUEST_STATUS_LABELS,
} from "../../admin-utils";

type PageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

type LoadState = "loading" | "ready" | "not_found" | "error";
type LinkedLoadState = "idle" | "loading" | "ready" | "not_found" | "error";
type FeedbackState = "idle" | "saving" | "success" | "error";

type MutationFeedback = {
  state: FeedbackState;
  message: string;
};

type RequestEditForm = {
  title: string;
  requestType: string;
  purchaseMode: string;
  urgency: string;
  deadlineLabel: string;
  assignedStylist: string;
  notes: string;
  styleNotes: string;
  shippingCountry: string;
  categories: string;
  favoriteBrands: string;
  dislikedBrands: string;
};

type RequestReference = {
  id: string;
  label: string;
  type: string;
  value: string;
  href: string | null;
};

type LinkedPreview = {
  id: string;
  title: string;
  description: string;
};

type ServiceDetailSection = {
  id: string;
  title: string;
  fields: Array<{ label: string; value: string }>;
};

type QuoteSummary = {
  currency: "GBP" | "EUR" | "USD";
  quoteNumber: string;
  total: number;
  validUntil: string;
};

type RequestRecord = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  rawStatus: string;
  status: RequestStatus | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  source: string;
  submittedFrom: string;
  issues: string[];
  detail: {
    title: string;
    requestType: string;
    purchaseMode: string;
    urgency: string;
    deadlineLabel: string;
    assignedStylist: string;
    notes: string;
    styleNotes: string;
    shippingCountry: string;
    categories: string[];
    favoriteBrands: string[];
    dislikedBrands: string[];
    references: RequestReference[];
    whatHappensNext: string;
    statusTimeline: ActivityEvent[];
    linkedOrder: LinkedPreview | null;
    linkedEditsCount: number;
    serviceSections: ServiceDetailSection[];
    quote: QuoteSummary | null;
  };
};

type LinkedClient = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  contactPreferences: string[];
  shippingCountry: string;
};

const IDLE_FEEDBACK: MutationFeedback = { state: "idle", message: "" };

const NEXT_ACTIONS: Record<RequestStatus, string> = {
  submitted: "Review the brief and decide whether more client information is needed.",
  reviewing: "Complete the review, then begin sourcing or request missing information.",
  needs_info: "Contact the client and record the missing information before progressing.",
  sourcing: "Continue sourcing and prepare suitable options for the client.",
  options_sent: "Wait for or record the client’s response to the proposed options.",
  awaiting_client_approval: "Obtain the client’s approval before progressing commercially.",
  approved: "Create or continue the order and invoice workflow.",
  invoice_sent: "Wait for confirmed payment before purchasing.",
  paid: "Purchase the approved item and record fulfilment information.",
  purchased: "Receive the item and complete the quality check.",
  quality_check: "Complete checks and dispatch the item when ready.",
  dispatched: "Monitor delivery and record completion when confirmed.",
  delivered: "Confirm completion and close the request when appropriate.",
  closed: "No further workflow action is defined for this closed request.",
  cancelled: "No further workflow action is defined for this cancelled request.",
};

export default function AdminRequestDetailPage({ params }: PageProps) {
  const { requestId } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<RequestRecord | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [readError, setReadError] = useState("");
  const [client, setClient] = useState<LinkedClient | null>(null);
  const [clientState, setClientState] = useState<LinkedLoadState>("idle");
  const [clientError, setClientError] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [statusFeedback, setStatusFeedback] =
    useState<MutationFeedback>(IDLE_FEEDBACK);
  const [deleteFeedback, setDeleteFeedback] =
    useState<MutationFeedback>(IDLE_FEEDBACK);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<RequestEditForm | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editFeedback, setEditFeedback] = useState<MutationFeedback>(IDLE_FEEDBACK);
  const [editDirty, setEditDirty] = useState(false);
  const statusLock = useRef(false);
  const deleteLock = useRef(false);
  const editLock = useRef(false);
  const requestIdentity = request?.id;
  const requestStatus = request?.status;
  const requestRawStatus = request?.rawStatus;

  useEffect(() => {
    setLoadState("loading");
    setReadError("");

    const unsubscribe = onSnapshot(
      doc(db, "requests", requestId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setRequest(null);
          setLoadState("not_found");
          return;
        }

        setRequest(
          normalizeRequest(
            snapshot.id,
            snapshot.data() as Record<string, unknown>,
          ),
        );
        setLoadState("ready");
      },
      (error) => {
        console.error("Failed to load request", error);
        setRequest(null);
        setReadError(readFailureMessage(error, "request"));
        setLoadState("error");
      },
    );

    return unsubscribe;
  }, [requestId]);

  useEffect(() => {
    setStatusFeedback(IDLE_FEEDBACK);
    setDeleteFeedback(IDLE_FEEDBACK);
    setEditing(false);
    setEditForm(null);
    setEditErrors({});
    setEditFeedback(IDLE_FEEDBACK);
    setEditDirty(false);
  }, [requestId]);

  useEffect(() => {
    if (!editDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editDirty]);

  useEffect(() => {
    if (!requestIdentity) return;
    setStatusDraft(requestStatus ?? "");
  }, [requestIdentity, requestRawStatus, requestStatus]);

  useEffect(() => {
    const clientId = request?.clientId ?? "";

    if (!clientId) {
      setClient(null);
      setClientError("");
      setClientState("idle");
      return;
    }

    if (!isSafeDocumentId(clientId)) {
      setClient(null);
      setClientError("The linked client ID is malformed.");
      setClientState("error");
      return;
    }

    setClient(null);
    setClientError("");
    setClientState("loading");

    return onSnapshot(
      doc(db, "client_profiles", clientId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setClient(null);
          setClientState("not_found");
          return;
        }

        setClient(
          normalizeClient(
            snapshot.id,
            snapshot.data() as Record<string, unknown>,
          ),
        );
        setClientState("ready");
      },
      (error) => {
        console.error("Failed to load linked client", error);
        setClient(null);
        setClientError(readFailureMessage(error, "linked client"));
        setClientState("error");
      },
    );
  }, [request?.clientId]);

  function beginEditing() {
    if (!request) return;
    setEditForm(editFormFromRequest(request));
    setEditErrors({});
    setEditFeedback(IDLE_FEEDBACK);
    setEditDirty(false);
    setEditing(true);
  }

  function cancelEditing() {
    if (editDirty && !window.confirm("Discard unsaved request changes?")) return;
    setEditing(false);
    setEditForm(null);
    setEditErrors({});
    setEditFeedback(IDLE_FEEDBACK);
    setEditDirty(false);
  }

  function changeEditForm(next: RequestEditForm) {
    setEditForm(next);
    setEditDirty(true);
    setEditFeedback(IDLE_FEEDBACK);
  }

  async function saveRequestEdits() {
    if (!request || !editForm || editLock.current) return;
    const validation = validateRequestEdit(editForm);
    setEditErrors(validation.errors);
    if (Object.keys(validation.errors).length) {
      setEditFeedback({ state: "error", message: "Review the highlighted request fields before saving." });
      return;
    }

    editLock.current = true;
    setEditFeedback({ state: "saving", message: "Saving request…" });
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "requests", request.id);
        const snapshot = await transaction.get(requestRef);
        if (!snapshot.exists()) throw new Error("Request not found.");
        const latest = snapshot.data() as Record<string, unknown>;
        const latestDetail = isRecord(latest.detail) ? latest.detail : {};
        const activity = Array.isArray(latestDetail.activitySummary) ? latestDetail.activitySummary : [];
        const event: ActivityEvent = {
          id: `request-edited-${Date.now()}`,
          label: "Request details edited",
          type: "request-edited",
          meta: formatDate(new Date()),
          description: "The editable request brief fields were updated by an admin.",
          tone: "info",
          actorName: "Admin",
        };

        transaction.update(requestRef, {
          "detail.title": validation.title,
          "detail.requestType": validation.requestType,
          "detail.purchaseMode": validation.purchaseMode,
          "detail.urgency": validation.urgency,
          "detail.deadlineLabel": validation.deadlineLabel,
          "detail.assignedStylist": validation.assignedStylist,
          "detail.notes": validation.notes,
          "detail.styleNotes": validation.styleNotes,
          "detail.shippingCountry": validation.shippingCountry,
          "detail.categories": validation.categories,
          "detail.favoriteBrands": validation.favoriteBrands,
          "detail.dislikedBrands": validation.dislikedBrands,
          "detail.activitySummary": [event, ...activity],
          updatedAt: serverTimestamp(),
        });
      });
      setEditDirty(false);
      setEditing(false);
      setEditForm(null);
      setEditFeedback({ state: "success", message: "Request details saved." });
    } catch (error) {
      console.error("Failed to edit request", error);
      setEditFeedback({ state: "error", message: mutationFailureMessage(error, "request details") });
    } finally {
      editLock.current = false;
    }
  }

  async function saveStatus() {
    if (statusLock.current || !request || !isRequestStatus(statusDraft)) return;
    if (request.status === statusDraft) return;

    const nextStatus = statusDraft;
    const currentIndex = request.status
      ? REQUEST_STATUSES.indexOf(request.status)
      : -1;
    const nextIndex = REQUEST_STATUSES.indexOf(nextStatus);
    const isTerminal = nextStatus === "closed" || nextStatus === "cancelled";
    const isBackwards = currentIndex >= 0 && nextIndex < currentIndex;

    if (
      (isTerminal || isBackwards) &&
      !window.confirm(statusConfirmationMessage(nextStatus, isBackwards))
    ) {
      return;
    }

    statusLock.current = true;
    setStatusFeedback({ state: "saving", message: "Saving status…" });

    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "requests", request.id);
        const snapshot = await transaction.get(requestRef);

        if (!snapshot.exists()) throw new Error("Request not found.");

        const latest = snapshot.data() as Record<string, unknown>;
        const latestDetail = isRecord(latest.detail) ? latest.detail : {};
        const latestRawStatus =
          readString(latest.status) || readString(latestDetail.status);
        const previousLabel = isRequestStatus(latestRawStatus)
          ? REQUEST_STATUS_LABELS[latestRawStatus]
          : latestRawStatus
            ? "Unknown status"
            : "Missing status";
        const event: ActivityEvent = {
          id: createEventId(nextStatus),
          label: `Status changed to ${REQUEST_STATUS_LABELS[nextStatus]}`,
          type: "status-updated",
          meta: formatDate(new Date()),
          description: `Request moved from ${previousLabel} to ${REQUEST_STATUS_LABELS[nextStatus]}.`,
          tone: "info",
          statusLabel: "Current",
          actorName: "Admin",
        };
        const timeline = Array.isArray(latestDetail.statusTimeline)
          ? latestDetail.statusTimeline
          : [];
        const activity = Array.isArray(latestDetail.activitySummary)
          ? latestDetail.activitySummary
          : [];

        transaction.update(requestRef, {
          status: nextStatus,
          "detail.status": nextStatus,
          "detail.whatHappensNext": NEXT_ACTIONS[nextStatus],
          "detail.statusTimeline": [...timeline, event],
          "detail.activitySummary": [event, ...activity],
          updatedAt: serverTimestamp(),
        });
      });

      setStatusFeedback({
        state: "success",
        message: `Status changed to ${REQUEST_STATUS_LABELS[nextStatus]}.`,
      });
    } catch (error) {
      console.error("Failed to update request status", error);
      setStatusFeedback({
        state: "error",
        message: mutationFailureMessage(error, "status"),
      });
    } finally {
      statusLock.current = false;
    }
  }

  async function deleteRequest() {
    if (deleteLock.current || !request) return;

    const confirmation = window.prompt(
      `Permanently delete “${request.detail.title}”? This removes the request brief, status history, references, invoice and fulfilment data.\n\nType DELETE to confirm.`,
    );

    if (confirmation !== "DELETE") {
      if (confirmation !== null) {
        setDeleteFeedback({
          state: "error",
          message: "The request was not deleted. Enter DELETE exactly to confirm.",
        });
      }
      return;
    }

    deleteLock.current = true;
    setDeleteFeedback({ state: "saving", message: "Checking linked records…" });

    try {
      const ordersSnapshot = await getDocs(
        query(
          collection(db, "orders"),
          where("requestId", "==", request.id),
          limit(1),
        ),
      );

      if (!ordersSnapshot.empty) {
        setDeleteFeedback({
          state: "error",
          message: "This request is still linked to an order. Remove the relationship first, or mark the request Cancelled instead.",
        });
        return;
      }

      setDeleteFeedback({ state: "saving", message: "Deleting request…" });
      await deleteDoc(doc(db, "requests", request.id));
      router.replace("/admin/requests");
    } catch (error) {
      console.error("Failed to delete request", error);
      setDeleteFeedback({
        state: "error",
        message: deletionFailureMessage(error),
      });
    } finally {
      deleteLock.current = false;
    }
  }

  const contactEmail = firstValidEmail(client?.email, request?.clientEmail);
  const contactPhone = client?.phone || request?.clientPhone || "";
  const whatsappContactHref = request
    ? whatsappHref(contactPhone, request.clientName, request.detail.title)
    : "";

  return (
    <AdminShell active="requests">
      <AdminPage>
        <Link
          href="/admin/requests"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[#6f6259] transition hover:text-[#2b231e]"
        >
          <span aria-hidden="true">←</span>
          Back to requests
        </Link>

        {loadState === "loading" ? (
          <StateSurface>
            <AdminState
              title="Loading request"
              body="Reading this request from Firestore."
            />
          </StateSurface>
        ) : null}

        {loadState === "not_found" ? (
          <StateSurface>
            <AdminState
              title="Request not found"
              body="No request exists for this identifier. Return to the request queue to choose another record."
              tone="error"
            />
          </StateSurface>
        ) : null}

        {loadState === "error" ? (
          <StateSurface>
            <AdminState
              title="Could not load request"
              body={readError}
              tone="error"
            />
          </StateSurface>
        ) : null}

        {loadState === "ready" && request ? (
          <>
            <AdminPageHeader
              eyebrow="Request detail"
              title={request.detail.title}
              description={`Request snapshot for ${snapshotClientLabel(request)}.`}
              actions={
                <>
                  {whatsappContactHref ? (
                    <a
                      href={whatsappContactHref}
                      target="_blank"
                      rel="noreferrer"
                      className={adminSecondaryButton}
                    >
                      WhatsApp client
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                  {contactEmail ? (
                    <a
                      href={`mailto:${contactEmail}`}
                      className={adminSecondaryButton}
                    >
                      Email client
                    </a>
                  ) : null}
                  {!editing ? (
                    <button type="button" onClick={beginEditing} className={adminSecondaryButton}>
                      Edit request
                    </button>
                  ) : null}
                  <Link
                    href={`/admin/requests/${encodeURIComponent(request.id)}/quote`}
                    className={adminSecondaryButton}
                  >
                    {request.detail.quote ? "View quote" : "Create quote"}
                  </Link>
                  <Link
                    href={`/admin/create?requestId=${encodeURIComponent(request.id)}`}
                    className={adminPrimaryButton}
                  >
                    Create order
                  </Link>
                </>
              }
            />

            <section
              aria-label="Request metadata"
              className="grid divide-y divide-[#e5ddd4] border-y border-[#e5ddd4] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            >
              <MetaItem label="Status">
                <StatusMetaControl
                  request={request}
                  statusDraft={statusDraft}
                  onStatusChange={(value) => {
                    setStatusDraft(value);
                    setStatusFeedback(IDLE_FEEDBACK);
                  }}
                  onSave={saveStatus}
                  feedback={statusFeedback}
                />
              </MetaItem>
              <MetaItem label="Submitted">
                <DateValue value={request.createdAt} />
              </MetaItem>
              <MetaItem label="Type" value={request.detail.requestType || "Not provided"} />
            </section>

            {!editing && editFeedback.message ? (
              <p className={`rounded-[10px] border px-4 py-3 text-sm ${editFeedback.state === "error" ? "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]" : "border-[#c9ddcc] bg-[#eff7f0] text-[#35633c]"}`} role={editFeedback.state === "error" ? "alert" : "status"}>
                {editFeedback.message}
              </p>
            ) : null}

            {request.issues.length ? (
              <div
                role="alert"
                className="rounded-[10px] border border-[#e5d3a9] bg-[#fbf6e8] px-4 py-3 text-sm text-[#725820]"
              >
                <p className="font-semibold">Request data needs review</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-5">
                  {request.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-8">
                {editing && editForm ? (
                  <RequestEditPanel
                    form={editForm}
                    errors={editErrors}
                    feedback={editFeedback}
                    onChange={changeEditForm}
                    onCancel={cancelEditing}
                    onSave={saveRequestEdits}
                  />
                ) : (
                  <RequestBrief request={request} />
                )}
                {request.detail.references.length ? (
                  <ReferencesSection references={request.detail.references} />
                ) : null}
              </div>

              <aside className="min-w-0 space-y-6 xl:pt-14" aria-label="Request operations">
                <ClientPanel
                  request={request}
                  client={client}
                  clientState={clientState}
                  clientError={clientError}
                  contactPhone={contactPhone}
                />
                {hasRelatedRecords(request) ? (
                  <RelatedRecordsPanel request={request} />
                ) : null}
              </aside>
            </div>

            {request.detail.statusTimeline.length > 1 ? (
              <details className="rounded-[12px] border border-[#ded5cb] bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#4f4239]">
                  Activity history ({request.detail.statusTimeline.length})
                </summary>
                <div className="mt-4">
                  <TimelineList events={request.detail.statusTimeline} />
                </div>
              </details>
            ) : null}

            <DangerZone
              feedback={deleteFeedback}
              onDelete={deleteRequest}
            />
          </>
        ) : null}
      </AdminPage>
    </AdminShell>
  );
}

function DangerZone({
  feedback,
  onDelete,
}: {
  feedback: MutationFeedback;
  onDelete: () => void;
}) {
  const deleting = feedback.state === "saving";

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="inline-flex h-8 items-center justify-center rounded-[8px] border border-[#d9a89e] bg-transparent px-3 text-[11px] font-medium text-[#8c3c2d] transition hover:border-[#b45c4b] hover:bg-[#fcf0ed] focus:outline-none focus:ring-2 focus:ring-[#b45c4b] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
      >
        {deleting ? "Deleting…" : "Delete request"}
      </button>
      <MutationMessage feedback={feedback} />
    </div>
  );
}

function RequestEditPanel({ form, errors, feedback, onChange, onCancel, onSave }: { form: RequestEditForm; errors: Record<string, string>; feedback: MutationFeedback; onChange: (form: RequestEditForm) => void; onCancel: () => void; onSave: () => void }) {
  const saving = feedback.state === "saving";
  const update = <Key extends keyof RequestEditForm>(key: Key, value: RequestEditForm[Key]) => onChange({ ...form, [key]: value });

  return (
    <section aria-labelledby="edit-request-heading" className="rounded-[12px] border border-[#ded5cb] bg-[#faf8f5] p-4 sm:p-5">
      <div className="flex flex-col gap-3 border-b border-[#ded5cb] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">Request brief</p>
          <h2 id="edit-request-heading" className="mt-1 text-lg font-semibold text-[#302722]">Edit request</h2>
          <p className="mt-1 text-xs leading-5 text-[#74675e]">Edits these brief fields only. Status, quote, references, linked records and service-specific data are preserved.</p>
        </div>
        <div className="flex gap-2"><button type="button" onClick={onCancel} disabled={saving} className={adminSecondaryButton}>Cancel</button><button type="button" onClick={onSave} disabled={saving} className={adminPrimaryButton}>{saving ? "Saving…" : "Save request"}</button></div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><EditField label="Request title" error={errors.title}><input value={form.title} onChange={(event) => update("title", event.target.value)} className={requestEditControlClass} /></EditField></div>
        <EditField label="Request type" error={errors.requestType}><input value={form.requestType} onChange={(event) => update("requestType", event.target.value)} className={requestEditControlClass} /></EditField>
        <EditField label="Purchase mode" error={errors.purchaseMode}><input value={form.purchaseMode} onChange={(event) => update("purchaseMode", event.target.value)} className={requestEditControlClass} /></EditField>
        <EditField label="Urgency" error={errors.urgency}><input value={form.urgency} onChange={(event) => update("urgency", event.target.value)} className={requestEditControlClass} /></EditField>
        <EditField label="Deadline" error={errors.deadlineLabel}><input value={form.deadlineLabel} onChange={(event) => update("deadlineLabel", event.target.value)} className={requestEditControlClass} /></EditField>
        <EditField label="Shipping country" error={errors.shippingCountry}><input value={form.shippingCountry} onChange={(event) => update("shippingCountry", event.target.value)} className={requestEditControlClass} /></EditField>
        <EditField label="Assigned admin" error={errors.assignedStylist}><input value={form.assignedStylist} onChange={(event) => update("assignedStylist", event.target.value)} className={requestEditControlClass} /></EditField>
        <div className="md:col-span-2"><EditField label="Full brief" error={errors.notes}><textarea rows={6} value={form.notes} onChange={(event) => update("notes", event.target.value)} className={requestEditControlClass} /></EditField></div>
        <div className="md:col-span-2"><EditField label="Style notes" error={errors.styleNotes}><textarea rows={4} value={form.styleNotes} onChange={(event) => update("styleNotes", event.target.value)} className={requestEditControlClass} /></EditField></div>
        <EditField label="Categories" hint="Comma-separated"><textarea rows={2} value={form.categories} onChange={(event) => update("categories", event.target.value)} className={requestEditControlClass} /></EditField>
        <EditField label="Favourite brands" hint="Comma-separated"><textarea rows={2} value={form.favoriteBrands} onChange={(event) => update("favoriteBrands", event.target.value)} className={requestEditControlClass} /></EditField>
        <EditField label="Disliked brands" hint="Comma-separated"><textarea rows={2} value={form.dislikedBrands} onChange={(event) => update("dislikedBrands", event.target.value)} className={requestEditControlClass} /></EditField>
      </div>
      <MutationMessage feedback={feedback} />
    </section>
  );
}

function EditField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#62554c]"><span>{label}</span>{hint ? <span className="font-normal text-[#92857b]">{hint}</span> : null}</span>{children}{error ? <span className="mt-1 block text-xs text-[#9a4030]" role="alert">{error}</span> : null}</label>;
}

function RequestBrief({ request }: { request: RequestRecord }) {
  const detail = request.detail;
  const additionalDetails = [
    ["Purchase mode", detail.purchaseMode],
    ["Urgency", detail.urgency],
    ["Deadline", detail.deadlineLabel],
    ["Shipping country", detail.shippingCountry],
    ["Assigned admin", detail.assignedStylist],
    ["Categories", detail.categories.join(", ")],
    ["Favourite brands", detail.favoriteBrands.join(", ")],
    ["Disliked brands", detail.dislikedBrands.join(", ")],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <AdminSection
      title="Request brief"
      description="Client-provided request snapshot and sourcing preferences."
    >
      <div className="space-y-5">
        {detail.serviceSections.length ? (
          <div className="space-y-3">
            {detail.serviceSections.map((section) => (
              <div key={section.id} className="rounded-[12px] border border-[#ded5cb] bg-white p-4">
                <h3 className="text-sm font-semibold text-[#302722]">{section.title}</h3>
                <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <InlineDetail key={`${section.id}-${field.label}`} label={field.label} value={field.value} />
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : null}
        <ContentBlock label="Full brief" value={detail.notes} />
        {detail.styleNotes ? (
          <ContentBlock label="Style notes" value={detail.styleNotes} />
        ) : null}
        {additionalDetails.length ? (
          <dl className={`grid overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white ${additionalDetails.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {additionalDetails.map(([label, value]) => (
              <DetailItem key={label} label={label} value={value} />
            ))}
          </dl>
        ) : null}
      </div>
    </AdminSection>
  );
}

function ReferencesSection({ references }: { references: RequestReference[] }) {
  return (
    <AdminSection
      title="References and attachments"
      description="Links and placeholders stored with this request."
    >
      {references.length ? (
        <ul className="divide-y divide-[#e8e1d9] overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
          {references.map((reference) => (
            <li key={reference.id} className="min-w-0 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  {reference.type === "image" && reference.href ? (
                    <a href={reference.href} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reference.href} alt={reference.label || "Request reference"} className="h-20 w-20 rounded-[9px] border border-[#ded5cb] object-cover" />
                    </a>
                  ) : null}
                  <div className="min-w-0">
                  <p className="text-sm font-medium text-[#302722]">
                    {reference.label || "Unlabelled reference"}
                  </p>
                  <p className="mt-1 break-all text-xs leading-5 text-[#81746a]">
                    {reference.type === "image" ? "Uploaded image" : reference.value || "No reference value provided"}
                  </p>
                  </div>
                </div>
                {reference.href ? (
                  <a
                    href={reference.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${adminSecondaryButton} shrink-0`}
                  >
                    {reference.type === "image" ? "Open image" : "Open reference"}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : reference.type === "link" ? (
                  <span className="shrink-0 text-xs font-medium text-[#8c3c2d]">
                    Invalid link
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-[#81746a]">
                    {reference.type || "Attachment placeholder"}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <StateSurface>
          <AdminState
            title="No references provided"
            body="This request has no stored links or attachment placeholders."
          />
        </StateSurface>
      )}
    </AdminSection>
  );
}

function ClientPanel({
  request,
  client,
  clientState,
  clientError,
  contactPhone,
}: {
  request: RequestRecord;
  client: LinkedClient | null;
  clientState: LinkedLoadState;
  clientError: string;
  contactPhone: string;
}) {
  return (
    <OperationalPanel title="Client" eyebrow="Contact and relationship">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#806b5d]">
        Request snapshot
      </p>
      <dl className="mt-2 space-y-2">
        {request.clientName ? <InlineDetail label="Name" value={request.clientName} /> : null}
        {request.clientEmail ? <InlineDetail label="Email" value={request.clientEmail} breakWords /> : null}
        {request.clientPhone ? <InlineDetail label="Phone" value={request.clientPhone} breakWords /> : null}
      </dl>

      {request.clientId ? <div className="mt-4 border-t border-[#e5ddd4] pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#806b5d]">
          Live client profile
        </p>
        {clientState === "loading" ? (
          <p className="mt-2 text-sm text-[#81746a]" role="status">
            Loading linked client…
          </p>
        ) : null}
        {clientState === "not_found" ? (
          <p className="mt-2 text-sm text-[#8c3c2d]">
            The linked client profile was not found.
          </p>
        ) : null}
        {clientState === "error" ? (
          <p className="mt-2 text-sm text-[#8c3c2d]" role="alert">
            {clientError}
          </p>
        ) : null}
        {clientState === "ready" && client ? (
          <dl className="mt-2 space-y-2">
            {client.fullName ? <InlineDetail label="Name" value={client.fullName} /> : null}
            {client.email ? <InlineDetail label="Email" value={client.email} breakWords /> : null}
            {client.phone ? <InlineDetail label="Phone" value={client.phone} breakWords /> : null}
            {client.contactPreferences.length ? (
              <InlineDetail label="Contact preference" value={client.contactPreferences.join(", ")} />
            ) : null}
            {client.shippingCountry ? <InlineDetail label="Shipping country" value={client.shippingCountry} /> : null}
          </dl>
        ) : null}
      </div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {request.clientId && isSafeDocumentId(request.clientId) ? (
          <Link
            href={`/admin/clients/${request.clientId}`}
            className={adminSecondaryButton}
          >
            Open client profile
          </Link>
        ) : null}
        {phoneHref(contactPhone) ? (
          <a href={phoneHref(contactPhone) ?? undefined} className={adminSecondaryButton}>
            Call client
          </a>
        ) : null}
        {whatsappHref(contactPhone, request.clientName, request.detail.title) ? (
          <a
            href={whatsappHref(contactPhone, request.clientName, request.detail.title)}
            target="_blank"
            rel="noreferrer"
            className={adminSecondaryButton}
          >
            WhatsApp client
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </OperationalPanel>
  );
}

function StatusMetaControl({
  request,
  statusDraft,
  onStatusChange,
  onSave,
  feedback,
}: {
  request: RequestRecord;
  statusDraft: string;
  onStatusChange: (value: string) => void;
  onSave: () => void;
  feedback: MutationFeedback;
}) {
  const saving = feedback.state === "saving";

  return (
    <>
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Change request status</span>
        <select
          value={statusDraft}
          onChange={(event) => onStatusChange(event.target.value)}
          disabled={saving}
          className="h-8 w-full rounded-[8px] border border-[#d8cec3] bg-white px-2.5 text-xs text-[#473c35] outline-none focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/15 disabled:cursor-wait disabled:opacity-60"
        >
          <option value="" disabled>
            Select a recognised status
          </option>
          {REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {REQUEST_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={
            saving || !isRequestStatus(statusDraft) || statusDraft === request.status
          }
          className={`${adminPrimaryButton} h-8 shrink-0 px-3`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <MutationMessage feedback={feedback} />
    </>
  );
}

function hasRelatedRecords(request: RequestRecord) {
  return (
    request.detail.linkedOrder !== null ||
    request.detail.linkedEditsCount > 0
  );
}

function RelatedRecordsPanel({ request }: { request: RequestRecord }) {
  return (
    <OperationalPanel title="Related records" eyebrow="Explicit links">
      <div className="space-y-3">
          {request.detail.linkedOrder ? (
            <Link
              href={
                isSafeDocumentId(request.detail.linkedOrder.id)
                  ? `/admin/orders/${request.detail.linkedOrder.id}`
                  : "/admin/orders"
              }
              className="block rounded-[10px] border border-[#ded5cb] bg-white px-3 py-2.5 text-sm text-[#4e4138] transition hover:bg-[#faf7f2]"
            >
              Linked order: {request.detail.linkedOrder.title}
            </Link>
          ) : null}
          {request.detail.linkedEditsCount ? (
            <p className="text-xs leading-5 text-[#81746a]">
              {request.detail.linkedEditsCount} linked edit record
              {request.detail.linkedEditsCount === 1 ? " is" : "s are"} stored,
              but no admin edit route exists.
            </p>
          ) : null}
      </div>
    </OperationalPanel>
  );
}

function TimelineList({ events }: { events: ActivityEvent[] }) {
  if (!events.length) {
    return (
      <StateSurface>
        <AdminState
          title="No status history"
          body="No embedded status events are recorded on this request."
        />
      </StateSurface>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event, index) => (
        <li
          key={`${event.id}-${index}`}
          className="rounded-[10px] border border-[#ded5cb] bg-white px-4 py-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-[#302722]">
                {event.label || "Unlabelled event"}
              </p>
              {event.actorName ? (
                <p className="mt-1 text-xs text-[#81746a]">{event.actorName}</p>
              ) : null}
            </div>
            {event.meta ? (
              <p className="shrink-0 text-xs text-[#81746a]">{event.meta}</p>
            ) : null}
          </div>
          {event.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#6f6259]">
              {event.description}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function OperationalPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-[#ded5cb] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-base font-semibold text-[#302722]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ContentBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#806b5d]">
        {label}
      </p>
      <div className="mt-1.5 rounded-[12px] border border-[#ded5cb] bg-white p-4">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#62564e]">
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-[#e8e1d9] px-4 py-3 last:border-b-0 sm:odd:border-r">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#806b5d]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm leading-6 text-[#62564e]">
        {value || "Not provided"}
      </dd>
    </div>
  );
}

function MetaItem({
  label,
  value,
  children,
  breakWords = false,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  breakWords?: boolean;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#806b5d]">
        {label}
      </p>
      <div className={`mt-1 text-sm text-[#62564e] ${breakWords ? "break-all" : ""}`}>
        {children ?? value ?? "Not provided"}
      </div>
    </div>
  );
}

function InlineDetail({
  label,
  value,
  breakWords = false,
}: {
  label: string;
  value: string;
  breakWords?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#806b5d]">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm text-[#62564e] ${breakWords ? "break-all" : "break-words"}`}>
        {value || "Not provided"}
      </dd>
    </div>
  );
}

function DateValue({ value }: { value: Date | null }) {
  return value ? (
    <time dateTime={value.toISOString()}>{formatDate(value)}</time>
  ) : (
    <span className="text-[#8c3c2d]">Unavailable</span>
  );
}

function MutationMessage({ feedback }: { feedback: MutationFeedback }) {
  if (feedback.state === "idle") return null;

  return (
    <p
      className={`mt-3 text-sm ${
        feedback.state === "error"
          ? "text-[#8c3c2d]"
          : feedback.state === "success"
            ? "text-[#35633c]"
            : "text-[#6f6259]"
      }`}
      role={feedback.state === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {feedback.message}
    </p>
  );
}

function StateSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[#ded5cb] bg-white">
      {children}
    </div>
  );
}

function normalizeRequest(
  id: string,
  data: Record<string, unknown>,
): RequestRecord {
  const detailExists = isRecord(data.detail);
  const detail = detailExists ? data.detail as Record<string, unknown> : {};
  const rawStatus = readString(data.status) || readString(detail.status);
  const status = isRequestStatus(rawStatus) ? rawStatus : null;
  const createdAt = readDate(data.createdAt);
  const updatedAt = readDate(data.updatedAt);
  const references = normalizeReferences(detail.references);
  const linkedOrder = normalizeLinkedPreview(detail.linkedOrder);
  const statusTimeline = normalizeEvents(detail.statusTimeline);
  const issues = [
    !detailExists ? "Request detail data is missing or malformed." : "",
    !status
      ? rawStatus
        ? `Status “${rawStatus}” is not recognised.`
        : "Request status is missing."
      : "",
    !createdAt ? "Submitted date is missing or invalid." : "",
    !updatedAt ? "Updated date is missing or invalid." : "",
    detail.references !== undefined && !Array.isArray(detail.references)
      ? "References are malformed and could not be displayed."
      : "",
    detail.statusTimeline !== undefined && !Array.isArray(detail.statusTimeline)
      ? "Status history is malformed and could not be displayed."
      : "",
  ].filter(Boolean);

  return {
    id,
    clientId: readString(data.clientId),
    clientName:
      readString(data.clientName) ||
      readString(data.fullName) ||
      readString(data.name),
    clientEmail: readString(data.clientEmail),
    clientPhone: readString(data.clientPhone) || readString(data.phone),
    rawStatus,
    status,
    createdAt,
    updatedAt,
    source: readString(data.source),
    submittedFrom: readString(data.submittedFrom),
    issues,
    detail: {
      title: readString(detail.title) || "Untitled request",
      requestType: readString(detail.requestType),
      purchaseMode: readString(detail.purchaseMode),
      urgency: readString(detail.urgency),
      deadlineLabel: readString(detail.deadlineLabel),
      assignedStylist: readString(detail.assignedStylist),
      notes: readString(detail.notes),
      styleNotes: readString(detail.styleNotes),
      shippingCountry: readString(detail.shippingCountry),
      categories: readStringArray(detail.categories),
      favoriteBrands: readStringArray(detail.favoriteBrands),
      dislikedBrands: readStringArray(detail.dislikedBrands),
      references,
      whatHappensNext: readString(detail.whatHappensNext),
      statusTimeline,
      linkedOrder,
      linkedEditsCount: Array.isArray(detail.linkedEdits)
        ? detail.linkedEdits.length
        : 0,
      serviceSections: normalizeServiceSections(detail.serviceDetails),
      quote: normalizeQuoteSummary(detail.quote),
    },
  };
}

function normalizeQuoteSummary(value: unknown): QuoteSummary | null {
  if (!isRecord(value)) return null;
  const currency = readString(value.currency);
  const total = Number(value.total);
  if (!["GBP", "EUR", "USD"].includes(currency) || !Number.isFinite(total) || total < 0) {
    return null;
  }
  return {
    currency: currency as QuoteSummary["currency"],
    quoteNumber: readString(value.quoteNumber),
    total,
    validUntil: readString(value.validUntil),
  };
}

function normalizeServiceSections(value: unknown): ServiceDetailSection[] {
  if (!isRecord(value)) return [];
  const mode = readString(value.mode);

  if (mode === "item_sourcing") {
    if (!Array.isArray(value.items)) return [];
    return value.items.flatMap((entry, index) => {
      if (!isRecord(entry)) return [];
      const name = readString(entry.item) || `Item ${index + 1}`;
      const fields = compactServiceFields([
        ["Make / brand", readString(entry.make)],
        ["Model / style", readString(entry.model)],
        ["Size", readString(entry.size)],
        ["Colour", readString(entry.colour)],
        ["Condition", serviceValueLabel(readString(entry.condition))],
        ["Budget", readString(entry.budget)],
        ["Notes", readString(entry.notes)],
      ]);
      return [{ id: readString(entry.id) || `item-${index + 1}`, title: name, fields }];
    });
  }

  if (mode === "styling_edit") {
    return [{
      id: "styling-edit",
      title: "Styling edit details",
      fields: compactServiceFields([
        ["Edit for", serviceValueLabel(readString(value.editFor))],
        ["Delivery", serviceValueLabel(readString(value.deliveryMode))],
        ["Occasion / trip", readString(value.occasion)],
        ["Occasion date", formatStoredDate(readString(value.occasionDate))],
        ["Number of looks", readString(value.numberOfLooks)],
        ["Sizes", readString(value.sizes)],
        ["Budget", readString(value.budget)],
        ["Goals", readString(value.goals)],
      ]),
    }];
  }

  if (mode === "wardrobe_refresh") {
    return [{
      id: "wardrobe-refresh",
      title: "Wardrobe refresh details",
      fields: compactServiceFields([
        ["Session format", serviceValueLabel(readString(value.sessionMode))],
        ["Focus", serviceValueLabel(readString(value.focus))],
        ["Location", readString(value.location)],
        ["Preferred date", formatStoredDate(readString(value.preferredDate))],
        ["Wardrobe size", readString(value.wardrobeSize)],
        ["Goals", readString(value.goals)],
      ]),
    }];
  }

  return [];
}

function compactServiceFields(entries: string[][]) {
  return entries
    .filter((entry) => Boolean(entry[1]))
    .map(([label, value]) => ({ label, value }));
}

function serviceValueLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatStoredDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function normalizeClient(
  id: string,
  data: Record<string, unknown>,
): LinkedClient {
  const profile = isRecord(data.profile) ? data.profile : {};
  const shippingAddress = isRecord(profile.shippingAddress)
    ? profile.shippingAddress
    : {};

  return {
    id,
    fullName:
      readString(profile.fullName) ||
      readString(data.fullName) ||
      "Unnamed client",
    email: readString(data.email),
    phone: readString(profile.phoneNumber) || readString(data.phoneNumber),
    contactPreferences: readStringArray(profile.contactPreferences),
    shippingCountry: readString(shippingAddress.country),
  };
}

function normalizeReferences(value: unknown): RequestReference[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry, index) => {
    const reference = isRecord(entry) ? entry : {};
    const type = readString(reference.type);
    const referenceValue = readString(reference.value);

    return {
      id: readString(reference.id) || `reference-${index + 1}`,
      label: readString(reference.label),
      type,
      value: referenceValue,
      href:
        type === "link" || type === "image"
          ? parseOptionalHttpUrl(referenceValue)
          : null,
    };
  });
}

function normalizeLinkedPreview(value: unknown): LinkedPreview | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  if (!isSafeDocumentId(id)) return null;

  return {
    id,
    title: readString(value.title) || id,
    description: readString(value.description),
  };
}

function normalizeEvents(value: unknown): ActivityEvent[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<ActivityEvent[]>((events, entry, index) => {
      if (!isRecord(entry)) return events;

      const event: ActivityEvent = {
        id: readString(entry.id) || `event-${index + 1}`,
        label: readString(entry.label) || "Unlabelled event",
        type: readString(entry.type) || "unknown",
        meta: readString(entry.meta) || undefined,
        description: readString(entry.description) || undefined,
        tone: readString(entry.tone) || undefined,
        statusLabel: readString(entry.statusLabel) || undefined,
        actorName: readString(entry.actorName) || undefined,
      };

      events.push(event);
      return events;
    }, []);
}

function parseOptionalHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function readDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (isRecord(value) && typeof value.toDate === "function") {
    const date = (value.toDate as () => Date)();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (isRecord(value)) {
    const seconds = Number(value.seconds ?? value._seconds);
    const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);

    if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
      const date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : [];
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeDocumentId(value: string) {
  return Boolean(value) && !value.includes("/");
}

function snapshotClientLabel(request: RequestRecord) {
  return request.clientName || request.clientEmail || request.clientId || "an unidentified client";
}

const requestEditControlClass = "block min-h-10 w-full rounded-[9px] border border-[#d3c8bd] bg-white px-3 py-2 text-sm text-[#302722] outline-none focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/20";

function editFormFromRequest(request: RequestRecord): RequestEditForm {
  const detail = request.detail;
  return {
    title: detail.title,
    requestType: detail.requestType,
    purchaseMode: detail.purchaseMode,
    urgency: detail.urgency,
    deadlineLabel: detail.deadlineLabel,
    assignedStylist: detail.assignedStylist,
    notes: detail.notes,
    styleNotes: detail.styleNotes,
    shippingCountry: detail.shippingCountry,
    categories: detail.categories.join(", "),
    favoriteBrands: detail.favoriteBrands.join(", "),
    dislikedBrands: detail.dislikedBrands.join(", "),
  };
}

function validateRequestEdit(form: RequestEditForm) {
  const errors: Record<string, string> = {};
  const title = form.title.trim();
  const notes = form.notes.trim();
  const styleNotes = form.styleNotes.trim();
  if (!title) errors.title = "Enter a request title.";
  else if (title.length > 250) errors.title = "Keep the title to 250 characters or fewer.";
  if (!notes) errors.notes = "Enter the full request brief.";
  else if (notes.length > 5000) errors.notes = "Keep the brief to 5,000 characters or fewer.";
  if (styleNotes.length > 5000) errors.styleNotes = "Keep style notes to 5,000 characters or fewer.";

  const shortFields: Array<[keyof RequestEditForm, string]> = [
    ["requestType", "Request type"],
    ["purchaseMode", "Purchase mode"],
    ["urgency", "Urgency"],
    ["deadlineLabel", "Deadline"],
    ["assignedStylist", "Assigned admin"],
    ["shippingCountry", "Shipping country"],
  ];
  shortFields.forEach(([key, label]) => {
    if (form[key].trim().length > 250) errors[key] = `${label} must be 250 characters or fewer.`;
  });

  return {
    errors,
    title,
    requestType: form.requestType.trim(),
    purchaseMode: form.purchaseMode.trim(),
    urgency: form.urgency.trim(),
    deadlineLabel: form.deadlineLabel.trim(),
    assignedStylist: form.assignedStylist.trim(),
    notes,
    styleNotes,
    shippingCountry: form.shippingCountry.trim(),
    categories: parseRequestList(form.categories),
    favoriteBrands: parseRequestList(form.favoriteBrands),
    dislikedBrands: parseRequestList(form.dislikedBrands),
  };
}

function parseRequestList(value: string) {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))];
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function phoneHref(value: string) {
  const normalized = value.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : null;
}

function whatsappHref(phone: string, clientName: string, requestTitle: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  const greeting = clientName.trim() ? `Hi ${clientName.trim()},` : "Hi,";
  const message = `${greeting} I’m following up about your Tufffinds request: ${requestTitle}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function firstValidEmail(...values: Array<string | undefined>) {
  return (
    values.find(
      (value): value is string =>
        Boolean(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string),
    ) ?? ""
  );
}

function statusConfirmationMessage(nextStatus: RequestStatus, backwards: boolean) {
  if (nextStatus === "cancelled") {
    return "Cancel this request? This is a terminal workflow status and requires a deliberate later change to reopen.";
  }
  if (nextStatus === "closed") {
    return "Close this request? Confirm that no further work is currently required.";
  }
  if (backwards) {
    return `Move this request backwards to ${REQUEST_STATUS_LABELS[nextStatus]}?`;
  }
  return `Change status to ${REQUEST_STATUS_LABELS[nextStatus]}?`;
}

function createEventId(status: RequestStatus) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now());
  return `${status}-${suffix}`;
}

function readFailureMessage(error: unknown, resource: string) {
  return errorCode(error) === "permission-denied"
    ? `You do not have permission to read this ${resource}.`
    : `The ${resource} query failed. Available request data has not been replaced with empty values.`;
}

function mutationFailureMessage(error: unknown, operation: string) {
  return errorCode(error) === "permission-denied"
    ? `You do not have permission to update ${operation}.`
    : `Could not save ${operation}. No success has been assumed.`;
}

function deletionFailureMessage(error: unknown) {
  const code = errorCode(error);

  if (code === "permission-denied") {
    return "You do not have permission to delete this request or check its linked records.";
  }

  if (code === "failed-precondition") {
    return "Linked records could not be checked because the required database index is unavailable. The request was not deleted.";
  }

  return "Could not delete this request. It may still exist; refresh the request list before trying again.";
}

function errorCode(error: unknown) {
  return isRecord(error) ? readString(error.code) : "";
}
