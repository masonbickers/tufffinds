import type {
  AdminThread,
  FirestoreTimestampValue,
  MessageEntry,
  MessageWorkflow,
  MessageWorkflowState,
  ThreadLifecycleLink,
} from "./admin-types";
import { normalizeTimestamp } from "./admin-utils";

type ThreadDocumentData = {
  adminNotes?: unknown;
  clientId?: unknown;
  createdAt?: FirestoreTimestampValue;
  detail?: unknown;
  lastMessagePreview?: unknown;
  messageWorkflow?: unknown;
  requestId?: unknown;
  updatedAt?: FirestoreTimestampValue;
};

export function parseAdminThread(
  id: string,
  data: ThreadDocumentData,
): AdminThread {
  const detail = record(data.detail);
  const messages = normalizeMessages(detail.messages);
  const lifecycleLinks = normalizeLifecycleLinks(detail.lifecycleLinks);
  const rootRequestId = text(data.requestId);
  const lifecycleRequestId = getLifecycleRequestId(lifecycleLinks);
  const workflow = normalizeMessageWorkflow(data.messageWorkflow, messages);
  const workflowRecord = record(data.messageWorkflow);

  return {
    id,
    adminNotes: text(data.adminNotes),
    clientId: text(data.clientId),
    createdAt: safeTimestamp(data.createdAt),
    detail: {
      composerPlaceholder: text(detail.composerPlaceholder) || "Send a message",
      id: text(detail.id) || id,
      lifecycleLinks,
      messages,
      participantName: text(detail.participantName),
      title: text(detail.title) || "Conversation",
    },
    isActionable: isThreadActionable(messages),
    lastMessagePreview:
      text(data.lastMessagePreview) || messages[messages.length - 1]?.body || "",
    requestId: rootRequestId || lifecycleRequestId,
    rootRequestId,
    updatedAt: safeTimestamp(data.updatedAt),
    workflow,
    workflowIsPersisted: isMessageWorkflowState(workflowRecord.state),
  };
}

export function normalizeMessages(value: unknown): MessageEntry[] {
  if (!Array.isArray(value)) return [];

  return value.map((entry, index) => {
    const message = record(entry);
    const type = isMessageType(message.type) ? message.type : "system";

    return {
      id: text(message.id) || `legacy-message-${index + 1}`,
      body: text(message.body) || "Message content is unavailable.",
      meta: text(message.meta) || undefined,
      senderName: text(message.senderName) || undefined,
      timestampLabel: text(message.timestampLabel),
      type,
    };
  });
}

export function isThreadActionable(messages: MessageEntry[]) {
  return messages[messages.length - 1]?.type === "client";
}

export function getLatestClientMessageId(messages: MessageEntry[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].type === "client") return messages[index].id;
  }
  return "";
}

export function isMessageWorkflowState(
  value: unknown,
): value is MessageWorkflowState {
  return (
    value === "needs_reply" ||
    value === "waiting_on_client" ||
    value === "resolved"
  );
}

export function normalizeMessageWorkflow(
  value: unknown,
  messages: MessageEntry[],
): MessageWorkflow {
  const workflow = record(value);
  const fallbackState: MessageWorkflowState = isThreadActionable(messages)
    ? "needs_reply"
    : "waiting_on_client";

  return {
    lastClientMessageId: text(workflow.lastClientMessageId),
    lastReplyAt: safeTimestamp(workflow.lastReplyAt),
    lastReplyByUid: text(workflow.lastReplyByUid),
    reopenedAt: safeTimestamp(workflow.reopenedAt),
    reopenedByUid: text(workflow.reopenedByUid),
    resolvedAt: safeTimestamp(workflow.resolvedAt),
    resolvedByUid: text(workflow.resolvedByUid),
    state: isMessageWorkflowState(workflow.state)
      ? workflow.state
      : fallbackState,
    stateUpdatedAt: safeTimestamp(workflow.stateUpdatedAt),
    stateUpdatedByUid: text(workflow.stateUpdatedByUid),
  };
}

export function getLifecycleRequestIds(links: ThreadLifecycleLink[]) {
  return Array.from(
    new Set(
      links
        .filter((link) => link.type === "request")
        .map((link) => extractRequestId(link.href))
        .filter(Boolean),
    ),
  );
}

function getLifecycleRequestId(links: ThreadLifecycleLink[]) {
  return getLifecycleRequestIds(links)[0] ?? "";
}

function extractRequestId(href: string) {
  const match = href.match(/\/(?:admin\/)?requests\/([^/?#]+)/);
  if (!match?.[1]) return "";

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}

function normalizeLifecycleLinks(value: unknown): ThreadLifecycleLink[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const link = record(entry);
    if (!isLinkType(link.type)) return [];
    const href = text(link.href);
    if (!href) return [];

    return [
      {
        href,
        label: text(link.label) || "Linked record",
        type: link.type,
      },
    ];
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeTimestamp(value: unknown) {
  if (typeof value === "string") return normalizeTimestamp(value);
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    try {
      return normalizeTimestamp(value as FirestoreTimestampValue);
    } catch {
      return "";
    }
  }
  return "";
}

function isMessageType(value: unknown): value is MessageEntry["type"] {
  return value === "client" || value === "stylist" || value === "system";
}

function isLinkType(value: unknown): value is ThreadLifecycleLink["type"] {
  return value === "request" || value === "edit" || value === "order";
}
