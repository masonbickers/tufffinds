# Admin Messages workflow

The Messages area uses the existing Firebase client and existing protected admin
layout. It does not add an Auth listener, a second admin check, or an external
email, SMS, or WhatsApp integration.

## Existing Firestore model

Threads are stored at `message_threads/{threadId}`. Before this workflow, active
repository code read these root fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `clientId` | string | Exact `client_profiles` document link. |
| `detail` | map | Thread subject, participant label, links, and messages. |
| `lastMessagePreview` | string | List summary of the latest message. |
| `updatedAt` | Firestore timestamp | Thread ordering and last-update time. |

The current code also safely accepts optional root `requestId` and `createdAt`
values when legacy or future-compatible documents contain them. The earlier
in-repository admin data type described an optional `requestId`, but no active
thread writer exists in the repository.

The existing `detail` map contains:

- `id`
- `title`
- `participantName`
- `composerPlaceholder`
- `lifecycleLinks`, containing `href`, `label`, and a `type` of `request`,
  `edit`, or `order`
- `messages`, an embedded array

Existing messages contain:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Message identity within the embedded array. |
| `type` | `client`, `stylist`, or `system` | Sender category and presentation. |
| `body` | string | Client-visible conversation content. |
| `timestampLabel` | string | Existing display-time convention. It is not a guaranteed machine timestamp. |
| `meta` | optional string | Existing sender/context display metadata. |

No active repository writer creates or appends Thread messages. No attachment
field, internal-notes field, dedicated sender-identity field, per-message
Firestore timestamp, or persisted workflow state existed. Malformed legacy array
entries are rendered as safe system-style placeholders rather than crashing the
page. Stored array order remains the authoritative chronological order.

The older unused admin data type contains `isUnread` and `unreadCount`, but there
is no active Firestore reader, writer, per-user receipt model, or user-specific
read timestamp supporting genuine unread tracking. The workflow therefore does
not describe Threads as unread.

## New fields

All workflow and audit fields below are internal-only operational metadata.

| Field | Type | Purpose |
| --- | --- | --- |
| `adminNotes` | string | Private administrator notes, stored outside `detail.messages`. |
| `messageWorkflow.state` | `needs_reply`, `waiting_on_client`, or `resolved` | Persisted operational state. |
| `messageWorkflow.stateUpdatedAt` | Firestore timestamp | Server time of the latest state update. |
| `messageWorkflow.stateUpdatedByUid` | string | Approved administrator UID responsible for the state update. |
| `messageWorkflow.lastClientMessageId` | string | Latest client-message ID already incorporated into workflow state. |
| `messageWorkflow.lastReplyAt` | Firestore timestamp | Server time of the latest admin reply. |
| `messageWorkflow.lastReplyByUid` | string | Approved administrator UID that saved the latest reply. |
| `messageWorkflow.resolvedAt` | Firestore timestamp | Server time the Thread was last resolved. |
| `messageWorkflow.resolvedByUid` | string | Approved administrator UID that resolved the Thread. |
| `messageWorkflow.reopenedAt` | Firestore timestamp | Server time the Thread was last reopened. |
| `messageWorkflow.reopenedByUid` | string | Approved administrator UID that reopened the Thread. |
| `detail.messages[].senderName` | optional string | Safe display name for a newly saved admin reply. It does not contain a Firebase UID. |

Administrator UIDs remain in the internal workflow map and are not rendered in
the Messages UI. `adminNotes` is never inserted into the client-visible embedded
message array.

## Replies and timestamps

An administrator reply is appended to the existing `detail.messages` array in a
Firestore transaction with:

- a browser-generated stable ID for transaction retry deduplication
- `type: "stylist"`
- the validated reply body
- a safe sender display label in `senderName` and `meta`
- an ISO string in the existing `timestampLabel` field

The transaction reads the latest embedded array before appending, preserves raw
legacy entries, updates `lastMessagePreview`, and uses `serverTimestamp()` for
root `updatedAt`, reply audit time, and workflow state time. It then sets the
state to `waiting_on_client`. The browser prevents repeated submissions while the
transaction is active. No external delivery is claimed or attempted.

Firestore server-timestamp sentinels cannot be embedded inside array elements, so
the reply keeps the existing `timestampLabel` string convention while the Thread
and audit timestamps use server timestamps.

## Workflow and actionability

For legacy Threads without `messageWorkflow.state`, the UI initially derives:

- latest message is `client` -> `needs_reply`
- otherwise -> `waiting_on_client`

When the detail listener observes a new latest client message whose ID differs
from `messageWorkflow.lastClientMessageId`, it transactionally persists
`needs_reply`. This also reopens operational action after a genuinely new client
message. An explicit administrator choice of `needs_reply` or
`waiting_on_client` records the current latest client-message ID so it is not
immediately overwritten.

Saving an admin reply sets `waiting_on_client`. Resolving requires confirmation.
Reopening a resolved Thread requires confirmation and chooses `needs_reply` when
the latest message is from the client, otherwise `waiting_on_client`. Manual state
updates reject a stale message/state snapshot and ask the administrator to review
the newest conversation.

**Actionable** deliberately retains the dashboard definition: the latest stored
message has `type: "client"`. It is separate from per-user unread state and from
the manually persisted workflow state. The Messages list and detail page use the
same shared helper for this definition. The existing dashboard implementation
must inspect embedded message arrays because no root latest-sender field exists;
that requires reading Thread documents rather than using an aggregate count.

## Linked records

The detail page loads context only through exact identifiers:

- `clientId` -> `client_profiles/{clientId}`
- root `requestId`, or a strictly parsed request lifecycle link when the root
  value is absent -> `requests/{requestId}`

Names are never used for linking, and Messages have no supported email fallback.
Multiple lifecycle request links, root/lifecycle request conflicts, missing
documents, and a linked Request with a different non-empty `clientId` are shown as
relationship warnings instead of being silently treated as a matching client.

## Security boundary

Firestore rules allow `message_threads` reads and writes only when `isAdmin()`
succeeds. `isAdmin()` requires an authenticated user whose `admin_users/{uid}`
record has `active: true` and `role: "admin"`.

The rules do **not** server-enforce:

- root or embedded message schemas
- allowed message sender types
- body length or sender identity
- workflow states or state transitions
- internal-only treatment of notes and audit fields
- linked client/request integrity
- deduplication of reply IDs

Those protections are client-side in this workflow. Current rules also prevent
clients from reading Threads at all, so a future client messaging surface would
need separately reviewed rules and a response shape that excludes `adminNotes`
and internal workflow audit fields. Firestore rules were not changed or weakened
for this workflow.
