"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  AdminThread,
  MessageEntry,
  MessageWorkflowState,
} from "../../admin-types";
import { formatDateTime, formatStatusLabel } from "../../admin-utils";
import {
  getLatestClientMessageId,
  getLifecycleRequestIds,
  normalizeMessages,
  parseAdminThread,
} from "../../message-utils";

type PageProps = {
  params: Promise<{ threadId: string }>;
};

type ClientContext = {
  email: string;
  exists: boolean;
  name: string;
};

type RequestContext = {
  clientEmail: string;
  clientId: string;
  exists: boolean;
  title: string;
};

export default function AdminMessageThreadPage({ params }: PageProps) {
  const { threadId } = use(params);
  const [thread, setThread] = useState<AdminThread | null>(null);
  const [reply, setReply] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [clientContext, setClientContext] = useState<ClientContext | null>(null);
  const [requestContext, setRequestContext] = useState<RequestContext | null>(null);
  const [contextWarnings, setContextWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const autoSyncInFlight = useRef(false);
  const notesDirty = useRef(false);

  useEffect(() => {
    setIsLoading(true);
    setError("");

    return onSnapshot(
      doc(db, "message_threads", threadId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setThread(null);
          setIsLoading(false);
          setError("Message thread not found.");
          return;
        }

        const nextThread = parseAdminThread(snapshot.id, snapshot.data());
        setThread(nextThread);
        if (!notesDirty.current) setAdminNotes(nextThread.adminNotes);
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load message thread", snapshotError);
        setThread(null);
        setIsLoading(false);
        setError("Could not load this message thread from Firestore.");
      },
    );
  }, [threadId]);

  useEffect(() => {
    if (!thread) return;
    const currentThread = thread;
    let cancelled = false;

    async function loadContext() {
      setContextLoading(true);
      setContextError("");
      const clientPromise = currentThread.clientId
        ? getDoc(doc(db, "client_profiles", currentThread.clientId))
        : Promise.resolve(null);
      const requestPromise = currentThread.requestId
        ? getDoc(doc(db, "requests", currentThread.requestId))
        : Promise.resolve(null);
      const [clientResult, requestResult] = await Promise.allSettled([
        clientPromise,
        requestPromise,
      ]);

      if (cancelled) return;
      const warnings = getLinkWarnings(currentThread);
      let nextClient: ClientContext | null = null;
      let nextRequest: RequestContext | null = null;
      const failures: string[] = [];

      if (clientResult.status === "fulfilled" && clientResult.value) {
        const snapshot = clientResult.value;
        const data = snapshot.data() as
          | { email?: unknown; fullName?: unknown; profile?: unknown }
          | undefined;
        const profile = record(data?.profile);
        nextClient = {
          exists: snapshot.exists(),
          email: text(data?.email),
          name: text(data?.fullName) || text(profile.fullName),
        };
      } else if (clientResult.status === "rejected") {
        console.error("Failed to load linked client", clientResult.reason);
        failures.push("client");
      }

      if (requestResult.status === "fulfilled" && requestResult.value) {
        const snapshot = requestResult.value;
        const data = snapshot.data() as
          | { clientEmail?: unknown; clientId?: unknown; detail?: unknown }
          | undefined;
        const detail = record(data?.detail);
        nextRequest = {
          exists: snapshot.exists(),
          clientEmail: text(data?.clientEmail),
          clientId: text(data?.clientId),
          title: text(detail.title),
        };

        if (
          snapshot.exists() &&
          currentThread.clientId &&
          nextRequest.clientId &&
          nextRequest.clientId !== currentThread.clientId
        ) {
          warnings.push(
            "The linked request belongs to a different client identifier. The relationship needs manual review.",
          );
        }
      } else if (requestResult.status === "rejected") {
        console.error("Failed to load linked request", requestResult.reason);
        failures.push("request");
      }

      setClientContext(nextClient);
      setRequestContext(nextRequest);
      setContextWarnings(Array.from(new Set(warnings)));
      setContextError(
        failures.length
          ? `Could not load linked ${failures.join(" and ")} context.`
          : "",
      );
      setContextLoading(false);
    }

    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [thread]);

  useEffect(() => {
    if (!thread || autoSyncInFlight.current) return;
    const lastMessage = thread.detail.messages[thread.detail.messages.length - 1];
    const adminUid = auth.currentUser?.uid;

    const hasNewClientMessage =
      lastMessage?.type === "client" &&
      thread.workflow.lastClientMessageId !== lastMessage.id;

    if ((!hasNewClientMessage && thread.workflowIsPersisted) || !adminUid) {
      return;
    }

    autoSyncInFlight.current = true;
    const threadRef = doc(db, "message_threads", thread.id);

    void runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(threadRef);
      if (!snapshot.exists()) throw new Error("THREAD_NOT_FOUND");
      const current = parseAdminThread(snapshot.id, snapshot.data());
      const currentLastMessage =
        current.detail.messages[current.detail.messages.length - 1];
      const currentHasNewClientMessage =
        currentLastMessage?.type === "client" &&
        current.workflow.lastClientMessageId !== currentLastMessage.id;

      if (!currentHasNewClientMessage && current.workflowIsPersisted) {
        return;
      }

      transaction.update(threadRef, {
        "messageWorkflow.lastClientMessageId":
          getLatestClientMessageId(current.detail.messages),
        "messageWorkflow.state": currentHasNewClientMessage
          ? "needs_reply"
          : current.workflow.state,
        "messageWorkflow.stateUpdatedAt": serverTimestamp(),
        "messageWorkflow.stateUpdatedByUid": adminUid,
        updatedAt: serverTimestamp(),
      });
    })
      .catch((syncError) => {
        console.error("Failed to synchronize thread action state", syncError);
        setContextError(
          "The conversation loaded, but its automatic needs-reply state could not be saved.",
        );
      })
      .finally(() => {
        autoSyncInFlight.current = false;
      });
  }, [thread]);

  async function sendReply() {
    if (!thread || busyAction) return;
    const body = reply.trim();
    if (!body) {
      setError("Enter a reply before sending.");
      return;
    }
    if (body.length > 5000) {
      setError("Replies must be 5,000 characters or fewer.");
      return;
    }

    const adminUser = auth.currentUser;
    if (!adminUser?.uid) {
      setError("Your admin session is unavailable. Sign in again before replying.");
      return;
    }

    const replyId = crypto.randomUUID();
    const senderName = adminUser.displayName?.trim() || "Tufffinds admin";
    const newMessage = {
      id: replyId,
      body,
      meta: `Sent by ${senderName}`,
      senderName,
      timestampLabel: new Date().toISOString(),
      type: "stylist" as const,
    };
    const threadRef = doc(db, "message_threads", thread.id);

    setBusyAction("reply");
    setError("");
    setSuccess("");

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(threadRef);
        if (!snapshot.exists()) throw new Error("THREAD_NOT_FOUND");
        const data = snapshot.data();
        const detail = record(data.detail);
        const rawMessages = Array.isArray(detail.messages) ? detail.messages : [];
        const currentMessages = normalizeMessages(rawMessages);

        if (currentMessages.some((message) => message.id === replyId)) return;

        transaction.update(threadRef, {
          "detail.messages": [...rawMessages, newMessage],
          lastMessagePreview: body.slice(0, 240),
          "messageWorkflow.lastClientMessageId":
            getLatestClientMessageId(currentMessages),
          "messageWorkflow.lastReplyAt": serverTimestamp(),
          "messageWorkflow.lastReplyByUid": adminUser.uid,
          "messageWorkflow.state": "waiting_on_client",
          "messageWorkflow.stateUpdatedAt": serverTimestamp(),
          "messageWorkflow.stateUpdatedByUid": adminUser.uid,
          updatedAt: serverTimestamp(),
        });
      });
      setReply("");
      setSuccess("Reply saved to the conversation. No external message provider was contacted.");
    } catch (sendError) {
      console.error("Failed to send admin reply", sendError);
      setError("Could not save the reply. No successful send was confirmed.");
    } finally {
      setBusyAction("");
    }
  }

  async function changeWorkflowState(nextState: MessageWorkflowState) {
    if (
      !thread ||
      busyAction ||
      (thread.workflow.state === nextState && thread.workflowIsPersisted)
    ) return;
    if (
      nextState === "resolved" &&
      !window.confirm("Mark this conversation resolved?")
    ) {
      return;
    }

    const adminUid = auth.currentUser?.uid;
    if (!adminUid) {
      setError("Your admin session is unavailable. Sign in again before continuing.");
      return;
    }

    const expectedState = thread.workflow.state;
    const expectedLastMessageId =
      thread.detail.messages[thread.detail.messages.length - 1]?.id ?? "";
    const threadRef = doc(db, "message_threads", thread.id);

    setBusyAction("workflow");
    setError("");
    setSuccess("");

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(threadRef);
        if (!snapshot.exists()) throw new Error("THREAD_NOT_FOUND");
        const current = parseAdminThread(snapshot.id, snapshot.data());
        const currentLastMessageId =
          current.detail.messages[current.detail.messages.length - 1]?.id ?? "";

        if (
          current.workflow.state !== expectedState ||
          currentLastMessageId !== expectedLastMessageId
        ) {
          throw new Error("STALE_THREAD");
        }

        const values: Record<string, unknown> = {
          "messageWorkflow.lastClientMessageId":
            getLatestClientMessageId(current.detail.messages),
          "messageWorkflow.state": nextState,
          "messageWorkflow.stateUpdatedAt": serverTimestamp(),
          "messageWorkflow.stateUpdatedByUid": adminUid,
          updatedAt: serverTimestamp(),
        };

        if (nextState === "resolved") {
          values["messageWorkflow.resolvedAt"] = serverTimestamp();
          values["messageWorkflow.resolvedByUid"] = adminUid;
        }

        transaction.update(threadRef, values);
      });
      setSuccess(`Thread marked ${formatStatusLabel(nextState)}.`);
    } catch (workflowError) {
      console.error("Failed to update message workflow", workflowError);
      setError(
        workflowError instanceof Error && workflowError.message === "STALE_THREAD"
          ? "The thread changed while you were viewing it. Review the latest message and try again."
          : "Could not update the thread workflow state.",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function reopenThread() {
    if (!thread || busyAction || thread.workflow.state !== "resolved") return;
    if (!window.confirm("Reopen this resolved conversation?")) return;
    const adminUid = auth.currentUser?.uid;

    if (!adminUid) {
      setError("Your admin session is unavailable. Sign in again before continuing.");
      return;
    }

    const lastMessage = thread.detail.messages[thread.detail.messages.length - 1];
    const nextState: MessageWorkflowState =
      lastMessage?.type === "client" ? "needs_reply" : "waiting_on_client";
    const threadRef = doc(db, "message_threads", thread.id);
    const expectedLastMessageId = lastMessage?.id ?? "";

    setBusyAction("workflow");
    setError("");
    setSuccess("");

    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(threadRef);
        if (!snapshot.exists()) throw new Error("THREAD_NOT_FOUND");
        const current = parseAdminThread(snapshot.id, snapshot.data());
        const currentLastMessageId =
          current.detail.messages[current.detail.messages.length - 1]?.id ?? "";

        if (
          current.workflow.state !== "resolved" ||
          currentLastMessageId !== expectedLastMessageId
        ) {
          throw new Error("STALE_THREAD");
        }

        transaction.update(threadRef, {
          "messageWorkflow.lastClientMessageId":
            getLatestClientMessageId(current.detail.messages),
          "messageWorkflow.reopenedAt": serverTimestamp(),
          "messageWorkflow.reopenedByUid": adminUid,
          "messageWorkflow.state": nextState,
          "messageWorkflow.stateUpdatedAt": serverTimestamp(),
          "messageWorkflow.stateUpdatedByUid": adminUid,
          updatedAt: serverTimestamp(),
        });
      });
      setSuccess(`Thread reopened as ${formatStatusLabel(nextState)}.`);
    } catch (reopenError) {
      console.error("Failed to reopen thread", reopenError);
      setError(
        reopenError instanceof Error && reopenError.message === "STALE_THREAD"
          ? "The thread changed while you were viewing it. Review it and try again."
          : "Could not reopen this thread.",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function saveAdminNotes() {
    if (!thread || busyAction) return;
    if (adminNotes.length > 10000) {
      setError("Internal notes must be 10,000 characters or fewer.");
      return;
    }

    setBusyAction("notes");
    setError("");
    setSuccess("");

    try {
      await updateDoc(doc(db, "message_threads", thread.id), {
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp(),
      });
      notesDirty.current = false;
      setAdminNotes(adminNotes.trim());
      setSuccess("Internal notes saved.");
    } catch (notesError) {
      console.error("Failed to save message notes", notesError);
      setError("Could not save internal notes.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AdminShell active="messages">
      <div className="space-y-6">
        <Link href="/admin/messages" className="inline-flex rounded-full border border-black/10 bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]">
          ← Back to messages
        </Link>

        {isLoading ? <EmptyState title="Loading thread" body="Reading this message thread from Firestore." /> : null}
        {!isLoading && error && !thread ? <EmptyState title="Message issue" body={error} /> : null}

        {!isLoading && thread ? (
          <>
            <section className="rounded-[28px] border border-black/8 bg-white p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">Message thread</p>
                  <h1 className="mt-3 font-serif text-4xl">{thread.detail.title || "Conversation"}</h1>
                  <p className="mt-3 text-sm text-black/55">{thread.detail.participantName || clientContext?.name || "Unknown client"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <WorkflowBadge state={thread.workflow.state} />
                  {thread.isActionable ? <span className="rounded-full border border-[#B59674] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#76561E]">Actionable</span> : null}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Messages" value={String(thread.detail.messages.length)} />
                <InfoCard label="Latest sender" value={thread.detail.messages.length ? senderLabel(thread.detail.messages[thread.detail.messages.length - 1]) : "No messages"} />
                <InfoCard label="Created" value={formatDateTime(thread.createdAt)} />
                <InfoCard label="Updated" value={formatDateTime(thread.updatedAt)} />
              </div>
            </section>

            {error ? <Notice title="Action not completed" body={error} tone="error" /> : null}
            {success ? <Notice title="Saved" body={success} tone="success" /> : null}
            {contextError ? <Notice title="Linked context issue" body={contextError} tone="error" /> : null}
            {contextWarnings.map((warning) => <Notice key={warning} title="Relationship needs review" body={warning} tone="warning" />)}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
              <section className="rounded-[28px] border border-black/8 bg-white p-6">
                <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">Conversation</p>
                <p className="mt-2 text-xs leading-5 text-black/45">Messages are shown in their stored array order, which is the existing chronological convention.</p>
                <div className="mt-6 space-y-4">
                  {thread.detail.messages.length ? thread.detail.messages.map((message, index) => <MessageCard key={`${message.id}-${index}`} message={message} />) : <p className="text-sm text-black/45">No messages in this thread.</p>}
                </div>
              </section>

              <aside className="space-y-6">
                <Panel title="Reply" eyebrow="Client visible">
                  <TextArea label="Administrator reply" value={reply} onChange={setReply} rows={7} placeholder={thread.detail.composerPlaceholder} />
                  <p className="mt-2 text-xs leading-5 text-black/45">This saves a stylist message in Firestore. It does not send email, SMS or WhatsApp.</p>
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => void sendReply()} className="mt-4 rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busyAction === "reply" ? "Sending reply…" : "Send reply"}</button>
                </Panel>

                <Panel title="Action state" eyebrow="Operations">
                  <p className="text-sm leading-7 text-black/60">Persisted separately from the latest-sender actionable signal.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {thread.workflow.state === "resolved" ? (
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => void reopenThread()} className="rounded-xl border border-[#B59674] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busyAction === "workflow" ? "Updating…" : "Reopen thread"}</button>
                    ) : (
                      <>
                        <StateButton label="Needs reply" active={thread.workflow.state === "needs_reply"} disabled={Boolean(busyAction)} onClick={() => void changeWorkflowState("needs_reply")} />
                        <StateButton label="Waiting on client" active={thread.workflow.state === "waiting_on_client"} disabled={Boolean(busyAction)} onClick={() => void changeWorkflowState("waiting_on_client")} />
                        <StateButton label="Resolve" active={false} disabled={Boolean(busyAction)} danger onClick={() => void changeWorkflowState("resolved")} />
                      </>
                    )}
                  </div>
                </Panel>

                <Panel title="Internal notes" eyebrow="Admin only">
                  <TextArea label="Notes hidden from client-visible messages" value={adminNotes} onChange={(value) => { notesDirty.current = true; setAdminNotes(value); }} rows={7} />
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => void saveAdminNotes()} className="mt-4 rounded-xl bg-[#221C18] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyAction === "notes" ? "Saving notes…" : "Save internal notes"}</button>
                </Panel>

                <Panel title="Linked context" eyebrow="Exact identifiers">
                  {contextLoading ? <p className="text-sm text-black/45">Loading linked records…</p> : null}
                  {!contextLoading ? (
                    <div className="space-y-3">
                      {thread.clientId && clientContext?.exists ? <ContextLink href={`/admin/clients/${thread.clientId}`} title={clientContext.name || "Client profile"} meta={clientContext.email || "No email stored"} /> : <ContextMissing label="No valid linked client profile." />}
                      {thread.requestId && requestContext?.exists ? <ContextLink href={`/admin/requests/${thread.requestId}`} title={requestContext.title || "Linked request"} meta={requestContext.clientEmail || "No request email stored"} /> : <ContextMissing label="No valid linked request." />}
                    </div>
                  ) : null}
                </Panel>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function getLinkWarnings(thread: AdminThread) {
  const warnings: string[] = [];
  const requestIds = getLifecycleRequestIds(thread.detail.lifecycleLinks);

  if (requestIds.length > 1) {
    warnings.push("Multiple different request links are stored on this thread.");
  }
  if (
    thread.rootRequestId &&
    requestIds.some((requestId) => requestId !== thread.rootRequestId)
  ) {
    warnings.push("The root request identifier conflicts with a stored lifecycle request link.");
  }
  return warnings;
}

function MessageCard({ message }: { message: MessageEntry }) {
  const style = message.type === "client" ? "border border-black/8 bg-[#FFFDFC]" : message.type === "stylist" ? "bg-[#221C18] text-white" : "border border-[#E6D8C8] bg-[#F3ECE4]";
  return (
    <article className={`rounded-[24px] p-5 ${style}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] opacity-70">{senderLabel(message)}</p>
        <p className="text-xs opacity-70">{formatMessageTime(message.timestampLabel)}</p>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{message.body}</p>
      {message.meta ? <p className="mt-3 text-xs opacity-70">{message.meta}</p> : null}
    </article>
  );
}

function senderLabel(message: MessageEntry) {
  if (message.senderName) return message.senderName;
  if (message.type === "client") return "Client";
  if (message.type === "stylist") return "Tufffinds admin";
  return "System";
}

function formatMessageTime(value: string) {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDateTime(value);
}

function WorkflowBadge({ state }: { state: MessageWorkflowState }) {
  const style = state === "needs_reply" ? "bg-[#F5E6C8] text-[#76561E]" : state === "waiting_on_client" ? "bg-[#DCEAF7] text-[#275073]" : "bg-[#DDECDD] text-[#2F5A34]";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${style}`}>{formatStatusLabel(state)}</span>;
}

function StateButton({ label, active, disabled, onClick, danger = false }: { label: string; active: boolean; disabled: boolean; onClick: () => void; danger?: boolean }) {
  const style = active ? "border-[#221C18] bg-[#221C18] text-white" : danger ? "border-[#C98B78] text-[#8B3D2D]" : "border-[#DED2C5] text-black/65";
  return <button type="button" disabled={disabled || active} onClick={onClick} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${style}`}>{label}</button>;
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="rounded-[26px] border border-black/8 bg-white p-5"><p className="text-[10px] uppercase tracking-[0.24em] text-black/40">{eyebrow}</p><h2 className="mt-3 font-serif text-2xl">{title}</h2><div className="mt-5">{children}</div></section>;
}

function TextArea({ label, value, onChange, rows, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows: number; placeholder?: string }) {
  return <label className="block text-sm text-black/65"><span>{label}</span><textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-[#241E1A] outline-none placeholder:text-black/35 focus:border-[#B59674]" /></label>;
}

function ContextLink({ href, title, meta }: { href: string; title: string; meta: string }) {
  return <Link href={href} className="block rounded-xl bg-[#F7F1EA] p-4 transition hover:bg-[#EFE4D9]"><p className="font-medium text-[#241E1A]">{title}</p><p className="mt-1 text-xs text-black/50">{meta}</p></Link>;
}

function ContextMissing({ label }: { label: string }) {
  return <p className="rounded-xl bg-[#F7F1EA] p-4 text-sm text-black/45">{label}</p>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[20px] bg-[#F7F1EA] p-4"><p className="text-[10px] uppercase tracking-[0.22em] text-black/40">{label}</p><p className="mt-3 break-words text-sm leading-6 text-black/68">{value}</p></div>;
}

function Notice({ title, body, tone }: { title: string; body: string; tone: "success" | "warning" | "error" }) {
  const style = tone === "success" ? "border-[#B9D2BB] bg-[#EFF8F0] text-[#2F5A34]" : tone === "warning" ? "border-[#E7C98E] bg-[#FFF8E9] text-[#76561E]" : "border-[#E2B8AA] bg-[#FFF2EF] text-[#8B3D2D]";
  return <div role={tone === "error" ? "alert" : undefined} className={`rounded-2xl border p-4 ${style}`}><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-6">{body}</p></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-[#FBF7F2] text-center"><div className="max-w-md px-8 py-8"><h2 className="font-serif text-3xl leading-tight">{title}</h2><p className="mt-4 text-sm leading-7 text-black/55">{body}</p></div></div>;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
