"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  AdminOrder,
  Currency,
  FirestoreTimestampValue,
  OrderStatus,
} from "../../admin-types";
import {
  classNames,
  formatDateTime,
  formatStatusLabel,
  normalizeTimestamp,
} from "../../admin-utils";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export default function OrderDetailPage({ params }: PageProps) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    return onSnapshot(
      doc(db, "orders", orderId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setOrder(null);
          setError("Order not found.");
          setIsLoading(false);
          return;
        }

        const data = snapshot.data() as {
          approvedOptionId?: string;
          brand?: string;
          clientEmail?: string;
          clientId?: string;
          clientName?: string;
          clientPhone?: string;
          colour?: string;
          costPrice?: number;
          courier?: string;
          createdAt?: FirestoreTimestampValue;
          currency?: unknown;
          invoiceNumber?: string;
          invoiceUrl?: string;
          item?: string;
          notes?: string;
          paymentMethod?: string;
          requestId?: string;
          salePrice?: number;
          size?: string;
          status?: unknown;
          supplier?: string;
          title?: string;
          trackingNumber?: string;
          trackingUrl?: string;
          updatedAt?: FirestoreTimestampValue;
        };

        setOrder({
          id: snapshot.id,
          approvedOptionId: data.approvedOptionId ?? "",
          brand: data.brand ?? "",
          clientEmail: data.clientEmail ?? "",
          clientId: data.clientId ?? "",
          clientName: data.clientName ?? "",
          clientPhone: data.clientPhone ?? "",
          colour: data.colour ?? "",
          costPrice: Number(data.costPrice ?? 0),
          courier: data.courier ?? "",
          createdAt: normalizeTimestamp(data.createdAt),
          currency: isCurrency(data.currency) ? data.currency : "GBP",
          invoiceNumber: data.invoiceNumber ?? "",
          invoiceUrl: data.invoiceUrl ?? "",
          item: data.item ?? "",
          notes: data.notes ?? "",
          paymentMethod: data.paymentMethod ?? "",
          requestId: data.requestId ?? "",
          salePrice: Number(data.salePrice ?? 0),
          size: data.size ?? "",
          status: isOrderStatus(data.status) ? data.status : "created",
          supplier: data.supplier ?? "",
          title: data.title ?? "Untitled order",
          trackingNumber: data.trackingNumber ?? "",
          trackingUrl: data.trackingUrl ?? "",
          updatedAt: normalizeTimestamp(data.updatedAt),
        });
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load order", snapshotError);
        setOrder(null);
        setError("Could not load this order from Firestore.");
        setIsLoading(false);
      },
    );
  }, [orderId]);

  return (
    <AdminShell active="orders">
      <div className="space-y-6">
        <Link
          href="/admin/orders"
          className="inline-flex rounded-xl border border-[#DED2C5] bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]"
        >
          ← Back to orders
        </Link>

        {isLoading ? (
          <EmptyState title="Loading order" body="Reading this order from Firestore." />
        ) : null}
        {!isLoading && error ? <EmptyState title="Order issue" body={error} /> : null}

        {!isLoading && order ? (
          <>
            <section className="rounded-2xl border border-[#DED2C5] bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                Order record
              </p>
              <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-serif text-4xl text-[#241E1A]">
                      {order.title}
                    </h1>
                    <span className={classNames("rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", orderTone(order.status))}>
                      {formatStatusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-black/55">
                    {order.clientName || order.clientEmail || "Unknown client"}
                  </p>
                </div>
                <div className="grid min-w-[320px] grid-cols-2 gap-3">
                  <InfoCard label="Created" value={formatDateTime(order.createdAt)} />
                  <InfoCard label="Updated" value={formatDateTime(order.updatedAt)} />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {order.requestId ? <Link href={`/admin/requests/${order.requestId}`} className="rounded-xl border border-[#DED2C5] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">Open source request</Link> : null}
                {order.clientId ? <Link href={`/admin/clients/${order.clientId}`} className="rounded-xl border border-[#DED2C5] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">Open client profile</Link> : null}
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <DetailPanel title="Approved item" eyebrow="Order item">
                <InfoRow label="Brand" value={order.brand || "Not set"} />
                <InfoRow label="Item" value={order.item || "Not set"} />
                <InfoRow label="Size" value={order.size || "Not set"} />
                <InfoRow label="Colour" value={order.colour || "Not set"} />
                <InfoRow label="Supplier" value={order.supplier || "Not set"} />
                <InfoRow label="Sale price" value={formatMoney(order.salePrice, order.currency)} />
                <InfoRow label="Cost price" value={formatMoney(order.costPrice, order.currency)} />
              </DetailPanel>

              <DetailPanel title="Client identity" eyebrow="Customer">
                <InfoRow label="Name" value={order.clientName || "Not set"} />
                <InfoRow label="Email" value={order.clientEmail || "Not set"} />
                <InfoRow label="Phone" value={order.clientPhone || "Not set"} />
                <InfoRow label="Client ID" value={order.clientId || "Not linked"} />
                <InfoRow label="Request ID" value={order.requestId || "Not linked"} />
              </DetailPanel>

              <DetailPanel title="Invoice and payment" eyebrow="Commercial">
                <InfoRow label="Invoice number" value={order.invoiceNumber || "Not set"} />
                <InfoRow label="Payment method" value={order.paymentMethod || "Not set"} />
                <InfoRow label="Invoice URL" value={order.invoiceUrl || "Not set"} />
              </DetailPanel>

              <DetailPanel title="Fulfilment" eyebrow="Delivery">
                <InfoRow label="Courier" value={order.courier || "Not set"} />
                <InfoRow label="Tracking number" value={order.trackingNumber || "Not set"} />
                <InfoRow label="Tracking URL" value={order.trackingUrl || "Not set"} />
                <InfoRow label="Internal notes" value={order.notes || "None"} />
              </DetailPanel>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function isCurrency(value: unknown): value is Currency {
  return value === "GBP" || value === "EUR" || value === "USD";
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return ["created", "invoice_sent", "paid", "purchased", "quality_check", "dispatched", "delivered", "closed", "cancelled"].includes(String(value));
}

function orderTone(status: OrderStatus) {
  if (status === "cancelled") return "bg-[#F6D9D3] text-[#8B3D2D]";
  if (["dispatched", "delivered"].includes(status)) return "bg-[#DDECDD] text-[#2F5A34]";
  if (["paid", "purchased", "quality_check"].includes(status)) return "bg-[#EAE1F8] text-[#574276]";
  if (status === "invoice_sent") return "bg-[#F5E6C8] text-[#76561E]";
  return "bg-[#ECE7E1] text-[#65584E]";
}

function DetailPanel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#DED2C5] bg-white p-5"><p className="text-[10px] uppercase tracking-[0.24em] text-black/40">{eyebrow}</p><h2 className="mt-2 font-serif text-2xl text-[#241E1A]">{title}</h2><div className="mt-5 overflow-hidden rounded-xl border border-[#EFE4DA]">{children}</div></section>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#FBF7F2] p-3"><p className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</p><p className="mt-2 text-sm text-black/65">{value}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[150px_minmax(0,1fr)] border-b border-[#EFE4DA] last:border-b-0"><div className="bg-[#FBF7F2] px-4 py-3"><p className="text-[10px] uppercase tracking-[0.18em] text-black/40">{label}</p></div><p className="break-words px-4 py-3 text-sm text-black/65">{value}</p></div>;
}

function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#DED2C5] bg-[#FBF7F2] text-center"><div className="max-w-md px-8 py-8"><h2 className="font-serif text-3xl text-[#241E1A]">{title}</h2><p className="mt-4 text-sm leading-7 text-black/55">{body}</p></div></div>;
}
