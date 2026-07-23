import AdminShell, { type AdminSection } from "./AdminShell";
import { AdminPage, AdminPageHeader } from "./AdminUI";

type PlannedAdminPageProps = {
  active: AdminSection;
  description: string;
  features: Array<{
    title: string;
    description: string;
  }>;
  title: string;
};

export default function PlannedAdminPage({
  active,
  description,
  features,
  title,
}: PlannedAdminPageProps) {
  return (
    <AdminShell active={active}>
      <AdminPage>
        <AdminPageHeader
          eyebrow="Planned workspace"
          title={title}
          description={description}
        />

        <section
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          aria-label={`Planned ${title.toLowerCase()} capabilities`}
        >
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[12px] border border-[#ded5cb] bg-white p-4 sm:p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806b5d]">
                Planned
              </p>
              <h2 className="mt-2 text-sm font-semibold text-[#302722]">
                {feature.title}
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-[#766960]">
                {feature.description}
              </p>
            </article>
          ))}
        </section>
      </AdminPage>
    </AdminShell>
  );
}
