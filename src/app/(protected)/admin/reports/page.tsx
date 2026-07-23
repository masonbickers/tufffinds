import AdminShell from "../_components/AdminShell";
import { AdminPage, AdminPageHeader } from "../_components/AdminUI";

export default function ReportsPage() {
  return (
    <AdminShell active="reports">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Growth"
          title="Reports"
          description="A dedicated workspace for reviewing performance and business insights."
        />

        <section
          aria-labelledby="reports-coming-soon"
          className="flex min-h-[360px] items-center justify-center rounded-[12px] border border-[#ded5cb] bg-white px-6 py-16 text-center"
        >
          <div className="max-w-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
              In development
            </p>
            <h2
              id="reports-coming-soon"
              className="mt-3 font-serif text-3xl text-[#302722] sm:text-4xl"
            >
              Coming soon
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#766960]">
              We&apos;re building a simpler way to explore performance,
              understand trends and share business insights.
            </p>
          </div>
        </section>
      </AdminPage>
    </AdminShell>
  );
}
