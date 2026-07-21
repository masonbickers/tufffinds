# Admin request workflow fields

The admin request workflow keeps client-submitted request content in `detail`
and stores private operational state in the root `adminWorkflow` map. Existing
request documents do not require a migration; the admin UI supplies empty
defaults until an administrator saves workflow data.

## Request `adminWorkflow` map

| Field | Type | Purpose |
| --- | --- | --- |
| `internalNotes` | `string` | Private administrator notes. This is separate from the client-submitted `detail.notes` brief. |
| `missingInformation` | `string` | Private summary of information still required from the client. |
| `needsInfoReturnStatus` | request status or `null` | Status to restore when a request leaves `needs_info`. |
| `sourcingProgress` | `string` | Private sourcing progress summary. |
| `itemOptions` | array of item-option maps | Candidate sourced items and their commercial details. |
| `approvedOptionId` | `string` or `null` | ID of the item option approved for order conversion. |
| `orderId` | `string` or `null` | Created order document ID. Prevents repeat conversion in the UI. |

Each `itemOptions` entry contains:

- `id`, `title`, `brand`, `item`, `size`, `colour`, `supplier`, and `notes` as strings
- `salePrice` and `costPrice` as numbers
- `currency` as `GBP`, `EUR`, or `USD`

## Request-to-order fields

Converted orders use the existing `orders` collection and existing order
fields. Conversion also writes these compatible identity/link fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `approvedOptionId` | `string` | Source request item option used to build the order. |
| `clientName` | `string` | Client name copied from the request when available. |
| `clientPhone` | `string` | Client phone copied from the request when available. |

The existing `requestId`, `clientId`, and `clientEmail` fields link the order to
its source request and client. Converted order document IDs are deterministic:
`request_{requestId}`. The order creation and request link update run in one
Firestore transaction, so concurrent conversion attempts cannot create two
orders for the same request.

The request also receives `detail.linkedOrder`, using the existing linked-preview
shape, so administrators can navigate directly to the order.

## Authorization and rule boundary

Existing Firestore rules allow request and order reads and writes only when
`isAdmin()` confirms an active `admin_users/{uid}` document with role `admin`.
The rules do not validate request status transitions, request/order field
schemas for admin writes, or request-to-order uniqueness. Those constraints are
implemented in the admin client transaction but are not server-enforced against
an approved administrator using a different client.
