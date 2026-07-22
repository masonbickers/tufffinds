# Tufffinds launch email runbook

Campaign ID: `tufffinds-launch-2026`

This is a one-off campaign for existing eligible records in
`newsletter_signups` and `waitlist`. It is separate from the automatic welcome
email triggers for new signups.

## Stored signup schemas

Public Firestore rules accept these exact create schemas:

- `newsletter_signups`: `email`, server `createdAt`, source
  `web:newsletter`, and the submitting `page`.
- `waitlist`: `email`, server `createdAt`, source `web:coming-soon`, and the
  browser user-agent field `ua`.

Both public forms trim and lowercase email before writing. The Admin workflow
also trims and lowercases for comparison, but never rewrites stored email
values. Neither collection has a dedicated consent timestamp or consent-version
field, so the Admin UI calls the result **eligibility**, not proof of consent.
The public newsletter form displays marketing-consent copy, while the stored
record itself proves only its source and creation time.

Admins may add only this internal map to an existing signup record:

```text
emailAdmin: {
  state: "eligible" | "suppressed" | "invalid" | "archived",
  reason: string (5–200 characters),
  updatedAt: server timestamp,
  updatedByUid: approved admin UID
}
```

Firestore rules require an approved active admin, allow only `emailAdmin` to
change, and reject signup deletion. The Admin UI requires an explicit checkbox
and reason before an update. It does not delete, merge, or silently normalize
records. Internal reasons and administrator identifiers are not included in CSV
exports or campaign status responses.

## Eligibility and deduplication

An address is eligible for the fixed launch campaign only when all of the
following are true:

1. Trimming and lowercasing produces a valid email of at most 254 characters.
2. No record for that normalized address has a supported opt-out marker. The
   server recognises the legacy boolean/date/consent/status markers in
   `hasOptOutMarker`, `active: false`, and `emailAdmin.state` values
   `suppressed`, `invalid`, or `archived`.
3. The address occurs in either or both signup collections.

There is intentionally no winning duplicate document. Records are grouped by
normalized email; any ineligible record suppresses the entire group, otherwise
the normalized address is included exactly once. This conservative rule is
used by the Admin audit, launch, failed-recipient retry, and CLI workflow.
Setting one record back to `eligible` never overrides a legacy opt-out marker or
an exclusion on another duplicate.

The Email Signups CSV exports the currently filtered records with only:
`email`, `normalized_email`, `list_type`, `source`, `page`, `signup_date`,
`validity`, `duplicate_records`, and `eligibility`. CSV cells are quoted,
embedded quotes are escaped, and spreadsheet-formula prefixes are neutralised.
Document IDs, user-agent strings, cleanup reasons, admin identifiers, and
profile data are excluded.

The protected Admin workflow at `/admin/email-campaigns` supplements the CLI
commands below. It does not weaken or remove any command-line confirmation.

## Deployment order

1. Confirm `RESEND_API_KEY` is configured for Firebase Functions without
   printing it.
   The secret must remain a Functions runtime environment value; it is never a
   `NEXT_PUBLIC_` website variable. The website continues to require its normal
   `NEXT_PUBLIC_FIREBASE_*` configuration so authenticated Admin pages can call
   Firebase, but no provider secret is exposed to the browser.
2. Enable the Google Cloud Tasks API for the Firebase project. When deploying,
   confirm the Functions runtime service account can create tasks and invoke the
   private `processLaunchEmailCampaignBatch` task function. The Firebase CLI
   normally configures the task queue during the Functions deployment; review
   any IAM prompt rather than broadening access manually.
3. Deploy the automatic welcome triggers and protected Admin email Functions:

   ```bash
   firebase deploy --only functions:sendNewsletterWelcomeEmail,functions:sendWaitlistWelcomeEmail,functions:previewAdminEmailTemplate,functions:sendAdminTestEmail,functions:auditLaunchEmailRecipients,functions:startLaunchEmailCampaign,functions:getLaunchEmailCampaignStatus,functions:retryFailedLaunchEmailCampaign,functions:processLaunchEmailCampaignBatch
   ```

4. Deploy the reviewed Firestore rules. Browser clients retain read-only admin
   access to safe status documents; all campaign writes remain server-only:

   ```bash
   firebase deploy --only firestore:rules
   ```

5. Deploy the website so the protected Admin page can call the deployed
   Functions. Verify `/admin/email-campaigns` with an approved admin account.
6. Confirm `https://tufffinds.com` is live before any launch-campaign action.

Do not use the Admin page to infer that the welcome triggers are deployed.
Confirm both trigger names in Firebase after step 3.

## Before sending

1. Confirm [https://tufffinds.com](https://tufffinds.com) is live and the contact
   section works.
2. Generate and review the browser preview:

   ```bash
   npm run email:preview:launch
   ```

   Open `.email-previews/launch-email.html` locally.
3. Send exactly one test email. This mode does not query Firestore:

   ```bash
   TEST_EMAIL_RECIPIENT="info@tufffinds.com" npm run email:launch:test
   ```

4. With valid Firebase Admin application-default credentials, run the dry
   recipient audit:

   ```bash
   npm run email:launch
   ```

5. Review the aggregate `Unique eligible recipients` total. The audit prints no
   addresses and sends nothing.
6. Obtain explicit approval for that recipient total and campaign content.

The equivalent Admin workflow requires a fresh server-side audit, the exact
phrase `SEND TUFFFINDS LAUNCH`, and a separate final confirmation action. It
creates the fixed campaign job `tufffinds-launch-2026`; once that job exists, a
second launch job cannot be started.

The protected preview callable returns HTML and plain text produced by the same
template builders used for delivery. The HTML preview is placed in a sandboxed
iframe. Test sends are separate from launch: they are prefixed `[TEST]`, may go
only to the signed-in administrator or another approved active administrator,
are limited to five attempts per administrator per rolling hour, and have their
own audit and idempotency key. Do not use test-send controls during deployment
verification unless an explicitly approved recipient and live provider send are
intended.

## Persisted campaign and delivery state

The one launch is preserved at
`email_campaigns/tufffinds-launch-2026`. It stores aggregate pending, accepted,
failed and skipped counts; audit counts and ID; campaign/run IDs; phase, status
and retry run; eligible total; batch progress; subject/site URL; server created,
updated and completed timestamps; and initiating admin UID/email. Admin browser
writes are denied. The callable status response omits UIDs and returns the
initiating email only where the server stored a valid value, otherwise the safe
label `Approved administrator`.

Each normalized recipient has one deterministic hash-only document in
`email_campaign_deliveries`. It stores campaign/run IDs, recipient hash, status,
attempt count, server timestamps, provider message ID after acceptance, and a
safe failure code (`provider_rejected` or `delivery_error`). Raw addresses and
provider error bodies are not stored in the delivery ledger. Batch completion
is transactionally applied once using deterministic batch IDs in
`email_campaign_batches`.

The Admin history panel reflects the preserved fixed campaign record, including
start/completion times, safe initiator label, counts, state and retry runs. This
architecture deliberately permits one historical launch rather than a list of
repeat launches.

## One-time production send

Run this command once only after approval:

```bash
LAUNCH_EMAIL_CONFIRMATION="SEND_TUFFFINDS_LAUNCH" \
LAUNCH_SITE_URL="https://tufffinds.com" \
npm run email:launch:send
```

The command also requires `RESEND_API_KEY` and valid Firebase Admin access. It
processes two recipients at a time, reports aggregate progress only, and writes
hash-only delivery state to `email_campaign_deliveries`. Review the aggregate
command result and Resend dashboard after completion.

Do not rerun the normal production command to resend accepted recipients. Both
the delivery ledger and the Resend idempotency key
`tufffinds-launch-2026/{recipientHash}` prevent a previously accepted recipient
from receiving the campaign twice.

## Failed-recipient retry

Only after reviewing the failed total and obtaining separate approval, retry
ledger entries whose status is exactly `failed`:

```bash
LAUNCH_EMAIL_CONFIRMATION="SEND_TUFFFINDS_LAUNCH" \
LAUNCH_SITE_URL="https://tufffinds.com" \
npm run email:launch:retry-failed
```

The retry performs one controlled attempt per failed recipient. It skips
accepted, pending and unrecorded recipients and has no automatic retry loop.

In Admin, a retry is available only after processing completes with failures.
It requires `RETRY FAILED LAUNCH EMAILS` plus a separate checkbox confirmation,
rechecks current consent, and never retries accepted deliveries.

The retry callable transactionally claims the completed campaign before
changing suppressed failures, preventing simultaneous retry actions from
double-counting them. It rebuilds current eligibility, marks newly ineligible
failed ledger entries skipped, and queues only still-eligible entries whose
ledger status is exactly `failed`. The Admin control is disabled while a retry
is active. Resend receives the deterministic idempotency key
`tufffinds-launch-2026/{recipientHash}`; this provides a second guard against
duplicate provider acceptance.

## Security and operational limitations

- Every Admin callable independently checks Firebase authentication and
  `admin_users/{uid}` for `active: true` and `role: "admin"`.
- Callables reject unknown payload fields and validate template names,
  recipients, confirmation fields, audit IDs, task batch size, run IDs, and
  recipient hashes. Recipient totals and status are always rebuilt/read on the
  server.
- Browser access to campaign audits, deliveries, batches, test audit, and test
  rate-limit collections is denied. Browser writes to campaign documents are
  denied.
- Cloud Tasks uses a private invoker, one concurrent dispatcher, deterministic
  task/batch IDs, and small batches. Provider acceptance is not the same as
  inbox delivery; final delivery/bounce information remains in the provider
  dashboard unless a separate webhook workflow is added.
- Firestore and provider operations cannot be one cross-service transaction.
  The deterministic delivery ledger, provider idempotency key, and task/batch
  guards make retries safe where practical, but operators must review a
  `queue_error` before manual intervention.
- Automatic welcome triggers are idempotent per signup document, not per email.
  A person who submits multiple new documents can receive multiple welcome
  emails; the one-off launch campaign is deduplicated across both collections.
