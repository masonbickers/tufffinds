"use client";

import { useEffect, useState } from "react";
import { updateProfile } from "firebase/auth";
import AdminShell from "../_components/AdminShell";
import { useAdminSession } from "../_components/AdminGuard";
import {
  AdminPage,
  AdminPageHeader,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../_components/AdminUI";

const HIDE_TEST_RECORDS_KEY = "tufffinds.admin.hideLikelyTests";

type Feedback = {
  tone: "idle" | "success" | "error";
  message: string;
};

export default function AdminSettingsPage() {
  const { signOut, signOutError, user } = useAdminSession();
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [hideLikelyTests, setHideLikelyTests] = useState(true);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>({
    tone: "idle",
    message: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(HIDE_TEST_RECORDS_KEY);
    if (stored !== null) setHideLikelyTests(stored !== "false");
  }, []);

  function updateDashboardPreference(checked: boolean) {
    setHideLikelyTests(checked);
    window.localStorage.setItem(HIDE_TEST_RECORDS_KEY, String(checked));
  }

  async function saveProfile() {
    if (savingProfile) return;
    const nextName = displayName.trim();
    if (!nextName) {
      setProfileFeedback({
        tone: "error",
        message: "Enter a display name before saving.",
      });
      return;
    }

    setSavingProfile(true);
    setProfileFeedback({ tone: "idle", message: "" });
    try {
      await updateProfile(user, { displayName: nextName });
      setDisplayName(nextName);
      setProfileFeedback({
        tone: "success",
        message: "Profile name updated.",
      });
    } catch (error) {
      console.error("Failed to update admin profile", error);
      setProfileFeedback({
        tone: "error",
        message: "Profile name could not be updated.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const provider =
    user.providerData.map((entry) => entry.providerId).filter(Boolean).join(", ") ||
    "Firebase authentication";

  return (
    <AdminShell active="settings">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Workspace"
          title="Settings"
          description="Manage your admin profile, local workspace preferences and active session."
        />

        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-8">
            <SettingsSection
              eyebrow="Account"
              title="Profile"
              description="This name belongs to your authenticated admin account."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display name" htmlFor="admin-display-name">
                  <input
                    id="admin-display-name"
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      setProfileFeedback({ tone: "idle", message: "" });
                    }}
                    className={controlClass}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email">
                  <ReadOnlyValue value={user.email || "No email available"} />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={savingProfile || displayName.trim() === (user.displayName || "")}
                  className={adminPrimaryButton}
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </button>
                <FeedbackMessage feedback={profileFeedback} />
              </div>
            </SettingsSection>

            <SettingsSection
              eyebrow="Preferences"
              title="Dashboard"
              description="Saved on this browser and applied to the admin dashboard."
            >
              <label className="flex cursor-pointer items-start justify-between gap-6 rounded-[12px] border border-[#ded5cb] bg-white px-4 py-4">
                <span>
                  <span className="block text-sm font-semibold text-[#302722]">
                    Hide likely test records
                  </span>
                  <span className="mt-1 block max-w-xl text-xs leading-5 text-[#766960]">
                    Exclude records identified as likely test data from dashboard attention and activity views.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={hideLikelyTests}
                  onChange={(event) => updateDashboardPreference(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#302722]"
                />
              </label>
            </SettingsSection>
          </div>

          <aside className="space-y-6" aria-label="Workspace and session settings">
            <SettingsCard eyebrow="Workspace defaults" title="Tufffinds Admin">
              <dl className="space-y-3">
                <Definition label="Timezone" value="Europe/London" />
                <Definition label="Default currency" value="GBP" />
                <Definition label="Supported currencies" value="GBP, EUR, USD" />
                <Definition label="Data source" value="Firebase / Firestore" />
              </dl>
            </SettingsCard>

            <SettingsCard eyebrow="Security" title="Active session">
              <dl className="space-y-3">
                <Definition label="Signed in as" value={user.email || "Unknown admin"} breakWords />
                <Definition label="Provider" value={provider} breakWords />
                <Definition
                  label="Last sign-in"
                  value={formatAccountDate(user.metadata.lastSignInTime)}
                />
              </dl>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className={`${adminSecondaryButton} mt-5`}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
              {signOutError ? (
                <p className="mt-3 text-xs text-[#8c3c2d]" role="alert">
                  {signOutError}
                </p>
              ) : null}
            </SettingsCard>
          </aside>
        </div>
      </AdminPage>
    </AdminShell>
  );
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[#ded5cb] pt-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 font-serif text-xl text-[#302722]">{title}</h2>
      <p className="mt-1 text-sm text-[#766960]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SettingsCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#ded5cb] bg-white p-5 shadow-[0_1px_2px_rgba(43,35,30,0.04)]">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
        {eyebrow}
      </p>
      <h2 className="mt-1.5 font-serif text-xl text-[#302722]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[#62554c]">
        {label}
      </label>
      {children}
    </div>
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="flex min-h-10 items-center rounded-[9px] border border-[#e2dad2] bg-[#f8f5f1] px-3 text-sm text-[#62564e]">
      {value}
    </div>
  );
}

function Definition({
  label,
  value,
  breakWords = false,
}: {
  label: string;
  value: string;
  breakWords?: boolean;
}) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8a7d73]">
        {label}
      </dt>
      <dd className={`mt-1 text-sm text-[#51463e] ${breakWords ? "break-all" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback.message) return null;
  return (
    <p
      className={`text-xs ${feedback.tone === "error" ? "text-[#8c3c2d]" : "text-[#35633c]"}`}
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}

function formatAccountDate(value?: string) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const controlClass =
  "block min-h-10 w-full rounded-[9px] border border-[#d3c8bd] bg-white px-3 py-2 text-sm text-[#302722] outline-none transition focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/20";
