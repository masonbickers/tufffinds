const crypto = require("node:crypto");
const { getApps, initializeApp } = require("firebase-admin/app");
const {
  FieldValue,
  Timestamp,
  getFirestore,
} = require("firebase-admin/firestore");
const { getFunctions: getAdminFunctions } = require("firebase-admin/functions");
const logger = require("firebase-functions/logger");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onTaskDispatched } = require("firebase-functions/v2/tasks");
const { Resend } = require("resend");
const {
  ADMIN_CONFIRMATION_PHRASE,
  AUDIT_COLLECTION,
  BATCH_COLLECTION,
  CAMPAIGN_COLLECTION,
  CAMPAIGN_ID,
  DELIVERY_COLLECTION,
  EXPECTED_SITE_URL,
  RETRY_CONFIRMATION_PHRASE,
  TEST_AUDIT_COLLECTION,
  TEST_LIMIT_COLLECTION,
  buildEmailTemplate,
  buildRecipientAudit,
  normalizeEmail,
  recipientHash,
} = require("./email-campaigns");

const REGION = "europe-west2";
const SENDER = "Tufffinds <info@tufffinds.com>";
const TEST_SEND_LIMIT = 5;
const TEST_WINDOW_MS = 60 * 60 * 1000;
const AUDIT_TTL_MS = 30 * 60 * 1000;
const CAMPAIGN_BATCH_SIZE = 2;
const TASK_FUNCTION_NAME =
  "locations/europe-west2/functions/processLaunchEmailCampaignBatch";

function getAdminServices() {
  const app = getApps()[0] || initializeApp();
  return {
    app,
    db: getFirestore(app),
  };
}

async function requireApprovedAdmin(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Admin sign in is required.");
  }

  const { db } = getAdminServices();
  let snapshot;

  try {
    snapshot = await db.collection("admin_users").doc(request.auth.uid).get();
  } catch {
    throw new HttpsError("internal", "Admin access could not be verified.");
  }

  const record = snapshot.exists ? snapshot.data() : null;
  if (!record?.active || record.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }

  return {
    db,
    email: normalizeEmail(request.auth.token?.email),
    uid: request.auth.uid,
  };
}

function requireTemplate(value) {
  if (value !== "welcome" && value !== "launch") {
    throw new HttpsError("invalid-argument", "Choose a valid email template.");
  }

  return value;
}

function requirePayload(data, allowedKeys) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).some((key) => !allowedKeys.includes(key))
  ) {
    throw new HttpsError("invalid-argument", "The request is invalid.");
  }
}

function requireResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new HttpsError(
      "failed-precondition",
      "Email delivery is not configured."
    );
  }
  return apiKey;
}

async function resolveApprovedTestRecipient({ db, admin, requestedEmail }) {
  const hasRequestedEmail =
    typeof requestedEmail === "string" && requestedEmail.trim().length > 0;
  const requestedRecipient = normalizeEmail(requestedEmail);
  if (hasRequestedEmail && !requestedRecipient) {
    throw new HttpsError(
      "invalid-argument",
      "A valid approved admin email is required."
    );
  }

  const recipient = requestedRecipient || admin.email;
  if (!recipient) {
    throw new HttpsError(
      "invalid-argument",
      "A valid approved admin email is required."
    );
  }

  if (recipient === admin.email) return recipient;

  let snapshot;
  try {
    snapshot = await db.collection("admin_users").get();
  } catch {
    throw new HttpsError(
      "internal",
      "The test recipient could not be verified."
    );
  }

  const approved = snapshot.docs.some((document) => {
    const record = document.data();
    return (
      record.active === true &&
      record.role === "admin" &&
      normalizeEmail(record.email) === recipient
    );
  });

  if (!approved) {
    throw new HttpsError(
      "permission-denied",
      "Test emails may only be sent to an approved active admin."
    );
  }

  return recipient;
}

async function claimTestSend({ db, admin, recipient, template }) {
  const now = Timestamp.now();
  const limitReference = db.collection(TEST_LIMIT_COLLECTION).doc(admin.uid);
  const auditReference = db.collection(TEST_AUDIT_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const limitSnapshot = await transaction.get(limitReference);
    const limit = limitSnapshot.exists ? limitSnapshot.data() : null;
    const windowStartedAt = limit?.windowStartedAt?.toMillis?.() || 0;
    const insideWindow = now.toMillis() - windowStartedAt < TEST_WINDOW_MS;
    const currentCount = insideWindow ? Number(limit?.count || 0) : 0;

    if (currentCount >= TEST_SEND_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "The test-email limit has been reached. Try again later."
      );
    }

    transaction.set(limitReference, {
      adminUid: admin.uid,
      count: currentCount + 1,
      updatedAt: now,
      windowStartedAt: insideWindow ? limit.windowStartedAt : now,
    });
    transaction.create(auditReference, {
      adminUid: admin.uid,
      createdAt: now,
      recipientHash: recipientHash(recipient),
      status: "pending",
      template,
    });
  });

  return auditReference;
}

async function safeCampaignStatus(db, snapshot) {
  if (!snapshot?.exists) {
    return {
      exists: false,
      campaignId: CAMPAIGN_ID,
      status: "not_started",
      pending: 0,
      accepted: 0,
      failed: 0,
      skipped: 0,
      retried: 0,
      completed: false,
      failureReasons: [],
    };
  }

  const data = snapshot.data();
  const deliveries = await db
    .collection(DELIVERY_COLLECTION)
    .where("campaignId", "==", CAMPAIGN_ID)
    .get();
  const failureCounts = new Map();
  let retried = 0;

  for (const document of deliveries.docs) {
    const delivery = document.data();
    if (Number(delivery.attempts || 0) > 1) retried += 1;
    if (delivery.status !== "failed") continue;
    const code = ["delivery_error", "provider_rejected"].includes(
      delivery.failureCode
    )
      ? delivery.failureCode
      : "delivery_error";
    failureCounts.set(code, Number(failureCounts.get(code) || 0) + 1);
  }

  return {
    exists: true,
    campaignId: CAMPAIGN_ID,
    subject: data.subject || "Tufffinds is now live",
    status: data.status || "unknown",
    pending: Number(data.pending || 0),
    accepted: Number(data.accepted || 0),
    failed: Number(data.failed || 0),
    skipped: Number(data.skipped || 0),
    retried,
    completed: Boolean(data.completed),
    eligibleTotal: Number(data.eligibleTotal || 0),
    phase: data.phase || "initial",
    retryRun: Number(data.retryRun || 0),
    createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
    completedAt: data.completedAt?.toDate?.().toISOString?.() || null,
    initiatedBy: normalizeEmail(data.createdByEmail) || "Approved administrator",
    lastRetryAt: data.lastRetryAt?.toDate?.().toISOString?.() || null,
    failureReasons: [...failureCounts.entries()].map(([code, count]) => ({
      code,
      count,
    })),
    updatedAt: data.updatedAt?.toDate?.().toISOString?.() || null,
  };
}

function splitIntoBatches(recipients) {
  const batches = [];
  for (let index = 0; index < recipients.length; index += CAMPAIGN_BATCH_SIZE) {
    batches.push(recipients.slice(index, index + CAMPAIGN_BATCH_SIZE));
  }
  return batches;
}

async function enqueueBatches({ app, batches, mode, runId }) {
  const queue = getAdminFunctions(app).taskQueue(TASK_FUNCTION_NAME);

  for (let index = 0; index < batches.length; index += 1) {
    const taskId = crypto
      .createHash("sha256")
      .update(`${CAMPAIGN_ID}:${runId}:${index}`)
      .digest("hex");

    await queue.enqueue(
      {
        batchIndex: index,
        campaignId: CAMPAIGN_ID,
        mode,
        recipients: batches[index],
        runId,
      },
      {
        dispatchDeadlineSeconds: 300,
        id: taskId,
        scheduleDelaySeconds: 8,
      }
    );
  }
}

function validateStartRequest(data) {
  requirePayload(data, [
    "auditId",
    "confirmationPhrase",
    "finalConfirmation",
    "siteUrl",
  ]);
  if (data?.siteUrl !== EXPECTED_SITE_URL) {
    throw new HttpsError(
      "failed-precondition",
      "The production site URL is not confirmed."
    );
  }
  if (data?.confirmationPhrase !== ADMIN_CONFIRMATION_PHRASE) {
    throw new HttpsError(
      "failed-precondition",
      "The launch confirmation phrase does not match."
    );
  }
  if (data?.finalConfirmation !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Final launch confirmation is required."
    );
  }
  if (
    typeof data?.auditId !== "string" ||
    !/^[A-Za-z0-9]{1,128}$/.test(data.auditId)
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Run a recipient audit before starting the campaign."
    );
  }
}

exports.previewAdminEmailTemplate = onCall(
  { region: REGION },
  async (request) => {
    await requireApprovedAdmin(request);
    requirePayload(request.data, ["template"]);
    const template = requireTemplate(request.data?.template);
    return buildEmailTemplate(template);
  }
);

exports.sendAdminTestEmail = onCall({ region: REGION }, async (request) => {
  const admin = await requireApprovedAdmin(request);
  requirePayload(request.data, ["recipient", "template"]);
  const template = requireTemplate(request.data?.template);
  const recipient = await resolveApprovedTestRecipient({
    db: admin.db,
    admin,
    requestedEmail: request.data?.recipient,
  });
  const apiKey = requireResendApiKey();
  const auditReference = await claimTestSend({
    db: admin.db,
    admin,
    recipient,
    template,
  });
  const email = buildEmailTemplate(template);
  let providerMessageId;

  try {
    const resend = new Resend(apiKey);
    const response = await resend.emails.send(
      {
        from: SENDER,
        to: recipient,
        subject: `[TEST] ${email.subject}`,
        html: email.html,
        text: email.text,
      },
      {
        idempotencyKey: `admin-${template}-test/${auditReference.id}`,
      }
    );

    if (response.error || !response.data?.id) {
      throw new Error("Test email was not accepted.");
    }
    providerMessageId = response.data.id;
  } catch {
    try {
      await auditReference.update({
        failedAt: FieldValue.serverTimestamp(),
        status: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // The rate-limit record still prevents rapid repeated attempts if the
      // audit status itself cannot be updated.
    }
    logger.error("Admin test email delivery failed.", {
      adminUid: admin.uid,
      auditId: auditReference.id,
      template,
    });
    throw new HttpsError("internal", "The test email could not be sent.");
  }

  try {
    await auditReference.update({
      acceptedAt: FieldValue.serverTimestamp(),
      providerMessageId,
      status: "accepted",
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    logger.warn("Admin test email was accepted but its audit status was not updated.", {
      adminUid: admin.uid,
      auditId: auditReference.id,
      template,
    });
  }

  return { accepted: true };
});

exports.auditLaunchEmailRecipients = onCall(
  { region: REGION, timeoutSeconds: 300 },
  async (request) => {
    const admin = await requireApprovedAdmin(request);
    requirePayload(request.data, []);
    let audit;

    try {
      audit = await buildRecipientAudit(admin.db);
    } catch {
      throw new HttpsError(
        "internal",
        "The launch recipient audit could not be completed."
      );
    }

    const now = Timestamp.now();
    const reference = admin.db.collection(AUDIT_COLLECTION).doc();
    await reference.create({
      campaignId: CAMPAIGN_ID,
      completedAt: now,
      completedByUid: admin.uid,
      counts: audit.counts,
      expiresAt: Timestamp.fromMillis(now.toMillis() + AUDIT_TTL_MS),
      recipientSetHash: audit.recipientSetHash,
    });

    return {
      auditId: reference.id,
      counts: audit.counts,
      expiresAt: new Date(now.toMillis() + AUDIT_TTL_MS).toISOString(),
    };
  }
);

exports.startLaunchEmailCampaign = onCall(
  { region: REGION, timeoutSeconds: 300 },
  async (request) => {
    const admin = await requireApprovedAdmin(request);
    validateStartRequest(request.data);
    const { app } = getAdminServices();
    const auditReference = admin.db
      .collection(AUDIT_COLLECTION)
      .doc(request.data.auditId.trim());
    const auditSnapshot = await auditReference.get();
    const auditRecord = auditSnapshot.exists ? auditSnapshot.data() : null;

    if (
      !auditRecord ||
      auditRecord.campaignId !== CAMPAIGN_ID ||
      auditRecord.completedByUid !== admin.uid ||
      !auditRecord.expiresAt?.toMillis ||
      auditRecord.expiresAt.toMillis() <= Date.now()
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Run a fresh recipient audit before starting the campaign."
      );
    }

    let currentAudit;
    try {
      currentAudit = await buildRecipientAudit(admin.db);
    } catch {
      throw new HttpsError(
        "internal",
        "The recipient list could not be verified."
      );
    }

    if (
      currentAudit.eligibleRecipients.length === 0 ||
      currentAudit.recipientSetHash !== auditRecord.recipientSetHash
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The recipient list changed. Run a fresh audit and review the counts."
      );
    }

    const campaignReference = admin.db
      .collection(CAMPAIGN_COLLECTION)
      .doc(CAMPAIGN_ID);
    const batches = splitIntoBatches(currentAudit.eligibleRecipients);

    await admin.db.runTransaction(async (transaction) => {
      const campaignSnapshot = await transaction.get(campaignReference);
      if (campaignSnapshot.exists) {
        throw new HttpsError(
          "already-exists",
          "The launch campaign has already been started."
        );
      }

      transaction.create(campaignReference, {
        accepted: 0,
        auditCounts: currentAudit.counts,
        auditId: auditReference.id,
        campaignId: CAMPAIGN_ID,
        completed: false,
        completedBatches: 0,
        createdAt: FieldValue.serverTimestamp(),
        createdByEmail: admin.email || null,
        createdByUid: admin.uid,
        eligibleTotal: currentAudit.eligibleRecipients.length,
        failed: 0,
        pending: currentAudit.eligibleRecipients.length,
        phase: "initial",
        retryRun: 0,
        runId: "initial",
        skipped: 0,
        siteUrl: EXPECTED_SITE_URL,
        status: "queueing",
        subject: "Tufffinds is now live",
        totalBatches: batches.length,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    try {
      await enqueueBatches({ app, batches, mode: "initial", runId: "initial" });
      await campaignReference.update({
        status: "running",
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch {
      await campaignReference.update({
        status: "queue_error",
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.error("Launch campaign tasks could not be queued.", {
        campaignId: CAMPAIGN_ID,
      });
      throw new HttpsError(
        "internal",
        "The campaign could not be queued. No manual retry should be attempted until the campaign status is reviewed."
      );
    }

    return { started: true, campaignId: CAMPAIGN_ID };
  }
);

exports.getLaunchEmailCampaignStatus = onCall(
  { region: REGION },
  async (request) => {
    const admin = await requireApprovedAdmin(request);
    requirePayload(request.data, []);
    const snapshot = await admin.db
      .collection(CAMPAIGN_COLLECTION)
      .doc(CAMPAIGN_ID)
      .get();
    return safeCampaignStatus(admin.db, snapshot);
  }
);

async function markSuppressedFailedDeliveries(db, references) {
  for (let index = 0; index < references.length; index += 400) {
    const batch = db.batch();
    for (const reference of references.slice(index, index + 400)) {
      batch.update(reference, {
        skippedAt: FieldValue.serverTimestamp(),
        status: "skipped",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

exports.retryFailedLaunchEmailCampaign = onCall(
  { region: REGION, timeoutSeconds: 300 },
  async (request) => {
    const admin = await requireApprovedAdmin(request);
    requirePayload(request.data, ["confirmationPhrase", "finalConfirmation"]);
    if (
      request.data?.confirmationPhrase !== RETRY_CONFIRMATION_PHRASE ||
      request.data?.finalConfirmation !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The failed-recipient retry confirmation is incomplete."
      );
    }

    const { app } = getAdminServices();
    const campaignReference = admin.db
      .collection(CAMPAIGN_COLLECTION)
      .doc(CAMPAIGN_ID);
    const campaignSnapshot = await campaignReference.get();
    const campaign = campaignSnapshot.exists ? campaignSnapshot.data() : null;

    if (
      !campaign ||
      !["completed", "completed_with_failures"].includes(campaign.status) ||
      Number(campaign.failed || 0) < 1
    ) {
      throw new HttpsError(
        "failed-precondition",
        "There are no completed failed deliveries available to retry."
      );
    }

    const [audit, deliverySnapshot] = await Promise.all([
      buildRecipientAudit(admin.db),
      admin.db
        .collection(DELIVERY_COLLECTION)
        .where("campaignId", "==", CAMPAIGN_ID)
        .get(),
    ]);
    const eligibleByHash = new Map(
      audit.eligibleRecipients.map((recipient) => [recipient.hash, recipient])
    );
    const retryRecipients = [];
    const suppressedReferences = [];

    for (const document of deliverySnapshot.docs) {
      const delivery = document.data();
      if (delivery.status !== "failed") continue;

      const recipient = eligibleByHash.get(delivery.recipientHash);
      if (recipient) retryRecipients.push(recipient);
      else suppressedReferences.push(document.ref);
    }

    const retryRun = Number(campaign.retryRun || 0) + 1;
    const runId = `retry-${retryRun}`;

    await admin.db.runTransaction(async (transaction) => {
      const freshSnapshot = await transaction.get(campaignReference);
      const fresh = freshSnapshot.data();
      if (
        !fresh ||
        !["completed", "completed_with_failures"].includes(fresh.status) ||
        Number(fresh.retryRun || 0) !== retryRun - 1
      ) {
        throw new HttpsError(
          "failed-precondition",
          "The campaign is already running or cannot be retried."
        );
      }

      transaction.update(campaignReference, {
        completed: false,
        completedAt: null,
        phase: "retry",
        retryRun,
        runId,
        status: "preparing_retry",
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    try {
      await markSuppressedFailedDeliveries(admin.db, suppressedReferences);
    } catch {
      await campaignReference.update({
        status: "queue_error",
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError(
        "internal",
        "Suppressed failed recipients could not be safely prepared for retry."
      );
    }

    if (retryRecipients.length === 0) {
      await campaignReference.update({
        completed: true,
        completedAt: FieldValue.serverTimestamp(),
        failed: 0,
        lastRetryAt: FieldValue.serverTimestamp(),
        lastRetryByEmail: admin.email || null,
        pending: 0,
        skipped: FieldValue.increment(suppressedReferences.length),
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { started: false, noEligibleFailures: true };
    }

    const batches = splitIntoBatches(retryRecipients);
    await campaignReference.update({
      completedBatches: 0,
      failed: retryRecipients.length,
      lastRetryAt: FieldValue.serverTimestamp(),
      lastRetryByEmail: admin.email || null,
      pending: retryRecipients.length,
      skipped: FieldValue.increment(suppressedReferences.length),
      status: "queueing_retry",
      totalBatches: batches.length,
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      await enqueueBatches({ app, batches, mode: "retry", runId });
      await campaignReference.update({
        status: "retrying",
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch {
      await campaignReference.update({
        status: "queue_error",
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.error("Failed-recipient retry tasks could not be queued.", {
        campaignId: CAMPAIGN_ID,
        retryRun,
      });
      throw new HttpsError(
        "internal",
        "The failed-recipient retry could not be queued."
      );
    }

    return { started: true, campaignId: CAMPAIGN_ID };
  }
);

async function claimDelivery({ db, mode, recipient, runId }) {
  const reference = db
    .collection(DELIVERY_COLLECTION)
    .doc(`${CAMPAIGN_ID}_${recipient.hash}`);

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const delivery = snapshot.exists ? snapshot.data() : null;

    if (mode === "retry") {
      if (delivery?.status === "pending" && delivery.runId === runId) {
        return { action: "deliver", reference };
      }
      if (delivery?.status !== "failed") {
        return { action: "skipped", reference };
      }

      transaction.update(reference, {
        attempts: FieldValue.increment(1),
        runId,
        status: "pending",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { action: "deliver", reference };
    }

    if (delivery?.status === "pending" && delivery.runId === runId) {
      return { action: "deliver", reference };
    }
    if (snapshot.exists) return { action: "skipped", reference };

    transaction.create(reference, {
      attempts: 1,
      campaignId: CAMPAIGN_ID,
      createdAt: FieldValue.serverTimestamp(),
      recipientHash: recipient.hash,
      runId,
      status: "pending",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { action: "deliver", reference };
  });

  return result;
}

async function deliverCampaignRecipient({ db, email, mode, recipient, resend, runId }) {
  const claim = await claimDelivery({ db, mode, recipient, runId });
  if (claim.action === "skipped") return "skipped";

  try {
    const response = await resend.emails.send(
      {
        from: SENDER,
        to: recipient.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      },
      { idempotencyKey: `${CAMPAIGN_ID}/${recipient.hash}` }
    );

    if (response.error || !response.data?.id) {
      throw new Error("Campaign email was not accepted.");
    }

    await claim.reference.update({
      acceptedAt: FieldValue.serverTimestamp(),
      providerMessageId: response.data.id,
      status: "accepted",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "accepted";
  } catch (error) {
    const failureCode = error?.message === "Campaign email was not accepted."
      ? "provider_rejected"
      : "delivery_error";
    await claim.reference.update({
      failedAt: FieldValue.serverTimestamp(),
      failureCode,
      status: "failed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return "failed";
  }
}

async function recordCompletedBatch({
  batchId,
  batchSize,
  db,
  mode,
  results,
  runId,
}) {
  const campaignReference = db
    .collection(CAMPAIGN_COLLECTION)
    .doc(CAMPAIGN_ID);
  const batchReference = db.collection(BATCH_COLLECTION).doc(batchId);

  await db.runTransaction(async (transaction) => {
    const [campaignSnapshot, batchSnapshot] = await Promise.all([
      transaction.get(campaignReference),
      transaction.get(batchReference),
    ]);
    if (batchSnapshot.exists) return;

    const campaign = campaignSnapshot.data();
    if (!campaign || campaign.campaignId !== CAMPAIGN_ID) return;

    const totals = { accepted: 0, failed: 0, skipped: 0 };
    for (const result of results) totals[result] += 1;

    const completedBatches = Number(campaign.completedBatches || 0) + 1;
    const totalBatches = Number(campaign.totalBatches || 0);
    const finalBatch = completedBatches >= totalBatches;
    const accepted =
      Number(campaign.accepted || 0) + totals.accepted;
    const failed =
      mode === "retry"
        ? Math.max(0, Number(campaign.failed || 0) - totals.accepted)
        : Number(campaign.failed || 0) + totals.failed;
    const skipped =
      Number(campaign.skipped || 0) +
      (mode === "initial" ? totals.skipped : 0);

    transaction.create(batchReference, {
      accepted: totals.accepted,
      batchSize,
      campaignId: CAMPAIGN_ID,
      completedAt: FieldValue.serverTimestamp(),
      failed: totals.failed,
      mode,
      runId,
      skipped: totals.skipped,
    });
    transaction.update(campaignReference, {
      accepted,
      completed: finalBatch,
      completedAt: finalBatch ? FieldValue.serverTimestamp() : null,
      completedBatches,
      failed,
      pending: Math.max(0, Number(campaign.pending || 0) - batchSize),
      skipped,
      status: finalBatch
        ? failed > 0
          ? "completed_with_failures"
          : "completed"
        : mode === "retry"
          ? "retrying"
          : "running",
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

exports.processLaunchEmailCampaignBatch = onTaskDispatched(
  {
    invoker: "private",
    maxInstances: 1,
    rateLimits: {
      maxConcurrentDispatches: 1,
      maxDispatchesPerSecond: 1,
    },
    region: REGION,
    retryConfig: {
      maxAttempts: 3,
      maxBackoffSeconds: 60,
      maxRetrySeconds: 900,
      minBackoffSeconds: 5,
    },
    timeoutSeconds: 300,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new Error("Task authentication is required.");
    }

    const { batchIndex, campaignId, mode, recipients, runId } = request.data || {};
    if (
      !request.data ||
      typeof request.data !== "object" ||
      Array.isArray(request.data) ||
      Object.keys(request.data).some(
        (key) =>
          !["batchIndex", "campaignId", "mode", "recipients", "runId"].includes(
            key
          )
      ) ||
      campaignId !== CAMPAIGN_ID ||
      !["initial", "retry"].includes(mode) ||
      typeof runId !== "string" ||
      !/^(initial|retry-[1-9][0-9]*)$/.test(runId) ||
      !Number.isInteger(batchIndex) ||
      batchIndex < 0 ||
      !Array.isArray(recipients) ||
      recipients.length < 1 ||
      recipients.length > CAMPAIGN_BATCH_SIZE ||
      recipients.some(
        (recipient) =>
          !recipient ||
          typeof recipient !== "object" ||
          Array.isArray(recipient) ||
          Object.keys(recipient).some(
            (key) => !["email", "hash"].includes(key)
          ) ||
          normalizeEmail(recipient?.email) !== recipient?.email ||
          recipientHash(recipient.email) !== recipient?.hash
      )
    ) {
      throw new Error("Invalid campaign task payload.");
    }

    const { db } = getAdminServices();
    const campaignSnapshot = await db
      .collection(CAMPAIGN_COLLECTION)
      .doc(CAMPAIGN_ID)
      .get();
    const campaign = campaignSnapshot.exists ? campaignSnapshot.data() : null;
    const allowedStatuses =
      mode === "retry" ? ["queueing_retry", "retrying"] : ["queueing", "running"];

    if (
      !campaign ||
      campaign.phase !== mode ||
      campaign.runId !== runId ||
      !allowedStatuses.includes(campaign.status)
    ) {
      return;
    }

    const batchId = crypto
      .createHash("sha256")
      .update(`${CAMPAIGN_ID}:${runId}:${batchIndex}`)
      .digest("hex");
    const existingBatch = await db.collection(BATCH_COLLECTION).doc(batchId).get();
    if (existingBatch.exists) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("Campaign email delivery is not configured.");

    const resend = new Resend(apiKey);
    const email = buildEmailTemplate("launch");
    const results = [];

    for (const recipient of recipients) {
      results.push(
        await deliverCampaignRecipient({
          db,
          email,
          mode,
          recipient,
          resend,
          runId,
        })
      );
    }

    await recordCompletedBatch({
      batchId,
      batchSize: recipients.length,
      db,
      mode,
      results,
      runId,
    });

    logger.info("Launch campaign batch completed.", {
      batchIndex,
      batchSize: recipients.length,
      campaignId: CAMPAIGN_ID,
      mode,
    });
  }
);

exports._test = {
  requireApprovedAdmin,
  safeCampaignStatus,
  splitIntoBatches,
  validateStartRequest,
};
