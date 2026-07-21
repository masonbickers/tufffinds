const path = require("node:path");
const {
  CAMPAIGN_ID,
  CLI_CONFIRMATION_PHRASE,
  DELIVERY_COLLECTION,
  EXPECTED_SITE_URL,
  buildRecipientAudit,
  createEmailBuilders,
  hasOptOutMarker,
  normalizeEmail,
  recipientHash,
} = require("../email-campaigns");

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 1000;

class CampaignError extends Error {}

function createFirestoreAdmin() {
  const {
    applicationDefault,
    getApps,
    initializeApp,
  } = require("firebase-admin/app");
  const { getFirestore } = require("firebase-admin/firestore");
  const app =
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId: "tufffinds",
    });

  return getFirestore(app);
}

async function readRecipientAudit(db) {
  try {
    return await buildRecipientAudit(db);
  } catch {
    throw new CampaignError(
      "Firebase Admin access is required to read the signup collections."
    );
  }
}

function printAudit(counts, heading = "Launch email dry-run audit") {
  console.log(heading);
  console.log(`Newsletter records: ${counts.newsletterRecords}`);
  console.log(`Waitlist records: ${counts.waitlistRecords}`);
  console.log(`Total records: ${counts.totalRecords}`);
  console.log(`Malformed records skipped: ${counts.invalidRecords}`);
  console.log(`Opt-out records found: ${counts.optedOutRecords}`);
  console.log(`Duplicate records removed: ${counts.duplicateRecords}`);
  console.log(`Unique valid contacts: ${counts.uniqueValidContacts}`);
  console.log(
    `Unique contacts suppressed by opt-out: ${counts.suppressedUniqueContacts}`
  );
  console.log(`Unique eligible recipients: ${counts.eligibleUniqueContacts}`);
}

function loadFunctionsEnvironment() {
  const dotenv = require("dotenv");
  dotenv.config({
    path: path.resolve(__dirname, "..", ".env"),
    quiet: true,
  });
}

function createBuilder() {
  return createEmailBuilders().buildLaunchEmail;
}

function requireResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new CampaignError("RESEND_API_KEY is required for email delivery.");
  }
  return apiKey;
}

async function sendTestEmail() {
  loadFunctionsEnvironment();
  const recipient = normalizeEmail(process.env.TEST_EMAIL_RECIPIENT);

  if (!recipient) {
    throw new CampaignError(
      "TEST_EMAIL_RECIPIENT must contain one valid email address."
    );
  }

  const { Resend } = require("resend");
  const resend = new Resend(requireResendApiKey());
  const { subject, html, text } = createBuilder()();
  const response = await resend.emails.send(
    {
      from: "Tufffinds <info@tufffinds.com>",
      to: recipient,
      subject: `[TEST] ${subject}`,
      html,
      text,
    },
    {
      idempotencyKey: `${CAMPAIGN_ID}/test/${recipientHash(recipient)}`,
    }
  );

  if (response.error || !response.data?.id) {
    throw new CampaignError("The test email was not accepted by Resend.");
  }

  console.log("Test emails accepted: 1");
}

function assertProductionConfirmation() {
  if (process.env.LAUNCH_EMAIL_CONFIRMATION !== CLI_CONFIRMATION_PHRASE) {
    throw new CampaignError("The launch email confirmation phrase is missing.");
  }
  if (process.env.LAUNCH_SITE_URL !== EXPECTED_SITE_URL) {
    throw new CampaignError(
      "LAUNCH_SITE_URL must be exactly https://tufffinds.com."
    );
  }
}

async function claimRecipient(db, recipient, retryFailed) {
  const { FieldValue } = require("firebase-admin/firestore");
  const reference = db
    .collection(DELIVERY_COLLECTION)
    .doc(`${CAMPAIGN_ID}_${recipient.hash}`);

  const claimed = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);

    if (retryFailed) {
      if (!snapshot.exists || snapshot.data()?.status !== "failed") return false;

      transaction.update(reference, {
        status: "pending",
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    }

    if (snapshot.exists) return false;

    transaction.create(reference, {
      campaignId: CAMPAIGN_ID,
      recipientHash: recipient.hash,
      status: "pending",
      attempts: 1,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  return { claimed, reference };
}

async function deliverRecipient({ db, resend, recipient, email, retryFailed }) {
  const { FieldValue } = require("firebase-admin/firestore");
  const { claimed, reference } = await claimRecipient(
    db,
    recipient,
    retryFailed
  );

  if (!claimed) return "skipped";

  try {
    const response = await resend.emails.send(
      {
        from: "Tufffinds <info@tufffinds.com>",
        to: recipient.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      },
      {
        idempotencyKey: `${CAMPAIGN_ID}/${recipient.hash}`,
      }
    );

    if (response.error || !response.data?.id) {
      throw new Error("Email was not accepted.");
    }

    await reference.update({
      status: "accepted",
      providerMessageId: response.data.id,
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "accepted";
  } catch {
    try {
      await reference.update({
        status: "failed",
        failedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // A pending hash-only ledger entry and Resend idempotency still prevent
      // an automatic duplicate if the delivery-state update itself fails.
    }
    return "failed";
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendCampaign({ retryFailed }) {
  loadFunctionsEnvironment();
  assertProductionConfirmation();
  const apiKey = requireResendApiKey();
  const db = createFirestoreAdmin();
  const audit = await readRecipientAudit(db);

  printAudit(
    audit.counts,
    retryFailed ? "Launch email failed-recipient retry audit" : "Launch email send audit"
  );

  if (audit.eligibleRecipients.length === 0) {
    throw new CampaignError("No eligible launch email recipients were found.");
  }

  const { Resend } = require("resend");
  const resend = new Resend(apiKey);
  const email = createBuilder()();
  const totals = { accepted: 0, failed: 0, skipped: 0 };
  const batchCount = Math.ceil(audit.eligibleRecipients.length / BATCH_SIZE);

  for (let index = 0; index < audit.eligibleRecipients.length; index += BATCH_SIZE) {
    const batch = audit.eligibleRecipients.slice(index, index + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((recipient) =>
        deliverRecipient({ db, resend, recipient, email, retryFailed })
      )
    );
    const batchTotals = { accepted: 0, failed: 0, skipped: 0 };

    for (const result of results) {
      batchTotals[result] += 1;
      totals[result] += 1;
    }

    console.log(
      `Batch ${Math.floor(index / BATCH_SIZE) + 1}/${batchCount}: accepted ${batchTotals.accepted}, failed ${batchTotals.failed}, skipped ${batchTotals.skipped}`
    );

    if (index + BATCH_SIZE < audit.eligibleRecipients.length) {
      await wait(BATCH_DELAY_MS);
    }
  }

  console.log(
    `Campaign totals: accepted ${totals.accepted}, failed ${totals.failed}, skipped ${totals.skipped}`
  );

  if (totals.failed > 0) process.exitCode = 1;
}

async function runDryAudit() {
  const db = createFirestoreAdmin();
  const { counts } = await readRecipientAudit(db);
  printAudit(counts);
}

async function main() {
  const mode = process.argv[2] || "--dry-run";

  if (mode === "--dry-run") return runDryAudit();
  if (mode === "--test") return sendTestEmail();
  if (mode === "--send") return sendCampaign({ retryFailed: false });
  if (mode === "--retry-failed") return sendCampaign({ retryFailed: true });

  throw new CampaignError("Unknown launch email mode.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      error instanceof CampaignError
        ? error.message
        : "The launch email command failed safely."
    );
    process.exitCode = 1;
  });
}

module.exports = {
  assertProductionConfirmation,
  buildRecipientAudit,
  hasOptOutMarker,
  normalizeEmail,
  recipientHash,
  sendTestEmail,
};
