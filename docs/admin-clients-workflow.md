# Admin Clients workflow

The Clients area reads and updates `client_profiles` through the existing Firebase
client configuration and the existing admin route guard. It does not add an Auth
listener or a second admin authorisation check.

## Existing client profile schema

The application reads these root fields from `client_profiles/{clientId}`:

| Field | Type | Purpose |
| --- | --- | --- |
| `email` | string | Client email address. |
| `fullName` | string | Root copy of the client's name. |
| `phoneNumber` | string | Root copy of the client's phone number. |
| `phoneNumberNormalized` | string | Search/integration-friendly phone value. |
| `onboardingCompleted` | boolean | Existing onboarding completion flag. |
| `createdAt` | Firestore timestamp | Profile creation time. |
| `updatedAt` | Firestore timestamp | Last profile or admin-workflow update. |
| `profile` | map | Client-submitted profile information. |

The existing `profile` map contains:

- `fullName` and `phoneNumber`
- `shippingAddress`: `firstName`, `lastName`, `company`, `line1`, `line2`,
  `city`, `postcode`, `country`, and `phone`
- `clothingSizes`, a string-to-string map (the current defaults are `tops`,
  `bottoms`, `dresses`, and `shoes`)
- `stylePreferences`, `favoriteBrands`, `dislikedBrands`,
  `shoppingPriorities`, and `contactPreferences`, all string arrays
- `budgetComfortRange`, `fitNotes`, and `giftingPreferences`, all strings

There is no numerical budget field, generic client-visible notes field, explicit
communication-consent field, or root `uid`/`userId` field in the current schema.
The Firestore document ID is the client identifier used by linked records; the UI
does not display it as an authentication diagnostic.

Profile edits update supported fields individually and retain unknown root and
`profile` fields. The existing root and profile copies of name and phone are kept
in sync. `updatedAt` uses `serverTimestamp()`.

## New admin-only fields

All fields in this section are operational admin metadata and must not be shown in
a client-facing product.

| Field | Type | Purpose |
| --- | --- | --- |
| `adminNotes` | string | Internal administrator notes, separate from `profile.fitNotes` and all client-submitted preferences. |
| `archived` | boolean | Whether the profile is excluded from the active-client view. Archive never deletes the profile or linked records. |
| `archive.reason` | string | Required reason for the current archive action. |
| `archive.archivedAt` | Firestore timestamp | Server time of the archive action. |
| `archive.archivedByUid` | string | Firebase UID of the approved administrator who archived the profile. |
| `archive.restoredAt` | Firestore timestamp | Server time of the latest restore action. |
| `archive.restoredByUid` | string | Firebase UID of the approved administrator who restored the profile. |
| `onboardingAdmin.completedAt` | Firestore timestamp | Server time when an administrator completed onboarding. |
| `onboardingAdmin.completedByUid` | string | Firebase UID of the administrator completing onboarding. |
| `onboardingAdmin.overrideReason` | string | Required explanation when onboarding is completed with missing required information. |
| `onboardingAdmin.overriddenMissingFields` | string array | Snapshot of required fields missing at the confirmed override. |
| `onboardingAdmin.reopenedAt` | Firestore timestamp | Server time when onboarding was reopened. |
| `onboardingAdmin.reopenedByUid` | string | Firebase UID of the administrator reopening onboarding. |

Administrator UIDs are retained only as internal audit metadata and are not
rendered in the Clients interface.

## Validation and onboarding

Profile saving requires a non-empty name, a syntactically valid email address,
and a phone containing at least three digits and only standard phone punctuation.
Text lengths are bounded in the interface. `budgetComfortRange` remains a string
because that is the existing schema; no numerical budget field was invented.

Normal onboarding completion requires:

- full name
- valid email
- valid phone
- shipping address line 1
- shipping city
- shipping postcode
- shipping country

If any are missing, the administrator must enter an override reason and confirm
the action. The missing-field snapshot, reason, administrator UID, and server
timestamp are recorded. Reopening onboarding requires confirmation and records
who reopened it and when. These actions update onboarding metadata only; they do
not replace client-submitted profile values.

## Linked records and metrics

The detail page uses direct Firestore equality queries instead of loading whole
collections:

- `requests.clientId == client_profiles document ID`
- `orders.clientId == client_profiles document ID`
- `message_threads.clientId == client_profiles document ID`

Requests and Orders can also be linked by an exact `clientEmail` match when their
`clientId` is empty. This supports the public request schema, which currently
creates Requests with `clientId: ""`. A same-email record with a different,
non-empty `clientId` is flagged but is not linked. Names are never used for
relationships. Message Threads have no repository-supported email relationship,
so they use `clientId` only.

Client metrics are defined as follows:

- **Open requests:** linked Requests whose root/detail status is not `closed` or
  `cancelled`.
- **Active orders:** linked Orders with status `created`, `invoice_sent`, `paid`,
  `purchased`, `quality_check`, or `dispatched`.
- **Completed orders:** linked Orders with status `delivered` or `closed`.
- **Actionable messages:** linked Message Threads whose latest stored
  `detail.messages` entry has `type: "client"`.
- **Recorded order value:** sum of finite, non-negative `salePrice` values on
  non-cancelled linked Orders, shown separately for each `currency`. Values in
  different currencies are never combined.

Each collection is loaded independently. If one linked query fails, the page
keeps the profile and any successful linked collections visible and names the
unavailable area.

## Archive and restore

Archiving requires a reason and browser confirmation. It sets `archived: true`
and records the reason, approved administrator UID, and server timestamp. It does
not delete or update Requests, Orders, Message Threads, or commercial history.
Restoring requires confirmation, sets `archived: false`, and records restore audit
metadata while retaining the archive reason and timestamps.

## Firestore security boundary

The current Firestore rules allow `client_profiles` reads and writes only when
`isAdmin()` succeeds. `isAdmin()` requires a signed-in user whose
`admin_users/{uid}` record has `active: true` and `role: "admin"`.

The rules do **not** server-validate the client profile schema, supported edit
fields, onboarding prerequisites or overrides, archive metadata, administrator
UID audit values, or the internal-only meaning of `adminNotes`. Those integrity
controls are client-side in this workflow. The rules were not weakened or changed
as part of this work; stronger enforcement would require a separately reviewed
rules or trusted-server-write design.
