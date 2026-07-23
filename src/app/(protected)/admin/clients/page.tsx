"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
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
  AdminTable,
  AdminToolbar,
  adminSecondaryButton,
} from "../_components/AdminUI";
import type { OrderStatus, RequestStatus } from "../admin-types";
import {
  isOpenRequestStatus,
  isOrderStatus,
  isRequestStatus,
  orderQueueGroup,
} from "../admin-utils";
import {
  csvCell,
  effectiveTimestamp,
  formatDate,
  isRecord,
  isSafeDocumentId,
  normalizeClientDocument,
  onboardingLabel,
  readString,
  readTimestamp,
  validTimestamp,
  type LoadState,
  type ManagedClient,
} from "./client-management";

type ActivityFilter = "all" | "open_requests" | "active_orders";
type ProfileFilter =
  | "all"
  | "onboarded"
  | "incomplete"
  | "missing_email"
  | "missing_phone"
  | "missing_address"
  | "stale";
type IssueFilter = "all" | "with" | "without";
type SortOption =
  | "activity_desc"
  | "activity_asc"
  | "requests_desc"
  | "orders_desc"
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc";
type RelatedRequest = {
  clientId: string;
  status: RequestStatus | null;
  updatedAt: Date | null;
};
type RelatedOrder = {
  clientId: string;
  status: OrderStatus | null;
  updatedAt: Date | null;
};
type ActivityMaps = {
  openRequests: Map<string, number>;
  activeOrders: Map<string, number>;
  latestRelated: Map<string, Date>;
  requestStatusIncomplete: Set<string>;
  orderStatusIncomplete: Set<string>;
};

const STALE_DAYS = 90;
const ACTIVITY_FILTERS = new Set<ActivityFilter>([
  "all",
  "open_requests",
  "active_orders",
]);
const PROFILE_FILTERS = new Set<ProfileFilter>([
  "all",
  "onboarded",
  "incomplete",
  "missing_email",
  "missing_phone",
  "missing_address",
  "stale",
]);
const ISSUE_FILTERS = new Set<IssueFilter>(["all", "with", "without"]);
const SORT_OPTIONS = new Set<SortOption>([
  "activity_desc",
  "activity_asc",
  "requests_desc",
  "orders_desc",
  "updated_desc",
  "updated_asc",
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
]);
const SORT_LABELS: Record<SortOption, string> = {
  activity_desc: "Activity: most recent",
  activity_asc: "Activity: least recent",
  requests_desc: "Most open requests",
  orders_desc: "Most active orders",
  updated_desc: "Updated: newest",
  updated_asc: "Updated: oldest",
  created_desc: "Created: newest",
  created_asc: "Created: oldest",
  name_asc: "Name: A–Z",
  name_desc: "Name: Z–A",
};
type ParameterName = "q" | "activity" | "profile" | "issues" | "sort";

export default function AdminClientsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<ManagedClient[]>([]);
  const [clientsState, setClientsState] = useState<LoadState>("loading");
  const [clientsError, setClientsError] = useState("");
  const [requests, setRequests] = useState<RelatedRequest[]>([]);
  const [requestsState, setRequestsState] = useState<LoadState>("loading");
  const [requestsError, setRequestsError] = useState("");
  const [orders, setOrders] = useState<RelatedOrder[]>([]);
  const [ordersState, setOrdersState] = useState<LoadState>("loading");
  const [ordersError, setOrdersError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState("");

  const search = searchParams.get("q") ?? "";
  const activity = readActivityFilter(searchParams.get("activity"));
  const profileFilter = readProfileFilter(searchParams.get("profile"));
  const issues = readIssueFilter(searchParams.get("issues"));
  const sort = readSortOption(searchParams.get("sort"));
  const queryKey = searchParams.toString();

  useEffect(() => {
    setSelectedIds(new Set());
    setCopyFeedback("");
  }, [queryKey]);

  useEffect(() =>
    onSnapshot(
      collection(db, "client_profiles"),
      (snapshot) => {
        setClients(
          snapshot.docs.map((entry) =>
            normalizeClientDocument(
              entry.id,
              entry.data() as Record<string, unknown>,
            ),
          ),
        );
        setClientsState("ready");
        setClientsError("");
      },
      (error) => {
        console.error("Failed to load clients", error);
        setClientsError("Could not read the client directory from Firestore.");
        setClientsState("error");
      },
    ), []);

  useEffect(() =>
    onSnapshot(
      collection(db, "requests"),
      (snapshot) => {
        setRequests(snapshot.docs.map((entry) => {
          const data = entry.data() as Record<string, unknown>;
          const detail = isRecord(data.detail) ? data.detail : {};
          const rawStatus = readString(data.status) || readString(detail.status);
          return {
            clientId: readString(data.clientId),
            status: isRequestStatus(rawStatus) ? rawStatus : null,
            updatedAt: dateValue(data.updatedAt) ?? dateValue(data.createdAt),
          };
        }));
        setRequestsState("ready");
        setRequestsError("");
      },
      (error) => {
        console.error("Failed to load client request activity", error);
        setRequestsError("Request activity could not be loaded.");
        setRequestsState("error");
      },
    ), []);

  useEffect(() =>
    onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        setOrders(snapshot.docs.map((entry) => {
          const data = entry.data() as Record<string, unknown>;
          const rawStatus = readString(data.status);
          return {
            clientId: readString(data.clientId),
            status: isOrderStatus(rawStatus) ? rawStatus : null,
            updatedAt: dateValue(data.updatedAt) ?? dateValue(data.createdAt),
          };
        }));
        setOrdersState("ready");
        setOrdersError("");
      },
      (error) => {
        console.error("Failed to load client order activity", error);
        setOrdersError("Order activity could not be loaded.");
        setOrdersState("error");
      },
    ), []);

  const activityMaps = useMemo(
    () => buildActivityMaps(requests, orders),
    [orders, requests],
  );
  const activityFilterState = activitySourceState(
    activity,
    requestsState,
    ordersState,
  );
  const activityFilterUnavailable = activity !== "all" && activityFilterState !== "ready";
  const staleFilterUnavailable =
    profileFilter === "stale" &&
    [requestsState, ordersState].some((state) => state !== "ready");

  const visibleClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients
      .filter((client) =>
        !term || client.searchTerms.some((value) => value.toLowerCase().includes(term)),
      )
      .filter((client) =>
        staleFilterUnavailable || matchesProfileFilter(client, profileFilter, activityMaps),
      )
      .filter((client) => issues === "all" || (issues === "with" ? client.issues.length > 0 : client.issues.length === 0))
      .filter((client) =>
        activityFilterUnavailable || matchesActivityFilter(client.id, activity, activityMaps),
      )
      .sort((left, right) => compareClients(left, right, sort, activityMaps));
  }, [activity, activityFilterUnavailable, activityMaps, clients, issues, profileFilter, search, sort, staleFilterUnavailable]);

  const selectedClients = visibleClients.filter((client) => selectedIds.has(client.id));
  const fullyOnboarded = clients.filter((client) => client.onboardingState === "complete").length;
  const incompleteOnboarding = clients.filter((client) => client.onboardingState !== "complete").length;
  const issueCount = clients.filter((client) => client.issues.length > 0).length;
  const hasActiveControls = Boolean(search.trim()) || activity !== "all" || profileFilter !== "all" || issues !== "all" || sort !== "activity_desc";

  function updateParameter(name: ParameterName, value: string, replace = false) {
    const next = new URLSearchParams(searchParams.toString());
    const defaults: Record<ParameterName, string> = {
      q: "",
      activity: "all",
      profile: "all",
      issues: "all",
      sort: "activity_desc",
    };
    if (!value || value === defaults[name]) next.delete(name);
    else next.set(name, value);
    const destination = next.toString() ? `${pathname}?${next}` : pathname;
    if (replace) router.replace(destination, { scroll: false });
    else router.push(destination, { scroll: false });
  }

  function resetControls() {
    router.push(pathname, { scroll: false });
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copySelectedEmails() {
    const emails = selectedClients
      .filter((client) => client.email.kind === "valid")
      .map((client) => client.email.value);
    if (!emails.length) return;
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopyFeedback(`${emails.length} ${emails.length === 1 ? "email" : "emails"} copied.`);
    } catch (error) {
      console.error("Failed to copy client emails", error);
      setCopyFeedback("Email addresses could not be copied.");
    }
  }

  function exportClients(records: ManagedClient[], scope: string) {
    const rows = [
      ["Name", "Email", "Phone", "Country", "Onboarding", "Open requests", "Active orders", "Created", "Updated", "Data issues"],
      ...records.map((client) => [
        client.name,
        client.email.value,
        client.phone.value,
        client.country,
        onboardingLabel(client.onboardingState),
        relationshipExportValue(requestsState, !activityMaps.requestStatusIncomplete.has(client.id), activityMaps.openRequests.get(client.id) ?? 0),
        relationshipExportValue(ordersState, !activityMaps.orderStatusIncomplete.has(client.id), activityMaps.activeOrders.get(client.id) ?? 0),
        formatDate(validTimestamp(client.createdAt)),
        formatDate(validTimestamp(client.updatedAt)),
        client.issues.map((issue) => `${issue.field}: ${issue.message}`).join(" | "),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tufffinds-clients-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell active="clients">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Client directory"
          title="Clients"
          description="Triage client profiles, contact clients and open their linked workflows."
          actions={
            <button
              type="button"
              onClick={() => exportClients(visibleClients, "filtered")}
              disabled={!visibleClients.length}
              className={adminSecondaryButton}
            >
              Export filtered
            </button>
          }
        />

        <section aria-label="Client directory summary">
          <div className="grid divide-y divide-[#e2d9cf] border-y border-[#e2d9cf] sm:grid-cols-4 sm:divide-y-0">
            <AdminMetric label="Total clients" value={sourceValue(clientsState, clients.length)} detail="Complete directory" />
            <AdminMetric label="Fully onboarded" value={sourceValue(clientsState, fullyOnboarded)} detail="Ready client profiles" />
            <AdminMetric label="Incomplete" value={sourceValue(clientsState, incompleteOnboarding)} detail="Onboarding still required" />
            <AdminMetric label="Data issues" value={sourceValue(clientsState, issueCount)} detail="Profiles requiring review" />
          </div>
        </section>

        {clientsState === "error" ? <AlertSurface tone="error" title="Clients could not be refreshed" body={`${clientsError}${clients.length ? " Previously loaded records remain visible." : " No empty directory has been assumed."}`} /> : null}
        {requestsState === "error" || ordersState === "error" ? <AlertSurface tone="warning" title="Some related activity is unavailable" body={[requestsError, ordersError].filter(Boolean).join(" ")} /> : null}
        {activityFilterUnavailable ? <AlertSurface tone="warning" title="Activity filter not applied" body="Its supporting collection is loading or unavailable. Profile, issue and search controls remain applied." /> : null}
        {staleFilterUnavailable ? <AlertSurface tone="warning" title="No-recent-activity filter not applied" body="All related activity sources must be available before a client can be classified as inactive for 90 days." /> : null}

        <section aria-labelledby="client-directory-heading">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="client-directory-heading" className="text-lg font-semibold text-[#302722]">Client directory</h2>
              <p className="mt-0.5 text-sm text-[#7b6e65]">Default order: most recent profile or workflow activity first.</p>
            </div>
            <p className="text-xs tabular-nums text-[#74675e]" role="status" aria-live="polite">{clientsState === "ready" || clients.length ? `${visibleClients.length} of ${clients.length} shown` : "Results unavailable"}</p>
          </div>

          <AdminTable label="Client directory">
            <AdminToolbar>
              <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <AdminSearchInput value={search} onChange={(value) => updateParameter("q", value, true)} placeholder="Search identity, country, style or brand" label="Search clients" />
                <AdminFilterSelect label="Filter by activity" value={activity} onChange={(value) => updateParameter("activity", value)}>
                  <option value="all">All activity</option><option value="open_requests">Has open requests</option><option value="active_orders">Has active orders</option>
                </AdminFilterSelect>
                <AdminFilterSelect label="Filter client profile" value={profileFilter} onChange={(value) => updateParameter("profile", value)}>
                  <option value="all">All profiles</option><option value="onboarded">Fully onboarded</option><option value="incomplete">Incomplete onboarding</option><option value="missing_email">Missing email</option><option value="missing_phone">Missing phone</option><option value="missing_address">Missing address</option><option value="stale">No recent activity</option>
                </AdminFilterSelect>
                <AdminFilterSelect label="Filter data quality" value={issues} onChange={(value) => updateParameter("issues", value)}>
                  <option value="all">All data quality</option><option value="with">With data issues</option><option value="without">Without data issues</option>
                </AdminFilterSelect>
                <AdminFilterSelect label="Sort clients" value={sort} onChange={(value) => updateParameter("sort", value)}>
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((value) => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}
                </AdminFilterSelect>
                {hasActiveControls ? <button type="button" onClick={resetControls} className={`${adminSecondaryButton} shrink-0`}>Clear filters</button> : null}
              </div>
            </AdminToolbar>

            {selectedIds.size ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-[#e5ddd4] bg-[#faf8f4] px-4 py-3">
                <p className="mr-auto text-sm font-medium text-[#43372f]">{selectedIds.size} selected</p>
                <button type="button" onClick={copySelectedEmails} disabled={!selectedClients.some((client) => client.email.kind === "valid")} className={`${adminSecondaryButton} h-9 px-3 text-xs`}>Copy selected emails</button>
                <button type="button" onClick={() => exportClients(selectedClients, "selected")} className={`${adminSecondaryButton} h-9 px-3 text-xs`}>Export selected</button>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="h-9 px-2 text-xs font-semibold text-[#6f6259] underline underline-offset-2">Clear selection</button>
                {copyFeedback ? <p className="w-full text-xs text-[#62564e]" role="status">{copyFeedback}</p> : null}
              </div>
            ) : null}

            {clientsState === "loading" ? <AdminState title="Loading clients" body="Reading the complete client directory." /> : null}
            {clientsState === "error" && !clients.length ? <AdminState title="Clients unavailable" body="The client query failed. No empty result has been assumed." tone="error" /> : null}
            {clientsState === "ready" && !clients.length ? <AdminState title="No clients yet" body="No client profile documents exist. Authentication-backed client creation is not available in this admin workspace." /> : null}
            {(clientsState === "ready" || clients.length > 0) && clients.length > 0 && !visibleClients.length ? <DirectoryState title="No clients match these controls" body="Reset the current search and filters to return to the full loaded directory." action={<button type="button" onClick={resetControls} className={adminSecondaryButton}>Reset controls</button>} /> : null}
            {visibleClients.length ? (
              <ClientDirectory
                clients={visibleClients}
                activity={activityMaps}
                states={{ requests: requestsState, orders: ordersState }}
                selectedIds={selectedIds}
                onToggle={toggleSelection}
                onToggleAll={() => setSelectedIds(selectedIds.size === visibleClients.length ? new Set() : new Set(visibleClients.map((client) => client.id)))}
              />
            ) : null}
          </AdminTable>
        </section>
      </AdminPage>
    </AdminShell>
  );
}

function ClientDirectory({ clients, activity, states, selectedIds, onToggle, onToggleAll }: { clients: ManagedClient[]; activity: ActivityMaps; states: { requests: LoadState; orders: LoadState }; selectedIds: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void }) {
  const allSelected = clients.length > 0 && selectedIds.size === clients.length;
  return <div><div className="flex items-center gap-3 border-b border-[#e5ddd4] bg-[#faf8f4] px-4 py-2.5 lg:hidden"><input type="checkbox" aria-label="Select all filtered clients" checked={allSelected} onChange={onToggleAll} className="h-4 w-4 accent-[#806650]" /><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#776a61]">Select filtered clients</span></div><div className="hidden grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(10rem,0.72fr)_minmax(9rem,0.58fr)_2rem] gap-4 border-b border-[#e5ddd4] bg-[#faf8f4] px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#776a61] lg:grid"><input type="checkbox" aria-label="Select all filtered clients" checked={allSelected} onChange={onToggleAll} className="h-4 w-4 accent-[#806650]" /><span>Client</span><span>Contact</span><span>Workflows</span><span>Last activity</span><span /></div><ul className="divide-y divide-[#ece5dd]">{clients.map((client) => <li key={client.id}><ClientRow client={client} activity={activity} states={states} selected={selectedIds.has(client.id)} onToggle={() => onToggle(client.id)} /></li>)}</ul></div>;
}

function ClientRow({ client, activity, states, selected, onToggle }: { client: ManagedClient; activity: ActivityMaps; states: { requests: LoadState; orders: LoadState }; selected: boolean; onToggle: () => void }) {
  const requestCount = activity.openRequests.get(client.id) ?? 0;
  const orderCount = activity.activeOrders.get(client.id) ?? 0;
  const latest = clientLatestActivity(client, activity);
  const clientHref = `/admin/clients/${encodeURIComponent(client.id)}`;
  return (
    <div className={`group relative min-w-0 px-4 py-3.5 transition hover:bg-[#faf7f2] ${client.issues.length ? "shadow-[inset_3px_0_0_#b59674]" : ""}`}>
      <Link href={clientHref} aria-label={`Open client ${client.identityLabel}`} className="absolute inset-0 z-0 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#806650] focus:ring-inset"><span className="sr-only">Open client</span></Link>
      <div className="pointer-events-none relative z-10 grid min-w-0 gap-3 lg:grid-cols-[2rem_minmax(0,1.3fr)_minmax(0,1fr)_minmax(10rem,0.72fr)_minmax(9rem,0.58fr)_2rem] lg:items-center lg:gap-4">
        <input type="checkbox" aria-label={`Select ${client.identityLabel}`} checked={selected} onChange={onToggle} className="pointer-events-auto h-4 w-4 accent-[#806650]" />
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#241e1a] group-hover:text-black">{client.identityLabel}</p>{client.issues.length ? <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#8c3c2d]">{client.issues.slice(0, 2).map((issue) => issue.message).join(" ")}</p> : null}</div>
        <div className="min-w-0 space-y-1"><ContactLink contact={client.email} label="Email" /><ContactLink contact={client.phone} label="Phone" /><p className="truncate text-xs text-[#81746a]">{client.country || "Country not stored"}</p></div>
        <div className="space-y-1 text-xs text-[#6f6259]"><RelatedCount label="Open requests" value={requestCount} state={states.requests} complete={!activity.requestStatusIncomplete.has(client.id)} href={`/admin/requests?clientId=${encodeURIComponent(client.id)}`} /><RelatedCount label="Active orders" value={orderCount} state={states.orders} complete={!activity.orderStatusIncomplete.has(client.id)} href={`/admin/orders?clientId=${encodeURIComponent(client.id)}`} /></div>
        <div className="flex items-center justify-between gap-3 lg:block"><span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#968980] lg:hidden">Last activity</span><p className={`text-xs tabular-nums ${latest ? "text-[#6f6259]" : "text-[#8c3c2d]"}`}>{formatDate(latest)}</p></div>
        <span aria-hidden="true" className="hidden text-right text-[#9a8d83] lg:block">→</span>
      </div>
    </div>
  );
}
function ContactLink({ contact, label }: { contact: ManagedClient["email"]; label: string }) { if (contact.kind === "valid") return <a href={contact.href} className="pointer-events-auto block break-words text-sm text-[#4e4138] underline decoration-[#d3c8bd] underline-offset-2">{contact.value}</a>; return <p className={`text-sm ${contact.kind === "malformed" ? "text-[#8c3c2d]" : "text-[#81746a]"}`}>{contact.value || `${label} not stored`}</p>; }
function RelatedCount({ label, value, state, complete, href }: { label: string; value: number; state: LoadState; complete: boolean; href: string }) { const available = state === "ready" && complete; return <p><span className="font-medium text-[#4e4138]">{label}:</span> {available ? value ? <Link href={href} className="pointer-events-auto font-semibold underline underline-offset-2">{value}</Link> : "0" : "—"}</p>; }
function AlertSurface({ tone, title, body }: { tone: "error" | "warning"; title: string; body: string }) { const classes = tone === "error" ? "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]" : "border-[#e5d3a9] bg-[#fbf6e8] text-[#725820]"; return <div role={tone === "error" ? "alert" : "status"} className={`rounded-[12px] border p-4 text-sm ${classes}`}><p className="font-semibold">{title}</p><p className="mt-1 leading-6">{body}</p></div>; }
function DirectoryState({ title, body, action }: { title: string; body: string; action: React.ReactNode }) { return <div className="px-5 py-12 text-center"><h3 className="text-base font-semibold text-[#302722]">{title}</h3><p className="mx-auto mt-1 max-w-xl text-sm text-[#766960]">{body}</p><div className="mt-4 flex justify-center">{action}</div></div>; }

function buildActivityMaps(requests: RelatedRequest[], orders: RelatedOrder[]): ActivityMaps {
  const openRequests = new Map<string, number>();
  const activeOrders = new Map<string, number>();
  const latestRelated = new Map<string, Date>();
  const requestStatusIncomplete = new Set<string>();
  const orderStatusIncomplete = new Set<string>();
  const recordLatest = (clientId: string, value: Date | null) => { if (!isSafeDocumentId(clientId) || !value) return; const current = latestRelated.get(clientId); if (!current || value > current) latestRelated.set(clientId, value); };
  requests.forEach((request) => { if (!isSafeDocumentId(request.clientId)) return; recordLatest(request.clientId, request.updatedAt); if (!request.status) requestStatusIncomplete.add(request.clientId); else if (isOpenRequestStatus(request.status)) openRequests.set(request.clientId, (openRequests.get(request.clientId) ?? 0) + 1); });
  orders.forEach((order) => { if (!isSafeDocumentId(order.clientId)) return; recordLatest(order.clientId, order.updatedAt); if (!order.status) orderStatusIncomplete.add(order.clientId); else { const group = orderQueueGroup(order.status); if (group === "needs_action" || group === "awaiting_payment" || group === "fulfilment") activeOrders.set(order.clientId, (activeOrders.get(order.clientId) ?? 0) + 1); } });
  return { openRequests, activeOrders, latestRelated, requestStatusIncomplete, orderStatusIncomplete };
}

function matchesProfileFilter(client: ManagedClient, filter: ProfileFilter, activity: ActivityMaps) { if (filter === "all") return true; if (filter === "onboarded") return client.onboardingState === "complete"; if (filter === "incomplete") return client.onboardingState !== "complete"; if (filter === "missing_email") return client.email.kind === "missing"; if (filter === "missing_phone") return client.phone.kind === "missing"; if (filter === "missing_address") return client.addressMissing; return isStale(clientLatestActivity(client, activity)); }
function matchesActivityFilter(id: string, filter: ActivityFilter, activity: ActivityMaps) { if (filter === "all") return true; if (filter === "open_requests") return (activity.openRequests.get(id) ?? 0) > 0; return (activity.activeOrders.get(id) ?? 0) > 0; }
function compareClients(left: ManagedClient, right: ManagedClient, sort: SortOption, activity: ActivityMaps) { if (sort === "name_asc" || sort === "name_desc") return compareText(left.identityLabel, right.identityLabel) * (sort === "name_asc" ? 1 : -1) || compareText(left.id, right.id); if (sort === "requests_desc") return compareNumbers(activity.openRequests.get(right.id) ?? 0, activity.openRequests.get(left.id) ?? 0, left.id, right.id); if (sort === "orders_desc") return compareNumbers(activity.activeOrders.get(right.id) ?? 0, activity.activeOrders.get(left.id) ?? 0, left.id, right.id); const date = sort.startsWith("activity") ? [clientLatestActivity(left, activity), clientLatestActivity(right, activity)] : sort.startsWith("created") ? [validTimestamp(left.createdAt), validTimestamp(right.createdAt)] : [validTimestamp(left.updatedAt), validTimestamp(right.updatedAt)]; return compareNullableDates(date[0], date[1], sort.endsWith("asc")) || compareText(left.id, right.id); }
function clientLatestActivity(client: ManagedClient, activity: ActivityMaps) { const profile = effectiveTimestamp(client).value; const related = activity.latestRelated.get(client.id) ?? null; if (!profile) return related; if (!related) return profile; return profile > related ? profile : related; }
function isStale(value: Date | null) { return !value || Date.now() - value.getTime() > STALE_DAYS * 86_400_000; }
function compareNullableDates(left: Date | null, right: Date | null, ascending: boolean) { if (!left && !right) return 0; if (!left) return 1; if (!right) return -1; return ascending ? left.getTime() - right.getTime() : right.getTime() - left.getTime(); }
function compareNumbers(left: number, right: number, leftId: string, rightId: string) { return left - right || compareText(leftId, rightId); }
function compareText(left: string, right: string) { return left.localeCompare(right, undefined, { sensitivity: "base" }); }
function dateValue(value: unknown) { return validTimestamp(readTimestamp(value)); }
function sourceValue(state: LoadState, value: number) { return state === "ready" ? value : "—"; }
function relationshipExportValue(state: LoadState, complete: boolean, value: number) { return state === "ready" && complete ? value : "Unavailable"; }
function readActivityFilter(value: string | null): ActivityFilter { return value && ACTIVITY_FILTERS.has(value as ActivityFilter) ? value as ActivityFilter : "all"; }
function readProfileFilter(value: string | null): ProfileFilter { return value && PROFILE_FILTERS.has(value as ProfileFilter) ? value as ProfileFilter : "all"; }
function readIssueFilter(value: string | null): IssueFilter { return value && ISSUE_FILTERS.has(value as IssueFilter) ? value as IssueFilter : "all"; }
function readSortOption(value: string | null): SortOption { return value && SORT_OPTIONS.has(value as SortOption) ? value as SortOption : "activity_desc"; }
function activitySourceState(activity: ActivityFilter, requests: LoadState, orders: LoadState) { if (activity === "open_requests") return requests; if (activity === "active_orders") return orders; return "ready" as const; }
