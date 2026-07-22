"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import type { AdminThread, MessageWorkflowState } from "../admin-types";
import { formatDateTime, formatStatusLabel } from "../admin-utils";
import { parseAdminThread } from "../message-utils";

type ThreadFilter = MessageWorkflowState | "all";

export default function AdminMessagesPage() {
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ThreadFilter>("needs_reply");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const threadsQuery = query(
      collection(db, "message_threads"),
      orderBy("updatedAt", "desc"),
    );

    return onSnapshot(
      threadsQuery,
      (snapshot) => {
        setThreads(
          snapshot.docs.map((entry) =>
            parseAdminThread(entry.id, entry.data()),
          ),
        );
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load message threads", snapshotError);
        setThreads([]);
        setIsLoading(false);
        setError("Could not load message threads from Firestore.");
      },
    );
  }, []);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();

    return threads.filter((thread) => {
      const matchesFilter = filter === "all" || thread.workflow.state === filter;
      const latestMessage = thread.detail.messages[thread.detail.messages.length - 1];
      const matchesSearch =
        !term ||
        [
          thread.detail.title,
          thread.detail.participantName,
          thread.lastMessagePreview,
          latestMessage?.body,
          latestMessage?.senderName,
          thread.workflow.state,
          ...thread.detail.lifecycleLinks.map((link) => link.label),
        ].some((value) => String(value ?? "").toLowerCase().includes(term));

      return matchesFilter && matchesSearch;
    });
  }, [filter, search, threads]);

  const counts = {
    needsReply: threads.filter((thread) => thread.workflow.state === "needs_reply")
      .length,
    waiting: threads.filter(
      (thread) => thread.workflow.state === "waiting_on_client",
    ).length,
    resolved: threads.filter((thread) => thread.workflow.state === "resolved").length,
    actionable: threads.filter((thread) => thread.isActionable).length,
  };

  return (
    <AdminShell
      active="messages"
      metrics={{
        clients: 0,
        requests: 0,
        threads: counts.actionable,
        needsInfo: 0,
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              Client communication
            </p>
            <h1 className="mt-3 font-serif text-4xl">Messages</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-black/60">
              Review client conversations, reply, record private notes and manage
              operational follow-up.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Needs reply" value={counts.needsReply} />
            <SummaryCard label="Waiting" value={counts.waiting} />
            <SummaryCard label="Resolved" value={counts.resolved} />
            <SummaryCard label="Actionable" value={counts.actionable} />
          </div>
        </div>

        <div className="grid gap-3 rounded-[24px] border border-black/8 bg-[#FBF7F2] p-5 md:grid-cols-[1fr_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subject, client, request or message..."
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as ThreadFilter)}
            aria-label="Filter message threads"
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="needs_reply">Needs reply</option>
            <option value="waiting_on_client">Waiting on client</option>
            <option value="resolved">Resolved</option>
            <option value="all">All threads</option>
          </select>
        </div>

        <p className="text-xs leading-5 text-black/45">
          “Actionable” matches the dashboard definition: the latest stored message
          is from a client. This is an operational signal, not genuine per-user
          unread tracking.
        </p>

        {isLoading ? (
          <EmptyState title="Loading messages" body="Reading message threads from Firestore." />
        ) : null}
        {!isLoading && error ? (
          <EmptyState title="Could not load messages" body={error} />
        ) : null}
        {!isLoading && !error && filteredThreads.length === 0 ? (
          <EmptyState
            title="No messages found"
            body="No message threads matched the selected workflow filter and search."
          />
        ) : null}
        {!isLoading && !error && filteredThreads.length > 0 ? (
          <div className="grid gap-4">
            {filteredThreads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

function ThreadRow({ thread }: { thread: AdminThread }) {
  const lastMessage = thread.detail.messages[thread.detail.messages.length - 1];
  const requestLabel =
    thread.detail.lifecycleLinks.find((link) => link.type === "request")?.label ||
    (thread.requestId ? "Linked request" : "No linked request");

  return (
    <Link
      href={`/admin/messages/${thread.id}`}
      className="block rounded-[26px] border border-black/8 bg-white p-5 transition hover:border-[#B59674] hover:bg-[#FFF9F1]"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(190px,0.55fr)_minmax(250px,0.75fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl">
              {thread.detail.title || "Conversation"}
            </h2>
            <WorkflowBadge state={thread.workflow.state} />
            {thread.isActionable ? <ActionableBadge /> : null}
          </div>
          <p className="mt-2 text-sm text-black/55">
            {thread.detail.participantName || "Unknown client"}
          </p>
          <p className="mt-4 line-clamp-3 text-sm leading-7 text-black/62">
            {thread.lastMessagePreview || lastMessage?.body || "No messages yet."}
          </p>
        </div>

        <div className="space-y-3 text-sm text-black/60">
          <Meta label="Linked request" value={requestLabel} />
          <Meta
            label="Latest sender"
            value={lastMessage ? messageSenderLabel(lastMessage.type) : "No messages"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniInfo label="Messages" value={String(thread.detail.messages.length)} />
          <MiniInfo label="Updated" value={formatDateTime(thread.updatedAt)} />
        </div>
      </div>
    </Link>
  );
}

function WorkflowBadge({ state }: { state: MessageWorkflowState }) {
  const style =
    state === "needs_reply"
      ? "bg-[#F5E6C8] text-[#76561E]"
      : state === "waiting_on_client"
        ? "bg-[#DCEAF7] text-[#275073]"
        : "bg-[#DDECDD] text-[#2F5A34]";

  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${style}`}>
      {formatStatusLabel(state)}
    </span>
  );
}

function ActionableBadge() {
  return (
    <span className="rounded-full border border-[#B59674] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#76561E]">
      Actionable
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-black/8 bg-[#FBF7F2] px-4 py-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-black/40">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-black/40">{label}</p>
      <p className="mt-1 truncate">{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#F7F1EA] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-black/40">{label}</p>
      <p className="mt-1 break-words text-sm text-black/70">{value}</p>
    </div>
  );
}

function messageSenderLabel(type: "client" | "stylist" | "system") {
  if (type === "client") return "Client";
  if (type === "stylist") return "Tufffinds admin";
  return "System";
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-[#FBF7F2] text-center">
      <div className="max-w-md px-8 py-8">
        <h2 className="font-serif text-3xl leading-tight">{title}</h2>
        <p className="mt-4 text-sm leading-7 text-black/55">{body}</p>
      </div>
    </div>
  );
}
