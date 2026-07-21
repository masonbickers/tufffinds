"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";
import type {
  AdminThread,
  FirestoreTimestampValue,
  ThreadDetail,
} from "../admin-types";
import { formatDateTime, normalizeTimestamp } from "../admin-utils";

export default function AdminMessagesPage() {
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const threadsQuery = query(
      collection(db, "message_threads"),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      threadsQuery,
      (snapshot) => {
        const nextThreads = snapshot.docs.map((entry) => {
          const data = entry.data() as {
            clientId?: string;
            detail?: ThreadDetail;
            lastMessagePreview?: string;
            updatedAt?: FirestoreTimestampValue;
          };

          return {
            id: entry.id,
            clientId: data.clientId ?? "",
            detail: data.detail ?? getFallbackThreadDetail(entry.id),
            lastMessagePreview: data.lastMessagePreview ?? "",
            updatedAt: normalizeTimestamp(data.updatedAt),
          } satisfies AdminThread;
        });

        setThreads(nextThreads);
        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load message threads", error);
        setThreads([]);
        setIsLoading(false);
        setError("Could not load message threads from Firestore.");
      },
    );

    return unsubscribe;
  }, []);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return threads;

    return threads.filter((thread) =>
      [
        thread.id,
        thread.clientId,
        thread.detail.title,
        thread.detail.participantName,
        thread.lastMessagePreview,
        ...thread.detail.lifecycleLinks.map((link) => link.label),
      ].some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [threads, search]);

  return (
    <AdminShell
      active="messages"
      metrics={{
        clients: 0,
        requests: 0,
        threads: threads.length,
        needsInfo: 0,
      }}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
              Client communication
            </p>

            <h1 className="mt-3 font-serif text-4xl">
              Messages
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-black/60">
              Review request-linked client conversations and message history.
            </p>
          </div>

          <div className="rounded-[24px] border border-black/8 bg-[#FBF7F2] p-4">
            <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
              Total threads
            </p>
            <p className="mt-2 text-3xl font-semibold">{threads.length}</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-black/8 bg-[#FBF7F2] p-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search thread, client, message..."
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none"
          />
        </div>

        {isLoading ? (
          <EmptyState
            title="Loading messages"
            body="Reading message threads from Firestore."
          />
        ) : null}

        {!isLoading && error ? (
          <EmptyState title="Could not load messages" body={error} />
        ) : null}

        {!isLoading && !error && filteredThreads.length === 0 ? (
          <EmptyState
            title="No messages found"
            body="No message threads matched your search."
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

  return (
    <Link
      href={`/admin/messages/${thread.id}`}
      className="block rounded-[26px] border border-black/8 bg-white p-5 transition hover:border-[#B59674] hover:bg-[#FFF9F1]"
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 className="font-serif text-2xl">
            {thread.detail.title || "Conversation"}
          </h2>

          <p className="mt-2 text-sm text-black/55">
            {thread.detail.participantName || thread.clientId || "Unknown client"}
          </p>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-black/62">
            {thread.lastMessagePreview ||
              lastMessage?.body ||
              "No messages yet."}
          </p>
        </div>

        <div className="grid min-w-[260px] grid-cols-2 gap-3">
          <MiniInfo label="Messages" value={String(thread.detail.messages.length)} />
          <MiniInfo label="Updated" value={formatDateTime(thread.updatedAt)} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {thread.detail.lifecycleLinks.length ? (
          thread.detail.lifecycleLinks.map((link) => (
            <span
              key={`${link.type}-${link.href}`}
              className="rounded-full bg-[#F7F1EA] px-3 py-1.5 text-xs text-black/60"
            >
              {link.type}: {link.label}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[#F7F1EA] px-3 py-1.5 text-xs text-black/45">
            No linked request
          </span>
        )}
      </div>
    </Link>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#F7F1EA] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-black/40">
        {label}
      </p>

      <p className="mt-1 break-words text-sm text-black/70">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-[#FBF7F2] text-center">
      <div className="max-w-md px-8 py-8">
        <h2 className="font-serif text-3xl leading-tight">
          {title}
        </h2>

        <p className="mt-4 text-sm leading-7 text-black/55">
          {body}
        </p>
      </div>
    </div>
  );
}

function getFallbackThreadDetail(id: string): ThreadDetail {
  return {
    composerPlaceholder: "Send a message",
    id,
    lifecycleLinks: [],
    messages: [],
    participantName: "",
    title: "Conversation",
  };
}
