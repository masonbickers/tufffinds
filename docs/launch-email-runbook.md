# Tufffinds launch email runbook

Campaign ID: `tufffinds-launch-2026`

This is a one-off campaign for existing eligible records in
`newsletter_signups` and `waitlist`. It is separate from the automatic welcome
email triggers for new signups.

The protected Admin workflow at `/admin/email-campaigns` supplements the CLI
commands below. It does not weaken or remove any command-line confirmation.

## Deployment order

1. Confirm `RESEND_API_KEY` is configured for Firebase Functions without
   printing it.
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
