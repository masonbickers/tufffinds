"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import {
  AdminFilterSelect,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminSearchInput,
  AdminState,
  AdminToolbar,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../_components/AdminUI";
import { REQUEST_STATUSES, type RequestStatus } from "../admin-types";
import {
  isRequestStatus,
  REQUEST_STATUS_LABELS,
} from "../admin-utils";

type LoadState = "loading" | "ready" | "error";

type QueueFilter =
  | "all"
  | "attention"
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "unknown"
  | RequestStatus;

type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc";

type QueueRequest = {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  summary: string;
  requestType: string;
  urgency: string;
  status: RequestStatus | null;
  rawStatus: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  searchTerms: string[];
  issues: string[];
};

const QUEUE_FILTERS = new Set<QueueFilter>([
  "all",
  "attention",
  "open",
  "in_progress",
  "completed",
  "cancelled",
  "unknown",
  ...REQUEST_STATUSES,
]);

const SORT_OPTIONS = new Set<SortOption>([
  "updated_desc",
  "updated_asc",
  "created_desc",
  "created_asc",
]);

const TERMINAL_STATUSES = new Set<RequestStatus>([
  "delivered",
  "closed",
  "cancelled",
]);

const ATTENTION_STATUSES = new Set<RequestStatus>([
  "submitted",
  "needs_info",
]);

const REQUEST_NEXT_ACTIONS: Record<RequestStatus, string> = {
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

export default function AdminRequestsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const search = searchParams.get("q") ?? "";
  const clientId = searchParams.get("clientId") ?? "";
  const queueFilter = readQueueFilter(searchParams.get("status"));
  const sort = readSortOption(searchParams.get("sort"));

  useEffect(() => {
    setLoadState("loading");

    const unsubscribe = onSnapshot(
      collection(db, "requests"),
      (snapshot) => {
        setRequests(
          snapshot.docs.map((entry) =>
            normalizeRequest(entry.id, entry.data() as Record<string, unknown>),
          ),
        );
        setLoadState("ready");
      },
      (error) => {
        console.error("Failed to load requests", error);
        setRequests([]);
        setLoadState("error");
      },
    );

    return unsubscribe;
  }, []);

  const summary = useMemo(
    () => ({
      new: requests.filter((request) => request.status === "submitted").length,
      needsInfo: requests.filter((request) => request.status === "needs_info")
        .length,
      inProgress: requests.filter((request) => isInProgress(request.status))
        .length,
      completed: requests.filter(
        (request) =>
          request.status === "delivered" || request.status === "closed",
      ).length,
    }),
    [requests],
  );

  const visibleRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests
      .filter((request) => !clientId || request.clientId === clientId)
      .filter((request) => matchesQueueFilter(request, queueFilter))
      .filter(
        (request) =>
          !term ||
          request.searchTerms.some((value) => value.toLowerCase().includes(term)),
      )
      .sort((left, right) => compareRequests(left, right, sort));
  }, [clientId, queueFilter, requests, search, sort]);

  const malformedCount = requests.filter((request) => request.issues.length).length;
  const hasActiveFilters =
    search.trim().length > 0 || Boolean(clientId) || queueFilter !== "all" || sort !== "updated_desc";

  function updateQuery(
    key: "q" | "status" | "sort",
    value: string,
    defaultValue = "",
  ) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (!value || value === defaultValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }

    const queryString = nextParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  function clearFilters() {
    router.replace(pathname, { scroll: false });
  }

  return (
    <AdminShell active="requests">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Request queue"
          title="Requests"
          description="Review new briefs, follow up on missing information and progress active sourcing work."
          actions={
            <Link href="/admin/requests/new" className={adminPrimaryButton}>
              Add request
            </Link>
          }
        />

        <section aria-label="Request queue summary">
          <div className="grid divide-y divide-[#e2d9cf] border-y border-[#e2d9cf] sm:grid-cols-4 sm:divide-y-0">
            <AdminMetric
              label="New"
              value={summaryValue(loadState, summary.new)}
              detail="Submitted and awaiting review"
            />
            <AdminMetric
              label="Needs information"
              value={summaryValue(loadState, summary.needsInfo)}
              detail="Client follow-up required"
            />
            <AdminMetric
              label="In progress"
              value={summaryValue(loadState, summary.inProgress)}
              detail="Recognised active workflow"
            />
            <AdminMetric
              label="Completed"
              value={summaryValue(loadState, summary.completed)}
              detail="Delivered or closed"
            />
          </div>
        </section>

        <section aria-labelledby="request-list-heading">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="request-list-heading" className="text-lg font-semibold text-[#302722]">
                Request queue
              </h2>
              <p className="mt-0.5 text-sm text-[#7b6e65]">
                Default order: most recently updated first.
              </p>
            </div>
            {loadState === "ready" ? (
              <p className="text-xs tabular-nums text-[#74675e]" aria-live="polite">
                {visibleRequests.length} of {requests.length} shown
              </p>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
            <AdminToolbar>
              <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <AdminSearchInput
                  value={search}
                  onChange={(value) => updateQuery("q", value)}
                  placeholder="Search client, title, brief, brand or reference"
                  label="Search requests"
                />
                <AdminFilterSelect
                  label="Filter requests"
                  value={queueFilter}
                  onChange={(value) => updateQuery("status", value, "all")}
                >
                  <optgroup label="Queue views">
                    <option value="all">All requests</option>
                    <option value="attention">Needs attention</option>
                    <option value="open">All open</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="unknown">Unknown status</option>
                  </optgroup>
                  <optgroup label="Exact status">
                    {REQUEST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {REQUEST_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </optgroup>
                </AdminFilterSelect>
                <AdminFilterSelect
                  label="Sort requests"
                  value={sort}
                  onChange={(value) => updateQuery("sort", value, "updated_desc")}
                >
                  <option value="updated_desc">Updated: newest</option>
                  <option value="updated_asc">Updated: oldest</option>
                  <option value="created_desc">Submitted: newest</option>
                  <option value="created_asc">Submitted: oldest</option>
                </AdminFilterSelect>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={`${adminSecondaryButton} shrink-0`}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </AdminToolbar>

            {loadState === "ready" && malformedCount > 0 ? (
              <p
                role="status"
                className="border-b border-[#e5d3a9] bg-[#fbf6e8] px-4 py-2.5 text-xs leading-5 text-[#725820]"
              >
                {malformedCount} {malformedCount === 1 ? "request has" : "requests have"}{" "}
                missing or unrecognised workflow data. These records remain available
                but are excluded from summaries when their status is invalid.
              </p>
            ) : null}

            <RequestResults
              loadState={loadState}
              requests={requests}
              visibleRequests={visibleRequests}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />
          </div>
        </section>
      </AdminPage>
    </AdminShell>
  );
}

function RequestResults({
  loadState,
  requests,
  visibleRequests,
  hasActiveFilters,
  onClearFilters,
}: {
  loadState: LoadState;
  requests: QueueRequest[];
  visibleRequests: QueueRequest[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}) {
  if (loadState === "loading") {
    return (
      <AdminState
        title="Loading requests"
        body="Reading the current request queue from Firestore."
      />
    );
  }

  if (loadState === "error") {
    return (
      <AdminState
        title="Could not load requests"
        body="The request query failed. No counts or empty results are being inferred."
        tone="error"
      />
    );
  }

  if (!requests.length) {
    return (
      <AdminState
        title="No requests yet"
        body="No request documents currently exist in the request queue."
      />
    );
  }

  if (!visibleRequests.length) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <h3 className="text-base font-semibold text-[#302722]">
          No matching requests
        </h3>
        <p className="mt-1 text-sm text-[#766960]">
          No requests match the current search, status and sort view.
        </p>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className={`${adminSecondaryButton} mt-4`}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    );
  }

  return <RequestList requests={visibleRequests} />;
}

function RequestList({ requests }: { requests: QueueRequest[] }) {
  return (
    <div>
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(12rem,0.72fr)_minmax(9rem,0.58fr)_2rem] gap-4 border-b border-[#e5ddd4] bg-[#faf8f4] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#776a61] lg:grid"
      >
        <span>Request</span>
        <span>Client</span>
        <span>Status</span>
        <span>Updated</span>
        <span />
      </div>
      <ul className="divide-y divide-[#ece5dd]">
        {requests.map((request) => (
          <li key={request.id}>
            <RequestRow request={request} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequestRow({ request }: { request: QueueRequest }) {
  const clientLabel = request.clientName || request.clientEmail || "Client not set";
  const attention = request.status && ATTENTION_STATUSES.has(request.status);
  const [statusDraft, setStatusDraft] = useState(request.status ?? "");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!savingStatus) setStatusDraft(request.status ?? "");
  }, [request.status, savingStatus]);

  async function changeStatus(value: string) {
    if (!isRequestStatus(value) || savingStatus || value === request.status) return;
    const nextStatus = value;
    const currentIndex = request.status ? REQUEST_STATUSES.indexOf(request.status) : -1;
    const nextIndex = REQUEST_STATUSES.indexOf(nextStatus);
    const backwards = currentIndex >= 0 && nextIndex < currentIndex;
    if ((backwards || nextStatus === "closed" || nextStatus === "cancelled") && !window.confirm(queueStatusConfirmation(nextStatus, backwards))) {
      setStatusDraft(request.status ?? "");
      return;
    }

    setStatusDraft(nextStatus);
    setSavingStatus(true);
    setStatusMessage("Saving…");
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, "requests", request.id);
        const snapshot = await transaction.get(requestRef);
        if (!snapshot.exists()) throw new Error("Request not found.");
        const latest = snapshot.data() as Record<string, unknown>;
        const detail = isRecord(latest.detail) ? latest.detail : {};
        const latestRawStatus = readString(latest.status) || readString(detail.status);
        const previousLabel = isRequestStatus(latestRawStatus) ? REQUEST_STATUS_LABELS[latestRawStatus] : "Unknown status";
        const event = {
          id: `status-${nextStatus}-${Date.now()}`,
          label: `Status changed to ${REQUEST_STATUS_LABELS[nextStatus]}`,
          type: "status-updated",
          meta: formatDate(new Date()),
          description: `Request moved from ${previousLabel} to ${REQUEST_STATUS_LABELS[nextStatus]}.`,
          tone: "info",
          statusLabel: "Current",
          actorName: "Admin",
        };
        const timeline = Array.isArray(detail.statusTimeline) ? detail.statusTimeline : [];
        const activity = Array.isArray(detail.activitySummary) ? detail.activitySummary : [];
        transaction.update(requestRef, {
          status: nextStatus,
          "detail.status": nextStatus,
          "detail.whatHappensNext": REQUEST_NEXT_ACTIONS[nextStatus],
          "detail.statusTimeline": [...timeline, event],
          "detail.activitySummary": [event, ...activity],
          updatedAt: serverTimestamp(),
        });
      });
      setStatusMessage("Updated");
    } catch (error) {
      console.error("Failed to update request status from queue", error);
      setStatusDraft(request.status ?? "");
      setStatusMessage("Could not update");
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div
      className={`group relative min-w-0 px-4 py-3.5 transition hover:bg-[#faf7f2] ${
        attention ? "shadow-[inset_3px_0_0_#b59674]" : ""
      }`}
    >
      <Link href={`/admin/requests/${request.id}`} aria-label={`Open request ${request.title} for ${clientLabel}`} className="absolute inset-0 z-0 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#806650] focus:ring-inset"><span className="sr-only">Open request</span></Link>
      <div className="pointer-events-none relative z-10 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(12rem,0.72fr)_minmax(9rem,0.58fr)_2rem] lg:items-center lg:gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#241e1a] group-hover:text-black">
              {request.title}
            </p>
            {request.urgency ? (
              <span className="shrink-0 rounded-full bg-[#f7f1ea] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#74675e]">
                {request.urgency}
              </span>
            ) : null}
            {request.issues.length ? (
              <span
                title={request.issues.join(", ")}
                className="shrink-0 rounded-full border border-[#e5d3a9] bg-[#fbf6e8] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#725820]"
              >
                Data issue
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#81746a] lg:truncate">
            {request.summary}
          </p>
          {request.requestType ? (
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#968980]">
              {request.requestType}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm text-[#62564e]">{clientLabel}</p>
          {request.clientName && request.clientEmail ? (
            <p className="mt-1 truncate text-xs text-[#8b7e75]">
              {request.clientEmail}
            </p>
          ) : null}
        </div>

        <div className="pointer-events-auto flex items-center justify-between gap-3 lg:block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#968980] lg:hidden">
            Status
          </span>
          <div className="min-w-0">
            <select
              aria-label={`Change status for ${request.title}`}
              value={statusDraft}
              disabled={savingStatus}
              onChange={(event) => void changeStatus(event.target.value)}
              className="h-9 w-full min-w-0 rounded-[9px] border border-[#d3c8bd] bg-white px-2.5 text-xs font-semibold text-[#4f4239] outline-none focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/20 disabled:cursor-wait disabled:opacity-60"
            >
              {!request.status ? <option value="">{requestStatusLabel(request)}</option> : null}
              {REQUEST_STATUSES.map((status) => <option key={status} value={status}>{REQUEST_STATUS_LABELS[status]}</option>)}
            </select>
            {statusMessage ? <p className={`mt-1 text-[10px] ${statusMessage === "Could not update" ? "text-[#8c3c2d]" : "text-[#6f6259]"}`} role={statusMessage === "Could not update" ? "alert" : "status"}>{statusMessage}</p> : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#968980] lg:hidden">
            Updated
          </span>
          {request.updatedAt ? (
            <time
              dateTime={request.updatedAt.toISOString()}
              className="text-xs tabular-nums text-[#6f6259]"
            >
              {formatDate(request.updatedAt)}
            </time>
          ) : (
            <span className="text-xs text-[#8c3c2d]">Unavailable</span>
          )}
        </div>

        <span aria-hidden="true" className="hidden text-right text-[#9a8d83] lg:block">
          →
        </span>
      </div>
    </div>
  );
}

function normalizeRequest(
  id: string,
  data: Record<string, unknown>,
): QueueRequest {
  const detail = isRecord(data.detail) ? data.detail : {};
  const rawStatus = readString(data.status) || readString(detail.status);
  const status = isRequestStatus(rawStatus) ? rawStatus : null;
  const createdAt = readDate(data.createdAt);
  const updatedAt = readDate(data.updatedAt);
  const clientName =
    readString(data.clientName) ||
    readString(data.fullName) ||
    readString(data.name);
  const clientEmail = readString(data.clientEmail);
  const title = readString(detail.title) || "Untitled request";
  const requestType = readString(detail.requestType);
  const urgency = readString(detail.urgency);
  const summary =
    readString(detail.notes) ||
    readString(detail.styleNotes) ||
    readString(detail.whatHappensNext) ||
    "No brief summary captured.";
  const categories = readStringArray(detail.categories);
  const brands = [
    ...readStringArray(detail.favoriteBrands),
    ...readStringArray(detail.dislikedBrands),
  ];
  const references = readReferenceTerms(detail.references);
  const serviceTerms = readNestedStringValues(detail.serviceDetails);
  const issues = [
    !status ? (rawStatus ? "unrecognised status" : "missing status") : "",
    !createdAt ? "missing or invalid submitted date" : "",
    !updatedAt ? "missing or invalid updated date" : "",
  ].filter(Boolean);

  return {
    id,
    clientId: readString(data.clientId),
    clientName,
    clientEmail,
    title,
    summary,
    requestType,
    urgency,
    status,
    rawStatus,
    createdAt,
    updatedAt,
    searchTerms: [
      id,
      readString(data.clientId),
      clientName,
      clientEmail,
      title,
      summary,
      requestType,
      urgency,
      rawStatus,
      readString(detail.shippingCountry),
      ...categories,
      ...brands,
      ...references,
      ...serviceTerms,
    ].filter(Boolean),
    issues,
  };
}

function matchesQueueFilter(request: QueueRequest, filter: QueueFilter) {
  if (filter === "all") return true;
  if (filter === "unknown") return request.status === null;
  if (filter === "attention") {
    return request.status !== null && ATTENTION_STATUSES.has(request.status);
  }
  if (filter === "open") return isOpen(request.status);
  if (filter === "in_progress") return isInProgress(request.status);
  if (filter === "completed") {
    return request.status === "delivered" || request.status === "closed";
  }
  if (filter === "cancelled") return request.status === "cancelled";
  return request.status === filter;
}

function isOpen(status: RequestStatus | null): status is RequestStatus {
  return status !== null && !TERMINAL_STATUSES.has(status);
}

function isInProgress(status: RequestStatus | null) {
  return isOpen(status) && !ATTENTION_STATUSES.has(status);
}

function compareRequests(
  left: QueueRequest,
  right: QueueRequest,
  sort: SortOption,
) {
  const field = sort.startsWith("created") ? "createdAt" : "updatedAt";
  const direction = sort.endsWith("asc") ? 1 : -1;
  const leftDate = left[field];
  const rightDate = right[field];

  if (leftDate && rightDate) {
    const difference = (leftDate.getTime() - rightDate.getTime()) * direction;
    if (difference !== 0) return difference;
  } else if (leftDate) {
    return -1;
  } else if (rightDate) {
    return 1;
  }

  return left.id.localeCompare(right.id);
}

function readQueueFilter(value: string | null): QueueFilter {
  return value && QUEUE_FILTERS.has(value as QueueFilter)
    ? (value as QueueFilter)
    : "all";
}

function readSortOption(value: string | null): SortOption {
  return value && SORT_OPTIONS.has(value as SortOption)
    ? (value as SortOption)
    : "updated_desc";
}

function requestStatusLabel(request: QueueRequest) {
  if (request.status) return REQUEST_STATUS_LABELS[request.status];
  return request.rawStatus ? "Unknown status" : "Missing status";
}

function queueStatusConfirmation(nextStatus: RequestStatus, backwards: boolean) {
  if (nextStatus === "cancelled") return "Cancel this request from the queue?";
  if (nextStatus === "closed") return "Close this request from the queue?";
  if (backwards) return `Move this request backwards to ${REQUEST_STATUS_LABELS[nextStatus]}?`;
  return `Change status to ${REQUEST_STATUS_LABELS[nextStatus]}?`;
}

function summaryValue(loadState: LoadState, value: number) {
  return loadState === "ready" ? value : "—";
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

function readReferenceTerms(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((reference) => {
    if (!isRecord(reference)) return [];
    return [readString(reference.label), readString(reference.value)].filter(Boolean);
  });
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(readString).filter(Boolean) : [];
}

function readNestedStringValues(value: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => readNestedStringValues(entry, depth + 1));
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap((entry) =>
      readNestedStringValues(entry, depth + 1),
    );
  }
  return [];
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
