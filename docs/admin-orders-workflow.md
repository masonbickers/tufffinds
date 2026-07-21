# Admin orders workflow fields

Orders remain in the existing `orders` collection. Existing flat order fields
are preserved for compatibility:

- Client and request links: `clientId`, `clientEmail`, `requestId`
- Item: `title`, `brand`, `item`, `size`, `colour`
- Commercial: `salePrice`, `costPrice`, `currency`
- Invoice/payment: `invoiceNumber`, `invoiceUrl`, `paymentMethod`
- Supplier/fulfilment: `supplier`, `courier`, `trackingNumber`, `trackingUrl`
- Other: `status`, `notes`, `createdAt`, `updatedAt`

The admin UI also accepts `approvedOptionId`, `clientName`, and `clientPhone`
when an order was created by a request-conversion workflow. Manual orders now
write these fields as strings for schema compatibility.

## New `orderWorkflow` map

Existing orders do not require migration. The UI supplies empty defaults until
an administrator saves a workflow field.

All fields below are internal-only and are readable/writable only through the
existing admin-protected order rules.

### Payment

| Field | Type | Purpose |
| --- | --- | --- |
| `payment.invoiceAmount` | number or `null` | Amount invoiced to the client. |
| `payment.invoiceDate` | `YYYY-MM-DD` string | Administrative invoice date. |
| `payment.paidAmount` | number or `null` | Amount recorded as paid. |
| `payment.paymentDate` | `YYYY-MM-DD` string | Administrative payment date. |
| `payment.paymentReference` | string | Bank, payment-link, or other payment reference. |
| `payment.paymentNotes` | string | Private payment notes. |

The existing `invoiceNumber`, `invoiceUrl`, and `paymentMethod` fields remain
the canonical flat invoice/payment fields.

### Supplier purchase

| Field | Type | Purpose |
| --- | --- | --- |
| `purchase.supplierContact` | string | Supplier contact information. |
| `purchase.supplierReference` | string | Supplier order or purchase reference. |
| `purchase.purchaseDate` | `YYYY-MM-DD` string | Date the supplier purchase was made. |
| `purchase.purchaseNotes` | string | Private purchasing notes. |
| `purchase.purchaseWithoutReferenceConfirmed` | boolean | Explicit confirmation that no supplier reference exists. |

The existing `supplier`, `costPrice`, and `currency` fields remain canonical.

### Quality check and fulfilment

| Field | Type | Purpose |
| --- | --- | --- |
| `fulfilment.qualityCheckStatus` | `pending`, `passed`, or `issue` | Current quality-check result. |
| `fulfilment.qualityCheckNotes` | string | Private quality-check notes. |
| `fulfilment.qualityCheckedAt` | Firestore timestamp or `null` | Time a non-pending result was saved. |
| `fulfilment.dispatchDate` | `YYYY-MM-DD` string | Confirmed dispatch date. |
| `fulfilment.expectedDeliveryDate` | `YYYY-MM-DD` string | Expected delivery date. |
| `fulfilment.deliveredDate` | `YYYY-MM-DD` string | Confirmed delivered date. |
| `fulfilment.noTrackingConfirmed` | boolean | Explicit approval to dispatch without tracking. |

The existing `courier`, `trackingNumber`, and `trackingUrl` fields remain
canonical.

### Cancellation

| Field | Type | Purpose |
| --- | --- | --- |
| `cancellation.reason` | string | Required cancellation reason. |
| `cancellation.previousStatus` | order status or `null` | Status preserved before cancellation. |
| `cancellation.cancelledAt` | Firestore timestamp or `null` | Cancellation time. |

Cancellation does not delete the order or alter payment/refund records.

### Refund and notes

| Field | Type | Purpose |
| --- | --- | --- |
| `refund.status` | `not_required`, `pending`, `partial`, `completed`, or `failed` | Administrative refund state. |
| `refund.amount` | number or `null` | Refund amount. |
| `refund.date` | `YYYY-MM-DD` string | Refund date. |
| `refund.reference` | string | External refund reference. |
| `refund.notes` | string | Private refund notes. |

Saving refund information records administrative state only; it does not send
money or connect to a payment processor.

The existing flat `notes` string remains the canonical internal-only order
notes field and is reused by both manual creation and order detail editing.

## Security boundary

Firestore rules currently restrict order reads and writes to `isAdmin()`, which
requires an active `admin_users/{uid}` document with role `admin`. The rules do
not validate order schemas, status transitions, prerequisite values, refunds,
or request/order relationships. Those invariants are checked by the admin UI
and transactions but are not server-enforced against an approved administrator
using a different client.
