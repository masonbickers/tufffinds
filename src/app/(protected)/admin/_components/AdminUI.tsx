import type { ReactNode } from "react";
import styles from "./AdminWorkspace.module.css";

export function AdminPage({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderCopy}>
        {eyebrow ? (
          <p className={styles.pageEyebrow}>{eyebrow}</p>
        ) : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? (
          <p className={styles.pageDescription}>{description}</p>
        ) : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return (
    <div className={styles.toolbar}>{children}</div>
  );
}

export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  label = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <label className={styles.searchLabel}>
      <span className="sr-only">{label}</span>
      <span className={styles.searchWrap}>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={styles.searchIcon}>
          <circle cx="8.5" cy="8.5" r="5.25" />
          <path d="m12.4 12.4 4.1 4.1" />
        </svg>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${styles.control} ${styles.searchControl}`}
        />
      </span>
    </label>
  );
}

export function AdminFilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className={styles.filterLabel}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={styles.control}
      >
        {children}
      </select>
    </label>
  );
}

export function AdminTable({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label} className={styles.table}>
      <div className={styles.tableScroll}>{children}</div>
    </section>
  );
}

export function AdminState({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div className={styles.state} role={tone === "error" ? "alert" : "status"}>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={tone === "error" ? styles.stateError : styles.stateBody}>{body}</p>
    </div>
  );
}

export function AdminStatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-[#ddd4ca] bg-[#f5f2ee] text-[#63574f]",
    info: "border-[#c9dae8] bg-[#edf5fa] text-[#315d76]",
    success: "border-[#c9ddcc] bg-[#eff7f0] text-[#35633c]",
    warning: "border-[#e5d3a9] bg-[#fbf6e8] text-[#725820]",
    danger: "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function AdminMetric({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className={styles.metric}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>{value}</p>
      {detail ? <p className={styles.metricDetail}>{detail}</p> : null}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderCopy}>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const adminPrimaryButton =
  "inline-flex h-9 items-center justify-center rounded-[9px] bg-[#2b231e] px-3.5 text-xs font-semibold text-white transition hover:bg-[#46382f] focus:outline-none focus:ring-2 focus:ring-[#806650] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const adminSecondaryButton =
  "inline-flex h-9 items-center justify-center rounded-[9px] border border-[#d3c8bd] bg-white px-3.5 text-xs font-medium text-[#4f4239] transition hover:bg-[#f7f3ee] focus:outline-none focus:ring-2 focus:ring-[#806650] focus:ring-offset-2";
