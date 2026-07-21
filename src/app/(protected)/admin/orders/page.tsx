"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import type {
  AdminOrder,
  Currency,
  FirestoreTimestampValue,
  OrderStatus,
} from "../admin-types";
import {
  classNames,
  formatDateTime,
  normalizeTimestamp,
} from "../admin-utils";

function isCurrency(value: unknown): value is Currency {
  return value === "GBP" || value === "EUR" || value === "USD";
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "created" ||
    value === "invoice_sent" ||
    value === "paid" ||
    value === "purchased" ||
    value === "quality_check" ||
    value === "dispatched" ||
    value === "delivered" ||
    value === "closed" ||
    value === "cancelled"
  );
}

export default function AdminOrdersPage() {
  const [clientsCount, setClientsCount] = useState(0);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [search, setSearch] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const clientsQuery = query(collection(db, "client_profiles"));

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        setClientsCount(snapshot.size);
      },
      (error) => {
        console.error("Failed to load client count", error);
        setClientsCount(0);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    setOrdersLoading(true);
    setError("");

    const ordersQuery = query(
      collection(db, "orders"),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const nextOrders = snapshot.docs.map((entry) => {
          const data = entry.data() as {
            approvedOptionId?: string;
            clientId?: string;
            clientEmail?: string;
            clientName?: string;
            clientPhone?: string;
            requestId?: string;
            title?: string;
            brand?: string;
            item?: string;
            size?: string;
            colour?: string;
            status?: unknown;
            salePrice?: number;
            costPrice?: number;
            currency?: unknown;
            invoiceNumber?: string;
            invoiceUrl?: string;
            paymentMethod?: string;
            supplier?: string;
            courier?: string;
            trackingNumber?: string;
            trackingUrl?: string;
            notes?: string;
            createdAt?: FirestoreTimestampValue;
            updatedAt?: FirestoreTimestampValue;
          };

          return {
            id: entry.id,
            approvedOptionId: data.approvedOptionId ?? "",
            clientId: data.clientId ?? "",
            clientEmail: data.clientEmail ?? "",
            clientName: data.clientName ?? "",
            clientPhone: data.clientPhone ?? "",
            requestId: data.requestId ?? "",
            title: data.title ?? "Untitled order",
            brand: data.brand ?? "",
            item: data.item ?? "",
            size: data.size ?? "",
            colour: data.colour ?? "",
            status: isOrderStatus(data.status) ? data.status : "created",
            salePrice: Number(data.salePrice ?? 0),
            costPrice: Number(data.costPrice ?? 0),
            currency: isCurrency(data.currency) ? data.currency : "GBP",
            invoiceNumber: data.invoiceNumber ?? "",
            invoiceUrl: data.invoiceUrl ?? "",
            paymentMethod: data.paymentMethod ?? "",
            supplier: data.supplier ?? "",
            courier: data.courier ?? "",
            trackingNumber: data.trackingNumber ?? "",
            trackingUrl: data.trackingUrl ?? "",
            notes: data.notes ?? "",
            createdAt: normalizeTimestamp(data.createdAt),
            updatedAt: normalizeTimestamp(data.updatedAt),
          } satisfies AdminOrder;
        });

        setOrders(nextOrders);
        setOrdersLoading(false);
      },
      (error) => {
        console.error("Failed to load orders", error);
        setOrders([]);
        setOrdersLoading(false);
        setError("Could not load orders from Firestore.");
      },
    );

    return unsubscribe;
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return orders;

    return orders.filter((order) =>
      [
        order.title,
        order.clientEmail,
        order.clientName,
        order.clientPhone,
        order.clientId,
        order.brand,
        order.item,
        order.status,
        order.invoiceNumber,
        order.trackingNumber,
        order.supplier,
        order.courier,
      ].some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [orders, search]);

  return (
    <AdminShell
      active="orders"
      metrics={{
        clients: clientsCount,
        requests: 0,
        threads: 0,
        needsInfo: 0,
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              Order management
            </p>

            <h1 className="mt-3 font-serif text-4xl text-[#241E1A]">
              Orders
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">
              Manage client orders, invoice progress, payment, purchase, dispatch
              and delivery.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] px-6 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
                Total orders
              </p>

              <p className="mt-2 text-3xl font-semibold text-[#241E1A]">
                {orders.length}
              </p>
            </div>

            <Link
              href="/admin/create"
              className="rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3A2F28]"
            >
              + Create order
            </Link>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[#E2B8AA] bg-[#FFF2EF] p-4 text-sm text-[#8B3D2D]">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search orders, client, brand, status..."
            className="w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-[#241E1A] outline-none placeholder:text-black/35 focus:border-[#B59674]"
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#DED2C5] bg-white">
          <div className="grid grid-cols-[1.3fr_1.2fr_1fr_1fr_1fr_120px] gap-4 border-b border-[#E9DED3] bg-[#FBF7F2] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
            <p>Order</p>
            <p>Client</p>
            <p>Status</p>
            <p>Value</p>
            <p>Updated</p>
            <p className="text-right">Open</p>
          </div>

          {ordersLoading ? (
            <EmptyState
              title="Loading orders"
              body="Reading orders from Firestore."
            />
          ) : null}

          {!ordersLoading && filteredOrders.length === 0 ? (
            <EmptyState
              title="No orders found"
              body="No orders matched your search."
            />
          ) : null}

          {!ordersLoading && filteredOrders.length > 0 ? (
            <div className="divide-y divide-[#EFE4DA]">
              {filteredOrders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}

function OrderRow({ order }: { order: AdminOrder }) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="grid grid-cols-[1.3fr_1.2fr_1fr_1fr_1fr_120px] gap-4 px-5 py-4 text-sm transition hover:bg-[#FFF9F1]"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-[#241E1A]">
          {order.title || "Untitled order"}
        </p>

        <p className="mt-1 truncate text-xs text-black/45">
          {[order.brand, order.item, order.size, order.colour]
            .filter(Boolean)
            .join(" · ") || order.id}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-black/60">
          {order.clientName || order.clientEmail || "Unknown client"}
        </p>

        <p className="mt-1 truncate text-xs text-black/40">
          {order.clientId || "No client ID"}
        </p>
      </div>

      <div>
        <span
          className={classNames(
            "inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            orderStatusTone(order.status),
          )}
        >
          {formatStatusLabel(order.status)}
        </span>
      </div>

      <div>
        <p className="text-black/65">
          {formatMoney(order.salePrice, order.currency)}
        </p>

        <p className="mt-1 text-xs text-black/40">
          Cost {formatMoney(order.costPrice, order.currency)}
        </p>
      </div>

      <p className="truncate text-black/60">
        {formatDateTime(order.updatedAt)}
      </p>

      <div className="text-right">
        <span className="rounded-full border border-[#DED2C5] px-3 py-1 text-xs text-black/55">
          View
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center bg-[#FFFDFC] text-center">
      <div className="max-w-md px-8 py-8">
        <h2 className="font-serif text-3xl leading-tight text-[#241E1A]">
          {title}
        </h2>

        <p className="mt-4 text-sm leading-7 text-black/55">
          {body}
        </p>
      </div>
    </div>
  );
}

function orderStatusTone(status: OrderStatus) {
  switch (status) {
    case "created":
      return "bg-[#DCEAF7] text-[#275073]";
    case "invoice_sent":
      return "bg-[#F5E6C8] text-[#76561E]";
    case "paid":
    case "purchased":
    case "quality_check":
      return "bg-[#EAE1F8] text-[#574276]";
    case "dispatched":
    case "delivered":
      return "bg-[#DDECDD] text-[#2F5A34]";
    case "closed":
      return "bg-[#ECE7E1] text-[#65584E]";
    case "cancelled":
      return "bg-[#F6D9D3] text-[#8B3D2D]";
    default:
      return "bg-[#ECE7E1] text-[#65584E]";
  }
}

function formatStatusLabel(value: string) {
  return value.replace(/[_-]/g, " ");
}

function formatMoney(amount?: number, currency: Currency = "GBP") {
  if (typeof amount !== "number") return "Not set";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}
