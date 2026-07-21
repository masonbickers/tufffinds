"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import type {
  ManagedAdminClient,
  RequestStatus,
  ShippingAddress,
} from "../../admin-types";
import {
  formatDateTime,
  formatStatusLabel,
  getMissingOnboardingFields,
  isValidEmail,
  isValidPhone,
  normalizePhoneNumber,
  normalizeTimestamp,
  parseAdminClient,
} from "../../admin-utils";

type PageProps = {
  params: Promise<{ clientId: string }>;
};

type ClientForm = {
  budgetComfortRange: string;
  clothingSizes: Record<string, string>;
  contactPreferences: string;
  dislikedBrands: string;
  email: string;
  favoriteBrands: string;
  fitNotes: string;
  fullName: string;
  giftingPreferences: string;
  phoneNumber: string;
  shoppingPriorities: string;
  shippingAddress: ShippingAddress;
  stylePreferences: string;
};

type ClientTextField = Exclude<
  keyof ClientForm,
  "clothingSizes" | "shippingAddress"
>;

type LinkedRequest = {
  clientEmail: string;
  clientId: string;
  id: string;
  status: RequestStatus;
  title: string;
  updatedAt: string;
};

type OrderStatus =
  | "created"
  | "invoice_sent"
  | "paid"
  | "purchased"
  | "quality_check"
  | "dispatched"
  | "delivered"
  | "closed"
  | "cancelled";

type LinkedOrder = {
  clientEmail: string;
  clientId: string;
  currency: string;
  id: string;
  salePrice: number | null;
  status: OrderStatus;
  title: string;
  updatedAt: string;
};

type LinkedThread = {
  id: string;
  isActionable: boolean;
  preview: string;
  title: string;
  updatedAt: string;
};

type LinkedData = {
  identifierWarnings: string[];
  legacyEmailLinks: number;
  orders: LinkedOrder[];
  requests: LinkedRequest[];
  threads: LinkedThread[];
};

const EMPTY_LINKED_DATA: LinkedData = {
  identifierWarnings: [],
  legacyEmailLinks: 0,
  orders: [],
  requests: [],
  threads: [],
};

const OPEN_REQUEST_STATUSES = new Set<RequestStatus>([
  "submitted",
  "reviewing",
  "needs_info",
  "sourcing",
  "options_sent",
  "awaiting_client_approval",
  "approved",
  "invoice_sent",
  "paid",
  "purchased",
  "quality_check",
  "dispatched",
  "delivered",
]);
const ACTIVE_ORDER_STATUSES = new Set<OrderStatus>([
  "created",
  "invoice_sent",
  "paid",
  "purchased",
  "quality_check",
  "dispatched",
]);
const COMPLETED_ORDER_STATUSES = new Set<OrderStatus>(["delivered", "closed"]);

export default function AdminClientDetailPage({ params }: PageProps) {
  const { clientId } = use(params);
  const [client, setClient] = useState<ManagedAdminClient | null>(null);
  const [form, setForm] = useState<ClientForm | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [linkedData, setLinkedData] = useState<LinkedData>(EMPTY_LINKED_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(true);
  const [error, setError] = useState("");
  const [linksError, setLinksError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");

    return onSnapshot(
      doc(db, "client_profiles", clientId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setClient(null);
          setForm(null);
          setIsLoading(false);
          setError("Client not found.");
          return;
        }

        const nextClient = parseAdminClient(snapshot.id, snapshot.data());
        setClient(nextClient);
        setForm(toClientForm(nextClient));
        setAdminNotes(nextClient.adminNotes);
        setArchiveReason(nextClient.archived ? nextClient.archive.reason : "");
        setIsLoading(false);
      },
      (snapshotError) => {
        console.error("Failed to load client", snapshotError);
        setClient(null);
        setForm(null);
        setIsLoading(false);
        setError("Could not load this client from Firestore.");
      },
    );
  }, [clientId]);

  useEffect(() => {
    if (!client) return;
    const currentClient = client;
    let cancelled = false;

    async function loadLinks() {
      setLinksLoading(true);
      setLinksError("");

      const [requestsResult, ordersResult, threadsResult] = await Promise.allSettled([
        loadIdentityLinkedDocuments("requests", clientId, currentClient.email, true),
        loadIdentityLinkedDocuments("orders", clientId, currentClient.email, true),
        loadIdentityLinkedDocuments("message_threads", clientId, "", false),
      ]);

      if (cancelled) return;

      const failures: string[] = [];
      const requestDocuments =
        requestsResult.status === "fulfilled" ? requestsResult.value : null;
      const orderDocuments = ordersResult.status === "fulfilled" ? ordersResult.value : null;
      const threadDocuments =
        threadsResult.status === "fulfilled" ? threadsResult.value : null;

      if (!requestDocuments) failures.push("requests");
      if (!orderDocuments) failures.push("orders");
      if (!threadDocuments) failures.push("messages");

      if (requestsResult.status === "rejected") {
        console.error("Failed to load client requests", requestsResult.reason);
      }
      if (ordersResult.status === "rejected") {
        console.error("Failed to load client orders", ordersResult.reason);
      }
      if (threadsResult.status === "rejected") {
        console.error("Failed to load client message threads", threadsResult.reason);
      }

      setLinkedData({
        requests: (requestDocuments?.documents ?? []).map(parseLinkedRequest),
        orders: (orderDocuments?.documents ?? []).map(parseLinkedOrder),
        threads: (threadDocuments?.documents ?? []).map(parseLinkedThread),
        legacyEmailLinks:
          (requestDocuments?.legacyEmailLinks ?? 0) +
          (orderDocuments?.legacyEmailLinks ?? 0),
        identifierWarnings: [
          ...(requestDocuments?.identifierWarnings ?? []),
          ...(orderDocuments?.identifierWarnings ?? []),
        ],
      });
      setLinksError(
        failures.length
          ? `Could not load linked ${failures.join(", ")}. Other client activity remains available.`
          : "",
      );
      setLinksLoading(false);
    }

    void loadLinks();
    return () => {
      cancelled = true;
    };
  }, [client, clientId]);

  const missingFields = useMemo(
    () => (client ? getMissingOnboardingFields(client) : []),
    [client],
  );
  const metrics = useMemo(() => getClientMetrics(linkedData), [linkedData]);

  async function saveProfile() {
    if (!client || !form || busyAction) return;
    const validationError = validateClientForm(form);

    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    setBusyAction("profile");
    setError("");
    setSuccess("");

    try {
      const fullName = form.fullName.trim();
      const email = form.email.trim().toLowerCase();
      const phoneNumber = form.phoneNumber.trim();
      const address = form.shippingAddress;

      await updateDoc(doc(db, "client_profiles", client.id), {
        email,
        fullName,
        phoneNumber,
        phoneNumberNormalized: normalizePhoneNumber(phoneNumber),
        "profile.fullName": fullName,
        "profile.phoneNumber": phoneNumber,
        "profile.budgetComfortRange": form.budgetComfortRange.trim(),
        "profile.clothingSizes": trimRecord(form.clothingSizes),
        "profile.contactPreferences": parseList(form.contactPreferences),
        "profile.dislikedBrands": parseList(form.dislikedBrands),
        "profile.favoriteBrands": parseList(form.favoriteBrands),
        "profile.fitNotes": form.fitNotes.trim(),
        "profile.giftingPreferences": form.giftingPreferences.trim(),
        "profile.shoppingPriorities": parseList(form.shoppingPriorities),
        "profile.shippingAddress": {
          ...address,
          city: address.city.trim(),
          company: address.company.trim(),
          country: address.country.trim(),
          firstName: address.firstName.trim(),
          lastName: address.lastName.trim(),
          line1: address.line1.trim(),
          line2: address.line2.trim(),
          phone: address.phone.trim(),
          postcode: address.postcode.trim(),
        },
        "profile.stylePreferences": parseList(form.stylePreferences),
        updatedAt: serverTimestamp(),
      });
      setSuccess("Client profile saved.");
    } catch (saveError) {
      console.error("Failed to save client profile", saveError);
      setError("Could not save the client profile. No changes were confirmed.");
    } finally {
      setBusyAction("");
    }
  }

  async function saveAdminNotes() {
    if (!client || busyAction) return;
    if (adminNotes.length > 10000) {
      setError("Internal notes must be 10,000 characters or fewer.");
      return;
    }

    await performUpdate("notes", "Internal notes saved.", {
      adminNotes: adminNotes.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  async function completeOnboarding() {
    if (!client || busyAction) return;
    const reason = overrideReason.trim();

    if (missingFields.length && reason.length < 5) {
      setError("Add an override reason before completing an incomplete profile.");
      return;
    }
    if (
      missingFields.length &&
      !window.confirm(
        `This profile is missing ${missingFields.join(", ")}. Confirm the onboarding override?`,
      )
    ) {
      return;
    }

    const adminUid = auth.currentUser?.uid;
    if (!adminUid) {
      setError("Your admin session is unavailable. Sign in again before continuing.");
      return;
    }

    setBusyAction("onboarding");
    setError("");
    setSuccess("");

    try {
      const clientRef = doc(db, "client_profiles", client.id);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(clientRef);
        if (!snapshot.exists()) throw new Error("Client not found");
        const current = parseAdminClient(snapshot.id, snapshot.data());
        const currentMissingFields = getMissingOnboardingFields(current);

        if (current.onboardingCompleted) throw new Error("Onboarding already complete");
        if (currentMissingFields.length && reason.length < 5) {
          throw new Error("Override reason required");
        }

        transaction.update(clientRef, {
          onboardingCompleted: true,
          "onboardingAdmin.completedAt": serverTimestamp(),
          "onboardingAdmin.completedByUid": adminUid,
          "onboardingAdmin.overrideReason": currentMissingFields.length ? reason : "",
          "onboardingAdmin.overriddenMissingFields": currentMissingFields,
          updatedAt: serverTimestamp(),
        });
      });
      setOverrideReason("");
      setSuccess(
        missingFields.length
          ? "Onboarding completed with a recorded override."
          : "Onboarding marked complete.",
      );
    } catch (actionError) {
      console.error("Failed to complete onboarding", actionError);
      setError("Could not complete onboarding. Refresh and try again.");
    } finally {
      setBusyAction("");
    }
  }

  async function reopenOnboarding() {
    if (!client || busyAction) return;
    if (!window.confirm("Reopen onboarding for this client?")) return;
    const adminUid = auth.currentUser?.uid;

    if (!adminUid) {
      setError("Your admin session is unavailable. Sign in again before continuing.");
      return;
    }

    await performUpdate("onboarding", "Onboarding reopened.", {
      onboardingCompleted: false,
      "onboardingAdmin.reopenedAt": serverTimestamp(),
      "onboardingAdmin.reopenedByUid": adminUid,
      updatedAt: serverTimestamp(),
    });
  }

  async function archiveClient() {
    if (!client || busyAction) return;
    const reason = archiveReason.trim();
    if (reason.length < 5) {
      setError("Add an archive reason of at least five characters.");
      return;
    }
    if (!window.confirm("Archive this client without deleting any linked history?")) return;
    const adminUid = auth.currentUser?.uid;

    if (!adminUid) {
      setError("Your admin session is unavailable. Sign in again before continuing.");
      return;
    }

    await performUpdate("archive", "Client archived. Linked history was preserved.", {
      archived: true,
      "archive.archivedAt": serverTimestamp(),
      "archive.archivedByUid": adminUid,
      "archive.reason": reason,
      updatedAt: serverTimestamp(),
    });
  }

  async function restoreClient() {
    if (!client || busyAction) return;
    if (!window.confirm("Restore this archived client to active status?")) return;
    const adminUid = auth.currentUser?.uid;

    if (!adminUid) {
      setError("Your admin session is unavailable. Sign in again before continuing.");
      return;
    }

    await performUpdate("archive", "Client restored to active status.", {
      archived: false,
      "archive.restoredAt": serverTimestamp(),
      "archive.restoredByUid": adminUid,
      updatedAt: serverTimestamp(),
    });
  }

  async function performUpdate(
    action: string,
    successMessage: string,
    values: Record<string, unknown>,
  ) {
    if (!client) return;
    setBusyAction(action);
    setError("");
    setSuccess("");

    try {
      await updateDoc(doc(db, "client_profiles", client.id), values);
      setSuccess(successMessage);
    } catch (actionError) {
      console.error(`Failed client action: ${action}`, actionError);
      setError("The client update could not be saved. Refresh and try again.");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <AdminShell active="clients">
      <div className="space-y-6">
        <Link
          href="/admin/clients"
          className="inline-flex rounded-full border border-black/10 bg-[#FBF7F2] px-4 py-2 text-sm text-black/65 hover:bg-[#F5EEE6]"
        >
          ← Back to clients
        </Link>

        {isLoading ? (
          <EmptyState title="Loading client" body="Reading this client profile from Firestore." />
        ) : null}
        {!isLoading && error && !client ? (
          <EmptyState title="Client issue" body={error} />
        ) : null}

        {!isLoading && client && form ? (
          <>
            <section className="rounded-[28px] border border-black/8 bg-white p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">
                    Client profile
                  </p>
                  <h1 className="mt-3 font-serif text-4xl">
                    {client.fullName || "Unnamed client"}
                  </h1>
                  <p className="mt-3 text-sm text-black/55">
                    {client.email || "No email"} · {client.phoneNumber || "No phone"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    label={client.onboardingCompleted ? "Onboarded" : "Onboarding incomplete"}
                    tone={client.onboardingCompleted ? "success" : "warning"}
                  />
                  <Badge
                    label={client.archived ? "Archived" : "Active"}
                    tone={client.archived ? "neutral" : "success"}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Created" value={formatDateTime(client.createdAt)} />
                <InfoCard label="Updated" value={formatDateTime(client.updatedAt)} />
                <InfoCard label="Open requests" value={String(metrics.openRequests)} />
                <InfoCard label="Active orders" value={String(metrics.activeOrders)} />
              </div>
            </section>

            {client.archived ? (
              <Notice
                title="This client is archived"
                body={`${client.archive.reason || "No archive reason recorded."}${client.archive.archivedAt ? ` Archived ${formatDateTime(client.archive.archivedAt)}.` : ""}`}
                tone="warning"
              />
            ) : null}
            {error ? <Notice title="Update not saved" body={error} tone="error" /> : null}
            {success ? <Notice title="Saved" body={success} tone="success" /> : null}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
              <div className="space-y-6">
                <DetailPanel eyebrow="Editable" title="Identity and contact">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full name" value={form.fullName} onChange={(value) => updateForm(setForm, "fullName", value)} required />
                    <Field label="Email" type="email" value={form.email} onChange={(value) => updateForm(setForm, "email", value)} required />
                    <Field label="Phone" type="tel" value={form.phoneNumber} onChange={(value) => updateForm(setForm, "phoneNumber", value)} required />
                    <Field label="Budget comfort range" value={form.budgetComfortRange} onChange={(value) => updateForm(setForm, "budgetComfortRange", value)} />
                  </div>
                </DetailPanel>

                <DetailPanel eyebrow="Fulfilment" title="Shipping address">
                  <div className="grid gap-4 md:grid-cols-2">
                    {ADDRESS_FIELDS.map((field) => (
                      <Field
                        key={field.key}
                        label={field.label}
                        value={form.shippingAddress[field.key]}
                        onChange={(value) =>
                          setForm((current) =>
                            current
                              ? { ...current, shippingAddress: { ...current.shippingAddress, [field.key]: value } }
                              : current,
                          )
                        }
                      />
                    ))}
                  </div>
                </DetailPanel>

                <DetailPanel eyebrow="Preferences" title="Style and communication">
                  <p className="mb-4 text-xs leading-6 text-black/45">
                    Enter list fields as comma-separated values.
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TextArea label="Style preferences" value={form.stylePreferences} onChange={(value) => updateForm(setForm, "stylePreferences", value)} />
                    <TextArea label="Favourite brands" value={form.favoriteBrands} onChange={(value) => updateForm(setForm, "favoriteBrands", value)} />
                    <TextArea label="Disliked brands" value={form.dislikedBrands} onChange={(value) => updateForm(setForm, "dislikedBrands", value)} />
                    <TextArea label="Shopping priorities" value={form.shoppingPriorities} onChange={(value) => updateForm(setForm, "shoppingPriorities", value)} />
                    <TextArea label="Contact preferences" value={form.contactPreferences} onChange={(value) => updateForm(setForm, "contactPreferences", value)} />
                    <TextArea label="Gifting preferences" value={form.giftingPreferences} onChange={(value) => updateForm(setForm, "giftingPreferences", value)} />
                  </div>
                  <div className="mt-4">
                    <TextArea label="Fit notes" value={form.fitNotes} onChange={(value) => updateForm(setForm, "fitNotes", value)} />
                  </div>
                </DetailPanel>

                <DetailPanel eyebrow="Sizing" title="Clothing and footwear sizes">
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(form.clothingSizes).map(([key, value]) => (
                      <Field
                        key={key}
                        label={formatStatusLabel(key)}
                        value={value}
                        onChange={(nextValue) =>
                          setForm((current) =>
                            current
                              ? { ...current, clothingSizes: { ...current.clothingSizes, [key]: nextValue } }
                              : current,
                          )
                        }
                      />
                    ))}
                  </div>
                </DetailPanel>

                <button
                  type="button"
                  disabled={Boolean(busyAction)}
                  onClick={() => void saveProfile()}
                  className="rounded-xl bg-[#221C18] px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyAction === "profile" ? "Saving profile…" : "Save profile"}
                </button>
              </div>

              <div className="space-y-6">
                <DetailPanel eyebrow="Onboarding" title="Profile readiness">
                  {missingFields.length ? (
                    <>
                      <p className="text-sm leading-7 text-black/60">
                        Complete these fields before marking onboarding complete:
                      </p>
                      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/65">
                        {missingFields.map((field) => <li key={field}>{field}</li>)}
                      </ul>
                    </>
                  ) : (
                    <p className="text-sm leading-7 text-[#2F5A34]">
                      All required onboarding information is present.
                    </p>
                  )}

                  {client.onboardingCompleted ? (
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => void reopenOnboarding()} className="mt-5 rounded-xl border border-[#B59674] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                      {busyAction === "onboarding" ? "Updating…" : "Reopen onboarding"}
                    </button>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {missingFields.length ? (
                        <TextArea label="Required override reason" value={overrideReason} onChange={setOverrideReason} />
                      ) : null}
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => void completeOnboarding()} className="rounded-xl bg-[#221C18] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                        {busyAction === "onboarding" ? "Updating…" : missingFields.length ? "Complete with override" : "Mark onboarding complete"}
                      </button>
                    </div>
                  )}

                  {client.onboardingAdmin.overrideReason ? (
                    <div className="mt-5 rounded-xl bg-[#FFF4DD] p-4 text-sm leading-6 text-[#76561E]">
                      <p className="font-semibold">Recorded override</p>
                      <p className="mt-1">{client.onboardingAdmin.overrideReason}</p>
                    </div>
                  ) : null}
                </DetailPanel>

                <DetailPanel eyebrow="Internal only" title="Administrator notes">
                  <TextArea label="Notes hidden from clients" value={adminNotes} onChange={setAdminNotes} rows={8} />
                  <button type="button" disabled={Boolean(busyAction)} onClick={() => void saveAdminNotes()} className="mt-4 rounded-xl bg-[#221C18] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {busyAction === "notes" ? "Saving…" : "Save internal notes"}
                  </button>
                </DetailPanel>

                <DetailPanel eyebrow="Account state" title={client.archived ? "Restore client" : "Archive client"}>
                  {client.archived ? (
                    <>
                      <p className="text-sm leading-7 text-black/60">
                        Restoring makes the profile active again. Linked history remains unchanged.
                      </p>
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => void restoreClient()} className="mt-4 rounded-xl border border-[#2F5A34] px-4 py-2.5 text-sm font-semibold text-[#2F5A34] disabled:opacity-50">
                        {busyAction === "archive" ? "Restoring…" : "Restore client"}
                      </button>
                    </>
                  ) : (
                    <>
                      <TextArea label="Required archive reason" value={archiveReason} onChange={setArchiveReason} />
                      <button type="button" disabled={Boolean(busyAction)} onClick={() => void archiveClient()} className="mt-4 rounded-xl border border-[#9F3A2A] px-4 py-2.5 text-sm font-semibold text-[#9F3A2A] disabled:opacity-50">
                        {busyAction === "archive" ? "Archiving…" : "Archive client"}
                      </button>
                    </>
                  )}
                </DetailPanel>
              </div>
            </div>

            <section className="space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-black/40">Live activity</p>
                <h2 className="mt-2 font-serif text-3xl">Linked client records</h2>
              </div>

              {linksLoading ? <Notice title="Loading linked activity" body="Querying Requests, Orders and Messages by exact client identifiers." /> : null}
              {linksError ? <Notice title="Some linked activity is unavailable" body={linksError} tone="error" /> : null}
              {linkedData.legacyEmailLinks ? (
                <Notice title="Legacy email links included" body={`${linkedData.legacyEmailLinks} record${linkedData.legacyEmailLinks === 1 ? "" : "s"} had no client profile link and matched this client's exact email address.`} tone="warning" />
              ) : null}
              {linkedData.identifierWarnings.length ? (
                <Notice title="Inconsistent client identifiers detected" body={`${linkedData.identifierWarnings.length} linked record${linkedData.identifierWarnings.length === 1 ? "" : "s"} contains an identifier or email that conflicts with this profile. Review those records before relying on the relationship.`} tone="warning" />
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Open requests" value={metrics.openRequests} definition="Status is not closed or cancelled." />
                <MetricCard label="Active orders" value={metrics.activeOrders} definition="Created through dispatched." />
                <MetricCard label="Completed orders" value={metrics.completedOrders} definition="Delivered or closed." />
                <MetricCard label="Actionable messages" value={metrics.actionableThreads} definition="Latest stored message is from the client." />
                <MetricCard label="Recorded order value" value={metrics.orderValueLabel} definition="Non-cancelled salePrice, grouped by currency." />
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <LinkedPanel title="Requests" empty="No linked requests found.">
                  {linkedData.requests.map((request) => (
                    <LinkedRow key={request.id} href={`/admin/requests/${request.id}`} title={request.title} meta={`${formatStatusLabel(request.status)} · ${formatDateTime(request.updatedAt)}`} />
                  ))}
                </LinkedPanel>
                <LinkedPanel title="Orders" empty="No linked orders found.">
                  {linkedData.orders.map((order) => (
                    <LinkedRow key={order.id} href={`/admin/orders/${order.id}`} title={order.title} meta={`${formatStatusLabel(order.status)} · ${formatDateTime(order.updatedAt)}`} />
                  ))}
                </LinkedPanel>
                <LinkedPanel title="Messages" empty="No linked message threads found.">
                  {linkedData.threads.map((thread) => (
                    <LinkedRow key={thread.id} href={`/admin/messages/${thread.id}`} title={thread.title} meta={`${thread.isActionable ? "Client reply pending" : "No client reply pending"} · ${formatDateTime(thread.updatedAt)}`} />
                  ))}
                </LinkedPanel>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}

const ADDRESS_FIELDS: Array<{ key: keyof ShippingAddress; label: string }> = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "company", label: "Company" },
  { key: "line1", label: "Address line 1" },
  { key: "line2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "postcode", label: "Postcode" },
  { key: "country", label: "Country" },
  { key: "phone", label: "Shipping phone" },
];

function toClientForm(client: ManagedAdminClient): ClientForm {
  return {
    budgetComfortRange: client.profile.budgetComfortRange,
    clothingSizes: { ...client.profile.clothingSizes },
    contactPreferences: client.profile.contactPreferences.join(", "),
    dislikedBrands: client.profile.dislikedBrands.join(", "),
    email: client.email,
    favoriteBrands: client.profile.favoriteBrands.join(", "),
    fitNotes: client.profile.fitNotes,
    fullName: client.fullName,
    giftingPreferences: client.profile.giftingPreferences,
    phoneNumber: client.phoneNumber,
    shoppingPriorities: client.profile.shoppingPriorities.join(", "),
    shippingAddress: { ...client.profile.shippingAddress },
    stylePreferences: client.profile.stylePreferences.join(", "),
  };
}

function updateForm(
  setForm: React.Dispatch<React.SetStateAction<ClientForm | null>>,
  key: ClientTextField,
  value: string,
) {
  setForm((current) => (current ? { ...current, [key]: value } : current));
}

function validateClientForm(form: ClientForm) {
  if (!form.fullName.trim()) return "Full name is required.";
  if (form.fullName.trim().length > 120) return "Full name must be 120 characters or fewer.";
  if (!isValidEmail(form.email)) return "Enter a valid email address.";
  if (!isValidPhone(form.phoneNumber)) return "Enter a valid phone number using digits and standard phone punctuation.";
  if (form.budgetComfortRange.length > 200) return "Budget comfort range must be 200 characters or fewer.";
  if (form.fitNotes.length > 5000 || form.giftingPreferences.length > 5000) {
    return "Profile notes must be 5,000 characters or fewer.";
  }
  return "";
}

function parseList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function trimRecord(value: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, entry.trim()]),
  );
}

type LoadedDocuments = {
  documents: QueryDocumentSnapshot<DocumentData>[];
  identifierWarnings: string[];
  legacyEmailLinks: number;
};

async function loadIdentityLinkedDocuments(
  collectionName: "requests" | "orders" | "message_threads",
  clientId: string,
  email: string,
  supportsEmail: boolean,
): Promise<LoadedDocuments> {
  const rawEmail = email.trim();
  const emailValue = rawEmail.toLowerCase();
  const queries = [
    getDocs(query(collection(db, collectionName), where("clientId", "==", clientId))),
  ];

  if (supportsEmail && emailValue) {
    Array.from(new Set([rawEmail, emailValue])).forEach((emailVariant) => {
      queries.push(
        getDocs(
          query(
            collection(db, collectionName),
            where("clientEmail", "==", emailVariant),
          ),
        ),
      );
    });
  }

  const snapshots = await Promise.all(queries);
  const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  const clientIdMatchedIds = new Set<string>();
  const emailMatchedIds = new Set<string>();

  snapshots.forEach((snapshot, index) => {
    snapshot.docs.forEach((entry) => {
      byId.set(entry.id, entry);
      if (index === 0) clientIdMatchedIds.add(entry.id);
      else emailMatchedIds.add(entry.id);
    });
  });

  const documents: QueryDocumentSnapshot<DocumentData>[] = [];
  const identifierWarnings: string[] = [];
  let legacyEmailLinks = 0;

  byId.forEach((entry) => {
    const data = entry.data() as { clientEmail?: unknown; clientId?: unknown };
    const recordClientId = typeof data.clientId === "string" ? data.clientId : "";
    const recordEmail = typeof data.clientEmail === "string" ? data.clientEmail.trim().toLowerCase() : "";
    const matchedByClientId = clientIdMatchedIds.has(entry.id);
    const matchedByEmail = emailMatchedIds.has(entry.id);

    if (matchedByEmail && recordClientId && recordClientId !== clientId) {
      identifierWarnings.push(entry.id);
      return;
    }

    if (matchedByEmail && !recordClientId) legacyEmailLinks += 1;
    if (
      matchedByClientId &&
      recordEmail &&
      emailValue &&
      recordEmail !== emailValue
    ) identifierWarnings.push(entry.id);

    if (matchedByClientId || (matchedByEmail && !recordClientId)) documents.push(entry);
  });

  return {
    documents: documents.sort((a, b) => timestampMillis(b.data().updatedAt) - timestampMillis(a.data().updatedAt)),
    identifierWarnings: Array.from(new Set(identifierWarnings)),
    legacyEmailLinks,
  };
}

function parseLinkedRequest(entry: QueryDocumentSnapshot<DocumentData>): LinkedRequest {
  const data = entry.data();
  const detail = data.detail && typeof data.detail === "object" ? data.detail : {};
  const status = isRequestStatus(data.status)
    ? data.status
    : isRequestStatus(detail.status)
      ? detail.status
      : "submitted";

  return {
    id: entry.id,
    clientId: stringValue(data.clientId),
    clientEmail: stringValue(data.clientEmail),
    status,
    title: stringValue(detail.title) || "Untitled request",
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

function parseLinkedOrder(entry: QueryDocumentSnapshot<DocumentData>): LinkedOrder {
  const data = entry.data();
  const salePrice = typeof data.salePrice === "number" && Number.isFinite(data.salePrice) ? data.salePrice : null;

  return {
    id: entry.id,
    clientId: stringValue(data.clientId),
    clientEmail: stringValue(data.clientEmail),
    currency: stringValue(data.currency) || "GBP",
    salePrice,
    status: isOrderStatus(data.status) ? data.status : "created",
    title: stringValue(data.title) || stringValue(data.item) || "Untitled order",
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

function parseLinkedThread(entry: QueryDocumentSnapshot<DocumentData>): LinkedThread {
  const data = entry.data();
  const detail = data.detail && typeof data.detail === "object" ? data.detail : {};
  const messages = Array.isArray(detail.messages) ? detail.messages : [];
  const lastMessage = messages[messages.length - 1] as { type?: unknown } | undefined;

  return {
    id: entry.id,
    isActionable: lastMessage?.type === "client",
    preview: stringValue(data.lastMessagePreview),
    title: stringValue(detail.title) || "Conversation",
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

function getClientMetrics(data: LinkedData) {
  const totals = new Map<string, number>();

  data.orders.forEach((order) => {
    if (order.status === "cancelled" || order.salePrice === null || order.salePrice < 0) return;
    totals.set(order.currency, (totals.get(order.currency) ?? 0) + order.salePrice);
  });

  return {
    openRequests: data.requests.filter((request) => OPEN_REQUEST_STATUSES.has(request.status)).length,
    activeOrders: data.orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status)).length,
    completedOrders: data.orders.filter((order) => COMPLETED_ORDER_STATUSES.has(order.status)).length,
    actionableThreads: data.threads.filter((thread) => thread.isActionable).length,
    orderValueLabel: totals.size
      ? [...totals.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([currency, amount]) => `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
          .join(" · ")
      : "—",
  };
}

function timestampMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value === "string") return new Date(value).getTime() || 0;
  return 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && [
    "submitted", "reviewing", "needs_info", "sourcing", "options_sent",
    "awaiting_client_approval", "approved", "invoice_sent", "paid", "purchased",
    "quality_check", "dispatched", "delivered", "closed", "cancelled",
  ].includes(value);
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && [
    "created", "invoice_sent", "paid", "purchased", "quality_check",
    "dispatched", "delivered", "closed", "cancelled",
  ].includes(value);
}

function DetailPanel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-black/8 bg-white p-5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">{eyebrow}</p>
      <h2 className="mt-3 font-serif text-2xl leading-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, required = false, type = "text" }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return (
    <label className="block text-sm text-black/65">
      <span>{label}{required ? " *" : ""}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-[#241E1A] outline-none focus:border-[#B59674]" />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <label className="block text-sm text-black/65">
      <span>{label}</span>
      <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DED2C5] bg-white px-4 py-3 text-[#241E1A] outline-none focus:border-[#B59674]" />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[20px] bg-[#F7F1EA] p-4"><p className="text-[10px] uppercase tracking-[0.22em] text-black/40">{label}</p><p className="mt-3 break-words text-sm leading-6 text-black/68">{value}</p></div>;
}

function MetricCard({ label, value, definition }: { label: string; value: number | string; definition: string }) {
  return <div className="rounded-[22px] border border-black/8 bg-white p-4"><p className="text-[10px] uppercase tracking-[0.2em] text-black/40">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-2 text-xs leading-5 text-black/45">{definition}</p></div>;
}

function Badge({ label, tone }: { label: string; tone: "neutral" | "success" | "warning" }) {
  const style = tone === "success" ? "bg-[#DDECDD] text-[#2F5A34]" : tone === "warning" ? "bg-[#F5E6C8] text-[#76561E]" : "bg-[#ECE7E1] text-[#65584E]";
  return <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${style}`}>{label}</span>;
}

function Notice({ title, body, tone = "neutral" }: { title: string; body: string; tone?: "neutral" | "success" | "warning" | "error" }) {
  const style = tone === "success" ? "border-[#B9D2BB] bg-[#EFF8F0] text-[#2F5A34]" : tone === "warning" ? "border-[#E7C98E] bg-[#FFF8E9] text-[#76561E]" : tone === "error" ? "border-[#E2B8AA] bg-[#FFF2EF] text-[#8B3D2D]" : "border-[#DED2C5] bg-[#FBF7F2] text-black/65";
  return <div role={tone === "error" ? "alert" : undefined} className={`rounded-2xl border p-4 ${style}`}><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-6">{body}</p></div>;
}

function LinkedPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const entries = Array.isArray(children) ? children : [children];
  return <section className="rounded-[24px] border border-black/8 bg-white p-5"><h3 className="font-serif text-2xl">{title}</h3><div className="mt-4 space-y-3">{entries.length && entries.some(Boolean) ? children : <p className="text-sm text-black/45">{empty}</p>}</div></section>;
}

function LinkedRow({ href, title, meta }: { href: string; title: string; meta: string }) {
  return <Link href={href} className="block rounded-xl bg-[#F7F1EA] p-4 transition hover:bg-[#EFE4D9]"><p className="font-medium text-[#241E1A]">{title}</p><p className="mt-2 text-xs leading-5 text-black/50">{meta}</p></Link>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-black/10 bg-[#FBF7F2] text-center"><div className="max-w-md px-8 py-8"><h2 className="font-serif text-3xl leading-tight">{title}</h2><p className="mt-4 text-sm leading-7 text-black/55">{body}</p></div></div>;
}
