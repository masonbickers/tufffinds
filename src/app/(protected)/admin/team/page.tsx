"use client";

import { FormEvent, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { useAdminSession } from "../_components/AdminGuard";
import {
  AdminPage,
  AdminPageHeader,
  AdminStatusBadge,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../_components/AdminUI";

type Role = "Owner" | "Admin" | "Sourcing";
type MemberStatus = "Active" | "Invited";
type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  workload: string;
  lastActive: string;
};

const INITIAL_MEMBERS: Member[] = [
  {
    id: "owner",
    name: "Mason Bickers",
    email: "info@tufffinds.com",
    role: "Owner",
    status: "Active",
    workload: "6 open",
    lastActive: "Now",
  },
  {
    id: "gina",
    name: "Gina",
    email: "gina@tufffinds.com",
    role: "Sourcing",
    status: "Active",
    workload: "4 open",
    lastActive: "18 min ago",
  },
  {
    id: "ginny",
    name: "Ginny",
    email: "ginny@tufffinds.com",
    role: "Admin",
    status: "Active",
    workload: "2 open",
    lastActive: "Yesterday",
  },
];

const ACTIVITY = [
  {
    actor: "Mason",
    detail: "assigned the Chanel Classic Flap search to Gina",
    time: "12 minutes ago",
  },
  {
    actor: "Ginny",
    detail: "updated Olivia Harris from request to order",
    time: "Yesterday, 16:42",
  },
  {
    actor: "Gina",
    detail: "added a sourcing note to the Hermès Kelly request",
    time: "Yesterday, 11:08",
  },
];

export default function TeamPage() {
  const { user } = useAdminSession();
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Sourcing");
  const [feedback, setFeedback] = useState("");

  const activeCount = useMemo(
    () => members.filter((member) => member.status === "Active").length,
    [members],
  );

  function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    if (members.some((member) => member.email.toLowerCase() === email)) {
      setFeedback("That email is already in this workspace.");
      return;
    }

    const displayName = email
      .split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");

    setMembers((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        name: displayName || "Invited member",
        email,
        role: inviteRole,
        status: "Invited",
        workload: "—",
        lastActive: "Invite sent",
      },
    ]);
    setInviteEmail("");
    setFeedback("");
    setDialogOpen(false);
  }

  function updateRole(memberId: string, role: Role) {
    setMembers((current) =>
      current.map((member) => (member.id === memberId ? { ...member, role } : member)),
    );
  }

  return (
    <AdminShell active="team">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Workspace"
          title="Team"
          description="Keep ownership clear across client requests, sourcing and fulfilment."
          actions={
            <button
              type="button"
              className={adminPrimaryButton}
              onClick={() => setDialogOpen(true)}
            >
              Invite team member
            </button>
          }
        />

        <section className="grid overflow-hidden rounded-[14px] border border-[#ded5cb] bg-white shadow-[0_1px_2px_rgba(43,35,30,0.04)] sm:grid-cols-3">
          <TeamMetric
            label="Team members"
            value={members.length}
            detail={`${activeCount} active in this workspace`}
          />
          <TeamMetric
            label="Open assignments"
            value="12"
            detail="Across sourcing and fulfilment"
          />
          <TeamMetric
            label="Unassigned"
            value="3"
            detail="Requests waiting for an owner"
            action
          />
        </section>

        <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="team-members-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
                  Directory
                </p>
                <h2 id="team-members-title" className="mt-1.5 font-serif text-xl text-[#302722]">
                  Members and access
                </h2>
              </div>
              <p className="text-xs text-[#766960]">
                Signed in as {user.email || "admin"}
              </p>
            </div>

            <div className="overflow-hidden rounded-[14px] border border-[#ded5cb] bg-white">
              <div className="hidden grid-cols-[minmax(14rem,1.4fr)_8rem_7rem_6rem] gap-4 border-b border-[#e7dfd7] bg-[#faf8f4] px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8a7c72] md:grid">
                <span>Member</span>
                <span>Role</span>
                <span>Assignments</span>
                <span>Last active</span>
              </div>
              <ul className="divide-y divide-[#e7dfd7]">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="grid gap-4 px-4 py-4 transition-colors hover:bg-[#fcfaf7] md:grid-cols-[minmax(14rem,1.4fr)_8rem_7rem_6rem] md:items-center md:px-5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={member.name} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#302722]">
                            {member.name}
                          </p>
                          <AdminStatusBadge tone={member.status === "Active" ? "success" : "warning"}>
                            {member.status}
                          </AdminStatusBadge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#766960]">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-3 md:block">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a7c72] md:sr-only">
                        Role
                      </span>
                      <select
                        value={member.role}
                        disabled={member.role === "Owner"}
                        onChange={(event) => updateRole(member.id, event.target.value as Role)}
                        aria-label={`Role for ${member.name}`}
                        className="h-8 rounded-[8px] border border-[#d8cec5] bg-white px-2 text-xs text-[#51443b] disabled:cursor-not-allowed disabled:bg-[#f6f2ed]"
                      >
                        <option>Owner</option>
                        <option>Admin</option>
                        <option>Sourcing</option>
                      </select>
                    </label>

                    <MemberDatum label="Assignments" value={member.workload} />
                    <MemberDatum label="Last active" value={member.lastActive} />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="space-y-6" aria-label="Team activity and access">
            <section className="rounded-[14px] border border-[#ded5cb] bg-white p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
                Live overview
              </p>
              <h2 className="mt-1.5 font-serif text-xl text-[#302722]">
                Workload
              </h2>
              <div className="mt-5 space-y-4">
                <WorkloadRow name="Mason" value={6} max={8} />
                <WorkloadRow name="Gina" value={4} max={8} />
                <WorkloadRow name="Ginny" value={2} max={8} />
              </div>
              <button type="button" className={`${adminSecondaryButton} mt-5 w-full`}>
                View assignments
              </button>
            </section>

            <section className="rounded-[14px] border border-[#ded5cb] bg-white p-5">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
                Recent
              </p>
              <h2 className="mt-1.5 font-serif text-xl text-[#302722]">
                Team activity
              </h2>
              <ol className="mt-4 space-y-4">
                {ACTIVITY.map((item) => (
                  <li key={`${item.actor}-${item.time}`} className="border-l border-[#d9cfc6] pl-3">
                    <p className="text-xs leading-5 text-[#5f5249]">
                      <span className="font-semibold text-[#302722]">{item.actor}</span>{" "}
                      {item.detail}
                    </p>
                    <p className="mt-1 text-[10px] text-[#96887e]">{item.time}</p>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>

        {dialogOpen ? (
          <div
            className="fixed inset-0 z-[80] grid place-items-center bg-[#17120f]/45 p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDialogOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="invite-title"
              className="w-full max-w-md rounded-[16px] border border-[#d9cfc6] bg-[#fbf8f3] p-6 shadow-2xl"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#806b5d]">
                Workspace access
              </p>
              <h2 id="invite-title" className="mt-1.5 font-serif text-2xl text-[#302722]">
                Invite a team member
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#766960]">
                They’ll receive access to the workspace based on the role you choose.
              </p>

              <form onSubmit={inviteMember} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#62554c]">
                    Email address
                  </span>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={inviteEmail}
                    onChange={(event) => {
                      setInviteEmail(event.target.value);
                      setFeedback("");
                    }}
                    placeholder="name@tufffinds.com"
                    className="h-10 w-full rounded-[9px] border border-[#d3c8bd] bg-white px-3 text-sm text-[#302722] placeholder:text-[#a99d94]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-[#62554c]">
                    Role
                  </span>
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as Role)}
                    className="h-10 w-full rounded-[9px] border border-[#d3c8bd] bg-white px-3 text-sm text-[#302722]"
                  >
                    <option value="Sourcing">Sourcing — requests and supplier work</option>
                    <option value="Admin">Admin — full operational access</option>
                  </select>
                </label>
                {feedback ? (
                  <p className="text-xs text-[#8c3c2d]" role="alert">{feedback}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className={adminSecondaryButton}
                    onClick={() => {
                      setDialogOpen(false);
                      setFeedback("");
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={adminPrimaryButton}>
                    Send invitation
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </AdminPage>
    </AdminShell>
  );
}

function TeamMetric({
  label,
  value,
  detail,
  action = false,
}: {
  label: string;
  value: string | number;
  detail: string;
  action?: boolean;
}) {
  return (
    <div className="border-b border-[#e3dbd3] p-5 last:border-0 sm:border-b-0 sm:border-r">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#887a70]">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-serif text-3xl text-[#302722]">{value}</p>
        {action ? <span className="text-[10px] font-semibold text-[#9b4e3c]">Needs attention</span> : null}
      </div>
      <p className="mt-1 text-xs text-[#766960]">{detail}</p>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#d8ccc2] bg-[#eee5dc] text-[10px] font-semibold tracking-[0.08em] text-[#5c4c42]"
    >
      {initials}
    </span>
  );
}

function MemberDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 md:block">
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8a7c72] md:sr-only">
        {label}
      </span>
      <span className="text-xs text-[#62554c]">{value}</span>
    </div>
  );
}

function WorkloadRow({ name, value, max }: { name: string; value: number; max: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-semibold text-[#51443b]">{name}</span>
        <span className="text-[#8a7c72]">{value} open</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#eee8e2]">
        <span
          className="block h-full rounded-full bg-[#806650]"
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}
