"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  AdminState,
  AdminStatusBadge,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../_components/AdminUI";
import {
  ORDER_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  isOpenRequestStatus,
  isOrderStatus,
  isRequestStatus,
  orderQueueGroup,
} from "../../admin-utils";
import {
  clientGenderLabel,
  editValuesFromClient,
  formatDate,
  isRecord,
  isSafeDocumentId,
  normalizeClientDocument,
  normalizePhoneForStorage,
  parseListInput,
  readString,
  readTimestamp,
  validTimestamp,
  validateClientEdit,
  whatsappHref,
  type ClientEditValues,
  type ClientGender,
  type LoadState,
  type ManagedAddress,
  type ManagedClient,
} from "../client-management";

type PageProps = { params: Promise<{ clientId: string }> };
type RelatedKind = "request" | "order";
type RelatedRecord = {
  active: boolean;
  attention: boolean;
  classificationComplete: boolean;
  href: string;
  id: string;
  kind: RelatedKind;
  statusLabel: string;
  statusTone: "neutral" | "info" | "success" | "warning" | "danger";
  title: string;
  updatedAt: Date | null;
};
type RelatedSource = {
  records: RelatedRecord[];
  state: LoadState;
  error: string;
  limited: boolean;
};
type Feedback = { state: "idle" | "saving" | "success" | "error"; message: string };

const RELATED_LIMIT = 100;
const STYLE_SUGGESTIONS = ["Minimal", "Classic", "Streetwear", "Smart casual", "Tailored", "Relaxed", "Luxury", "Vintage", "Sporty"] as const;
const BRAND_SUGGESTIONS = ["Chanel", "Nike", "Lululemon", "Adidas", "Prada", "Gucci", "Zara", "COS", "Arket"] as const;
const PRIORITY_SUGGESTIONS = ["Quality", "Comfort", "Fit", "Versatility", "Value", "Sustainability", "Exclusivity", "Fast delivery"] as const;
const EMPTY_SOURCE: RelatedSource = {
  records: [],
  state: "loading",
  error: "",
  limited: false,
};

export default function AdminClientDetailPage({ params }: PageProps) {
  const { clientId } = use(params);
  const router = useRouter();
  const [client, setClient] = useState<ManagedClient | null>(null);
  const [clientState, setClientState] = useState<LoadState>("loading");
  const [clientError, setClientError] = useState("");
  const [requests, setRequests] = useState<RelatedSource>(EMPTY_SOURCE);
  const [orders, setOrders] = useState<RelatedSource>(EMPTY_SOURCE);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<ClientEditValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Feedback>({ state: "idle", message: "" });
  const [deleteFeedback, setDeleteFeedback] = useState<Feedback>({ state: "idle", message: "" });
  const [dirty, setDirty] = useState(false);
  const saveLock = useRef(false);
  const deleteLock = useRef(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isSafeDocumentId(clientId)) {
      setClientState("error");
      setClientError("The client ID is malformed and cannot be queried safely.");
      return;
    }
    return onSnapshot(
      doc(db, "client_profiles", clientId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setClient(null);
          setClientState("error");
          setClientError("Client not found.");
          return;
        }
        setClient(
          normalizeClientDocument(
            snapshot.id,
            snapshot.data() as Record<string, unknown>,
          ),
        );
        setClientState("ready");
        setClientError("");
      },
      (error) => {
        console.error("Failed to load client", error);
        setClientState("error");
        setClientError("Could not load this client from Firestore.");
      },
    );
  }, [clientId]);

  useEffect(() => {
    if (!isSafeDocumentId(clientId)) return;
    return onSnapshot(
      query(collection(db, "requests"), where("clientId", "==", clientId), limit(RELATED_LIMIT)),
      (snapshot) => setRequests({
        records: snapshot.docs.map((entry) => normalizeRequest(entry.id, entry.data() as Record<string, unknown>)),
        state: "ready",
        error: "",
        limited: snapshot.size === RELATED_LIMIT,
      }),
      (error) => {
        console.error("Failed to load related requests", error);
        setRequests((current) => ({ ...current, state: "error", error: "Related requests are unavailable." }));
      },
    );
  }, [clientId]);

  useEffect(() => {
    if (!isSafeDocumentId(clientId)) return;
    return onSnapshot(
      query(collection(db, "orders"), where("clientId", "==", clientId), limit(RELATED_LIMIT)),
      (snapshot) => setOrders({
        records: snapshot.docs.map((entry) => normalizeOrder(entry.id, entry.data() as Record<string, unknown>)),
        state: "ready",
        error: "",
        limited: snapshot.size === RELATED_LIMIT,
      }),
      (error) => {
        console.error("Failed to load related orders", error);
        setOrders((current) => ({ ...current, state: "error", error: "Related orders are unavailable." }));
      },
    );
  }, [clientId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const openRequests = requests.records.filter((record) => record.active).length;
  const activeOrders = orders.records.filter((record) => record.active).length;
  const allRelated = useMemo(
    () => [...requests.records, ...orders.records].sort(sortNewest),
    [orders.records, requests.records],
  );

  function beginEditing() {
    if (!client || client.profileIsMalformed) return;
    setEditValues(editValuesFromClient(client));
    setErrors({});
    setFeedback({ state: "idle", message: "" });
    setDirty(false);
    setEditing(true);
    window.setTimeout(() => firstInputRef.current?.focus(), 0);
  }

  function cancelEditing() {
    if (dirty && !window.confirm("Discard unsaved client changes?")) return;
    setEditing(false);
    setEditValues(null);
    setErrors({});
    setFeedback({ state: "idle", message: "" });
    setDirty(false);
  }

  function changeValues(next: ClientEditValues) {
    setEditValues(next);
    setDirty(true);
    setFeedback({ state: "idle", message: "" });
  }

  async function saveClient() {
    if (!editValues || !client || saveLock.current || !isSafeDocumentId(client.id)) return;
    const validation = validateClientEdit(editValues);
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length) {
      setFeedback({ state: "error", message: "Review the highlighted fields before saving." });
      return;
    }

    saveLock.current = true;
    setFeedback({ state: "saving", message: "Saving client…" });
    try {
      const address = trimAddress(editValues.shippingAddress);
      const updates: Record<string, unknown> = {
        fullName: validation.name,
        email: validation.email,
        phoneNumber: validation.phone,
        phoneNumberNormalized: normalizePhoneForStorage(validation.phone),
        onboardingCompleted: editValues.onboardingCompleted === "true",
        "profile.fullName": validation.name,
        "profile.gender": editValues.gender,
        "profile.phoneNumber": validation.phone,
        "profile.contactPreferences": parseListInput(editValues.contactPreferences),
        "profile.stylePreferences": parseListInput(editValues.stylePreferences),
        "profile.favoriteBrands": parseListInput(editValues.favoriteBrands),
        "profile.dislikedBrands": parseListInput(editValues.dislikedBrands),
        "profile.shoppingPriorities": parseListInput(editValues.shoppingPriorities),
        "profile.budgetComfortRange": editValues.budgetComfortRange.trim(),
        "profile.fitNotes": editValues.fitNotes.trim(),
        "profile.giftingPreferences": editValues.giftingPreferences.trim(),
        updatedAt: serverTimestamp(),
      };
      if (!client.addressIsMalformed) {
        Object.entries(address).forEach(([key, value]) => {
          updates[`profile.shippingAddress.${key}`] = value;
        });
      }
      if (!client.sizesIsMalformed) {
        Object.entries(editValues.clothingSizes).forEach(([key, value]) => {
          if (isSafeFieldSegment(key)) updates[`profile.clothingSizes.${key}`] = value.trim();
        });
      }
      await updateDoc(doc(db, "client_profiles", client.id), updates);
      setDirty(false);
      setEditing(false);
      setEditValues(null);
      setFeedback({ state: "success", message: "Client details saved." });
    } catch (error) {
      console.error("Failed to save client", error);
      setFeedback({ state: "error", message: "Client details could not be saved. No success has been assumed." });
    } finally {
      saveLock.current = false;
    }
  }

  async function deleteClient() {
    if (!client || deleteLock.current || !isSafeDocumentId(client.id)) return;

    const confirmation = window.prompt(
      `Permanently delete “${client.identityLabel}”? This removes the client profile and cannot be undone.\n\nType DELETE to confirm.`,
    );

    if (confirmation !== "DELETE") {
      if (confirmation !== null) {
        setDeleteFeedback({
          state: "error",
          message: "The client was not deleted. Enter DELETE exactly to confirm.",
        });
      }
      return;
    }

    deleteLock.current = true;
    setDeleteFeedback({ state: "saving", message: "Checking linked records…" });

    try {
      const [requestsSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(query(collection(db, "requests"), where("clientId", "==", client.id), limit(1))),
        getDocs(query(collection(db, "orders"), where("clientId", "==", client.id), limit(1))),
      ]);

      if (!requestsSnapshot.empty || !ordersSnapshot.empty) {
        const linkedTypes = [
          !requestsSnapshot.empty ? "a request" : "",
          !ordersSnapshot.empty ? "an order" : "",
        ].filter(Boolean);
        setDeleteFeedback({
          state: "error",
          message: `This client is still linked to ${linkedTypes.join(" and ")}. Remove those relationships before deleting the client.`,
        });
        return;
      }

      setDeleteFeedback({ state: "saving", message: "Deleting client…" });
      await deleteDoc(doc(db, "client_profiles", client.id));
      router.replace("/admin/clients");
    } catch (error) {
      console.error("Failed to delete client", error);
      setDeleteFeedback({
        state: "error",
        message: clientDeletionFailureMessage(error),
      });
    } finally {
      deleteLock.current = false;
    }
  }

  return (
    <AdminShell active="clients">
      <AdminPage>
        <Link
          href="/admin/clients"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-[#6f6259] transition hover:text-[#2b231e]"
        >
          <span aria-hidden="true">←</span>
          Back to clients
        </Link>

        {clientState === "loading" ? <AdminState title="Loading client" body="Reading this client profile and linked activity." /> : null}
        {clientState === "error" ? <AdminState title="Client issue" body={clientError} tone="error" /> : null}

        {client ? (
          <>
            <AdminPageHeader
              eyebrow="Client profile"
              title={client.identityLabel}
              actions={<div className="flex flex-wrap items-center justify-end gap-2"><ContactActions client={client} sources={{ requests, orders }} />{!client.profileIsMalformed ? <button type="button" onClick={beginEditing} className={adminPrimaryButton}>Edit client</button> : null}</div>}
            />

            {feedback.message ? <p className={`rounded-[10px] border px-3 py-2 text-sm ${feedback.state === "error" ? "border-[#e6c7be] bg-[#fcf0ed] text-[#8c3c2d]" : "border-[#c9ddcc] bg-[#eff7f0] text-[#35633c]"}`} role={feedback.state === "error" ? "alert" : "status"}>{feedback.message}</p> : null}

            <section
              aria-label="Client operational summary"
              className="grid border-y border-[#ded5cb] sm:grid-cols-2 xl:grid-cols-6"
            >
              <InfoMetric label="Email" value={client.email.value || "Not stored"} />
              <InfoMetric label="Phone" value={client.phone.value || "Not stored"} />
              <InfoMetric label="Country" value={client.country || "Not stored"} />
              <InfoMetric label="Gender" value={clientGenderLabel(client.profile.gender)} />
              <InfoMetric label="Open requests" value={relatedCount(requests, openRequests, requests.records.every((record) => record.classificationComplete))} />
              <InfoMetric label="Active orders" value={relatedCount(orders, activeOrders, orders.records.every((record) => record.classificationComplete))} />
            </section>

            {editing && editValues ? (
              <ClientEditForm
                values={editValues}
                errors={errors}
                saving={feedback.state === "saving"}
                firstInputRef={firstInputRef}
                onChange={changeValues}
                onCancel={cancelEditing}
                onSave={saveClient}
                addressEditable={!client.addressIsMalformed}
                sizesEditable={!client.sizesIsMalformed}
              />
            ) : (
              <ClientProfileView client={client} />
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <RelatedSection title="Requests" source={requests} clientId={client.id} kind="request" />
              <RelatedSection title="Orders" source={orders} clientId={client.id} kind="order" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ActivitySummary records={allRelated} />
              <DataQualitySection client={client} />
            </div>

            <ClientDangerZone feedback={deleteFeedback} onDelete={deleteClient} />
          </>
        ) : null}
      </AdminPage>
    </AdminShell>
  );
}

function ContactActions({ client, sources }: { client: ManagedClient; sources: { requests: RelatedSource; orders: RelatedSource } }) {
  return <nav aria-label="Client actions" className="flex flex-wrap gap-2">{client.phone.kind === "valid" ? <><Link href={whatsappHref(client.phone.value)} target="_blank" rel="noreferrer" className={adminPrimaryButton}>WhatsApp client<span className="sr-only"> (opens in a new tab)</span></Link><CopyButton label="Copy phone" value={client.phone.value} /></> : null}{client.email.kind === "valid" ? <CopyButton label="Copy email" value={client.email.value} /> : null}{sources.requests.state === "ready" && sources.requests.records.length ? <Link href={`/admin/requests?clientId=${encodeURIComponent(client.id)}`} className={adminSecondaryButton}>View requests</Link> : null}{sources.orders.state === "ready" && sources.orders.records.length ? <Link href={`/admin/orders?clientId=${encodeURIComponent(client.id)}`} className={adminSecondaryButton}>View orders</Link> : null}</nav>;
}

function CopyButton({ label, value }: { label: string; value: string }) { const [copied, setCopied] = useState(false); return <button type="button" className={adminSecondaryButton} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1300); } catch (error) { console.error("Client copy action failed", error); } }}>{copied ? "Copied" : label}</button>; }
function InfoMetric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="min-w-0 border-b border-r border-[#eee8e1] px-4 py-3.5 last:border-r-0 xl:border-b-0"><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8a7d73]">{label}</p><p className="mt-1.5 break-words text-sm font-semibold text-[#352c27]">{value}</p></div>; }

function ClientDangerZone({ feedback, onDelete }: { feedback: Feedback; onDelete: () => void }) {
  const deleting = feedback.state === "saving";
  return <section aria-labelledby="delete-client-heading" className="rounded-[14px] border border-[#ead7d1] border-l-[3px] border-l-[#b45c4b] bg-white p-4 shadow-[0_1px_2px_rgba(43,35,30,0.03)]"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#9a4a3a]">Danger zone</p><h2 id="delete-client-heading" className="mt-1 text-sm font-semibold text-[#51251d]">Delete this client</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-[#80645d]">Permanent deletion is available only when no request or order references this client.</p></div><button type="button" onClick={onDelete} disabled={deleting} className="inline-flex h-7 w-fit shrink-0 items-center justify-center rounded-[6px] border border-[#e2c3bc] bg-transparent px-2.5 text-[10px] font-semibold text-[#9a4a3a] transition hover:border-[#c98f82] hover:bg-[#fcf0ed] focus:outline-none focus:ring-2 focus:ring-[#b45c4b] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-50">{deleting ? "Deleting…" : "Delete client"}</button></div>{feedback.message ? <p className={`mt-3 text-sm ${feedback.state === "error" ? "text-[#8c3c2d]" : "text-[#7b463b]"}`} role={feedback.state === "error" ? "alert" : "status"}>{feedback.message}</p> : null}</section>;
}

function ClientProfileView({ client }: { client: ManagedClient }) {
  return <div className="grid items-stretch gap-5 xl:grid-cols-[1.35fr_0.65fr]"><DetailPanel title="Preferences" eyebrow="Style profile" showDivider={false}><div className="grid gap-3 md:grid-cols-2"><ChipGroup label="Style preferences" values={client.profile.stylePreferences} /><ChipGroup label="Favourite brands" values={client.profile.favoriteBrands} /><ChipGroup label="Disliked brands" values={client.profile.dislikedBrands} /><ChipGroup label="Shopping priorities" values={client.profile.shoppingPriorities} /><ChipGroup label="Contact preferences" values={client.profile.contactPreferences} /><TextBlock label="Budget comfort" value={client.profile.budgetComfortRange || "Not captured"} /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><TextBlock label="Fit notes" value={client.profile.fitNotes || "Not captured"} /><TextBlock label="Gifting preferences" value={client.profile.giftingPreferences || "Not captured"} /></div></DetailPanel><div className="grid gap-5 rounded-[14px] border border-[#ded5cb] bg-white p-4 shadow-[0_1px_2px_rgba(43,35,30,0.04)] sm:grid-cols-2 sm:p-5 xl:grid-cols-1"><DetailPanel title="Shipping address" eyebrow="Fulfilment" showDivider={false}><AddressBlock address={client.profile.shippingAddress} /></DetailPanel><DetailPanel title="Sizes" eyebrow="Client sizing"><div className="grid grid-cols-2 gap-2">{visibleSizeEntries(client.profile.clothingSizes, client.profile.gender).map(([key, value]) => <ProfileField key={key} label={formatFieldLabel(key)} value={value || "Not set"} muted={!value} />)}</div></DetailPanel></div></div>;
}

function ClientEditForm({ values, errors, saving, firstInputRef, onChange, onCancel, onSave, addressEditable, sizesEditable }: { values: ClientEditValues; errors: Record<string, string>; saving: boolean; firstInputRef: React.RefObject<HTMLInputElement | null>; onChange: (values: ClientEditValues) => void; onCancel: () => void; onSave: () => void; addressEditable: boolean; sizesEditable: boolean }) {
  const update = <K extends keyof ClientEditValues>(key: K, value: ClientEditValues[K]) => onChange({ ...values, [key]: value });
  return <section aria-labelledby="edit-client-heading" className="rounded-[12px] border border-[#ded5cb] bg-[#faf8f5] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#81746a]">Safe targeted update</p><h2 id="edit-client-heading" className="mt-1.5 text-lg font-semibold text-[#302722]">Edit client</h2></div><div className="flex gap-2"><button type="button" onClick={onCancel} disabled={saving} className={adminSecondaryButton}>Cancel</button><button type="button" onClick={onSave} disabled={saving} className={adminPrimaryButton}>{saving ? "Saving…" : "Save changes"}</button></div></div>
    <div className="mt-6 space-y-8"><FormSection title="Basic information"><div className="grid gap-4 md:grid-cols-2"><Field label="Name" id="client-name" error={errors.fullName}><input ref={firstInputRef} id="client-name" value={values.fullName} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "client-name-error" : undefined} onChange={(event) => update("fullName", event.target.value)} className={controlClass} /></Field><Field label="Email" id="client-email" error={errors.email}><input id="client-email" type="email" value={values.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "client-email-error" : undefined} onChange={(event) => update("email", event.target.value)} className={controlClass} /></Field><Field label="Phone" id="client-phone" error={errors.phoneNumber}><input id="client-phone" type="tel" value={values.phoneNumber} aria-invalid={Boolean(errors.phoneNumber)} aria-describedby={errors.phoneNumber ? "client-phone-error" : undefined} onChange={(event) => update("phoneNumber", event.target.value)} className={controlClass} /></Field><Field label="Gender" id="client-gender" error={errors.gender}><select id="client-gender" value={values.gender} aria-invalid={Boolean(errors.gender)} aria-describedby={errors.gender ? "client-gender-error" : undefined} onChange={(event) => update("gender", event.target.value as ClientGender)} className={controlClass}><option value="not_specified">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option></select></Field></div></FormSection>
    <FormSection title="Style and brands"><div className="grid gap-4 md:grid-cols-2"><TagField label="Style preferences" id="style-preferences" value={values.stylePreferences} onChange={(value) => update("stylePreferences", value)} suggestions={STYLE_SUGGESTIONS} placeholder="Add a style, then press Enter" /><TagField label="Favourite brands" id="favourite-brands" value={values.favoriteBrands} onChange={(value) => update("favoriteBrands", value)} suggestions={BRAND_SUGGESTIONS} placeholder="Add a favourite brand" /><TagField label="Disliked brands" id="disliked-brands" value={values.dislikedBrands} onChange={(value) => update("dislikedBrands", value)} suggestions={BRAND_SUGGESTIONS} placeholder="Add a disliked brand" /></div></FormSection>
    <FormSection title="Shopping preferences"><div className="grid gap-4 md:grid-cols-2"><TagField label="Shopping priorities" id="shopping-priorities" value={values.shoppingPriorities} onChange={(value) => update("shoppingPriorities", value)} suggestions={PRIORITY_SUGGESTIONS} placeholder="Add a priority" /><Field label="Budget comfort" id="budget-notes"><input id="budget-notes" value={values.budgetComfortRange} onChange={(event) => update("budgetComfortRange", event.target.value)} placeholder="For example: £200–£500 per item" className={controlClass} /></Field><TextAreaField label="Fit preference and notes" id="fit-notes" value={values.fitNotes} onChange={(value) => update("fitNotes", value)} rows={3} placeholder="For example: relaxed or oversized fit" /></div><details className="mt-4 rounded-[10px] border border-[#ded5cb] bg-white" open={values.giftingPreferences ? true : undefined}><summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-[#62554c]">Optional gifting notes</summary><div className="border-t border-[#e8e1d9] p-3"><TextAreaField label="Gifting preferences" id="gifting-notes" value={values.giftingPreferences} onChange={(value) => update("giftingPreferences", value)} rows={3} placeholder="Sizes, recipients, occasions or gift preferences" /></div></details></FormSection>
    <FormSection title="Shipping address">{addressEditable ? <AddressFields value={values.shippingAddress} onChange={(shippingAddress) => update("shippingAddress", shippingAddress)} /> : <MalformedEditNotice field="shipping address" />}</FormSection>
    <FormSection title="Sizing">{sizesEditable ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visibleSizeEntries(values.clothingSizes, values.gender).map(([key, value]) => <Field key={key} label={formatFieldLabel(key)} id={`size-${key}`}><input id={`size-${key}`} value={value} onChange={(event) => update("clothingSizes", { ...values.clothingSizes, [key]: event.target.value })} className={controlClass} /></Field>)}</div> : <MalformedEditNotice field="sizing" />}</FormSection></div>
  </section>;
}

function RelatedSection({ title, source, clientId, kind }: { title: string; source: RelatedSource; clientId: string; kind: RelatedKind }) {
  const items = [...source.records].sort(sortNewest).slice(0, 5);
  const destination = kind === "request" ? `/admin/requests?clientId=${encodeURIComponent(clientId)}` : `/admin/orders?clientId=${encodeURIComponent(clientId)}`;
  return <AdminSection title={title} description={source.limited ? `Latest records from the first ${RELATED_LIMIT}.` : "Recent linked records."} action={source.state === "ready" && source.records.length ? <Link href={destination} className="text-xs font-semibold text-[#4e4138] underline underline-offset-2">View all</Link> : undefined}>{source.state === "loading" ? <StateSurface><AdminState title={`Loading ${title.toLowerCase()}`} body="Reading linked records." /></StateSurface> : source.state === "error" ? <StateSurface><AdminState title={`${title} unavailable`} body={source.error} tone="error" /></StateSurface> : !items.length ? <StateSurface><AdminState title={`No ${title.toLowerCase()} yet`} body={`Linked ${title.toLowerCase()} will appear here.`} /></StateSurface> : <div className="divide-y divide-[#eee8e1] overflow-hidden rounded-[14px] border border-[#e1d8cf] bg-white shadow-[0_1px_2px_rgba(43,35,30,0.04)]">{items.map((record) => <Link key={record.id} href={record.href} className="block px-4 py-3 transition hover:bg-[#faf7f2]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-[#302722]">{record.title}</p><p className="mt-1 text-xs text-[#81746a]">{formatDate(record.updatedAt)}</p></div><div className="flex flex-col items-end gap-1"><AdminStatusBadge tone={record.statusTone}>{record.statusLabel}</AdminStatusBadge>{record.attention ? <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8c3c2d]">Needs attention</span> : null}</div></div></Link>)}</div>}</AdminSection>;
}

function ActivitySummary({ records }: { records: RelatedRecord[] }) {
  const items = records.slice(0, 6).map((record) => ({ id: `${record.kind}-${record.id}`, label: record.kind === "request" ? "Request activity" : `Order updated · ${record.statusLabel}`, date: record.updatedAt, href: record.href })).filter((item) => item.date).sort((left, right) => (right.date?.getTime() ?? 0) - (left.date?.getTime() ?? 0)).slice(0, 8);
  return <AdminSection title="Activity" description="Latest linked request and order updates.">{items.length ? <div className="divide-y divide-[#eee8e1] overflow-hidden rounded-[14px] border border-[#e1d8cf] bg-white shadow-[0_1px_2px_rgba(43,35,30,0.04)]">{items.map((item) => <Link key={item.id} href={item.href} className="block transition hover:bg-[#faf7f2]"><div className="flex items-center justify-between gap-3 px-4 py-3"><p className="text-sm text-[#43372f]">{item.label}</p><time className="shrink-0 text-xs text-[#81746a]">{formatDate(item.date)}</time></div></Link>)}</div> : <StateSurface><AdminState title="No activity yet" body="Linked request and order updates will appear here." /></StateSurface>}</AdminSection>;
}

function DataQualitySection({ client }: { client: ManagedClient }) { return <AdminSection title="Profile health" description="Missing or malformed client details.">{!client.issues.length ? <StateSurface><AdminState title="Profile looks complete" body="No client-data issues were detected." /></StateSurface> : <div className="divide-y divide-[#eee8e1] overflow-hidden rounded-[14px] border border-[#e1d8cf] bg-white shadow-[0_1px_2px_rgba(43,35,30,0.04)]">{client.issues.map((issue, index) => <div key={`${issue.field}-${index}`} className="px-4 py-3"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge tone={issue.severity === "attention" ? "danger" : "warning"}>{issue.severity}</AdminStatusBadge><p className="text-sm font-semibold text-[#43372f]">{issue.field}</p></div><p className="mt-2 text-sm text-[#62564e]">{issue.message}</p><p className="mt-1 text-xs text-[#81746a]">{issue.editable ? "Update this in Edit client." : "This needs a separate operational review."}</p></div>)}</div>}</AdminSection>; }

function normalizeRequest(id: string, data: Record<string, unknown>): RelatedRecord { const detail = isRecord(data.detail) ? data.detail : {}; const rawStatus = readString(data.status) || readString(detail.status); const status = isRequestStatus(rawStatus) ? rawStatus : null; return { id, kind: "request", href: `/admin/requests/${id}`, title: readString(detail.title) || "Untitled request", statusLabel: status ? REQUEST_STATUS_LABELS[status] : rawStatus ? "Unrecognised status" : "Status missing", statusTone: !status ? "danger" : status === "submitted" ? "info" : status === "needs_info" ? "warning" : ["delivered", "closed"].includes(status) ? "success" : status === "cancelled" ? "danger" : "neutral", active: isOpenRequestStatus(status), classificationComplete: status !== null, attention: !status || status === "submitted" || status === "needs_info", updatedAt: dateValue(data.updatedAt) ?? dateValue(data.createdAt) }; }
function normalizeOrder(id: string, data: Record<string, unknown>): RelatedRecord { const rawStatus = readString(data.status); const status = isOrderStatus(rawStatus) ? rawStatus : null; const group = status ? orderQueueGroup(status) : null; return { id, kind: "order", href: `/admin/orders/${id}`, title: readString(data.title) || readString(data.item) || "Untitled order", statusLabel: status ? ORDER_STATUS_LABELS[status] : rawStatus ? "Unrecognised status" : "Status missing", statusTone: !status ? "danger" : group === "needs_action" || group === "awaiting_payment" ? "warning" : group === "fulfilment" || group === "completed" ? "success" : status === "cancelled" ? "danger" : "neutral", active: group === "needs_action" || group === "awaiting_payment" || group === "fulfilment", classificationComplete: status !== null, attention: !status || group === "needs_action", updatedAt: dateValue(data.updatedAt) ?? dateValue(data.createdAt) }; }
function DetailPanel({ eyebrow, title, children, showDivider = true }: { eyebrow: string; title: string; children: React.ReactNode; showDivider?: boolean }) { return <section className={showDivider ? "border-t border-[#ded5cb] pt-4" : ""}><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8a7d73]">{eyebrow}</p><h3 className="mt-1.5 font-serif text-xl leading-tight text-[#302722]">{title}</h3><div className="mt-4">{children}</div></section>; }
function TextBlock({ label, value }: { label: string; value: string }) { const muted = value === "Not captured"; return <div className="min-h-[68px] border-l-2 border-[#ddd4ca] py-1 pl-3.5"><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8a7d73]">{label}</p><p className={`mt-2 whitespace-pre-wrap text-sm leading-5 ${muted ? "text-[#a0958c]" : "text-[#51463e]"}`}>{value}</p></div>; }
function ChipGroup({ label, values }: { label: string; values: string[] }) { return <div className="min-h-[68px] border-l-2 border-[#ddd4ca] py-1 pl-3.5"><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8a7d73]">{label}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.length ? values.map((value) => <span key={value} className="rounded-full border border-[#ded5cb] px-2.5 py-1 text-xs text-[#51463e]">{value}</span>) : <span className="text-sm text-[#a0958c]">None captured</span>}</div></div>; }
function ProfileField({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) { return <div className="border-t border-[#e2dad2] py-3"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8a7d73]">{label}</p><p className={`mt-1 text-sm ${muted ? "text-[#a0958c]" : "font-medium text-[#51463e]"}`}>{value}</p></div>; }
function AddressBlock({ address }: { address: ManagedAddress }) { const hasAddress = Boolean(address.firstName || address.lastName || address.company || address.line1 || address.line2 || address.city || address.postcode || address.country || address.phone); if (!hasAddress) return <p className="border-l-2 border-[#ddd4ca] py-1 pl-3.5 text-sm text-[#a0958c]">No shipping address captured.</p>; return <address className="border-l-2 border-[#ddd4ca] py-1 pl-3.5 text-sm not-italic leading-6 text-[#51463e]"><p>{[address.firstName, address.lastName].filter(Boolean).join(" ")}</p>{address.company ? <p>{address.company}</p> : null}{address.line1 ? <p>{address.line1}</p> : null}{address.line2 ? <p>{address.line2}</p> : null}{address.city || address.postcode ? <p>{[address.city, address.postcode].filter(Boolean).join(" ")}</p> : null}{address.country ? <p>{address.country}</p> : null}{address.phone ? <p className="mt-2 text-[#6f6259]">{address.phone}</p> : null}</address>; }
function StateSurface({ children }: { children: React.ReactNode }) { return <div className="overflow-hidden rounded-[14px] border border-[#e1d8cf] bg-white shadow-[0_1px_2px_rgba(43,35,30,0.04)]">{children}</div>; }
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <fieldset className="border-t border-[#ded5cb] pt-4"><legend className="text-sm font-semibold text-[#43372f]">{title}</legend><div className="mt-4">{children}</div></fieldset>; }
function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) { return <div><label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[#62554c]">{label}</label>{children}{error ? <p id={`${id}-error`} className="mt-1 text-xs text-[#9a4030]" role="alert">{error}</p> : null}</div>; }
function TagField({ label, id, value, onChange, suggestions, placeholder }: { label: string; id: string; value: string; onChange: (value: string) => void; suggestions: readonly string[]; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const tags = parseListInput(value);
  const suggestionsId = `${id}-suggestions`;
  function commitDraft() {
    const additions = parseListInput(draft);
    if (!additions.length) return;
    const merged = [...tags];
    additions.forEach((addition) => {
      if (!merged.some((tag) => tag.toLowerCase() === addition.toLowerCase())) merged.push(addition);
    });
    onChange(merged.join(", "));
    setDraft("");
  }
  function removeTag(index: number) {
    onChange(tags.filter((_, tagIndex) => tagIndex !== index).join(", "));
  }
  return <Field label={label} id={id}><div className="rounded-[9px] border border-[#d3c8bd] bg-white px-2.5 py-2 transition focus-within:border-[#806650] focus-within:ring-2 focus-within:ring-[#806650]/20"><div className="flex min-h-7 flex-wrap items-center gap-1.5">{tags.map((tag, index) => <span key={`${tag}-${index}`} className="inline-flex items-center gap-1 rounded-full border border-[#d8cec4] bg-[#faf7f2] py-1 pl-2.5 pr-1.5 text-xs text-[#4f4239]">{tag}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => removeTag(index)} aria-label={`Remove ${tag}`} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[#8b7e75] hover:bg-[#e9e0d7] hover:text-[#43372f]">×</button></span>)}<input id={id} list={suggestionsId} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); commitDraft(); } else if (event.key === "Backspace" && !draft && tags.length) { event.preventDefault(); removeTag(tags.length - 1); } }} placeholder={tags.length ? "Add another…" : placeholder} className="h-7 min-w-[180px] flex-1 bg-transparent px-1 text-xs text-[#302722] outline-none placeholder:text-[#9d9188]" /></div></div><datalist id={suggestionsId}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist><p className="mt-1 text-[10px] text-[#8b7e75]">Press Enter or comma to add each item.</p></Field>;
}
function TextAreaField({ label, id, value, onChange, rows = 3, placeholder }: { label: string; id: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) { return <Field label={label} id={id}><textarea id={id} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={controlClass} /></Field>; }
function AddressFields({ value, onChange }: { value: ManagedAddress; onChange: (value: ManagedAddress) => void }) { const fields: Array<[keyof ManagedAddress, string]> = [["firstName", "First name"], ["lastName", "Last name"], ["company", "Company"], ["line1", "Address line 1"], ["line2", "Address line 2"], ["city", "City"], ["postcode", "Postcode"], ["country", "Country"], ["phone", "Address phone"]]; return <div className="grid gap-4 md:grid-cols-2">{fields.map(([key, label]) => <Field key={key} label={label} id={`address-${key}`}><input id={`address-${key}`} value={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className={controlClass} /></Field>)}</div>; }
function MalformedEditNotice({ field }: { field: string }) { return <p className="rounded-[10px] border border-[#e5d3a9] bg-[#fbf6e8] px-3 py-2 text-sm text-[#725820]">The stored {field} has an unsupported shape. It is excluded from this save so unrelated changes cannot overwrite it.</p>; }

const controlClass = "block min-h-9 w-full rounded-[9px] border border-[#d3c8bd] bg-white px-2.5 py-1.5 text-xs text-[#302722] outline-none transition focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/20 aria-[invalid=true]:border-[#a94b39]";
function trimAddress(address: ManagedAddress): ManagedAddress { return Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])) as ManagedAddress; }
function isSafeFieldSegment(value: string) { return Boolean(value) && !/[.~*/\[\]]/.test(value); }
function formatFieldLabel(value: string) { return value.replace(/[_-]/g, " ").replace(/^./, (character) => character.toUpperCase()); }
function visibleSizeEntries(sizes: Record<string, string>, gender: ClientGender) { return Object.entries(sizes).filter(([key]) => gender !== "male" || !/^dresses?$/i.test(key)); }
function dateValue(value: unknown) { return validTimestamp(readTimestamp(value)); }
function sortNewest(left: RelatedRecord, right: RelatedRecord) { return (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0) || left.id.localeCompare(right.id); }
function relatedCount(source: RelatedSource, count: number, complete: boolean) { if (source.state !== "ready" || !complete) return "—"; return source.limited ? `${count}+` : count; }
function clientDeletionFailureMessage(error: unknown) {
  const code = isRecord(error) ? readString(error.code) : "";
  if (code === "permission-denied") return "You do not have permission to delete this client or check its linked records.";
  if (code === "failed-precondition") return "Linked records could not be checked because the required database index is unavailable. The client was not deleted.";
  return "Could not delete this client. It may still exist; refresh the client list before trying again.";
}
