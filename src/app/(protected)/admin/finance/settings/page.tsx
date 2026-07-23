"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import { useAdminSession } from "../../_components/AdminGuard";
import {
  AdminPage,
  AdminPageHeader,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../_components/AdminUI";
import {
  calculateVatDeadline,
  createVatSchedule,
  DEFAULT_VAT_SETTINGS,
  formatVatDate,
  normaliseVatNumber,
  readVatSettings,
  validateVatSettings,
  VAT_FREQUENCY_LABELS,
  VAT_PRICE_BASIS_LABELS,
  VAT_SCHEME_LABELS,
  type VatSettings,
} from "../vat-settings";

type LoadState = "loading" | "ready" | "error";
type Feedback = { tone: "idle" | "success" | "error"; message: string };
type VatErrors = Partial<Record<keyof VatSettings, string>>;

const SETTINGS_REF = ["workspace_settings", "vat"] as const;

export default function VatSettingsPage() {
  const { user } = useAdminSession();
  const [settings, setSettings] = useState<VatSettings>(DEFAULT_VAT_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<VatSettings>(DEFAULT_VAT_SETTINGS);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<VatErrors>({});
  const [feedback, setFeedback] = useState<Feedback>({
    tone: "idle",
    message: "",
  });

  useEffect(
    () =>
      onSnapshot(
        doc(db, ...SETTINGS_REF),
        (snapshot) => {
          const next = snapshot.exists()
            ? readVatSettings(snapshot.data() as Record<string, unknown>)
            : DEFAULT_VAT_SETTINGS;
          setSettings(next);
          setSavedSettings(next);
          setLoadState("ready");
        },
        (error) => {
          console.error("Failed to load VAT settings", error);
          setLoadState("error");
          setFeedback({
            tone: "error",
            message: "VAT settings could not be loaded.",
          });
        },
      ),
    [],
  );

  const calculatedDeadline = calculateVatDeadline(
    settings.currentPeriodEnd,
    settings.filingFrequency,
  );
  const schedule = useMemo(() => createVatSchedule(settings), [settings]);
  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function update<K extends keyof VatSettings>(key: K, value: VatSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFeedback({ tone: "idle", message: "" });
  }

  async function saveSettings() {
    if (saving) return;
    const next = {
      ...settings,
      vatNumber: normaliseVatNumber(settings.vatNumber),
      flatRatePercentage:
        settings.scheme === "flat_rate" ? settings.flatRatePercentage : null,
    };
    const nextErrors = validateVatSettings(next);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setFeedback({
        tone: "error",
        message: "Check the highlighted VAT settings before saving.",
      });
      return;
    }

    setSaving(true);
    setFeedback({ tone: "idle", message: "" });
    try {
      await setDoc(doc(db, ...SETTINGS_REF), {
        ...next,
        calculatedDeadline: calculateVatDeadline(
          next.currentPeriodEnd,
          next.filingFrequency,
        ),
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
        updatedByEmail: user.email || "",
      });
      setSettings(next);
      setSavedSettings(next);
      setFeedback({
        tone: "success",
        message: "VAT settings saved and applied to Finance.",
      });
    } catch (error) {
      console.error("Failed to save VAT settings", error);
      setFeedback({
        tone: "error",
        message: "VAT settings could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell active="finance">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Finance configuration"
          title="VAT settings"
          description="Set the VAT rules Finance should use for reporting periods, estimates and deadlines."
          actions={
            <Link href="/admin/finance" className={adminSecondaryButton}>
              Back to Finance
            </Link>
          }
        />

        {loadState === "loading" ? (
          <div className="rounded-[12px] border border-[#ded5cb] bg-white px-5 py-10 text-center text-sm text-[#766960]">
            Loading VAT settings…
          </div>
        ) : (
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-8">
              <SettingsSection
                eyebrow="Registration"
                title="VAT identity"
                description="Use the details shown on the business VAT registration certificate."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="VAT registration number"
                    htmlFor="vat-number"
                    hint="Spaces are removed when saved."
                    error={errors.vatNumber}
                  >
                    <input
                      id="vat-number"
                      value={settings.vatNumber}
                      onChange={(event) => update("vatNumber", event.target.value)}
                      className={controlClass(errors.vatNumber)}
                      placeholder="GB123456789"
                      autoComplete="off"
                      aria-invalid={Boolean(errors.vatNumber)}
                    />
                  </Field>
                  <Field
                    label="VAT registration date"
                    htmlFor="registration-date"
                    error={errors.registrationDate}
                  >
                    <input
                      id="registration-date"
                      type="date"
                      value={settings.registrationDate}
                      onChange={(event) =>
                        update("registrationDate", event.target.value)
                      }
                      className={controlClass(errors.registrationDate)}
                      aria-invalid={Boolean(errors.registrationDate)}
                    />
                  </Field>
                </div>
              </SettingsSection>

              <SettingsSection
                eyebrow="Accounting method"
                title="VAT scheme"
                description="This controls whether Finance recognises VAT when invoices are issued, paid, or using a flat-rate percentage."
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {(
                    [
                      {
                        value: "standard",
                        copy: "Account for VAT using invoice dates.",
                      },
                      {
                        value: "cash",
                        copy: "Account for VAT when clients pay.",
                      },
                      {
                        value: "flat_rate",
                        copy: "Apply your HMRC industry percentage to gross turnover.",
                      },
                    ] as const
                  ).map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-[12px] border p-4 transition ${
                        settings.scheme === option.value
                          ? "border-[#806650] bg-[#f5eee7] shadow-[inset_0_0_0_1px_#806650]"
                          : "border-[#ded5cb] bg-white hover:border-[#b9aa9e]"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="vat-scheme"
                          value={option.value}
                          checked={settings.scheme === option.value}
                          onChange={() => update("scheme", option.value)}
                          className="mt-0.5 h-4 w-4 accent-[#302722]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-[#302722]">
                            {VAT_SCHEME_LABELS[option.value]}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[#766960]">
                            {option.copy}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                {settings.scheme === "flat_rate" ? (
                  <div className="mt-4 max-w-xs">
                    <Field
                      label="HMRC flat-rate percentage"
                      htmlFor="flat-rate"
                      hint="Use the percentage for your business sector."
                      error={errors.flatRatePercentage}
                    >
                      <div className="relative">
                        <input
                          id="flat-rate"
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          value={settings.flatRatePercentage ?? ""}
                          onChange={(event) =>
                            update(
                              "flatRatePercentage",
                              event.target.value ? Number(event.target.value) : null,
                            )
                          }
                          className={`${controlClass(errors.flatRatePercentage)} pr-9`}
                          aria-invalid={Boolean(errors.flatRatePercentage)}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#766960]">
                          %
                        </span>
                      </div>
                    </Field>
                  </div>
                ) : null}
              </SettingsSection>

              <SettingsSection
                eyebrow="Returns"
                title="Filing period and deadline"
                description="Enter the current period end shown in the HMRC VAT account. Finance calculates the usual filing and payment deadline."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Filing frequency" htmlFor="filing-frequency">
                    <select
                      id="filing-frequency"
                      value={settings.filingFrequency}
                      onChange={(event) =>
                        update(
                          "filingFrequency",
                          event.target.value as VatSettings["filingFrequency"],
                        )
                      }
                      className={controlClass()}
                    >
                      {Object.entries(VAT_FREQUENCY_LABELS).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Current VAT period end"
                    htmlFor="period-end"
                    hint="Copy this date from the HMRC VAT account."
                    error={errors.currentPeriodEnd}
                  >
                    <input
                      id="period-end"
                      type="date"
                      value={settings.currentPeriodEnd}
                      onChange={(event) =>
                        update("currentPeriodEnd", event.target.value)
                      }
                      className={controlClass(errors.currentPeriodEnd)}
                      aria-invalid={Boolean(errors.currentPeriodEnd)}
                    />
                  </Field>
                  <Field
                    label="Calculated return and payment deadline"
                    hint={
                      settings.filingFrequency === "annual"
                        ? "Two months after the period end."
                        : "One calendar month and seven days after the period end."
                    }
                  >
                    <ReadOnlyValue value={formatVatDate(calculatedDeadline)} />
                  </Field>
                  <Field
                    label="HMRC-confirmed deadline"
                    htmlFor="confirmed-deadline"
                    hint="Optional. Enter the date in your HMRC account if it differs."
                    error={errors.confirmedDeadline}
                  >
                    <input
                      id="confirmed-deadline"
                      type="date"
                      value={settings.confirmedDeadline}
                      onChange={(event) =>
                        update("confirmedDeadline", event.target.value)
                      }
                      className={controlClass(errors.confirmedDeadline)}
                      aria-invalid={Boolean(errors.confirmedDeadline)}
                    />
                  </Field>
                </div>
              </SettingsSection>

              <SettingsSection
                eyebrow="Order values"
                title="Stored price treatment"
                description="Choose how sale prices and purchase costs are currently entered on Tufffinds orders."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["inclusive", "exclusive"] as const).map((basis) => (
                    <label
                      key={basis}
                      className={`cursor-pointer rounded-[12px] border p-4 ${
                        settings.priceBasis === basis
                          ? "border-[#806650] bg-[#f5eee7] shadow-[inset_0_0_0_1px_#806650]"
                          : "border-[#ded5cb] bg-white"
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="price-basis"
                          value={basis}
                          checked={settings.priceBasis === basis}
                          onChange={() => update("priceBasis", basis)}
                          className="mt-0.5 h-4 w-4 accent-[#302722]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-[#302722]">
                            {VAT_PRICE_BASIS_LABELS[basis]}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[#766960]">
                            {basis === "inclusive"
                              ? "A £120 stored sale contains £20 VAT at the standard rate."
                              : "A £100 stored sale has £20 VAT added at the standard rate."}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </SettingsSection>

              <div className="sticky bottom-0 -mx-3 flex flex-wrap items-center gap-3 border-t border-[#ded5cb] bg-[#f4f0ea]/95 px-3 py-4 backdrop-blur">
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={saving || !isDirty || loadState === "error"}
                  className={adminPrimaryButton}
                >
                  {saving ? "Saving…" : "Save VAT settings"}
                </button>
                {feedback.message ? (
                  <p
                    className={`text-xs ${
                      feedback.tone === "error" ? "text-[#8c3c2d]" : "text-[#35633c]"
                    }`}
                    role={feedback.tone === "error" ? "alert" : "status"}
                  >
                    {feedback.message}
                  </p>
                ) : isDirty ? (
                  <p className="text-xs text-[#766960]">Unsaved changes</p>
                ) : null}
              </div>
            </div>

            <aside className="space-y-6" aria-label="VAT settings summary">
              <section className="rounded-[14px] border border-[#ded5cb] bg-[#2c241f] p-5 text-white">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#b8aaa0]">
                  Current setup
                </p>
                <h2 className="mt-1.5 font-serif text-xl">VAT reporting</h2>
                <dl className="mt-5 space-y-4">
                  <Definition
                    label="Scheme"
                    value={VAT_SCHEME_LABELS[settings.scheme]}
                    inverse
                  />
                  <Definition
                    label="Frequency"
                    value={VAT_FREQUENCY_LABELS[settings.filingFrequency]}
                    inverse
                  />
                  <Definition
                    label="Price basis"
                    value={VAT_PRICE_BASIS_LABELS[settings.priceBasis]}
                    inverse
                  />
                  <Definition
                    label="Next deadline"
                    value={formatVatDate(
                      settings.confirmedDeadline || calculatedDeadline,
                    )}
                    inverse
                  />
                </dl>
              </section>

              <section className="rounded-[14px] border border-[#ded5cb] bg-white p-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
                  Upcoming returns
                </p>
                <h2 className="mt-1.5 font-serif text-xl text-[#302722]">
                  Filing schedule
                </h2>
                {schedule.length ? (
                  <ol className="mt-4 divide-y divide-[#ebe3dc]">
                    {schedule.map((entry, index) => (
                      <li
                        className="flex items-center justify-between gap-4 py-3 first:pt-0"
                        key={`${entry.periodEnd}-${index}`}
                      >
                        <span>
                          <span className="block text-xs font-semibold text-[#4d4139]">
                            Due {formatVatDate(entry.deadline, { short: true })}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-[#8a7d74]">
                            Period ending {formatVatDate(entry.periodEnd, { short: true })}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                            entry.source === "confirmed"
                              ? "bg-[#edf5ee] text-[#35633c]"
                              : "bg-[#f3eee8] text-[#756258]"
                          }`}
                        >
                          {entry.source}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-4 text-xs leading-5 text-[#766960]">
                    Add the current period end to generate the schedule.
                  </p>
                )}
              </section>

              <section className="rounded-[14px] border border-[#ded5cb] bg-white p-5">
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
                  Important
                </p>
                <p className="mt-2 text-xs leading-5 text-[#766960]">
                  HMRC says the exact return and payment dates are shown in the VAT
                  online account. Confirm the first deadline there before relying on
                  this schedule.
                </p>
                <a
                  href="https://www.gov.uk/submit-vat-return/when-to-do-a-vat-return"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-semibold text-[#665044] underline decoration-[#c9b9ac] underline-offset-4"
                >
                  Read HMRC deadline guidance
                </a>
              </section>
            </aside>
          </div>
        )}
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
      <p className="mt-1 max-w-3xl text-sm leading-6 text-[#766960]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const description = error || hint;
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-[#62554c]">
        {label}
      </label>
      {children}
      {description ? (
        <p className={`mt-1.5 text-[11px] ${error ? "text-[#8c3c2d]" : "text-[#8a7d74]"}`}>
          {description}
        </p>
      ) : null}
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
  inverse = false,
}: {
  label: string;
  value: string;
  inverse?: boolean;
}) {
  return (
    <div>
      <dt
        className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${
          inverse ? "text-[#aa9d94]" : "text-[#8a7d73]"
        }`}
      >
        {label}
      </dt>
      <dd className={`mt-1 text-sm ${inverse ? "text-white" : "text-[#51463e]"}`}>
        {value}
      </dd>
    </div>
  );
}

function controlClass(error?: string) {
  return `block min-h-10 w-full rounded-[9px] border bg-white px-3 py-2 text-sm text-[#302722] outline-none transition focus:ring-2 ${
    error
      ? "border-[#b85b46] focus:border-[#b85b46] focus:ring-[#b85b46]/15"
      : "border-[#d3c8bd] focus:border-[#806650] focus:ring-[#806650]/20"
  }`;
}
