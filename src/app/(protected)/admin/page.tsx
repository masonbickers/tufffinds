"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "./_components/AdminShell";
import {
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminState,
  AdminStatusBadge,
  adminPrimaryButton,
} from "./_components/AdminUI";
import {
  REQUEST_STATUSES,
  type OrderStatus,
  type RequestStatus,
} from "./admin-types";
import {
  ORDER_NEXT_ACTIONS,
  ORDER_QUEUE_GROUP_LABELS,
  ORDER_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  isOpenRequestStatus,
  isOrderStatus,
  isRequestStatus,
  orderQueueGroup,
  type OrderQueueGroup,
} from "./admin-utils";

type SourceName = "requests" | "orders";
type SourceStatus = "loading" | "ready" | "error";
type StatusIssue = "missing" | "unrecognised" | "malformed" | null;
type Priority = "critical" | "high" | "medium" | "low";
type AttentionCategory = "request" | "order" | "data_quality";
type ActionOwner = "Admin" | "Client";

type BaseRecord = {
  id: string;
  clientId: string;
  clientEmail: string;
  clientName: string;
  createdAt: Date | null;
  href: string;
  rawTitle: string;
  title: string;
  updatedAt: Date | null;
};

type RequestRecord = BaseRecord & {
  kind: "request";
  rawStatus: string;
  status: RequestStatus | null;
  statusIssue: StatusIssue;
  urgency: string;
};

type OrderRecord = BaseRecord & {
  invoiceNumber: string;
  invoiceUrl: string;
  kind: "order";
  rawStatus: string;
  requestId: string;
  status: OrderStatus | null;
  statusIssue: StatusIssue;
  supplier: string;
  trackingNumber: string;
  trackingUrl: string;
};

type DashboardRecord = RequestRecord | OrderRecord;

type AttentionItem = {
  action: string;
  category: AttentionCategory;
  dataIssues: string[];
  isOverdue: boolean;
  owner: ActionOwner;
  record: DashboardRecord;
  priority: Priority;
  reason: string;
  sortGroup: number;
  technicalDetail?: string;
  waitingSince: Date | null;
};

type DashboardData = {
  requests: RequestRecord[];
  orders: OrderRecord[];
};

const INITIAL_DATA: DashboardData = { requests: [], orders: [] };
const INITIAL_SOURCE_STATUS: Record<SourceName, SourceStatus> = {
  requests: "loading",
  orders: "loading",
};
const SOURCE_LABELS: Record<SourceName, string> = {
  requests: "requests",
  orders: "orders",
};
const PRIORITY_RANK: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const ATTENTION_LIMIT = 6;
const ATTENTION_CATEGORY_CAPS: Record<AttentionCategory, number> = {
  request: 3,
  order: 2,
  data_quality: 2,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_OVERDUE_MS = 2 * DAY_MS;
const ORDER_OVERDUE_MS = 2 * DAY_MS;
const HIDE_TEST_RECORDS_KEY = "tufffinds.admin.hideLikelyTests";

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>(INITIAL_DATA);
  const [sourceStatus, setSourceStatus] =
    useState<Record<SourceName, SourceStatus>>(INITIAL_SOURCE_STATUS);
  const [hideLikelyTests, setHideLikelyTests] = useState(true);
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [listenerVersion, setListenerVersion] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(HIDE_TEST_RECORDS_KEY);
    if (stored !== null) setHideLikelyTests(stored !== "false");
  }, []);

  useEffect(() => {
    setSourceStatus(INITIAL_SOURCE_STATUS);
    const markReady = (source: SourceName) => {
      setSourceStatus((current) => ({ ...current, [source]: "ready" }));
    };
    const markFailed = (source: SourceName, error: Error) => {
      console.error(`Failed to load dashboard ${source}`, error);
      setData((current) => ({ ...current, [source]: [] }));
      setSourceStatus((current) => ({ ...current, [source]: "error" }));
    };

    const unsubscribers = [
      onSnapshot(
        collection(db, "requests"),
        (snapshot) => {
          setData((current) => ({
            ...current,
            requests: snapshot.docs.map((entry) =>
              normalizeRequest(entry.id, entry.data() as Record<string, unknown>),
            ),
          }));
          markReady("requests");
        },
        (error) => markFailed("requests", error),
      ),
      onSnapshot(
        collection(db, "orders"),
        (snapshot) => {
          setData((current) => ({
            ...current,
            orders: snapshot.docs.map((entry) =>
              normalizeOrder(entry.id, entry.data() as Record<string, unknown>),
            ),
          }));
          markReady("orders");
        },
        (error) => markFailed("orders", error),
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [listenerVersion]);

  const openRequests = useMemo(
    () => data.requests.filter((item) => isOpenRequestStatus(item.status)),
    [data.requests],
  );
  const waitingOnClient = useMemo(
    () => [
      ...data.requests.filter((item) =>
        ["needs_info", "options_sent", "awaiting_client_approval", "invoice_sent"].includes(
          item.status ?? "",
        ),
      ),
      ...data.orders.filter((item) => item.status === "invoice_sent"),
    ],
    [data.orders, data.requests],
  );
  const activeOrders = useMemo(
    () => data.orders.filter((item) => isActiveOrder(item.status)),
    [data.orders],
  );
  const allRecords = useMemo<DashboardRecord[]>(
    () => [...data.requests, ...data.orders],
    [data],
  );
  const allAttentionItems = useMemo(() => {
    const orderRequestIds = new Set(
      data.orders.map((order) => order.requestId).filter(Boolean),
    );
    return allRecords
      .map((record) =>
        toAttentionItem(
          record,
          orderRequestIds,
          sourceStatus.orders === "ready",
        ),
      )
      .filter((item): item is AttentionItem => item !== null)
      .sort(compareAttentionItems);
  }, [allRecords, data.orders, sourceStatus.orders]);

  const likelyTestCount = useMemo(
    () => allRecords.filter(isLikelyTestRecord).length,
    [allRecords],
  );
  const hiddenAttentionCount = useMemo(
    () => allAttentionItems.filter((item) => isLikelyTestRecord(item.record)).length,
    [allAttentionItems],
  );
  const visibleAttentionItems = useMemo(
    () =>
      hideLikelyTests
        ? allAttentionItems.filter((item) => !isLikelyTestRecord(item.record))
        : allAttentionItems,
    [allAttentionItems, hideLikelyTests],
  );
  const attentionItems = useMemo(
    () =>
      showAllAttention
        ? visibleAttentionItems
        : balanceAttentionItems(visibleAttentionItems, ATTENTION_LIMIT),
    [showAllAttention, visibleAttentionItems],
  );
  const overdueActions = useMemo(
    () =>
      allAttentionItems.filter(
        (item) => item.isOverdue && item.owner === "Admin",
      ),
    [allAttentionItems],
  );

  const requestsWithOrders = useMemo(
    () => new Set(data.orders.map((order) => order.requestId).filter(Boolean)),
    [data.orders],
  );

  const recentActivity = useMemo(
    () =>
      allRecords
        .filter((record) => !hideLikelyTests || !isLikelyTestRecord(record))
        .filter((record) => effectiveDate(record) !== null)
        .sort((left, right) =>
          compareDatesNewest(effectiveDate(left), effectiveDate(right)),
        )
        .slice(0, 8),
    [allRecords, hideLikelyTests],
  );

  const failedSources = getSourcesWithStatus(sourceStatus, "error");
  const loadingSources = getSourcesWithStatus(sourceStatus, "loading");
  const waitingSourceStatus = aggregateStatus(
    sourceStatus.requests,
    sourceStatus.orders,
  );

  return (
    <AdminShell active="dashboard">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Daily operations"
          title="Dashboard"
          description="Prioritise client work, resolve workflow issues and move active orders forward."
          actions={
            <Link href="/admin/create" className={adminPrimaryButton}>
              Create order
            </Link>
          }
        />

        <section
          aria-label="Daily operations summary"
          className="grid divide-y divide-[#e2d9cf] border-y border-[#e2d9cf] sm:grid-cols-4 sm:divide-x sm:divide-y-0"
        >
          <SummaryMetric
            href="/admin/requests?status=open"
            label="Open requests"
            value={metricValue(sourceStatus.requests, openRequests.length)}
            detail={metricDetail(
              sourceStatus.requests,
              openRequests.length
                ? `Oldest open ${formatWaitingTime(oldestRecordDate(openRequests))}`
                : "No open workflows",
            )}
          />
          <SummaryMetric
            href="/admin/requests?status=needs_info"
            label="Waiting on client"
            value={metricValue(waitingSourceStatus, waitingOnClient.length)}
            detail={metricDetail(
              waitingSourceStatus,
              waitingOnClient.length
                ? `Oldest wait ${formatWaitingTime(oldestRecordDate(waitingOnClient))}`
                : "No client replies or payments due",
            )}
          />
          <SummaryMetric
            href="/admin/orders"
            label="Active orders"
            value={metricValue(sourceStatus.orders, activeOrders.length)}
            detail={metricDetail(
              sourceStatus.orders,
              activeOrders.length
                ? `${activeOrders.filter((item) => item.status === "dispatched").length} in fulfilment`
                : "No active fulfilment",
            )}
          />
          <SummaryMetric
            href="/admin/requests?status=attention"
            label="Overdue actions"
            value={metricValue(
              aggregateStatus(
                sourceStatus.requests,
                sourceStatus.orders,
              ),
              overdueActions.length,
            )}
            detail={metricDetail(
              aggregateStatus(
                sourceStatus.requests,
                sourceStatus.orders,
              ),
              overdueActions.length
                ? `Oldest overdue ${formatWaitingTime(oldestAttentionDate(overdueActions))}`
                : "No overdue admin actions",
            )}
          />
        </section>

        <DataAvailabilityNotice
          failedSources={failedSources}
          loadingSources={loadingSources}
          onRetry={() => setListenerVersion((current) => current + 1)}
        />

        <AdminSection
          title="Needs attention"
          description="Balanced across data issues, orders and requests. Client contact happens through WhatsApp."
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md border border-[#ddd4ca] bg-white px-2.5 text-[11px] font-medium text-[#62564e]">
                <input
                  type="checkbox"
                  checked={hideLikelyTests}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setHideLikelyTests(checked);
                    window.localStorage.setItem(HIDE_TEST_RECORDS_KEY, String(checked));
                    setShowAllAttention(false);
                  }}
                  className="accent-[#302722]"
                />
                Hide likely test records
              </label>
              {!loadingSources.length ? (
                <span className="shrink-0 text-xs tabular-nums text-[#74675e]">
                  {attentionItems.length} shown
                </span>
              ) : null}
            </div>
          }
        >
          <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#74675e]">
            <span>
              {visibleAttentionItems.length} visible {visibleAttentionItems.length === 1 ? "item" : "items"}
              {hideLikelyTests && hiddenAttentionCount
                ? ` · ${hiddenAttentionCount} test-like attention ${hiddenAttentionCount === 1 ? "item" : "items"} hidden`
                : ""}
              {` · ${allAttentionItems.length} total attention ${allAttentionItems.length === 1 ? "candidate" : "candidates"}`}
              {hideLikelyTests && likelyTestCount
                ? ` · ${likelyTestCount} test-like ${likelyTestCount === 1 ? "record" : "records"} hidden overall and included in review totals`
                : ""}
            </span>
            {hideLikelyTests && likelyTestCount ? (
              <button
                type="button"
                className="font-semibold text-[#55453a] underline decoration-[#b8a99c] underline-offset-4 hover:text-black"
                onClick={() => {
                  setHideLikelyTests(false);
                  setShowAllAttention(false);
                }}
              >
                Show records
              </button>
            ) : null}
          </div>
          <AttentionList
            items={attentionItems}
            requestsWithOrders={requestsWithOrders}
            hasFailures={failedSources.length > 0}
            hasHiddenItems={hideLikelyTests && hiddenAttentionCount > 0}
            isLoading={loadingSources.length > 0}
          />
          {!showAllAttention && visibleAttentionItems.length > attentionItems.length ? (
            <button
              type="button"
              className="mt-2.5 text-xs font-semibold text-[#55453a] underline decoration-[#b8a99c] underline-offset-4 hover:text-black"
              onClick={() => setShowAllAttention(true)}
            >
              View all attention items ({visibleAttentionItems.length})
            </button>
          ) : showAllAttention ? (
            <button
              type="button"
              className="mt-2.5 text-xs font-semibold text-[#55453a] underline decoration-[#b8a99c] underline-offset-4 hover:text-black"
              onClick={() => setShowAllAttention(false)}
            >
              Show balanced priority view
            </button>
          ) : null}
        </AdminSection>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)]">
          <div id="recent-activity" className="scroll-mt-6">
            <AdminSection
              title="Recent activity"
              description="Latest supported record activity. Descriptions do not imply a full audit trail."
            >
              <ActivityList
                items={recentActivity}
                hasFailures={failedSources.length > 0}
                isLoading={loadingSources.length > 0}
              />
            </AdminSection>
          </div>

          <AdminSection
            title="Quick actions"
            description="Frequent operational destinations."
          >
            <nav aria-label="Dashboard actions">
              <div className="divide-y divide-[#e5ddd4] overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
                <QuickLink
                  href="/admin/requests?status=attention"
                  label="Review requests"
                  detail={`${visibleAttentionItems.length} visible attention ${visibleAttentionItems.length === 1 ? "item" : "items"}`}
                />
                <QuickLink
                  href="/admin/clients"
                  label="WhatsApp clients"
                  detail="Open a client record to start a chat"
                />
                <QuickLink
                  href={activeOrders.length ? "/admin/orders?group=needs_action" : "/admin/orders"}
                  label={activeOrders.length ? "Manage active orders" : "View orders"}
                  detail={
                    sourceStatus.orders === "error"
                      ? "Orders source unavailable"
                      : activeOrders.length
                        ? `${activeOrders.length} active ${activeOrders.length === 1 ? "order" : "orders"}`
                        : "No active fulfilment"
                  }
                />
                <QuickLink href="/admin/create" label="Create order" detail="Start a new fulfilment record" />
              </div>
            </nav>
          </AdminSection>
        </div>

        <div id="operational-overview" className="scroll-mt-6">
        <AdminSection
          title="Operational overview"
          description="Current workload distribution and records that need review."
        >
          <OperationalOverview data={data} sourceStatus={sourceStatus} />
        </AdminSection>
        </div>
      </AdminPage>
    </AdminShell>
  );
}

function SummaryMetric({
  detail,
  href,
  label,
  value,
}: {
  detail: string;
  href: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group min-w-0 transition hover:bg-[#faf7f2] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#806650]"
    >
      <AdminMetric label={label} value={value} detail={`${detail} →`} />
    </Link>
  );
}

function AttentionList({
  hasFailures,
  hasHiddenItems,
  isLoading,
  items,
  requestsWithOrders,
}: {
  hasFailures: boolean;
  hasHiddenItems: boolean;
  isLoading: boolean;
  items: AttentionItem[];
  requestsWithOrders: Set<string>;
}) {
  if (!items.length && isLoading) {
    return <StateSurface><AdminState title="Loading attention queue" body="Checking available workflow records." /></StateSurface>;
  }
  if (!items.length) {
    return (
      <StateSurface>
        <AdminState
          title={
            hasFailures
              ? "No items in available data"
              : hasHiddenItems
                ? "All attention items are hidden"
                : "Nothing needs attention"
          }
          body={
            hasFailures
              ? "One or more sources are unavailable, so this is only a partial result."
              : hasHiddenItems
                ? "The current attention candidates are test-like records. Use Show records to review them."
              : "No records match the attention rules. Review recent activity or create the next order."
          }
        />
      </StateSurface>
    );
  }

  return (
    <div className="divide-y divide-[#e8e1d9] overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
      {items.map((item) => (
        <AttentionRow
          key={`${item.record.kind}-${item.record.id}`}
          item={item}
          hasLinkedOrder={
            item.record.kind === "request" && requestsWithOrders.has(item.record.id)
          }
        />
      ))}
    </div>
  );
}

function AttentionRow({
  hasLinkedOrder,
  item,
}: {
  hasLinkedOrder: boolean;
  item: AttentionItem;
}) {
  const { record } = item;
  const secondaryActions = getSecondaryActions(record, hasLinkedOrder);
  const displayTitle = displayRecordTitle(record);
  const rawTitleDetail = weakRawTitleDetail(record);

  return (
    <article
      className={`px-3.5 py-2.5 ${priorityAccent(item.priority)}`}
      aria-label={`${item.action}: ${displayTitle}`}
    >
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_150px_160px] lg:items-start lg:gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#81746a]">
              {kindLabel(record.kind)}
            </span>
            {item.priority === "critical" || item.priority === "high" ? (
              <PriorityBadge priority={item.priority} />
            ) : null}
            <AdminStatusBadge tone={recordStatusTone(record)}>
              {recordStatusLabel(record)}
            </AdminStatusBadge>
          </div>
          <p
            className="mt-1 truncate text-sm font-semibold text-[#302722]"
            title={rawTitleDetail ?? displayTitle}
          >
            <span>{displayTitle}</span>
            {rawTitleDetail ? (
              <span className="ml-2 text-[11px] font-normal text-[#8b7e75]">
                · {rawTitleDetail}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-[#74675e]">
            {formatRecordIdentity(record, false)}
          </p>
          <p
            className="mt-0.5 truncate text-xs leading-4 text-[#62564e]"
            title={
              item.technicalDetail
                ? `${item.reason} — ${item.technicalDetail}`
                : item.reason
            }
          >
            <span className="font-medium text-[#43372f]">Reason:</span> {item.reason}
          </p>
        </div>

        <div className="min-w-0 lg:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#968980]">
            Next owner
          </p>
          <p className="mt-1 text-sm font-medium text-[#4e4138]">{item.owner}</p>
          <p
            className={`mt-1 text-xs ${item.isOverdue ? "font-semibold text-[#8c3c2d]" : "text-[#8b7e75]"}`}
            title={formatAbsoluteDate(item.waitingSince)}
          >
            {formatAttentionTiming(item)}
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-1 lg:w-auto">
          <Link href={record.href} className={adminPrimaryButton}>
            {item.action}
          </Link>
          {secondaryActions.length ? (
            <details className="group text-xs">
              <summary className="cursor-pointer list-none rounded-md px-2 py-1.5 text-center font-medium text-[#74675e] hover:bg-[#f5f1ec] hover:text-[#302722]">
                More actions <span aria-hidden="true">⌄</span>
              </summary>
              <div className="mt-1 overflow-hidden rounded-md border border-[#ddd4ca] bg-white shadow-sm">
                {secondaryActions.map((action) => (
                  <SecondaryAction key={`${action.kind}-${action.label}`} action={action} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type SecondaryAction =
  | { kind: "copy"; label: string; value: string }
  | { kind: "link"; href: string; label: string; external?: boolean };

function SecondaryAction({ action }: { action: SecondaryAction }) {
  const [copied, setCopied] = useState(false);

  if (action.kind === "copy") {
    return (
      <button
        type="button"
        className="block w-full px-3 py-2 text-left text-[11px] font-medium text-[#62564e] hover:bg-[#faf7f2] hover:text-[#302722]"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(action.value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch (error) {
            console.error("Dashboard copy action failed", error);
          }
        }}
      >
        {copied ? "Copied" : action.label}
      </button>
    );
  }

  return (
    <Link
      href={action.href}
      target={action.external ? "_blank" : undefined}
      rel={action.external ? "noreferrer" : undefined}
      className="block px-3 py-2 text-[11px] font-medium text-[#62564e] hover:bg-[#faf7f2] hover:text-[#302722]"
    >
      {action.label}
      {action.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </Link>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const classes = {
    critical: "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]",
    high: "border-[#e5d3a9] bg-[#fbf6e8] text-[#725820]",
    medium: "border-[#ddd4ca] bg-[#f5f2ee] text-[#63574f]",
    low: "border-[#ddd4ca] bg-[#f5f2ee] text-[#74675e]",
  }[priority];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${classes}`}>
      {priority}
    </span>
  );
}

function ActivityList({
  hasFailures,
  isLoading,
  items,
}: {
  hasFailures: boolean;
  isLoading: boolean;
  items: DashboardRecord[];
}) {
  if (!items.length && isLoading) {
    return <StateSurface><AdminState title="Loading recent activity" body="Reading timestamped workflow records." /></StateSurface>;
  }
  if (!items.length) {
    return (
      <StateSurface>
        <AdminState
          title={hasFailures ? "No activity in available data" : "No recent activity"}
          body={hasFailures ? "Some sources are unavailable, so this is a partial result." : "No timestamped request, conversation or order activity is available."}
        />
      </StateSurface>
    );
  }

  return (
    <div className="divide-y divide-[#e8e1d9] overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
      {items.map((record) => (
        <Link
          key={`${record.kind}-${record.id}`}
          href={record.href}
          className="group grid min-w-0 gap-3 px-4 py-3.5 transition hover:bg-[#faf7f2] focus:outline-none sm:grid-cols-[minmax(0,1fr)_auto_2rem] sm:items-center"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#968980]">
                {kindLabel(record.kind)}
              </span>
              <AdminStatusBadge tone={recordStatusTone(record)}>
                {recordStatusLabel(record)}
              </AdminStatusBadge>
            </div>
            <p className="mt-2 truncate text-sm font-medium text-[#302722] group-hover:text-black">
              {activityDescription(record)}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#81746a]">
              {formatRecordIdentity(record, true)}
            </p>
          </div>
          <div className="sm:text-right">
            <p
              className="text-xs font-medium text-[#62564e]"
              title={formatAbsoluteDate(effectiveDate(record))}
              aria-label={`${formatRelativeTime(effectiveDate(record))}; ${formatAbsoluteDate(effectiveDate(record))}`}
            >
              {formatRelativeTime(effectiveDate(record))}
            </p>
          </div>
          <span aria-hidden="true" className="hidden text-right text-[#9a8d83] sm:block">→</span>
        </Link>
      ))}
    </div>
  );
}

function OperationalOverview({
  data,
  sourceStatus,
}: {
  data: DashboardData;
  sourceStatus: Record<SourceName, SourceStatus>;
}) {
  const closedRequestStatuses: RequestStatus[] = ["delivered", "closed", "cancelled"];
  const requestRows = REQUEST_STATUSES.map((status) => ({
    label: REQUEST_STATUS_LABELS[status],
    section: closedRequestStatuses.includes(status) ? "Closed or cancelled" : "Active workflows",
    value: data.requests.filter((record) => record.status === status).length,
  })).filter((row) => row.value > 0);
  const orderGroups: OrderQueueGroup[] = [
    "needs_action",
    "awaiting_payment",
    "fulfilment",
    "completed",
    "cancelled",
  ];
  const orderRows = orderGroups
    .map((group) => ({
      label: ORDER_QUEUE_GROUP_LABELS[group],
      section:
        group === "completed"
          ? "Completed"
          : group === "cancelled"
            ? "Cancelled"
            : "Active orders",
      value: data.orders.filter(
        (record) => record.status && orderQueueGroup(record.status) === group,
      ).length,
    }))
    .filter((row) => row.value > 0);
  const allRecords = [...data.requests, ...data.orders];
  const unsupportedStatuses = [...data.requests, ...data.orders].filter(
    (record) => record.statusIssue === "unrecognised",
  ).length;
  const brokenRelationships = allRecords.filter((record) =>
    recordDataIssues(record).some(
      (issue) => issue.includes("malformed relationship") || issue.includes("clientId (malformed)"),
    ),
  ).length;
  const malformedRecords = allRecords.filter((record) =>
    recordDataIssues(record).some(
      (issue) =>
        !issue.startsWith("status (“") &&
        !issue.includes("malformed relationship") &&
        !issue.includes("clientId (malformed)"),
    ),
  ).length;
  const likelyTests = allRecords.filter(isLikelyTestRecord).length;
  const recognisedOrders = data.orders.filter((record) => record.status).length;
  const activeOrderCount = data.orders.filter((record) => isActiveOrder(record.status)).length;

  return (
    <div className="grid overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white md:grid-cols-2 xl:grid-cols-4">
      <BreakdownPanel
        title="Requests by status"
        titleMeta={`${data.requests.length} total`}
        status={sourceStatus.requests}
        empty={data.requests.length ? "No recognised request statuses" : "No requests exist"}
        rows={requestRows}
        total={data.requests.length}
      />
      <BreakdownPanel
        title="Orders by stage"
        titleMeta={`${data.orders.length} total`}
        status={sourceStatus.orders}
        empty={
          !data.orders.length
            ? "No orders exist"
            : !recognisedOrders
              ? `${data.orders.length} ${data.orders.length === 1 ? "order has" : "orders have"} an unsupported status`
              : "No recognised order stages"
        }
        note={
          data.orders.length && recognisedOrders && !activeOrderCount
            ? "No active orders; historical records are separated below."
            : undefined
        }
        rows={orderRows}
        total={data.orders.length}
      />
      <BreakdownPanel
        title="Records requiring review"
        status={aggregateStatus(sourceStatus.requests, sourceStatus.orders)}
        empty="No records require review"
        rows={[
          { label: "Malformed or incomplete records", value: malformedRecords },
          { label: "Unsupported statuses", value: unsupportedStatuses },
          { label: "Broken relationships", value: brokenRelationships },
          { label: "Likely test records", value: likelyTests },
        ]}
        showBars={false}
        total={data.requests.length + data.orders.length}
      />
    </div>
  );
}

function BreakdownPanel({
  empty,
  note,
  rows,
  showBars = true,
  status,
  title,
  titleMeta,
  total,
}: {
  empty: string;
  note?: string;
  rows: Array<{ label: string; section?: string; value: number }>;
  showBars?: boolean;
  status: SourceStatus;
  title: string;
  titleMeta?: string;
  total: number;
}) {
  let lastSection = "";
  return (
    <section className="min-w-0 border-b border-r border-[#e5ddd4] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#302722]">{title}</h3>
        {titleMeta ? <span className="text-[10px] text-[#8b7e75]">{titleMeta}</span> : null}
      </div>
      {status !== "ready" ? (
        <p className="mt-4 text-xs text-[#81746a]">
          {status === "loading" ? "Loading live data…" : "Source data unavailable"}
        </p>
      ) : rows.every((row) => row.value === 0) ? (
        <p className="mt-4 text-xs text-[#81746a]">{empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {note ? <p className="text-[11px] leading-4 text-[#81746a]">{note}</p> : null}
          {rows.map((row) => {
            const showSection = Boolean(row.section && row.section !== lastSection);
            if (row.section) lastSection = row.section;
            return (
            <div key={row.label}>
              {showSection ? (
                <p className="mb-2 border-t border-[#eee8e1] pt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#968980] first:border-t-0 first:pt-0">
                  {row.section}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-[#62564e]">{row.label}</span>
                <span className="font-semibold tabular-nums text-[#43372f]" aria-label={`${row.label}: ${row.value}`}>
                  {row.value}
                </span>
              </div>
              {showBars && row.value > 0 ? (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eee8e1]" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-[#a98d74]"
                  style={{ width: `${total ? Math.min(100, (row.value / total) * 100) : 0}%` }}
                />
                </div>
              ) : null}
            </div>
          )})}
        </div>
      )}
    </section>
  );
}

function DataAvailabilityNotice({
  failedSources,
  loadingSources,
  onRetry,
}: {
  failedSources: SourceName[];
  loadingSources: SourceName[];
  onRetry: () => void;
}) {
  if (!failedSources.length && !loadingSources.length) return null;
  return (
    <div className="mb-3 space-y-2" aria-live="polite">
      {failedSources.length ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#e6c7be] bg-[#fcf0ed] px-3 py-2 text-xs text-[#8c3c2d]">
          <p>
            Partial dashboard: {formatSourceList(failedSources)} could not be loaded. Dependent counts are marked Unavailable; working sources remain visible.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-[#d6aaa0] bg-white px-2.5 py-1 font-semibold text-[#7b3227] hover:bg-[#fff8f6]"
          >
            Retry failed sources
          </button>
        </div>
      ) : null}
      {loadingSources.length ? (
        <p className="rounded-[10px] border border-[#ddd4ca] bg-[#faf8f4] px-3 py-2 text-xs text-[#74675e]">
          Still loading {formatSourceList(loadingSources)}. Available results are shown now.
        </p>
      ) : null}
    </div>
  );
}

function StateSurface({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[12px] border border-[#ded5cb] bg-white">{children}</div>;
}

function QuickLink({ detail, href, label }: { detail: string; href: string; label: string }) {
  return (
    <Link href={href} className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 transition hover:bg-[#faf7f2] hover:text-black">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#4e4138]">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-[#81746a]">{detail}</span>
      </span>
      <span aria-hidden="true" className="w-3 text-right text-[#9a8d83]">→</span>
    </Link>
  );
}

function normalizeRequest(id: string, data: Record<string, unknown>): RequestRecord {
  const detail = isRecord(data.detail) ? data.detail : {};
  const rawValue = data.status ?? detail.status;
  const rawStatus = readString(rawValue);
  const status = isRequestStatus(rawStatus) ? rawStatus : null;
  const rawTitle = readString(detail.title);
  return {
    id,
    kind: "request",
    href: `/admin/requests/${id}`,
    rawTitle,
    title: rawTitle || "Untitled request",
    clientId: readString(data.clientId),
    clientEmail: readString(data.clientEmail),
    clientName: readString(data.clientName) || readString(data.fullName) || readString(data.name),
    urgency: readString(detail.urgency),
    status,
    rawStatus,
    statusIssue: classifyStatusIssue(rawValue, status),
    createdAt: readDate(data.createdAt),
    updatedAt: readDate(data.updatedAt),
  };
}

function normalizeOrder(id: string, data: Record<string, unknown>): OrderRecord {
  const rawValue = data.status;
  const rawStatus = readString(rawValue);
  const status = isOrderStatus(rawStatus) ? rawStatus : null;
  const rawTitle = readString(data.title) || readString(data.item);
  return {
    id,
    kind: "order",
    href: `/admin/orders/${id}`,
    rawTitle,
    title: rawTitle || "Untitled order",
    clientId: readString(data.clientId),
    clientEmail: readString(data.clientEmail),
    clientName: readString(data.clientName) || readString(data.fullName) || readString(data.name),
    requestId: readString(data.requestId),
    invoiceNumber: readString(data.invoiceNumber),
    invoiceUrl: safeHttpUrl(data.invoiceUrl),
    supplier: readString(data.supplier),
    trackingNumber: readString(data.trackingNumber),
    trackingUrl: safeHttpUrl(data.trackingUrl),
    status,
    rawStatus,
    statusIssue: classifyStatusIssue(rawValue, status),
    createdAt: readDate(data.createdAt),
    updatedAt: readDate(data.updatedAt),
  };
}

function toAttentionItem(
  record: DashboardRecord,
  orderRequestIds: Set<string>,
  canVerifyLinkedOrders: boolean,
): AttentionItem | null {
  const waitingSince = effectiveDate(record);
  const dataIssues = recordDataIssues(record);
  const age = recordAgeMs(record);

  if (dataIssues.length) {
    const critical = hasSevereDataIssue(record, dataIssues) || hasFailureStatus(record);
    const overdue = age >= REQUEST_OVERDUE_MS;
    return {
      record,
      action: dataIssueAction(record),
      category: "data_quality",
      dataIssues,
      isOverdue: overdue,
      owner: "Admin",
      priority: classifyPriority({ critical, high: !critical }),
      reason: dataIssueReason(record, waitingSince),
      sortGroup: 0,
      technicalDetail: `Affected fields: ${dataIssues.join(", ")}.`,
      waitingSince,
    };
  }

  if (record.kind === "request") {
    if (record.status === "submitted") {
      const overdue = isAttentionOverdue(record, REQUEST_OVERDUE_MS);
      return {
        record,
        action: "Review request",
        category: "request",
        dataIssues: [],
        isOverdue: overdue,
        owner: "Admin",
        priority: classifyPriority({
          high: overdue || record.urgency.toLowerCase() === "urgent",
        }),
        reason: overdue
          ? `Admin review has been waiting ${formatDurationWords(waitingSince)}.`
          : record.urgency.toLowerCase() === "urgent"
            ? "Marked urgent and ready for admin review."
            : "Submitted and ready for admin review.",
        sortGroup: overdue ? 4 : 5,
        waitingSince,
      };
    }
    if (record.status === "needs_info") {
      return {
        record,
        action: "Review request",
        category: "request",
        dataIssues: [],
        isOverdue: false,
        owner: "Client",
        priority: classifyPriority({ low: age < DAY_MS }),
        reason: `Client information has been outstanding for ${formatDurationWords(waitingSince)}.`,
        sortGroup: 6,
        waitingSince,
      };
    }
    if (
      record.status === "approved" &&
      canVerifyLinkedOrders &&
      !orderRequestIds.has(record.id)
    ) {
      const overdue = isAttentionOverdue(record, REQUEST_OVERDUE_MS);
      return {
        record,
        action: "Review approved request",
        category: "request",
        dataIssues: [],
        isOverdue: overdue,
        owner: "Admin",
        reason: `Approved request has had no linked order for ${formatDurationWords(waitingSince)}.`,
        priority: classifyPriority({ high: true }),
        sortGroup: 2,
        waitingSince,
      };
    }
    return null;
  }

  if (!record.status) return null;
  if (hasFailureStatus(record)) {
    return {
      record,
      action: "Resolve failure",
      category: "order",
      dataIssues: [],
      isOverdue: true,
      owner: "Admin",
      priority: "critical",
      reason: `Stored order state “${safeRawStatus(record.rawStatus)}” indicates a payment or fulfilment failure.`,
      sortGroup: 0,
      waitingSince,
    };
  }
  if (record.status === "invoice_sent") {
    return {
      record,
      action: "Review payment",
      category: "order",
      dataIssues: [],
      isOverdue: false,
      owner: "Client",
      priority: classifyPriority({ low: age < DAY_MS }),
      reason: `Payment has been outstanding for ${formatDurationWords(waitingSince)}.`,
      sortGroup: 3,
      waitingSince,
    };
  }
  if (record.status === "dispatched" && !record.trackingNumber && !record.trackingUrl) {
    const overdue = isAttentionOverdue(record, DAY_MS);
    return {
      record,
      action: "Add tracking",
      category: "order",
      dataIssues: [],
      isOverdue: overdue,
      owner: "Admin",
      priority: classifyPriority({ high: overdue }),
      reason: `Tracking details have been missing for ${formatDurationWords(waitingSince)} after dispatch.`,
      sortGroup: 3,
      waitingSince,
    };
  }
  if (orderQueueGroup(record.status) === "needs_action") {
    const action = record.status === "paid" && !record.supplier ? "Add supplier details" : ORDER_NEXT_ACTIONS[record.status];
    const blocked = record.status === "paid" && !record.supplier;
    const overdue = isAttentionOverdue(record, ORDER_OVERDUE_MS);
    return {
      record,
      action,
      category: "order",
      dataIssues: [],
      isOverdue: overdue,
      owner: "Admin",
      priority: classifyPriority({ high: blocked || overdue }),
      reason: orderAttentionReason(record, waitingSince, overdue),
      sortGroup: blocked ? 2 : 3,
      waitingSince,
    };
  }
  return null;
}

function orderAttentionReason(record: OrderRecord, waitingSince: Date | null, overdue: boolean) {
  if (!record.status) return "The order status needs review.";
  if (overdue) return `${ORDER_NEXT_ACTIONS[record.status]} has been waiting ${formatDurationWords(waitingSince)}.`
  if (record.status === "created") return "The order has been created and needs an invoice."
  if (record.status === "paid" && !record.supplier) return "Payment is recorded but supplier details are missing."
  if (record.status === "paid") return "Payment is recorded and the item is ready to purchase."
  if (record.status === "purchased") return "The purchased item is ready for quality checking."
  if (record.status === "quality_check") return "Quality checking is complete and dispatch should be prepared."
  return ORDER_NEXT_ACTIONS[record.status];
}

function getSecondaryActions(record: DashboardRecord, hasLinkedOrder: boolean): SecondaryAction[] {
  const actions: SecondaryAction[] = [];
  if (record.clientEmail) actions.push({ kind: "copy", label: "Copy client email", value: record.clientEmail });
  if (isSafeDocumentId(record.clientId)) actions.push({ kind: "link", label: "Open client", href: `/admin/clients/${record.clientId}` });
  if (record.kind === "request" && record.status === "approved" && !hasLinkedOrder) actions.push({ kind: "link", label: "Create linked order", href: `/admin/create?requestId=${encodeURIComponent(record.id)}` });
  if (record.kind === "order") {
    if (record.invoiceUrl) actions.push({ kind: "link", label: "Open invoice", href: record.invoiceUrl, external: true });
    else if (record.trackingUrl) actions.push({ kind: "link", label: "Open tracking", href: record.trackingUrl, external: true });
    else actions.push({ kind: "copy", label: "Copy order number", value: record.id });
    if (isSafeDocumentId(record.requestId)) actions.push({ kind: "link", label: "Open request", href: `/admin/requests/${record.requestId}` });
  }
  return actions.slice(0, 2);
}

function activityDescription(record: DashboardRecord) {
  if (record.kind === "request") return "Request updated";
  return record.status ? `Order status is now ${ORDER_STATUS_LABELS[record.status]}` : "Order updated — status needs review";
}

function compareAttentionItems(left: AttentionItem, right: AttentionItem) {
  const group = left.sortGroup - right.sortGroup;
  if (group) return group;
  const priority = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  if (priority) return priority;
  const leftTime = left.waitingSince?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightTime = right.waitingSince?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime || left.record.id.localeCompare(right.record.id);
}

function classifyPriority({
  critical = false,
  high = false,
  low = false,
}: {
  critical?: boolean;
  high?: boolean;
  low?: boolean;
}): Priority {
  if (critical) return "critical";
  if (high) return "high";
  if (low) return "low";
  return "medium";
}

function isAttentionOverdue(record: DashboardRecord, threshold: number) {
  return recordAgeMs(record) >= threshold;
}

function recordAgeMs(record: DashboardRecord) {
  const value = effectiveDate(record);
  return value ? Math.max(0, Date.now() - value.getTime()) : 0;
}

function dataIssueAction(record: DashboardRecord) {
  if (record.kind === "request") return "Open request";
  return "Open order";
}

function dataIssueReason(record: DashboardRecord, waitingSince: Date | null) {
  const duration = formatDurationWords(waitingSince);

  if (record.statusIssue) {
    return waitingSince
      ? `Workflow status has been unresolved for ${duration}.`
      : "Workflow status is missing, invalid or unsupported.";
  }
  if (!record.rawTitle || isPlaceholderTitle(record.rawTitle)) {
    return "The stored title is missing or unclear, so the record needs inspection.";
  }
  return waitingSince
    ? `Incomplete record data has been unresolved for ${duration}.`
    : "Record data is incomplete or invalid and needs inspection.";
}

function balanceAttentionItems(items: AttentionItem[], limit: number) {
  const selected: AttentionItem[] = [];
  const selectedKeys = new Set<string>();
  const categoryCounts: Record<AttentionCategory, number> = {
    request: 0,
    order: 0,
    data_quality: 0,
  };

  for (const item of items) {
    if (selected.length >= limit) break;
    if (categoryCounts[item.category] >= ATTENTION_CATEGORY_CAPS[item.category]) continue;
    selected.push(item);
    selectedKeys.add(`${item.record.kind}-${item.record.id}`);
    categoryCounts[item.category] += 1;
  }

  for (const item of items) {
    if (selected.length >= limit) break;
    const key = `${item.record.kind}-${item.record.id}`;
    if (selectedKeys.has(key)) continue;
    selected.push(item);
  }

  return selected.sort(compareAttentionItems);
}

function recordDataIssues(record: DashboardRecord) {
  const issues: string[] = [];

  if (!record.rawTitle) issues.push("title (missing)");
  else if (isPlaceholderTitle(record.rawTitle)) issues.push("title (placeholder)");

  if (!record.clientName && !record.clientEmail && !record.clientId) {
    issues.push("client identity (missing)");
  }
  if (record.clientId && !isSafeDocumentId(record.clientId)) {
    issues.push("clientId (malformed)");
  }
  if (!record.createdAt && !record.updatedAt) {
    issues.push("createdAt/updatedAt (missing or invalid)");
  }

  if (record.statusIssue === "missing") issues.push("status (missing)");
  if (record.statusIssue === "malformed") issues.push("status (unsupported value type)");
  if (record.statusIssue === "unrecognised") {
    issues.push(`status (“${safeRawStatus(record.rawStatus)}” not recognised)`);
  }

  if (record.kind === "order" && record.requestId && !isSafeDocumentId(record.requestId)) {
    issues.push("requestId (malformed relationship)");
  }

  return issues;
}

function hasSevereDataIssue(record: DashboardRecord, issues: string[]) {
  return (
    record.statusIssue === "malformed" ||
    issues.some((issue) =>
      issue.includes("malformed relationship") ||
      issue.includes("placeholder") ||
      issue.includes("unsupported value type"),
    ) ||
    (issues.some((issue) => issue.startsWith("title")) &&
      issues.some((issue) => issue.startsWith("client identity")))
  );
}

function hasFailureStatus(record: DashboardRecord) {
  return (
    record.kind === "order" &&
    /(?:^|[_\s-])(failed|failure|declined|payment_error|fulfilment_error|refund)(?:$|[_\s-])/.test(
      record.rawStatus.toLowerCase(),
    )
  );
}

function classifyStatusIssue(value: unknown, status: string | null): StatusIssue {
  if (status) return null;
  if (value === undefined || value === null || value === "") return "missing";
  return typeof value === "string" ? "unrecognised" : "malformed";
}

function recordStatusLabel(record: DashboardRecord) {
  if (record.status) return record.kind === "request" ? REQUEST_STATUS_LABELS[record.status] : ORDER_STATUS_LABELS[record.status];
  return record.rawStatus ? `Unrecognised: ${safeRawStatus(record.rawStatus)}` : record.statusIssue === "malformed" ? "Malformed status" : "Status missing";
}

function recordStatusTone(record: DashboardRecord): "neutral" | "info" | "success" | "warning" | "danger" {
  if (record.statusIssue) return "danger";
  const value = record.status;
  if (value === "submitted" || value === "created") return "info";
  if (["needs_info", "invoice_sent", "paid", "purchased", "quality_check"].includes(value ?? "")) return "warning";
  if (["dispatched", "delivered", "closed"].includes(value ?? "")) return "success";
  if (value === "cancelled") return "danger";
  return "neutral";
}

function isActiveOrder(status: OrderStatus | null) {
  if (!status) return false;
  const group = orderQueueGroup(status);
  return group === "needs_action" || group === "awaiting_payment" || group === "fulfilment";
}

function bestClientLabel(record: DashboardRecord) {
  return record.clientName || record.clientEmail || (record.clientId ? `Client ${record.clientId}` : "Client identity unavailable");
}

function displayRecordTitle(record: DashboardRecord) {
  const title = titleWithoutClientPrefix(record);
  if (!record.rawTitle) return `Untitled ${kindLabel(record.kind).toLowerCase()}`;
  if (isPlaceholderTitle(title) || isWeakTitle(title)) {
    return `Unclear ${kindLabel(record.kind).toLowerCase()} title`;
  }
  return title;
}

function titleWithoutClientPrefix(record: DashboardRecord) {
  const title = record.title.trim();
  const client = record.clientName.trim();
  if (!client) return title;

  const escapedClient = client.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutClient = title.replace(
    new RegExp(`^${escapedClient}\\s*(?:[-–—:]\\s*)+`, "i"),
    "",
  ).trim();

  return withoutClient || title;
}

function formatRecordIdentity(record: DashboardRecord, includeTitle: boolean) {
  const identity = bestClientLabel(record);
  return includeTitle
    ? `${identity} · ${displayRecordTitle(record)}`
    : `${identity} · #${record.id.slice(0, 8)}`;
}

function weakRawTitleDetail(record: DashboardRecord) {
  if (!record.rawTitle) return null;
  const title = titleWithoutClientPrefix(record);
  if (!isPlaceholderTitle(title) && !isWeakTitle(title)) return null;
  return `Stored title: “${safeRawTitle(title)}”`;
}

function isPlaceholderTitle(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  return /^(?:[-–—]+\s*\/\s*[-–—]+|[-–—]+|\/)$/.test(normalized);
}

function isWeakTitle(value: string) {
  const normalized = value.replace(/[^\p{L}\p{N}]/gu, "").trim();
  return normalized.length > 0 && normalized.length < 3;
}

function isLikelyTestRecord(record: DashboardRecord) {
  const title = titleWithoutClientPrefix(record)
    .toLowerCase()
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Conservative dashboard-only rule: hide only exact test/demo/sample/placeholder
  // labels (optionally followed by a record type or number), plus the common “tets” typo.
  // Short, missing, punctuation-only and otherwise weak titles remain visible for review.
  return /^(?:test|tets|demo|sample|placeholder)(?:\s*(?:record|request|order|conversation|\d+))?$/.test(
    title,
  );
}

function safeRawTitle(value: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized.length > 50 ? `${normalized.slice(0, 47)}…` : normalized;
}

function kindLabel(kind: DashboardRecord["kind"]) {
  if (kind === "request") return "Request";
  return "Order";
}

function effectiveDate(record: DashboardRecord) {
  return record.updatedAt ?? record.createdAt;
}

function readDate(value: unknown): Date | null {
  try {
    if (value instanceof Date) return validDate(value);
    if (isRecord(value) && typeof value.toDate === "function") return validDate((value.toDate as () => Date)());
    if (isRecord(value)) {
      const seconds = Number(value.seconds ?? value._seconds);
      const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
      if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) return validDate(new Date(seconds * 1000 + nanoseconds / 1_000_000));
    }
    if (typeof value === "string" || typeof value === "number") return validDate(new Date(value));
  } catch {
    return null;
  }
  return null;
}

function validDate(value: Date) {
  return Number.isNaN(value.getTime()) ? null : value;
}

function safeHttpUrl(value: unknown) {
  const raw = readString(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function isSafeDocumentId(value: string) {
  return Boolean(value) && value !== "." && value !== ".." && !value.includes("/");
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatWaitingTime(value: Date | null) {
  return formatDurationWords(value);
}

function formatDurationWords(value: Date | null) {
  if (!value) return "an unknown period";
  const elapsed = Math.max(0, Date.now() - value.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function formatAttentionTiming(item: AttentionItem) {
  if (!item.waitingSince) return "Waiting time unavailable";
  const duration = formatDurationWords(item.waitingSince);
  return item.isOverdue ? `${duration} overdue` : `${duration} waiting`;
}

function formatRelativeTime(value: Date | null) {
  if (!value) return "Time unavailable";
  const elapsed = Math.max(0, Date.now() - value.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function formatAbsoluteDate(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date unavailable";
}

function compareDatesNewest(left: Date | null, right: Date | null) {
  return (right?.getTime() ?? 0) - (left?.getTime() ?? 0);
}

function oldestRecordDate(records: DashboardRecord[]) {
  return records.reduce<Date | null>((oldest, record) => {
    const candidate = effectiveDate(record);
    if (!candidate) return oldest;
    return !oldest || candidate.getTime() < oldest.getTime() ? candidate : oldest;
  }, null);
}

function oldestAttentionDate(items: AttentionItem[]) {
  return items.reduce<Date | null>((oldest, item) => {
    const candidate = item.waitingSince;
    if (!candidate) return oldest;
    return !oldest || candidate.getTime() < oldest.getTime() ? candidate : oldest;
  }, null);
}

function metricValue(status: SourceStatus, value: number) {
  if (status === "loading") return "Loading";
  if (status === "error") return "Unavailable";
  return value;
}

function metricDetail(status: SourceStatus, readyDetail: string) {
  if (status === "loading") return "Loading live data";
  if (status === "error") return "Source data unavailable";
  return readyDetail;
}

function aggregateStatus(...statuses: SourceStatus[]): SourceStatus {
  if (statuses.includes("error")) return "error";
  if (statuses.includes("loading")) return "loading";
  return "ready";
}

function getSourcesWithStatus(statuses: Record<SourceName, SourceStatus>, status: SourceStatus) {
  return (Object.keys(statuses) as SourceName[]).filter((source) => statuses[source] === status);
}

function formatSourceList(sources: SourceName[]) {
  return sources.map((source) => SOURCE_LABELS[source]).join(", ");
}

function safeRawStatus(value: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized.length > 40 ? `${normalized.slice(0, 37)}…` : normalized;
}

function priorityAccent(priority: Priority) {
  if (priority === "critical") return "shadow-[inset_3px_0_0_#a94b39]";
  if (priority === "high") return "shadow-[inset_3px_0_0_#b59674]";
  return "";
}
