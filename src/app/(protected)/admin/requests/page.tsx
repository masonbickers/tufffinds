"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import type {
  AdminRequest,
  FirestoreTimestampValue,
  RequestDetail,
  RequestStatus,
} from "../admin-types";
import {
  classNames,
  formatDateTime,
  formatStatusLabel,
  normalizeTimestamp,
  requestTone,
} from "../admin-utils";

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const requestsQuery = query(
      collection(db, "requests"),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const nextRequests = snapshot.docs.map((entry) => {
          const data = entry.data() as {
            clientEmail?: string;
            clientId?: string;
            createdAt?: FirestoreTimestampValue;
            detail?: RequestDetail;
            status?: RequestStatus;
            updatedAt?: FirestoreTimestampValue;
          };

          const status = data.status ?? data.detail?.status ?? "submitted";

          return {
            id: entry.id,
            clientId: data.clientId ?? "",
            clientEmail: data.clientEmail ?? "",
            createdAt: normalizeTimestamp(data.createdAt),
            updatedAt: normalizeTimestamp(data.updatedAt),
            status,
            detail: data.detail ?? getFallbackRequestDetail(entry.id, status),
          } satisfies AdminRequest;
        });

        setRequests(nextRequests);
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load requests", error);
        setRequests([]);
        setIsLoading(false);
        setError("Could not load requests from Firestore.");
      },
    );

    return unsubscribe;
  }, []);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return requests;

    return requests.filter((request) =>
      [
        request.id,
        request.clientId,
        request.clientEmail,
        request.status,
        request.detail.title,
        request.detail.requestType,
        request.detail.shippingCountry,
        request.detail.urgency,
      ].some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [requests, search]);

  const metrics = useMemo(
    () => ({
      clients: 0,
      requests: requests.length,
      threads: 0,
      needsInfo: requests.filter((request) => request.status === "needs_info").length,
    }),
    [requests],
  );

  return (
    <AdminShell active="requests" metrics={metrics}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              Request queue
            </p>

            <h1 className="mt-3 font-serif text-4xl text-[#241E1A]">
              Requests
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">
              Manage every client request from receipt through sourcing, invoice,
              payment, dispatch and delivery.
            </p>
          </div>

          <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] px-6 py-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
              Total requests
            </p>

            <p className="mt-2 text-3xl font-semibold text-[#241E1A]">
              {requests.length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] p-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search request, client, status, type..."
            className="w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-[#241E1A] outline-none placeholder:text-black/35 focus:border-[#B59674]"
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#DED2C5] bg-white">
          <div className="grid grid-cols-[1.3fr_1.2fr_1fr_1fr_1fr_120px] gap-4 border-b border-[#E9DED3] bg-[#FBF7F2] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
            <p>Request</p>
            <p>Client</p>
            <p>Status</p>
            <p>Type</p>
            <p>Updated</p>
            <p className="text-right">Open</p>
          </div>

          {isLoading ? (
            <EmptyState
              title="Loading requests"
              body="Reading request documents from Firestore."
            />
          ) : null}

          {!isLoading && error ? (
            <EmptyState title="Could not load requests" body={error} />
          ) : null}

          {!isLoading && !error && filteredRequests.length === 0 ? (
            <EmptyState
              title="No requests found"
              body="No request documents matched your search."
            />
          ) : null}

          {!isLoading && !error && filteredRequests.length > 0 ? (
            <div className="divide-y divide-[#EFE4DA]">
              {filteredRequests.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}

function RequestRow({ request }: { request: AdminRequest }) {
  return (
    <Link
      href={`/admin/requests/${request.id}`}
      className="grid grid-cols-[1.3fr_1.2fr_1fr_1fr_1fr_120px] gap-4 px-5 py-4 text-sm transition hover:bg-[#FFF9F1]"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-medium text-[#241E1A]">
            {request.detail.title || "Untitled request"}
          </p>

          {request.detail.urgency ? (
            <span className="shrink-0 rounded-full bg-[#F7F1EA] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-black/45">
              {request.detail.urgency}
            </span>
          ) : null}
        </div>

        <p className="mt-1 truncate text-xs text-black/45">
          {request.detail.notes ||
            request.detail.styleNotes ||
            request.id}
        </p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-black/60">
          {request.clientEmail || "No email"}
        </p>

        <p className="mt-1 truncate text-xs text-black/40">
          {request.clientId || "No client ID"}
        </p>
      </div>

      <div>
        <span
          className={classNames(
            "inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            requestTone(request.status),
          )}
        >
          {formatStatusLabel(request.status)}
        </span>
      </div>

      <p className="truncate text-black/60">
        {request.detail.requestType || "Not set"}
      </p>

      <p className="truncate text-black/60">
        {formatDateTime(request.updatedAt)}
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

function getFallbackRequestDetail(
  id: string,
  status: RequestStatus = "submitted",
): RequestDetail {
  return {
    activitySummary: [],
    categories: [],
    createdDateLabel: "",
    dislikedBrands: [],
    favoriteBrands: [],
    href: `/requests/${id}`,
    id,
    linkedEdits: [],
    linkedMessagesPreview: [],
    notes: "",
    purchaseMode: "",
    references: [],
    requestType: "",
    shippingCountry: "",
    status,
    statusTimeline: [],
    styleNotes: "",
    title: "Untitled request",
    urgency: "",
    whatHappensNext: "",
  };
}
