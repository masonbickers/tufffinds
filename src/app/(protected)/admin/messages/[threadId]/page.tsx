"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  AdminThread,
  FirestoreTimestampValue,
  ThreadDetail,
} from "../../admin-types";
import { formatDateTime, normalizeTimestamp } from "../../admin-utils";

type PageProps = {
  params: Promise<{
    threadId: string;
  }>;
};

export default function AdminMessageThreadPage({ params }: PageProps) {
  const { threadId } = use(params);

  const [thread, setThread] = useState<AdminThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    const unsubscribe = onSnapshot(
      doc(db, "message_threads", threadId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setThread(null);
          setIsLoading(false);
          setError("Message thread not found.");
          return;
        }

        const data = snapshot.data() as {
          clientId?: string;
          detail?: ThreadDetail;
          lastMessagePreview?: string;
          updatedAt?: FirestoreTimestampValue;
        };

        setThread({
          id: snapshot.id,
          clientId: data.clientId ?? "",
          detail: data.detail ?? getFallbackThreadDetail(snapshot.id),
          lastMessagePreview: data.lastMessagePreview ?? "",
          updatedAt: normalizeTimestamp(data.updatedAt),
        });

        setIsLoading(false);
      },
      (error) => {
        console.error("Failed to load message thread", error);
        setThread(null);
        setIsLoading(false);
        setError("Could not load this message thread from Firestore.");
      },
    );

    return unsubscribe;
  }, [threadId]);

  return (
    <AdminShell active="messages">
      <div className="space-y-6">
        <Link
          href="/admin/messages"
          className="inline-flex rounded-full border border-black/10 bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]"
        >
          ← Back to messages
        </Link>

        {isLoading ? (
          <EmptyState
            title="Loading thread"
            body="Reading this message thread from Firestore."
          />
        ) : null}

        {!isLoading && error ? (
          <EmptyState title="Message issue" body={error} />
        ) : null}

        {!isLoading && thread ? (
          <>
            <section className="rounded-[28px] border border-black/8 bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                Message thread
              </p>

              <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <h1 className="font-serif text-4xl">
                    {thread.detail.title || "Conversation"}
                  </h1>

                  <p className="mt-3 text-sm text-black/55">
                    {thread.detail.participantName ||
                      thread.clientId ||
                      "Unknown client"}
                  </p>
                </div>

                <div className="grid min-w-[300px] grid-cols-2 gap-3">
                  <InfoCard label="Thread ID" value={thread.id} />
                  <InfoCard label="Updated" value={formatDateTime(thread.updatedAt)} />
                  <InfoCard label="Client UID" value={thread.clientId || "Not set"} />
                  <InfoCard
                    label="Messages"
                    value={String(thread.detail.messages.length)}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-[24px] border border-black/8 bg-[#FBF7F2] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
                  Linked records
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {thread.detail.lifecycleLinks.length ? (
                    thread.detail.lifecycleLinks.map((link) => {
                      const id = link.href.split("/").pop() ?? "";

                      return (
                        <Link
                          key={`${link.type}-${link.href}`}
                          href={
                            link.type === "request"
                              ? `/admin/requests/${id}`
                              : link.href
                          }
                          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black/68 hover:bg-[#221C18] hover:text-white"
                        >
                          {link.type}: {link.label}
                        </Link>
                      );
                    })
                  ) : (
                    <p className="text-sm text-black/45">No linked records.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-black/8 bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                Conversation
              </p>

              <div className="mt-6 space-y-4">
                {thread.detail.messages.length ? (
                  thread.detail.messages.map((message) => (
                    <div
                      key={message.id}
                      className={[
                        "rounded-[24px] p-5",
                        message.type === "client" &&
                          "border border-black/8 bg-[#FFFDFC]",
                        message.type === "stylist" &&
                          "bg-[#221C18] text-white",
                        message.type === "system" &&
                          "border border-[#E6D8C8] bg-[#F3ECE4]",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] opacity-70">
                          {message.type}
                        </p>

                        <p className="text-xs opacity-70">
                          {message.timestampLabel}
                        </p>
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
                        {message.body}
                      </p>

                      {message.meta ? (
                        <p className="mt-3 text-xs opacity-70">
                          {message.meta}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-black/45">
                    No messages in this thread.
                  </p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#F7F1EA] p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-black/40">
        {label}
      </p>

      <p className="mt-3 break-words text-sm leading-6 text-black/68">
        {value}
      </p>
    </div>
  );
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
