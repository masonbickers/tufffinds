"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "@/app/lib/firebase";
import AdminShell from "../_components/AdminShell";

type TemplateName = "welcome" | "launch";
type PreviewMode = "html" | "text";

type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type AuditCounts = {
  newsletterRecords: number;
  waitlistRecords: number;
  totalRecords: number;
  invalidRecords: number;
  optedOutRecords: number;
  duplicateRecords: number;
  uniqueValidContacts: number;
  suppressedUniqueContacts: number;
  eligibleUniqueContacts: number;
};

type AuditResult = {
  auditId: string;
  counts: AuditCounts;
  expiresAt: string;
};

type CampaignStatus = {
  exists: boolean;
  campaignId: string;
  subject?: string;
  status: string;
  pending: number;
  accepted: number;
  failed: number;
  skipped: number;
  retried: number;
  completed: boolean;
  eligibleTotal?: number;
  phase?: string;
  retryRun?: number;
  createdAt?: string | null;
  completedAt?: string | null;
  initiatedBy?: string;
  lastRetryAt?: string | null;
  failureReasons: Array<{ code: string; count: number }>;
  updatedAt?: string | null;
};

const LAUNCH_CONFIRMATION = "SEND TUFFFINDS LAUNCH";
const RETRY_CONFIRMATION = "RETRY FAILED LAUNCH EMAILS";
const SITE_URL = "https://tufffinds.com";

const previewTemplate = httpsCallable<
  { template: TemplateName },
  EmailTemplate
>(functions, "previewAdminEmailTemplate");
const sendTest = httpsCallable<
  { template: TemplateName; recipient?: string },
  { accepted: boolean }
>(functions, "sendAdminTestEmail");
const auditRecipients = httpsCallable<Record<string, never>, AuditResult>(
  functions,
  "auditLaunchEmailRecipients",
);
const startCampaign = httpsCallable<
  {
    auditId: string;
    confirmationPhrase: string;
    finalConfirmation: boolean;
    siteUrl: string;
  },
  { campaignId: string; started: boolean }
>(functions, "startLaunchEmailCampaign");
const readCampaignStatus = httpsCallable<
  Record<string, never>,
  CampaignStatus
>(functions, "getLaunchEmailCampaignStatus");
const retryCampaign = httpsCallable<
  { confirmationPhrase: string; finalConfirmation: boolean },
  { campaignId?: string; noEligibleFailures?: boolean; started: boolean }
>(functions, "retryFailedLaunchEmailCampaign");

export default function EmailCampaignsPage() {
  const [activeTemplate, setActiveTemplate] =
    useState<TemplateName>("welcome");
  const [templates, setTemplates] = useState<
    Partial<Record<TemplateName, EmailTemplate>>
  >({});
  const [previewError, setPreviewError] = useState("");
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(true);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | null>(
    null,
  );
  const [statusError, setStatusError] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      const result = await readCampaignStatus({});
      setCampaignStatus(result.data);
      setStatusError("");
    } catch {
      setStatusError("Campaign status could not be loaded.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProtectedData() {
      setIsLoadingPreviews(true);
      try {
        const [welcomeResult, launchResult] = await Promise.all([
          previewTemplate({ template: "welcome" }),
          previewTemplate({ template: "launch" }),
        ]);
        if (cancelled) return;
        setTemplates({
          welcome: welcomeResult.data,
          launch: launchResult.data,
        });
        setPreviewError("");
      } catch {
        if (cancelled) return;
        setPreviewError(
          "Email previews are unavailable until the protected Functions are deployed and reachable.",
        );
      } finally {
        if (!cancelled) setIsLoadingPreviews(false);
      }
    }

    void loadProtectedData();
    void refreshStatus();

    return () => {
      cancelled = true;
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (
      !campaignStatus ||
      !["queueing", "running", "queueing_retry", "retrying"].includes(
        campaignStatus.status,
      )
    ) {
      return;
    }

    const timer = window.setInterval(() => void refreshStatus(), 8000);
    return () => window.clearInterval(timer);
  }, [campaignStatus, refreshStatus]);

  const activeEmail = templates[activeTemplate];

  return (
    <AdminShell active="email-campaigns">
      <div className="space-y-7">
        <header>
          <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
            Email operations
          </p>
          <h1 className="mt-3 font-serif text-4xl text-[#241E1A]">
            Email campaigns
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">
            Review the exact customer emails, send controlled admin tests and
            manage the protected one-time website launch campaign.
          </p>
        </header>

        <div
          className="grid gap-2 rounded-2xl border border-[#DED2C5] bg-[#FBF7F2] p-2 sm:grid-cols-2"
          role="tablist"
          aria-label="Email template"
        >
          <TemplateTab
            active={activeTemplate === "welcome"}
            label="Welcome email"
            onClick={() => setActiveTemplate("welcome")}
          />
          <TemplateTab
            active={activeTemplate === "launch"}
            label="Website launch email"
            onClick={() => setActiveTemplate("launch")}
          />
        </div>

        {isLoadingPreviews ? (
          <StatePanel
            title="Loading protected previews"
            body="Generating the exact email HTML and plain text on the server."
          />
        ) : null}

        {!isLoadingPreviews && previewError ? (
          <StatePanel title="Previews unavailable" body={previewError} tone="error" />
        ) : null}

        {!isLoadingPreviews && activeEmail ? (
          <>
            <TemplatePreview
              email={activeEmail}
              template={activeTemplate}
            />

            <TestEmailPanel template={activeTemplate} />

            {activeTemplate === "welcome" ? <WelcomeDeliveryNote /> : null}
            {activeTemplate === "launch" ? (
              <LaunchCampaignPanel
                campaignStatus={campaignStatus}
                onStatusRefresh={refreshStatus}
                statusError={statusError}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

function TemplateTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-3 text-sm font-semibold transition",
        active
          ? "bg-[#40342F] text-white shadow-sm"
          : "text-[#5B493D] hover:bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function TemplatePreview({
  email,
  template,
}: {
  email: EmailTemplate;
  template: TemplateName;
}) {
  const [mode, setMode] = useState<PreviewMode>("html");

  return (
    <section className="rounded-[24px] border border-[#DED2C5] bg-[#FCFAF6] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/40">
            Preview only
          </p>
          <h2 className="mt-2 font-serif text-3xl text-[#241E1A]">
            {template === "welcome" ? "Welcome email" : "Website launch email"}
          </h2>
          <p className="mt-3 text-sm text-black/55">
            Subject: <span className="font-semibold text-[#241E1A]">{email.subject}</span>
          </p>
        </div>

        <div className="inline-flex self-start rounded-xl border border-[#DED2C5] bg-white p-1">
          {(["html", "text"] as const).map((previewMode) => (
            <button
              key={previewMode}
              type="button"
              onClick={() => setMode(previewMode)}
              className={[
                "rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]",
                mode === previewMode
                  ? "bg-[#40342F] text-white"
                  : "text-black/50",
              ].join(" ")}
            >
              {previewMode === "html" ? "HTML" : "Plain text"}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-black/45">
        The previews below come from the same protected builder used for real
        delivery. Links remain contained inside the sandboxed preview.
      </p>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <EmailPreviewViewport
          email={email}
          label="Desktop preview"
          mode={mode}
          width="100%"
        />
        <EmailPreviewViewport
          email={email}
          label="Mobile preview · 390px"
          mode={mode}
          width="390px"
        />
      </div>
    </section>
  );
}

function EmailPreviewViewport({
  email,
  label,
  mode,
  width,
}: {
  email: EmailTemplate;
  label: string;
  mode: PreviewMode;
  width: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
        {label}
      </p>
      <div className="overflow-auto rounded-2xl border border-[#D8C9B7] bg-[#EFE7DC] p-3">
        <div style={{ width, maxWidth: "100%", margin: "0 auto" }}>
          {mode === "html" ? (
            <iframe
              title={label}
              sandbox=""
              srcDoc={email.html}
              className="h-[680px] w-full rounded-xl border-0 bg-white"
            />
          ) : (
            <pre className="h-[680px] overflow-auto whitespace-pre-wrap rounded-xl bg-white p-5 font-sans text-sm leading-6 text-[#241E1A]">
              {email.text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function TestEmailPanel({ template }: { template: TemplateName }) {
  const [recipient, setRecipient] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setRecipient(auth.currentUser?.email || "");
    setFeedback("");
    setIsError(false);
  }, [template]);

  async function handleSendTest() {
    if (isSending) return;
    setIsSending(true);
    setFeedback("");
    setIsError(false);

    try {
      await sendTest({ template, recipient: recipient.trim() || undefined });
      setFeedback("One test email was accepted for delivery.");
    } catch (error) {
      setIsError(true);
      setFeedback(
        safeCallableMessage(
          error,
          "The test email could not be sent. Check the approved admin recipient and Functions configuration.",
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[#DED2C5] bg-white p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/40">
        Test email
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">
        Send one protected test
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-black/58">
        Test emails go only to the selected approved admin. The subject is
        prefixed with [TEST], and each admin is limited to five attempts per
        rolling hour.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label>
          <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-black/40">
            Approved admin email
          </span>
          <input
            type="email"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            className="w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm text-[#241E1A] outline-none focus:border-[#B59674]"
            placeholder="Signed-in admin email"
            autoComplete="email"
          />
        </label>
        <button
          type="button"
          disabled={isSending}
          onClick={() => void handleSendTest()}
          className="rounded-xl bg-[#40342F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2F2723] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSending ? "Sending one test…" : "Send test email"}
        </button>
      </div>

      {feedback ? (
        <p
          className={`mt-4 text-sm ${isError ? "text-[#9F3A2A]" : "text-[#2F5A34]"}`}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </section>
  );
}

function WelcomeDeliveryNote() {
  return (
    <section className="rounded-[24px] border border-[#D5C4B3] bg-[#F7F1EA] p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7A5D46]">
        Automatic delivery
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">
        New signups only
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-black/60">
        This welcome email is designed to run only when a new document is
        created in newsletter_signups or waitlist. There is no bulk-send
        control here, so existing contacts cannot receive it from this page.
      </p>
      <p className="mt-3 max-w-3xl text-xs leading-5 text-black/48">
        Deployment status is not inferred by this page. Confirm
        sendNewsletterWelcomeEmail and sendWaitlistWelcomeEmail in Firebase
        before relying on automatic delivery.
      </p>
    </section>
  );
}

function LaunchCampaignPanel({
  campaignStatus,
  onStatusRefresh,
  statusError,
}: {
  campaignStatus: CampaignStatus | null;
  onStatusRefresh: () => Promise<void>;
  statusError: string;
}) {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startFeedback, setStartFeedback] = useState("");
  const [retryPhrase, setRetryPhrase] = useState("");
  const [retryFinal, setRetryFinal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const campaignAlreadyExists = Boolean(campaignStatus?.exists);
  const launchRequirementsMet = Boolean(
    audit &&
      audit.counts.eligibleUniqueContacts > 0 &&
      confirmation === LAUNCH_CONFIRMATION &&
      !campaignAlreadyExists,
  );
  const canRetry = Boolean(
    campaignStatus?.exists &&
      campaignStatus.failed > 0 &&
      ["completed", "completed_with_failures"].includes(
        campaignStatus.status,
      ),
  );

  async function handleAudit() {
    if (isAuditing) return;
    setIsAuditing(true);
    setAuditError("");
    setShowFinalConfirmation(false);
    setStartFeedback("");

    try {
      const result = await auditRecipients({});
      setAudit(result.data);
    } catch (error) {
      setAudit(null);
      setAuditError(
        safeCallableMessage(
          error,
          "The recipient audit could not be completed. No addresses were returned to this page.",
        ),
      );
    } finally {
      setIsAuditing(false);
    }
  }

  async function handleStart() {
    if (!audit || !launchRequirementsMet || isStarting) return;
    setIsStarting(true);
    setStartFeedback("");

    try {
      await startCampaign({
        auditId: audit.auditId,
        confirmationPhrase: confirmation,
        finalConfirmation: true,
        siteUrl: SITE_URL,
      });
      setStartFeedback("The protected launch campaign was queued.");
      setShowFinalConfirmation(false);
      await onStatusRefresh();
    } catch (error) {
      setStartFeedback(
        safeCallableMessage(
          error,
          "The launch campaign did not start. Review the audit and campaign status before trying any further action.",
        ),
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function handleRetry() {
    if (
      !canRetry ||
      retryPhrase !== RETRY_CONFIRMATION ||
      !retryFinal ||
      isRetrying
    ) {
      return;
    }

    setIsRetrying(true);
    setStartFeedback("");
    try {
      const result = await retryCampaign({
        confirmationPhrase: retryPhrase,
        finalConfirmation: true,
      });
      setStartFeedback(
        result.data.noEligibleFailures
          ? "No failed recipients remained eligible; no retry emails were queued."
          : "The failed-recipient-only retry was queued.",
      );
      setRetryPhrase("");
      setRetryFinal(false);
      await onStatusRefresh();
    } catch (error) {
      setStartFeedback(
        safeCallableMessage(
          error,
          "The failed-recipient retry did not start.",
        ),
      );
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-[#DED2C5] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/40">
              Recipient audit
            </p>
            <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">
              Existing consenting contacts
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-black/58">
              Counts are calculated on the server. Email addresses never load
              into this browser.
            </p>
          </div>
          <button
            type="button"
            disabled={isAuditing || campaignAlreadyExists}
            onClick={() => void handleAudit()}
            className="rounded-xl border border-[#40342F] px-5 py-3 text-sm font-semibold text-[#40342F] transition hover:bg-[#F7F1EA] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isAuditing ? "Auditing…" : "Audit eligible recipients"}
          </button>
        </div>

        {audit ? <AuditGrid counts={audit.counts} /> : null}
        {auditError ? (
          <p className="mt-4 text-sm text-[#9F3A2A]" role="alert">
            {auditError}
          </p>
        ) : null}
      </section>

      <CampaignProgress
        campaignStatus={campaignStatus}
        onRefresh={onStatusRefresh}
        statusError={statusError}
      />

      {campaignStatus?.exists ? (
        <CampaignHistory campaignStatus={campaignStatus} />
      ) : null}

      <section className="rounded-[24px] border border-[#C8A99A] bg-[#FFF8F4] p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9F3A2A]">
          Production launch campaign
        </p>
        <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">
          One-time irreversible action
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-black/62">
          The launch action emails all eligible existing signups and cannot be
          undone. It is locked to {SITE_URL}, requires a fresh audit and cannot
          be started after a campaign record exists.
        </p>

        <div className="mt-5 rounded-2xl border border-[#E3CFC4] bg-white p-4">
          <p className="text-xs font-semibold text-[#241E1A]">
            Type exactly: {LAUNCH_CONFIRMATION}
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setShowFinalConfirmation(false);
            }}
            disabled={campaignAlreadyExists}
            className="mt-3 w-full rounded-xl border border-[#DED2C5] px-4 py-3 text-sm outline-none focus:border-[#B59674] disabled:bg-black/5"
            aria-label="Launch confirmation phrase"
          />
          <button
            type="button"
            disabled={!launchRequirementsMet}
            onClick={() => setShowFinalConfirmation(true)}
            className="mt-3 rounded-xl border border-[#9F3A2A] px-5 py-3 text-sm font-semibold text-[#9F3A2A] transition hover:bg-[#FFF2EC] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Review launch confirmation
          </button>
        </div>

        {showFinalConfirmation ? (
          <div className="mt-4 rounded-2xl border-2 border-[#9F3A2A] bg-white p-5">
            <p className="font-semibold text-[#9F3A2A]">
              Final confirmation
            </p>
            <p className="mt-2 text-sm leading-6 text-black/60">
              This starts a server-managed campaign for {audit?.counts.eligibleUniqueContacts ?? 0} eligible recipients. Successful recipients can never be resent by this workflow.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isStarting}
                onClick={() => void handleStart()}
                className="rounded-xl bg-[#9F3A2A] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isStarting ? "Starting campaign…" : "Start launch campaign"}
              </button>
              <button
                type="button"
                disabled={isStarting}
                onClick={() => setShowFinalConfirmation(false)}
                className="rounded-xl border border-[#DED2C5] px-5 py-3 text-sm font-semibold text-[#40342F]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {campaignAlreadyExists ? (
          <p className="mt-4 text-sm font-medium text-[#7A5D46]">
            A launch campaign record already exists. Starting another campaign
            is disabled.
          </p>
        ) : null}
        {startFeedback ? (
          <p className="mt-4 text-sm text-[#5B493D]" role="status">
            {startFeedback}
          </p>
        ) : null}
      </section>

      {canRetry ? (
        <section className="rounded-[24px] border border-[#DED2C5] bg-[#FBF7F2] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/40">
            Failed recipients only
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">
            Protected retry
          </h2>
          <p className="mt-3 text-sm leading-6 text-black/58">
            This action rebuilds eligibility, skips contacts who have opted out
            and retries only failed delivery records. Accepted recipients are
            never resent.
          </p>
          <p className="mt-4 text-xs font-semibold text-[#241E1A]">
            Type exactly: {RETRY_CONFIRMATION}
          </p>
          <input
            type="text"
            value={retryPhrase}
            onChange={(event) => setRetryPhrase(event.target.value)}
            className="mt-3 w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-sm outline-none focus:border-[#B59674]"
            aria-label="Failed-recipient retry phrase"
          />
          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-black/60">
            <input
              type="checkbox"
              checked={retryFinal}
              onChange={(event) => setRetryFinal(event.target.checked)}
              className="mt-1"
            />
            I confirm this retry is limited to currently eligible failed
            recipients.
          </label>
          <button
            type="button"
            disabled={
              retryPhrase !== RETRY_CONFIRMATION || !retryFinal || isRetrying
            }
            onClick={() => void handleRetry()}
            className="mt-4 rounded-xl bg-[#40342F] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isRetrying ? "Queueing failed-only retry…" : "Retry failed recipients"}
          </button>
        </section>
      ) : null}
    </div>
  );
}

function AuditGrid({ counts }: { counts: AuditCounts }) {
  const items = [
    ["Eligible recipients", counts.eligibleUniqueContacts],
    ["Suppressed contacts", counts.suppressedUniqueContacts],
    ["Newsletter records", counts.newsletterRecords],
    ["Waitlist records", counts.waitlistRecords],
    ["Duplicates removed", counts.duplicateRecords],
    ["Invalid records", counts.invalidRecords],
    ["Suppression markers", counts.optedOutRecords],
  ] as const;

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="rounded-2xl border border-[#E7DCCF] bg-[#FBF7F2] p-4"
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#241E1A]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function CampaignProgress({
  campaignStatus,
  onRefresh,
  statusError,
}: {
  campaignStatus: CampaignStatus | null;
  onRefresh: () => Promise<void>;
  statusError: string;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const progress = useMemo(
    () => [
      ["Pending", campaignStatus?.pending ?? 0],
      ["Accepted", campaignStatus?.accepted ?? 0],
      ["Failed", campaignStatus?.failed ?? 0],
      ["Retried", campaignStatus?.retried ?? 0],
      ["Skipped", campaignStatus?.skipped ?? 0],
    ],
    [campaignStatus],
  );

  async function refresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[#DED2C5] bg-[#FCFAF6] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/40">
            Campaign status
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">
            {!campaignStatus && !statusError
              ? "Loading status…"
              : formatCampaignStatus(campaignStatus?.status)}
          </h2>
        </div>
        <button
          type="button"
          disabled={isRefreshing}
          onClick={() => void refresh()}
          className="rounded-xl border border-[#DED2C5] bg-white px-4 py-2 text-xs font-semibold text-[#40342F]"
        >
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {progress.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#E7DCCF] bg-white p-4">
            <p className="text-[9px] uppercase tracking-[0.2em] text-black/40">
              {label}
            </p>
            <p className="mt-2 text-xl font-semibold text-[#241E1A]">{value}</p>
          </div>
        ))}
      </div>
      {statusError ? (
        <p className="mt-4 text-sm text-[#9F3A2A]" role="alert">
          {statusError}
        </p>
      ) : null}
      {campaignStatus?.failureReasons.length ? (
        <div className="mt-4 rounded-2xl border border-[#D8B6A7] bg-[#FFF8F4] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9F3A2A]">
            Safe failure summary
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[#7A3E31]">
            {campaignStatus.failureReasons.map((reason) => (
              <li key={reason.code}>
                {formatFailureReason(reason.code)}: {reason.count}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function CampaignHistory({ campaignStatus }: { campaignStatus: CampaignStatus }) {
  return (
    <section className="rounded-[24px] border border-[#DED2C5] bg-white p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/40">
        Campaign history
      </p>
      <h2 className="mt-2 font-serif text-2xl text-[#241E1A]">
        Preserved launch record
      </h2>
      <div className="mt-5 grid gap-4 rounded-2xl border border-[#E7DCCF] bg-[#FBF7F2] p-4 sm:grid-cols-2 xl:grid-cols-4">
        <HistoryItem label="Campaign" value={campaignStatus.subject || "Tufffinds website launch"} />
        <HistoryItem label="Started" value={formatDateTime(campaignStatus.createdAt)} />
        <HistoryItem label="Completed" value={formatDateTime(campaignStatus.completedAt)} />
        <HistoryItem label="Initiated by" value={campaignStatus.initiatedBy || "Approved administrator"} />
        <HistoryItem label="State" value={formatCampaignStatus(campaignStatus.status)} />
        <HistoryItem label="Eligible at launch" value={String(campaignStatus.eligibleTotal ?? 0)} />
        <HistoryItem label="Accepted" value={String(campaignStatus.accepted)} />
        <HistoryItem label="Retry runs" value={String(campaignStatus.retryRun ?? 0)} />
      </div>
      {campaignStatus.lastRetryAt ? (
        <p className="mt-3 text-xs text-black/45">
          Last retry action: {formatDateTime(campaignStatus.lastRetryAt)}
        </p>
      ) : null}
    </section>
  );
}

function HistoryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.18em] text-black/40">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#241E1A]">{value}</p>
    </div>
  );
}

function StatePanel({
  body,
  title,
  tone = "neutral",
}: {
  body: string;
  title: string;
  tone?: "neutral" | "error";
}) {
  return (
    <section
      className={`rounded-[24px] border p-8 text-center ${
        tone === "error"
          ? "border-[#D8B6A7] bg-[#FFF8F4]"
          : "border-[#DED2C5] bg-[#FBF7F2]"
      }`}
    >
      <h2 className="font-serif text-2xl text-[#241E1A]">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-black/55">
        {body}
      </p>
    </section>
  );
}

function safeCallableMessage(error: unknown, fallback: string) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

  if (code.endsWith("resource-exhausted")) {
    return "The five-per-hour test-email limit has been reached. Try again later.";
  }
  if (code.endsWith("permission-denied")) {
    return "This action requires an approved active Tufffinds admin account.";
  }
  if (code.endsWith("already-exists")) {
    return "The launch campaign has already been started and cannot be created again.";
  }
  if (code.endsWith("unauthenticated")) {
    return "Your admin session has expired. Sign in again before continuing.";
  }

  return fallback;
}

function formatCampaignStatus(status?: string) {
  if (!status || status === "not_started") return "Not started";
  return status
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatFailureReason(code: string) {
  return code === "provider_rejected"
    ? "Provider did not accept delivery"
    : "Delivery processing error";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not completed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
