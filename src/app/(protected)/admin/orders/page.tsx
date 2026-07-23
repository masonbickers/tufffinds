"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { useRouter, useSearchParams } from "next/navigation";

import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import {
  AdminFilterSelect,
  AdminMetric,
  AdminPage,
  AdminPageHeader,
  AdminSearchInput,
  AdminState,
  AdminStatusBadge,
  AdminToolbar,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../_components/AdminUI";
import { ORDER_STATUSES, type OrderStatus } from "../admin-types";
import {
  ORDER_NEXT_ACTIONS,
  ORDER_QUEUE_GROUP_LABELS,
  ORDER_QUEUE_GROUPS,
  ORDER_STATUS_LABELS,
  isOrderStatus,
  orderQueueGroup,
  orderStatusToneName,
  type OrderQueueGroup,
} from "../admin-utils";

type Currency = "GBP" | "EUR" | "USD";
type LoadState = "loading" | "ready" | "error";
type SourceFilter = "all" | "linked" | "manual";
type IssueFilter = "all" | "with" | "without";
type SortOption =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc";
type StatusFilter = "all" | "missing" | "unknown" | OrderStatus;
type GroupFilter = "all" | OrderQueueGroup;

type AmountValue =
  | { kind: "valid"; value: number }
  | { kind: "missing" }
  | { kind: "malformed" };

type CurrencyValue =
  | { kind: "supported"; value: Currency }
  | { kind: "missing" }
  | { kind: "unsupported"; raw: string };

type TimestampValue =
  | { kind: "valid"; value: number }
  | { kind: "missing" }
  | { kind: "malformed" };

type StatusIssue = "missing" | "unknown" | "malformed" | null;

type AdminOrder = {
  id: string;
  clientId: string;
  clientEmail: string;
  requestId: string;
  title: string;
  brand: string;
  item: string;
  size: string;
  colour: string;
  status: OrderStatus | null;
  rawStatus: string;
  statusIssue: StatusIssue;
  salePrice: AmountValue;
  costPrice: AmountValue;
  currency: CurrencyValue;
  invoiceNumber: string;
  supplier: string;
  courier: string;
  trackingNumber: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  issues: string[];
};

type ClientSummary = {
  fullName: string;
  email: string;
};

const SORT_LABELS: Record<SortOption, string> = {
  updated_desc: "Updated: newest",
  updated_asc: "Updated: oldest",
  created_desc: "Created: newest",
  created_asc: "Created: oldest",
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersState, setOrdersState] = useState<LoadState>("loading");
  const [ordersError, setOrdersError] = useState("");
  const [clients, setClients] = useState<Map<string, ClientSummary>>(new Map());
  const [clientsState, setClientsState] = useState<LoadState>("loading");
  const [clientsError, setClientsError] = useState("");

  const search = searchParams.get("q") ?? "";
  const clientId = searchParams.get("clientId") ?? "";
  const group = readGroupFilter(searchParams.get("group"));
  const status = readStatusFilter(searchParams.get("status"));
  const source = readSourceFilter(searchParams.get("source"));
  const issues = readIssueFilter(searchParams.get("issues"));
  const sort = readSortOption(searchParams.get("sort"));
  const hasInvalidParameters =
    isInvalidParameter(searchParams.get("group"), group, "all") ||
    isInvalidParameter(searchParams.get("status"), status, "all") ||
    isInvalidParameter(searchParams.get("source"), source, "all") ||
    isInvalidParameter(searchParams.get("issues"), issues, "all") ||
    isInvalidParameter(searchParams.get("sort"), sort, "updated_desc");

  useEffect(() => {
    setOrdersState("loading");
    setOrdersError("");

    return onSnapshot(
      query(collection(db, "orders")),
      (snapshot) => {
        setOrders(
          snapshot.docs.map((entry) =>
            normalizeOrder(
              entry.id,
              entry.data() as Record<string, unknown>,
            ),
          ),
        );
        setOrdersState("ready");
      },
      (error) => {
        console.error("Failed to load orders", error);
        setOrdersError(readFailureMessage(error, "orders"));
        setOrdersState("error");
      },
    );
  }, []);

  useEffect(() => {
    setClientsState("loading");
    setClientsError("");

    return onSnapshot(
      query(collection(db, "client_profiles")),
      (snapshot) => {
        const nextClients = new Map<string, ClientSummary>();

        snapshot.docs.forEach((entry) => {
          const data = entry.data() as Record<string, unknown>;
          const profile = isRecord(data.profile) ? data.profile : {};
          nextClients.set(entry.id, {
            fullName:
              readString(profile.fullName) ||
              readString(data.fullName) ||
              "",
            email: readString(data.email),
          });
        });

        setClients(nextClients);
        setClientsState("ready");
      },
      (error) => {
        console.error("Failed to load order clients", error);
        setClients(new Map());
        setClientsError(readFailureMessage(error, "client profiles"));
        setClientsState("error");
      },
    );
  }, []);

  const summary = useMemo(() => {
    const counts: Record<OrderQueueGroup, number> = {
      needs_action: 0,
      awaiting_payment: 0,
      fulfilment: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      if (!order.status) return;
      const queue = orderQueueGroup(order.status);
      if (queue) counts[queue] += 1;
    });

    return counts;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      if (clientId && order.clientId !== clientId) return false;
      const client = clients.get(order.clientId);
      const matchesSearch =
        !term ||
        [
          order.id,
          order.title,
          order.clientEmail,
          order.clientId,
          client?.fullName,
          client?.email,
          order.requestId,
          order.brand,
          order.item,
          order.rawStatus,
          order.invoiceNumber,
          order.trackingNumber,
          order.supplier,
          order.courier,
        ].some((value) => value?.toLowerCase().includes(term));

      if (!matchesSearch) return false;
      if (group !== "all") {
        if (!order.status || orderQueueGroup(order.status) !== group) {
          return false;
        }
      }
      if (status !== "all") {
        if (status === "missing" && order.statusIssue !== "missing") return false;
        if (
          status === "unknown" &&
          order.statusIssue !== "unknown" &&
          order.statusIssue !== "malformed"
        ) {
          return false;
        }
        if (isOrderStatus(status) && order.status !== status) return false;
      }
      if (source === "linked" && !isSafeDocumentId(order.requestId)) return false;
      if (source === "manual" && order.requestId) return false;
      if (issues === "with" && order.issues.length === 0) return false;
      if (issues === "without" && order.issues.length > 0) return false;
      return true;
    });

    return sortOrders(filtered, sort);
  }, [clientId, clients, group, issues, orders, search, sort, source, status]);

  const issueCount = useMemo(
    () => orders.filter((order) => order.issues.length > 0).length,
    [orders],
  );

  const hasActiveControls =
    Boolean(search.trim()) ||
    Boolean(clientId) ||
    group !== "all" ||
    status !== "all" ||
    source !== "all" ||
    issues !== "all" ||
    sort !== "updated_desc" ||
    hasInvalidParameters;

  function updateParameter(
    name: "q" | "group" | "status" | "source" | "issues" | "sort",
    value: string,
    replace = false,
  ) {
    const next = new URLSearchParams(searchParams.toString());
    const defaults: Record<typeof name, string> = {
      q: "",
      group: "all",
      status: "all",
      source: "all",
      issues: "all",
      sort: "updated_desc",
    };

    if (!value || value === defaults[name]) next.delete(name);
    else next.set(name, value);

    const destination = next.toString()
      ? `/admin/orders?${next.toString()}`
      : "/admin/orders";
    if (replace) router.replace(destination);
    else router.push(destination);
  }

  function resetControls() {
    router.push("/admin/orders");
  }

  const summaryReady = ordersState === "ready";
  const canShowOrders = orders.length > 0;

  return (
    <AdminShell active="orders">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Commercial and fulfilment"
          title="Orders"
          description="Prioritise invoicing, purchasing, quality checks and dispatch without hiding incomplete records."
          actions={
            <Link href="/admin/create" className={adminPrimaryButton}>
              Create order
            </Link>
          }
        />

        <section aria-label="Order queue summary">
          <div className="grid divide-y divide-[#e2d9cf] border-y border-[#e2d9cf] sm:grid-cols-4 sm:divide-y-0">
            <AdminMetric
              label="Needs action"
              value={summaryReady ? summary.needs_action : "—"}
              detail="Invoice, purchase, check or dispatch"
            />
            <AdminMetric
              label="Awaiting payment"
              value={summaryReady ? summary.awaiting_payment : "—"}
              detail="Invoice sent"
            />
            <AdminMetric
              label="In fulfilment"
              value={summaryReady ? summary.fulfilment : "—"}
              detail="Dispatched"
            />
            <AdminMetric
              label="Completed"
              value={summaryReady ? summary.completed : "—"}
              detail="Delivered or closed"
            />
          </div>
        </section>

        {ordersState === "error" ? (
          <div
            role="alert"
            className="rounded-[12px] border border-[#e6c7be] bg-[#fcf0ed] p-4 text-sm text-[#8c3c2d]"
          >
            <p className="font-semibold">Orders could not be refreshed</p>
            <p className="mt-1 leading-6">
              {ordersError}
              {canShowOrders
                ? " The last loaded records remain visible, but summary counts are unavailable."
                : " No empty collection has been assumed."}
            </p>
          </div>
        ) : null}

        {clientsState === "error" ? (
          <div
            role="status"
            className="rounded-[12px] border border-[#e5d3a9] bg-[#fbf6e8] p-4 text-sm text-[#725820]"
          >
            <p className="font-semibold">Live client names are unavailable</p>
            <p className="mt-1 leading-6">
              {clientsError} Stored order relationships and client links remain usable.
            </p>
          </div>
        ) : null}

        {ordersState === "ready" && issueCount > 0 ? (
          <div
            role="status"
            className="flex flex-col gap-2 rounded-[12px] border border-[#e5d3a9] bg-[#fbf6e8] p-4 text-sm text-[#725820] sm:flex-row sm:items-center sm:justify-between"
          >
            <p>
              <span className="font-semibold">
                {issueCount} order{issueCount === 1 ? " contains" : "s contain"} data issues.
              </span>{" "}
              Valid records remain available and affected values are labelled below.
            </p>
            <button
              type="button"
              onClick={() => updateParameter("issues", "with")}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Show affected orders
            </button>
          </div>
        ) : null}

        <section aria-labelledby="order-list-heading">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="order-list-heading" className="text-lg font-semibold text-[#302722]">
                Order queue
              </h2>
              <p className="mt-0.5 text-sm text-[#7b6e65]">
                Default order: most recently updated first.
              </p>
            </div>
            {ordersState === "ready" ? (
              <p className="text-xs tabular-nums text-[#74675e]" role="status" aria-live="polite">
                {visibleOrders.length} of {orders.length} shown
              </p>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[12px] border border-[#ded5cb] bg-white">
            <AdminToolbar>
              <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <AdminSearchInput
                value={search}
                onChange={(value) => updateParameter("q", value, true)}
                placeholder="Search client, order, request or supplier"
                label="Search orders"
              />
              <AdminFilterSelect
                label="Filter by queue group"
                value={group}
                onChange={(value) => updateParameter("group", value)}
              >
                <option value="all">All queue groups</option>
                {(Object.keys(ORDER_QUEUE_GROUPS) as OrderQueueGroup[]).map(
                  (value) => (
                    <option key={value} value={value}>
                      {ORDER_QUEUE_GROUP_LABELS[value]}
                    </option>
                  ),
                )}
              </AdminFilterSelect>
              <AdminFilterSelect
                label="Filter by exact status"
                value={status}
                onChange={(value) => updateParameter("status", value)}
              >
                <option value="all">All statuses</option>
                {ORDER_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {ORDER_STATUS_LABELS[value]}
                  </option>
                ))}
                <option value="missing">Missing status</option>
                <option value="unknown">Unknown or malformed status</option>
              </AdminFilterSelect>
              <AdminFilterSelect
                label="Filter by order source"
                value={source}
                onChange={(value) => updateParameter("source", value)}
              >
                <option value="all">All sources</option>
                <option value="linked">Request-linked</option>
                <option value="manual">Manual orders</option>
              </AdminFilterSelect>
              <AdminFilterSelect
                label="Filter by data quality"
                value={issues}
                onChange={(value) => updateParameter("issues", value)}
              >
                <option value="all">All data quality</option>
                <option value="with">With data issues</option>
                <option value="without">Without data issues</option>
              </AdminFilterSelect>
              <AdminFilterSelect
                label="Sort orders"
                value={sort}
                onChange={(value) => updateParameter("sort", value)}
              >
                {(Object.keys(SORT_LABELS) as SortOption[]).map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </AdminFilterSelect>
                {hasActiveControls ? (
                  <button
                    type="button"
                    onClick={resetControls}
                    className={`${adminSecondaryButton} shrink-0`}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </AdminToolbar>

          {ordersState === "loading" ? (
            <AdminState
              title="Loading orders"
              body="Reading the complete orders collection."
            />
          ) : null}

          {ordersState === "error" && !canShowOrders ? (
            <AdminState
              title="Orders unavailable"
              body="The query failed. No empty result has been assumed."
              tone="error"
            />
          ) : null}

          {ordersState === "ready" && orders.length === 0 ? (
            <AdminState
              title="No orders yet"
              body="Create an order when a client requirement is ready to enter the commercial workflow."
            />
          ) : null}

          {ordersState !== "loading" && canShowOrders && visibleOrders.length === 0 ? (
            <QueueState
              title="No orders match these controls"
              body="The loaded orders are still available. Clear the current search and filters to see them."
              action={
                <button
                  type="button"
                  onClick={resetControls}
                  className={adminSecondaryButton}
                >
                  Clear filters
                </button>
              }
            />
          ) : null}

          {visibleOrders.length > 0 ? (
            <>
              <table className="hidden w-full table-fixed text-left xl:table">
                <thead className="border-b border-[#e5ddd4] bg-[#faf8f4] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#776a61]">
                  <tr>
                    <th className="w-[18%] px-4 py-2.5">Client</th>
                    <th className="w-[19%] px-4 py-2.5">Order</th>
                    <th className="w-[15%] px-4 py-2.5">Status</th>
                    <th className="w-[11%] px-4 py-2.5">Sale</th>
                    <th className="w-[11%] px-4 py-2.5">Purchase</th>
                    <th className="w-[13%] px-4 py-2.5">Source</th>
                    <th className="w-[13%] px-4 py-2.5">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece5dd]">
                  {visibleOrders.map((order) => (
                    <DesktopOrderRow
                      key={order.id}
                      order={order}
                      client={clients.get(order.clientId)}
                    />
                  ))}
                </tbody>
              </table>

              <div className="divide-y divide-[#ece5dd] xl:hidden">
                {visibleOrders.map((order) => (
                  <ResponsiveOrderRow
                    key={order.id}
                    order={order}
                    client={clients.get(order.clientId)}
                  />
                ))}
              </div>
            </>
          ) : null}
          </div>
        </section>

      </AdminPage>
    </AdminShell>
  );
}

function DesktopOrderRow({
  order,
  client,
}: {
  order: AdminOrder;
  client?: ClientSummary;
}) {
  return (
    <tr className="align-top text-sm">
      <td className="px-4 py-3">
        <ClientRelationship order={order} client={client} />
      </td>
      <td className="px-4 py-3">
        <OrderIdentity order={order} />
      </td>
      <td className="px-4 py-3">
        <StatusAndAction order={order} />
      </td>
      <td className="px-4 py-3">
        <MoneyValue amount={order.salePrice} currency={order.currency} />
      </td>
      <td className="px-4 py-3">
        <MoneyValue amount={order.costPrice} currency={order.currency} />
      </td>
      <td className="px-4 py-3">
        <SourceRelationship order={order} />
      </td>
      <td className="px-4 py-3">
        <TimestampDisplay order={order} />
      </td>
    </tr>
  );
}

function ResponsiveOrderRow({
  order,
  client,
}: {
  order: AdminOrder;
  client?: ClientSummary;
}) {
  return (
    <article className="min-w-0 px-4 py-4" aria-label={`Order ${order.title}`}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <OrderIdentity order={order} />
        <StatusAndAction order={order} />
      </div>

      <div className="mt-4 grid gap-4 border-t border-[#ece5dd] pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <MobileField label="Client">
          <ClientRelationship order={order} client={client} />
        </MobileField>
        <MobileField label="Sale value">
          <MoneyValue amount={order.salePrice} currency={order.currency} />
        </MobileField>
        <MobileField label="Purchase value">
          <MoneyValue amount={order.costPrice} currency={order.currency} />
        </MobileField>
        <MobileField label="Source">
          <SourceRelationship order={order} />
        </MobileField>
        <MobileField label="Updated">
          <TimestampDisplay order={order} />
        </MobileField>
      </div>
    </article>
  );
}

function OrderIdentity({ order }: { order: AdminOrder }) {
  const detailHref = isSafeDocumentId(order.id)
    ? `/admin/orders/${order.id}`
    : "";

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        {detailHref ? (
          <Link
            href={detailHref}
            className="break-words font-medium text-[#2b231e] underline decoration-[#c9beb4] underline-offset-4 transition hover:decoration-[#2b231e]"
            aria-label={`Open order ${order.title || order.id}`}
          >
            {order.title || "Untitled order"}
          </Link>
        ) : (
          <p className="break-words font-medium text-[#2b231e]">
            {order.title || "Untitled order"}
          </p>
        )}
        {order.issues.length ? (
          <AdminStatusBadge tone="danger">Data issue</AdminStatusBadge>
        ) : null}
      </div>
      <p className="mt-1 break-words text-xs leading-5 text-[#75685f]">
        {[order.brand, order.item, order.size, order.colour]
          .filter(Boolean)
          .join(" · ") || "Item details not recorded"}
      </p>
      <p className="mt-1 break-all text-[11px] text-[#95887f]">
        Order {order.id}
      </p>
      {order.issues.length ? (
        <p className="sr-only">Issues: {order.issues.join("; ")}</p>
      ) : null}
    </div>
  );
}

function ClientRelationship({
  order,
  client,
}: {
  order: AdminOrder;
  client?: ClientSummary;
}) {
  const label =
    client?.fullName || client?.email || order.clientEmail || "Client profile";

  if (isSafeDocumentId(order.clientId)) {
    return (
      <div className="min-w-0">
        <Link
          href={`/admin/clients/${encodeURIComponent(order.clientId)}`}
          className="break-words font-medium text-[#4e4138] underline decoration-[#c8b9ac] underline-offset-2 hover:text-[#241e1a]"
          aria-label={`Open client profile for ${label}`}
        >
          {label}
        </Link>
        {order.clientEmail && order.clientEmail !== label ? (
          <p className="mt-1 break-all text-xs text-[#75685f]">
            {order.clientEmail}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="break-words text-[#4e4138]">
        {order.clientEmail || "Client not recorded"}
      </p>
      <p className="mt-1 text-xs font-medium text-[#8c3c2d]">
        {order.clientId ? "Malformed client ID" : "Client ID missing"}
      </p>
    </div>
  );
}

function StatusAndAction({ order }: { order: AdminOrder }) {
  if (!order.status) {
    return (
      <div className="min-w-0">
        <AdminStatusBadge tone="danger">
          {order.statusIssue === "missing"
            ? "Missing status"
            : order.statusIssue === "malformed"
              ? "Malformed status"
              : "Unknown status"}
        </AdminStatusBadge>
        {order.rawStatus ? (
          <p className="mt-1 break-all text-xs text-[#8c3c2d]">
            Stored as “{order.rawStatus}”
          </p>
        ) : null}
        <p className="mt-1 text-xs text-[#75685f]">No action inferred</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <AdminStatusBadge tone={orderStatusToneName(order.status)}>
        {ORDER_STATUS_LABELS[order.status]}
      </AdminStatusBadge>
      <p className="mt-1 text-xs leading-5 text-[#75685f]">
        {ORDER_NEXT_ACTIONS[order.status]}
      </p>
    </div>
  );
}

function MoneyValue({
  amount,
  currency,
}: {
  amount: AmountValue;
  currency: CurrencyValue;
}) {
  if (amount.kind === "missing") {
    return <p className="text-sm text-[#75685f]">Not recorded</p>;
  }
  if (amount.kind === "malformed") {
    return <DataIssueValue detail="Malformed amount" />;
  }
  if (currency.kind === "missing") {
    return <DataIssueValue detail="Currency missing" />;
  }
  if (currency.kind === "unsupported") {
    return (
      <DataIssueValue
        detail={currency.raw ? `Unsupported currency: ${currency.raw}` : "Unsupported currency"}
      />
    );
  }

  return (
    <p className="font-medium tabular-nums text-[#4e4138]">
      {new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: currency.value,
      }).format(amount.value)}
    </p>
  );
}

function DataIssueValue({ detail }: { detail: string }) {
  return (
    <div>
      <p className="font-medium text-[#8c3c2d]">Data issue</p>
      <p className="mt-1 text-xs text-[#8c3c2d]">{detail}</p>
    </div>
  );
}

function SourceRelationship({ order }: { order: AdminOrder }) {
  if (!order.requestId) {
    return (
      <div>
        <p className="font-medium text-[#4e4138]">Manual order</p>
        <p className="mt-1 text-xs text-[#75685f]">No request linked</p>
      </div>
    );
  }

  if (!isSafeDocumentId(order.requestId)) {
    return (
      <div>
        <p className="font-medium text-[#8c3c2d]">Malformed request ID</p>
        <p className="mt-1 break-all text-xs text-[#8c3c2d]">
          {order.requestId}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Link
        href={`/admin/requests/${encodeURIComponent(order.requestId)}`}
        className="font-medium text-[#4e4138] underline decoration-[#c8b9ac] underline-offset-2 hover:text-[#241e1a]"
        aria-label={`Open linked request ${order.requestId}`}
      >
        Linked request
      </Link>
      <p className="mt-1 break-all text-xs text-[#75685f]">
        {order.requestId}
      </p>
    </div>
  );
}

function TimestampDisplay({ order }: { order: AdminOrder }) {
  if (order.updatedAt.kind === "valid") {
    return (
      <div>
        <p className="text-[#4e4138]">{formatTimestamp(order.updatedAt.value)}</p>
        <p className="mt-1 text-xs text-[#75685f]">Updated</p>
      </div>
    );
  }
  if (order.createdAt.kind === "valid") {
    return (
      <div>
        <p className="text-[#4e4138]">{formatTimestamp(order.createdAt.value)}</p>
        <p className="mt-1 text-xs text-[#75685f]">Created date fallback</p>
      </div>
    );
  }
  return (
    <DataIssueValue
      detail={
        order.updatedAt.kind === "malformed" ||
        order.createdAt.kind === "malformed"
          ? "Invalid timestamps"
          : "Timestamps missing"
      }
    />
  );
}

function MobileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#81746a]">
        {label}
      </p>
      {children}
    </div>
  );
}

function QueueState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center" role="status">
      <h2 className="text-base font-semibold text-[#302722]">{title}</h2>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-[#766960]">
        {body}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function normalizeOrder(
  id: string,
  data: Record<string, unknown>,
): AdminOrder {
  const rawStatus = readString(data.status);
  const status = isOrderStatus(rawStatus) ? rawStatus : null;
  const statusIssue: StatusIssue = status
    ? null
    : data.status === undefined || data.status === null || rawStatus === ""
      ? "missing"
      : typeof data.status === "string"
        ? "unknown"
        : "malformed";
  const salePrice = readAmount(data.salePrice);
  const costPrice = readAmount(data.costPrice);
  const currency = readCurrency(data.currency);
  const createdAt = readTimestamp(data.createdAt);
  const updatedAt = readTimestamp(data.updatedAt);
  const clientId = readString(data.clientId);
  const requestId = readString(data.requestId);
  const title = readString(data.title);
  const issues = [
    statusIssue === "missing" ? "Order status is missing." : "",
    statusIssue === "unknown" ? `Order status “${rawStatus}” is not recognised.` : "",
    statusIssue === "malformed" ? "Order status is malformed." : "",
    salePrice.kind === "malformed" ? "Sale price is malformed." : "",
    costPrice.kind === "malformed" ? "Purchase price is malformed." : "",
    currency.kind === "missing" ? "Currency is missing." : "",
    currency.kind === "unsupported" ? "Currency is not supported." : "",
    !title ? "Order title is missing." : "",
    !clientId ? "Client ID is missing." : "",
    clientId && !isSafeDocumentId(clientId) ? "Client ID is malformed." : "",
    requestId && !isSafeDocumentId(requestId) ? "Request ID is malformed." : "",
    createdAt.kind !== "valid" ? "Created timestamp is missing or invalid." : "",
    updatedAt.kind !== "valid" ? "Updated timestamp is missing or invalid." : "",
  ].filter(Boolean);

  return {
    id,
    clientId,
    clientEmail: readString(data.clientEmail),
    requestId,
    title,
    brand: readString(data.brand),
    item: readString(data.item),
    size: readString(data.size),
    colour: readString(data.colour),
    status,
    rawStatus,
    statusIssue,
    salePrice,
    costPrice,
    currency,
    invoiceNumber: readString(data.invoiceNumber),
    supplier: readString(data.supplier),
    courier: readString(data.courier),
    trackingNumber: readString(data.trackingNumber),
    createdAt,
    updatedAt,
    issues,
  };
}

function sortOrders(orders: AdminOrder[], sort: SortOption) {
  return [...orders].sort((left, right) => {
    const leftTimestamp =
      sort === "created_desc" || sort === "created_asc"
        ? validTimestamp(left.createdAt)
        : effectiveUpdatedTimestamp(left);
    const rightTimestamp =
      sort === "created_desc" || sort === "created_asc"
        ? validTimestamp(right.createdAt)
        : effectiveUpdatedTimestamp(right);
    const ascending = sort === "updated_asc" || sort === "created_asc";
    const timestampComparison = compareNullableNumbers(
      leftTimestamp,
      rightTimestamp,
      ascending,
    );

    return timestampComparison || left.id.localeCompare(right.id);
  });
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  ascending: boolean,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return ascending ? left - right : right - left;
}

function effectiveUpdatedTimestamp(order: AdminOrder) {
  return validTimestamp(order.updatedAt) ?? validTimestamp(order.createdAt);
}

function validTimestamp(value: TimestampValue) {
  return value.kind === "valid" ? value.value : null;
}

function readAmount(value: unknown): AmountValue {
  if (value === undefined || value === null || value === "") {
    return { kind: "missing" };
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return { kind: "valid", value };
  }
  return { kind: "malformed" };
}

function readCurrency(value: unknown): CurrencyValue {
  if (value === undefined || value === null || value === "") {
    return { kind: "missing" };
  }
  if (isCurrency(value)) return { kind: "supported", value };
  return {
    kind: "unsupported",
    raw: typeof value === "string" ? value.trim() : "",
  };
}

function readTimestamp(value: unknown): TimestampValue {
  if (value === undefined || value === null || value === "") {
    return { kind: "missing" };
  }

  try {
    let date: Date | null = null;
    if (value instanceof Date) date = value;
    else if (isRecord(value) && typeof value.toDate === "function") {
      date = (value.toDate as () => Date)();
    } else if (isRecord(value)) {
      const seconds = Number(value.seconds ?? value._seconds);
      const nanoseconds = Number(value.nanoseconds ?? value._nanoseconds ?? 0);
      if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
        date = new Date(seconds * 1000 + nanoseconds / 1_000_000);
      }
    } else if (typeof value === "string" || typeof value === "number") {
      date = new Date(value);
    }

    if (date && !Number.isNaN(date.getTime())) {
      return { kind: "valid", value: date.getTime() };
    }
  } catch {
    return { kind: "malformed" };
  }

  return { kind: "malformed" };
}

function readGroupFilter(value: string | null): GroupFilter {
  return value && value in ORDER_QUEUE_GROUPS
    ? (value as OrderQueueGroup)
    : "all";
}

function readStatusFilter(value: string | null): StatusFilter {
  if (value === "missing" || value === "unknown" || isOrderStatus(value)) {
    return value;
  }
  return "all";
}

function readSourceFilter(value: string | null): SourceFilter {
  return value === "linked" || value === "manual" ? value : "all";
}

function readIssueFilter(value: string | null): IssueFilter {
  return value === "with" || value === "without" ? value : "all";
}

function readSortOption(value: string | null): SortOption {
  return value && value in SORT_LABELS ? (value as SortOption) : "updated_desc";
}

function isInvalidParameter(
  rawValue: string | null,
  normalizedValue: string,
  fallback: string,
) {
  return Boolean(rawValue) && rawValue !== fallback && normalizedValue === fallback;
}

function formatTimestamp(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isSafeDocumentId(value: string) {
  return (
    Boolean(value) &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    new TextEncoder().encode(value).length <= 1_500
  );
}

function isCurrency(value: unknown): value is Currency {
  return value === "GBP" || value === "EUR" || value === "USD";
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readFailureMessage(error: unknown, resource: string) {
  const code = isRecord(error) ? readString(error.code) : "";
  return code === "permission-denied"
    ? `You do not have permission to read ${resource}.`
    : `The ${resource} query failed.`;
}
