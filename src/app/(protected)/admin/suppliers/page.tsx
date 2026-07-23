import AdminShell from "../_components/AdminShell";
import { AdminPage, AdminPageHeader } from "../_components/AdminUI";

export default function SuppliersPage() {
  return (
    <AdminShell active="suppliers">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Operations"
          title="Suppliers"
          description="A dedicated workspace for managing sellers, dealers and sourcing partners."
        />

        <section
          aria-labelledby="suppliers-coming-soon"
          className="flex min-h-[360px] items-center justify-center rounded-[12px] border border-[#ded5cb] bg-white px-6 py-16 text-center"
        >
          <div className="max-w-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
              In development
            </p>
            <h2
              id="suppliers-coming-soon"
              className="mt-3 font-serif text-3xl text-[#302722] sm:text-4xl"
            >
              Coming soon
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#766960]">
              We&apos;re building a simpler way to organise supplier contacts,
              reliability notes and purchase history.
            </p>
          </div>
        </section>
      </AdminPage>
    </AdminShell>
  );
}
