export type VatScheme = "standard" | "cash" | "flat_rate";
export type VatFilingFrequency = "monthly" | "quarterly" | "annual";
export type VatPriceBasis = "inclusive" | "exclusive";

export type VatSettings = {
  vatNumber: string;
  registrationDate: string;
  scheme: VatScheme;
  flatRatePercentage: number | null;
  filingFrequency: VatFilingFrequency;
  currentPeriodEnd: string;
  confirmedDeadline: string;
  priceBasis: VatPriceBasis;
};

export const DEFAULT_VAT_SETTINGS: VatSettings = {
  vatNumber: "",
  registrationDate: "",
  scheme: "standard",
  flatRatePercentage: null,
  filingFrequency: "quarterly",
  currentPeriodEnd: "",
  confirmedDeadline: "",
  priceBasis: "inclusive",
};

export const VAT_SCHEME_LABELS: Record<VatScheme, string> = {
  standard: "Standard accounting",
  cash: "Cash Accounting Scheme",
  flat_rate: "Flat Rate Scheme",
};

export const VAT_FREQUENCY_LABELS: Record<VatFilingFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual Accounting",
};

export const VAT_PRICE_BASIS_LABELS: Record<VatPriceBasis, string> = {
  inclusive: "Prices include VAT",
  exclusive: "Prices exclude VAT",
};

export function readVatSettings(data: Record<string, unknown>): VatSettings {
  const scheme = readEnum(data.scheme, ["standard", "cash", "flat_rate"], "standard");
  const filingFrequency = readEnum(
    data.filingFrequency,
    ["monthly", "quarterly", "annual"],
    "quarterly",
  );
  const priceBasis = readEnum(data.priceBasis, ["inclusive", "exclusive"], "inclusive");
  const flatRatePercentage =
    typeof data.flatRatePercentage === "number" &&
    Number.isFinite(data.flatRatePercentage)
      ? data.flatRatePercentage
      : null;

  return {
    vatNumber: readString(data.vatNumber),
    registrationDate: readString(data.registrationDate),
    scheme,
    flatRatePercentage,
    filingFrequency,
    currentPeriodEnd: readString(data.currentPeriodEnd),
    confirmedDeadline: readString(data.confirmedDeadline),
    priceBasis,
  };
}

export function normaliseVatNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validateVatSettings(settings: VatSettings) {
  const errors: Partial<Record<keyof VatSettings, string>> = {};
  const vatNumber = normaliseVatNumber(settings.vatNumber);

  if (!vatNumber) {
    errors.vatNumber = "Enter the VAT registration number.";
  } else if (!/^(GB|XI)?[0-9]{9}([0-9]{3})?$/.test(vatNumber)) {
    errors.vatNumber = "Use a valid UK VAT number, for example GB123456789.";
  }

  if (!isDateInput(settings.registrationDate)) {
    errors.registrationDate = "Enter the VAT registration date.";
  } else if (parseDateInput(settings.registrationDate)! > startOfToday()) {
    errors.registrationDate = "The registration date cannot be in the future.";
  }

  if (!isDateInput(settings.currentPeriodEnd)) {
    errors.currentPeriodEnd = "Enter the current VAT period end date shown by HMRC.";
  }

  if (
    settings.confirmedDeadline &&
    !isDateInput(settings.confirmedDeadline)
  ) {
    errors.confirmedDeadline = "Enter a valid HMRC deadline.";
  }

  if (settings.scheme === "flat_rate") {
    if (
      settings.flatRatePercentage === null ||
      settings.flatRatePercentage <= 0 ||
      settings.flatRatePercentage > 100
    ) {
      errors.flatRatePercentage = "Enter the flat-rate percentage confirmed by HMRC.";
    }
  }

  return errors;
}

export function calculateVatDeadline(
  periodEnd: string,
  frequency: VatFilingFrequency,
) {
  const end = parseDateInput(periodEnd);
  if (!end) return "";
  const due = addCalendarMonths(end, frequency === "annual" ? 2 : 1);
  if (frequency !== "annual") due.setDate(due.getDate() + 7);

  return formatDateInput(due);
}

export function createVatSchedule(settings: VatSettings, count = 4) {
  const firstEnd = parseDateInput(settings.currentPeriodEnd);
  if (!firstEnd) return [];
  const increment =
    settings.filingFrequency === "monthly"
      ? 1
      : settings.filingFrequency === "quarterly"
        ? 3
        : 12;

  return Array.from({ length: count }, (_, index) => {
    const periodEnd = addCalendarMonths(firstEnd, increment * index);
    const periodEndValue = formatDateInput(periodEnd);
    const calculatedDeadline = calculateVatDeadline(
      periodEndValue,
      settings.filingFrequency,
    );

    return {
      periodEnd: periodEndValue,
      deadline:
        index === 0 && settings.confirmedDeadline
          ? settings.confirmedDeadline
          : calculatedDeadline,
      source:
        index === 0 && settings.confirmedDeadline ? ("confirmed" as const) : ("calculated" as const),
    };
  });
}

export function formatVatDate(value: string, options?: { short?: boolean }) {
  const date = parseDateInput(value);
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: options?.short ? "short" : "long",
    year: "numeric",
  }).format(date);
}

export function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : fallback;
}

function isDateInput(value: string) {
  return parseDateInput(value) !== null;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarMonths(value: Date, months: number) {
  const wasMonthEnd =
    value.getDate() ===
    new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const targetMonthStart = new Date(
    value.getFullYear(),
    value.getMonth() + months,
    1,
  );
  const lastDay = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0,
  ).getDate();
  const day = wasMonthEnd ? lastDay : Math.min(value.getDate(), lastDay);
  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    day,
  );
}
