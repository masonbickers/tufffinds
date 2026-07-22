const crypto = require("node:crypto");
const { createLaunchEmailBuilder } = require("./launch-email");
const { createWelcomeEmailBuilder } = require("./welcome-email");

const CAMPAIGN_ID = "tufffinds-launch-2026";
const EXPECTED_SITE_URL = "https://tufffinds.com";
const ADMIN_CONFIRMATION_PHRASE = "SEND TUFFFINDS LAUNCH";
const CLI_CONFIRMATION_PHRASE = "SEND_TUFFFINDS_LAUNCH";
const RETRY_CONFIRMATION_PHRASE = "RETRY FAILED LAUNCH EMAILS";
const DELIVERY_COLLECTION = "email_campaign_deliveries";
const CAMPAIGN_COLLECTION = "email_campaigns";
const AUDIT_COLLECTION = "email_campaign_audits";
const TEST_AUDIT_COLLECTION = "admin_email_test_audit";
const TEST_LIMIT_COLLECTION = "admin_email_test_limits";
const BATCH_COLLECTION = "email_campaign_batches";
const SIGNUP_COLLECTIONS = ["newsletter_signups", "waitlist"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_LOGO_URL = `${EXPECTED_SITE_URL}/finallogobrown.png`;
const DEFAULT_WHATSAPP_URL =
  "https://wa.me/447591207418?text=Hi%20Tufffinds%2C%20I%27ve%20submitted%20a%20sourcing%20brief.";

function normalizeEmail(value) {
  if (typeof value !== "string") return "";

  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : "";
}

function hasOptOutMarker(data) {
  const directOptOutFields = [
    "unsubscribed",
    "optedOut",
    "opted_out",
    "suppressed",
    "doNotEmail",
    "do_not_email",
  ];
  const optOutDateFields = [
    "unsubscribedAt",
    "optedOutAt",
    "opted_out_at",
    "suppressedAt",
  ];
  const explicitConsentFields = [
    "subscribed",
    "emailConsent",
    "marketingConsent",
  ];
  const suppressedStatuses = new Set([
    "archived",
    "invalid",
    "unsubscribed",
    "optedout",
    "opted_out",
    "suppressed",
    "inactive",
    "disabled",
  ]);

  if (directOptOutFields.some((field) => data[field] === true)) return true;
  if (
    optOutDateFields.some(
      (field) => data[field] !== undefined && data[field] !== null
    )
  ) {
    return true;
  }
  if (explicitConsentFields.some((field) => data[field] === false)) return true;
  if (data.active === false) return true;

  const adminState = String(data.emailAdmin?.state || "")
    .trim()
    .toLowerCase();
  if (["archived", "invalid", "suppressed"].includes(adminState)) {
    return true;
  }

  const status = String(
    data.emailStatus || data.subscriptionStatus || data.status || ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return suppressedStatuses.has(status);
}

function recipientHash(email) {
  return crypto.createHash("sha256").update(email).digest("hex");
}

function recipientSetHash(recipients) {
  return crypto
    .createHash("sha256")
    .update(
      recipients
        .map((recipient) => recipient.hash)
        .sort()
        .join(":")
    )
    .digest("hex");
}

function createEmailBuilders({
  logoUrl = DEFAULT_LOGO_URL,
  whatsappUrl = DEFAULT_WHATSAPP_URL,
  siteUrl = EXPECTED_SITE_URL,
} = {}) {
  return {
    buildLaunchEmail: createLaunchEmailBuilder({
      logoUrl,
      whatsappUrl,
      siteUrl,
      contactUrl: `${siteUrl}/#contact`,
    }),
    buildWelcomeEmail: createWelcomeEmailBuilder({
      logoUrl,
      whatsappUrl,
      contactUrl: `${siteUrl}/#contact`,
    }),
  };
}

function buildEmailTemplate(template) {
  const { buildLaunchEmail, buildWelcomeEmail } = createEmailBuilders();

  if (template === "welcome") {
    return buildWelcomeEmail({ sourceLabel: "Newsletter signup" });
  }
  if (template === "launch") return buildLaunchEmail();

  return null;
}

async function buildRecipientAudit(db) {
  const snapshots = await Promise.all(
    SIGNUP_COLLECTIONS.map((collectionName) =>
      db.collection(collectionName).get()
    )
  );
  const counts = {
    newsletterRecords: snapshots[0].size,
    waitlistRecords: snapshots[1].size,
    totalRecords: snapshots[0].size + snapshots[1].size,
    invalidRecords: 0,
    optedOutRecords: 0,
    duplicateRecords: 0,
    uniqueValidContacts: 0,
    suppressedUniqueContacts: 0,
    eligibleUniqueContacts: 0,
  };
  const contacts = new Map();

  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      const data = document.data();
      const email = normalizeEmail(data.email);

      if (!email) {
        counts.invalidRecords += 1;
        continue;
      }

      const optedOut = hasOptOutMarker(data);
      if (optedOut) counts.optedOutRecords += 1;

      const existing = contacts.get(email);
      if (existing) {
        counts.duplicateRecords += 1;
        existing.optedOut = existing.optedOut || optedOut;
      } else {
        contacts.set(email, { email, optedOut });
      }
    }
  }

  counts.uniqueValidContacts = contacts.size;
  const eligibleRecipients = [];

  for (const contact of contacts.values()) {
    if (contact.optedOut) {
      counts.suppressedUniqueContacts += 1;
      continue;
    }

    eligibleRecipients.push({
      email: contact.email,
      hash: recipientHash(contact.email),
    });
  }

  counts.eligibleUniqueContacts = eligibleRecipients.length;
  return {
    counts,
    eligibleRecipients,
    recipientSetHash: recipientSetHash(eligibleRecipients),
  };
}

module.exports = {
  ADMIN_CONFIRMATION_PHRASE,
  AUDIT_COLLECTION,
  BATCH_COLLECTION,
  CAMPAIGN_COLLECTION,
  CAMPAIGN_ID,
  CLI_CONFIRMATION_PHRASE,
  DEFAULT_LOGO_URL,
  DEFAULT_WHATSAPP_URL,
  DELIVERY_COLLECTION,
  EXPECTED_SITE_URL,
  RETRY_CONFIRMATION_PHRASE,
  SIGNUP_COLLECTIONS,
  TEST_AUDIT_COLLECTION,
  TEST_LIMIT_COLLECTION,
  buildEmailTemplate,
  buildRecipientAudit,
  createEmailBuilders,
  hasOptOutMarker,
  normalizeEmail,
  recipientHash,
  recipientSetHash,
};
