"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { useRouter, useSearchParams } from "next/navigation";
import { db, storage } from "@/app/lib/firebase";
import AdminShell from "../../_components/AdminShell";
import {
  AdminPage,
  AdminPageHeader,
  AdminSection,
  adminPrimaryButton,
  adminSecondaryButton,
} from "../../_components/AdminUI";
import { normalizePhoneForStorage } from "../../clients/client-management";

type ClientOption = {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
};

type RequestMode = "item_sourcing" | "styling_edit" | "wardrobe_refresh";

type SourcingItem = {
  id: string;
  item: string;
  make: string;
  model: string;
  size: string;
  colour: string;
  condition: "new" | "pre_owned" | "either";
  budget: string;
  notes: string;
};

type StylingEdit = {
  editFor: string;
  deliveryMode: string;
  occasion: string;
  occasionDate: string;
  numberOfLooks: string;
  sizes: string;
  budget: string;
  goals: string;
};

type WardrobeRefresh = {
  sessionMode: string;
  focus: string;
  location: string;
  preferredDate: string;
  wardrobeSize: string;
  goals: string;
};

type RequestForm = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  title: string;
  requestMode: RequestMode;
  urgency: string;
  deadline: string;
  shippingCountry: string;
  categories: string;
  styleNotes: string;
  notes: string;
};

type FormErrors = Partial<Record<keyof RequestForm, string>>;

const EMPTY_FORM: RequestForm = {
  clientId: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  title: "",
  requestMode: "item_sourcing",
  urgency: "",
  deadline: "",
  shippingCountry: "",
  categories: "",
  styleNotes: "",
  notes: "",
};

const EMPTY_SOURCING_ITEM = (id = createLocalId()): SourcingItem => ({
  id,
  item: "",
  make: "",
  model: "",
  size: "",
  colour: "",
  condition: "either",
  budget: "",
  notes: "",
});

const EMPTY_STYLING_EDIT: StylingEdit = {
  editFor: "everyday_wardrobe",
  deliveryMode: "digital",
  occasion: "",
  occasionDate: "",
  numberOfLooks: "",
  sizes: "",
  budget: "",
  goals: "",
};

const EMPTY_WARDROBE_REFRESH: WardrobeRefresh = {
  sessionMode: "in_person",
  focus: "full_wardrobe",
  location: "",
  preferredDate: "",
  wardrobeSize: "",
  goals: "",
};

const REQUEST_MODE_LABELS: Record<RequestMode, string> = {
  item_sourcing: "Personal shopping and item sourcing",
  styling_edit: "Styling edit",
  wardrobe_refresh: "Wardrobe refresh",
};

const controlClass =
  "mt-1.5 h-10 w-full rounded-[10px] border border-[#d8d0c8] bg-white px-3 text-sm text-[#2b231e] outline-none focus:border-[#806650] focus:ring-2 focus:ring-[#806650]/15";

export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClientId = (searchParams.get("clientId") ?? "").trim();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [sourcingItems, setSourcingItems] = useState<SourcingItem[]>([
    EMPTY_SOURCING_ITEM("item-1"),
  ]);
  const [itemImages, setItemImages] = useState<Record<string, File[]>>({});
  const [serviceImages, setServiceImages] = useState<File[]>([]);
  const [stylingEdit, setStylingEdit] = useState<StylingEdit>(EMPTY_STYLING_EDIT);
  const [wardrobeRefresh, setWardrobeRefresh] =
    useState<WardrobeRefresh>(EMPTY_WARDROBE_REFRESH);
  const [modeError, setModeError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const submissionLock = useRef(false);
  const requestRef = useRef<DocumentReference | null>(null);
  const clientRef = useRef<DocumentReference | null>(null);

  useEffect(() => {
    return onSnapshot(
      collection(db, "client_profiles"),
      (snapshot) => {
        setClients(
          snapshot.docs
            .map((entry) => normalizeClient(entry.id, entry.data() as Record<string, unknown>))
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
        setClientsLoading(false);
        setClientsError("");
      },
      (error) => {
        console.error("Failed to load clients for manual request", error);
        setClientsLoading(false);
        setClientsError("Existing clients could not be loaded. You can still enter the contact details manually.");
      },
    );
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId) ?? null,
    [clients, form.clientId],
  );

  useEffect(() => {
    if (!initialClientId || !clients.length) return;
    const client = clients.find((candidate) => candidate.id === initialClientId);
    if (!client) return;
    setForm((current) => current.clientName ? current : withClient(current, client));
  }, [clients, initialClientId]);

  function update<K extends keyof RequestForm>(field: K, value: RequestForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback("");
  }

  function selectClient(clientId: string) {
    const client = clients.find((candidate) => candidate.id === clientId);
    setForm((current) => client ? withClient(current, client) : { ...current, clientId: "" });
    setErrors((current) => ({ ...current, clientId: undefined, clientName: undefined }));
    setFeedback("");
  }

  function updateSourcingItem(
    id: string,
    field: keyof Omit<SourcingItem, "id">,
    value: string,
  ) {
    setSourcingItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
    setModeError("");
    setFeedback("");
  }

  function removeSourcingItem(id: string) {
    setSourcingItems((current) => current.filter((item) => item.id !== id));
    setItemImages((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setModeError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;

    const nextErrors = validateForm(form);
    const activeImages = form.requestMode === "item_sourcing"
      ? sourcingItems.flatMap((item) => itemImages[item.id] ?? [])
      : serviceImages;
    const nextModeError = validateModeDetails(
      form.requestMode,
      sourcingItems,
      stylingEdit,
      wardrobeRefresh,
    ) || validateImageFiles(activeImages);
    setErrors(nextErrors);
    setModeError(nextModeError);
    if (Object.keys(nextErrors).length || nextModeError) {
      setFeedback("Check the highlighted fields before creating the request.");
      return;
    }

    submissionLock.current = true;
    setSaving(true);
    setFeedback("");
    const nextReference = requestRef.current ?? doc(collection(db, "requests"));
    requestRef.current = nextReference;
    const shouldCreateClient = !form.clientId;
    const nextClientReference = shouldCreateClient
      ? clientRef.current ?? doc(collection(db, "client_profiles"))
      : doc(db, "client_profiles", form.clientId);
    if (shouldCreateClient) clientRef.current = nextClientReference;
    const resolvedClientId = nextClientReference.id;
    const now = new Date();
    const eventId = `manual-request-${now.getTime()}`;
    const timelineEvent = {
      id: eventId,
      label: "Request added manually",
      type: "request-submitted",
      meta: formatDateTime(now),
      description: "Request captured by an admin.",
      tone: "info",
      statusLabel: "Current",
      actorName: "Admin",
    };
    const serviceDetails = buildServiceDetails(
      form.requestMode,
      sourcingItems,
      stylingEdit,
      wardrobeRefresh,
    );
    const uploadedPaths: string[] = [];

    try {
      const references = await uploadReferenceImages({
        requestId: nextReference.id,
        mode: form.requestMode,
        items: sourcingItems,
        itemImages,
        serviceImages,
        uploadedPaths,
      });

      await runTransaction(db, async (transaction) => {
        const existingRequest = await transaction.get(nextReference);
        if (existingRequest.exists()) return;

        if (shouldCreateClient) {
          transaction.set(nextClientReference, buildClientProfile(form));
        }

        transaction.set(nextReference, {
          clientId: resolvedClientId,
          clientName: form.clientName.trim(),
          clientEmail: form.clientEmail.trim(),
          clientPhone: form.clientPhone.trim(),
          status: "submitted",
          source: "admin-manual",
          submittedFrom: "/admin/requests/new",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          detail: {
            id: nextReference.id,
            href: `/admin/requests/${nextReference.id}`,
            title: form.title.trim(),
            status: "submitted",
            requestType: REQUEST_MODE_LABELS[form.requestMode],
            requestMode: form.requestMode,
            serviceDetails,
            purchaseMode:
              form.requestMode === "item_sourcing"
                ? "Sourcing request"
                : form.requestMode === "styling_edit"
                  ? "Styling service"
                  : "Wardrobe service",
            urgency: form.urgency,
            deadlineLabel: formatDeadline(form.deadline),
            shippingCountry: form.shippingCountry.trim(),
            categories: splitList(form.categories),
            favoriteBrands: [],
            dislikedBrands: [],
            styleNotes: form.styleNotes.trim(),
            notes: form.notes.trim(),
            references,
            linkedEdits: [],
            linkedMessagesPreview: [],
            whatHappensNext: "Review the brief and decide whether more client information is needed.",
            createdDateLabel: formatDateTime(now),
            statusTimeline: [timelineEvent],
            activitySummary: [timelineEvent],
          },
        });
      });

      router.replace(`/admin/requests/${nextReference.id}`);
    } catch (error) {
      console.error("Failed to create manual request", error);
      setFeedback(
        errorCode(error) === "permission-denied"
          ? "You do not have permission to upload images or add requests."
          : "The images or request could not be saved. Your entries have been preserved so you can retry.",
      );
    } finally {
      submissionLock.current = false;
      setSaving(false);
    }
  }

  return (
    <AdminShell active="requests">
      <AdminPage>
        <AdminPageHeader
          eyebrow="Request queue"
          title="Add request"
          description="Capture a request received by phone, WhatsApp, email or another offline channel."
          actions={<Link href="/admin/requests" className={adminSecondaryButton}>Cancel</Link>}
        />

        <form onSubmit={submit} noValidate className="space-y-8">
          <AdminSection title="Client" description="Link an existing client, or leave the selector empty to create and link a new client profile.">
            <Surface>
              {clientsError ? <Notice>{clientsError}</Notice> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Existing client" id="clientId" error={errors.clientId} hint="Optional. Selecting a client fills the contact fields below.">
                  <select id="clientId" value={form.clientId} disabled={clientsLoading} onChange={(event) => selectClient(event.target.value)} className={controlClass}>
                    <option value="">{clientsLoading ? "Loading clients…" : "Create a new client"}</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name} {client.email ? `— ${client.email}` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Client name" id="clientName" required error={errors.clientName}>
                  <input id="clientName" value={form.clientName} onChange={(event) => update("clientName", event.target.value)} className={controlClass} />
                </Field>
                <Field label="Email" id="clientEmail" error={errors.clientEmail}>
                  <input id="clientEmail" type="email" value={form.clientEmail} onChange={(event) => update("clientEmail", event.target.value)} className={controlClass} />
                </Field>
                <Field label="Phone" id="clientPhone">
                  <input id="clientPhone" type="tel" value={form.clientPhone} onChange={(event) => update("clientPhone", event.target.value)} className={controlClass} />
                </Field>
              </div>
              {selectedClient ? <p className="mt-4 text-xs text-[#75685f]">Linked to client ID: {selectedClient.id}</p> : null}
            </Surface>
          </AdminSection>

          <AdminSection title="Request brief" description="Record enough context for the request to enter the normal review workflow.">
            <Surface>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><Field label="Request title" id="title" required error={errors.title}><input id="title" value={form.title} onChange={(event) => update("title", event.target.value)} className={controlClass} /></Field></div>
                <div className="md:col-span-2">
                  <Field label="Request type" id="requestMode" required>
                    <select id="requestMode" value={form.requestMode} onChange={(event) => { update("requestMode", event.target.value as RequestMode); setModeError(""); }} className={controlClass}>
                      <option value="item_sourcing">Personal shopping and item sourcing</option>
                      <option value="styling_edit">Styling edit</option>
                      <option value="wardrobe_refresh">Wardrobe refresh</option>
                    </select>
                  </Field>
                </div>
                <Field label="Urgency" id="urgency" hint="Optional"><select id="urgency" value={form.urgency} onChange={(event) => update("urgency", event.target.value)} className={controlClass}><option value="">Not specified</option><option value="flexible">Flexible</option><option value="timely">Timely</option><option value="urgent">Urgent</option></select></Field>
                <Field label="Deadline" id="deadline"><input id="deadline" type="date" value={form.deadline} onChange={(event) => update("deadline", event.target.value)} className={controlClass} /></Field>
                <Field label="Shipping country" id="shippingCountry"><input id="shippingCountry" value={form.shippingCountry} onChange={(event) => update("shippingCountry", event.target.value)} className={controlClass} /></Field>
              </div>
            </Surface>
          </AdminSection>

          <AdminSection
            title={REQUEST_MODE_LABELS[form.requestMode]}
            description="These fields change with the request type and are stored as structured request details."
          >
            <Surface>
              {form.requestMode === "item_sourcing" ? (
                <SourcingFields
                  items={sourcingItems}
                  onChange={updateSourcingItem}
                  onAdd={() => setSourcingItems((current) => [...current, EMPTY_SOURCING_ITEM()])}
                  onRemove={removeSourcingItem}
                  images={itemImages}
                  onImagesChange={(id, files) => { setItemImages((current) => ({ ...current, [id]: files })); setModeError(""); }}
                />
              ) : null}
              {form.requestMode === "styling_edit" ? (
                <StylingEditFields value={stylingEdit} onChange={(value) => { setStylingEdit(value); setModeError(""); }} />
              ) : null}
              {form.requestMode === "wardrobe_refresh" ? (
                <WardrobeRefreshFields value={wardrobeRefresh} onChange={(value) => { setWardrobeRefresh(value); setModeError(""); }} />
              ) : null}
              {modeError ? <p className="mt-4 text-sm font-medium text-[#8c3c2d]" role="alert">{modeError}</p> : null}
            </Surface>
          </AdminSection>

          <AdminSection title="Additional context" description="Capture preferences or internal context that applies across the whole request.">
            <Surface>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Categories" id="categories" hint="Separate multiple entries with commas."><input id="categories" value={form.categories} onChange={(event) => update("categories", event.target.value)} className={controlClass} /></Field>
                {form.requestMode !== "item_sourcing" ? <ImageUploadField id="serviceImages" label="Reference images" files={serviceImages} onChange={(files) => { setServiceImages(files); setModeError(""); }} /> : null}
                <div className="md:col-span-2"><Field label="Style notes" id="styleNotes"><textarea id="styleNotes" rows={4} value={form.styleNotes} onChange={(event) => update("styleNotes", event.target.value)} className={`${controlClass} h-auto py-2.5`} /></Field></div>
                <div className="md:col-span-2"><Field label="Brief / internal notes" id="notes" error={errors.notes}><textarea id="notes" rows={5} value={form.notes} onChange={(event) => update("notes", event.target.value)} className={`${controlClass} h-auto py-2.5`} /></Field></div>
              </div>
            </Surface>
          </AdminSection>

          {feedback ? <div role="alert" className="rounded-[12px] border border-[#e6c7be] bg-[#fcf0ed] p-4 text-sm text-[#8c3c2d]">{feedback}</div> : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[#ded5cb] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[#81746a]">The request starts at Submitted. If no existing client is selected, a new linked client profile is created at the same time.</p>
            <button type="submit" disabled={saving || clientsLoading} className={`${adminPrimaryButton} w-full sm:w-auto`}>{saving ? "Adding request…" : "Add request"}</button>
          </div>
        </form>
      </AdminPage>
    </AdminShell>
  );
}

function Surface({ children }: { children: ReactNode }) {
  return <div className="rounded-[12px] border border-[#ded5cb] bg-[#faf8f5] p-4 sm:p-5">{children}</div>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p role="status" className="mb-4 rounded-[10px] border border-[#e5d3a9] bg-[#fbf6e8] p-3 text-sm text-[#725820]">{children}</p>;
}

function Field({ label, id, required, error, hint, children }: { label: string; id: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return <label htmlFor={id} className="block min-w-0"><span className="flex items-center gap-2 text-xs font-medium text-[#4e4138]">{label}{required ? <span className="text-[#8c3c2d]">Required</span> : null}</span>{children}{error ? <span className="mt-1.5 block text-xs font-medium text-[#8c3c2d]">{error}</span> : hint ? <span className="mt-1.5 block text-xs leading-5 text-[#81746a]">{hint}</span> : null}</label>;
}

function SourcingFields({
  items,
  onChange,
  onAdd,
  onRemove,
  images,
  onImagesChange,
}: {
  items: SourcingItem[];
  onChange: (id: string, field: keyof Omit<SourcingItem, "id">, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  images: Record<string, File[]>;
  onImagesChange: (id: string, files: File[]) => void;
}) {
  return (
    <div className="space-y-5">
      {items.map((item, index) => (
        <fieldset key={item.id} className="rounded-[12px] border border-[#ded5cb] bg-white p-4">
          <legend className="px-2 text-sm font-semibold text-[#302722]">Item {index + 1}</legend>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Item" id={`${item.id}-item`} required><input id={`${item.id}-item`} value={item.item} onChange={(event) => onChange(item.id, "item", event.target.value)} placeholder="Handbag, trainers, jacket…" className={controlClass} /></Field>
            <Field label="Make / brand" id={`${item.id}-make`}><input id={`${item.id}-make`} value={item.make} onChange={(event) => onChange(item.id, "make", event.target.value)} className={controlClass} /></Field>
            <Field label="Model / style" id={`${item.id}-model`}><input id={`${item.id}-model`} value={item.model} onChange={(event) => onChange(item.id, "model", event.target.value)} className={controlClass} /></Field>
            <Field label="Size" id={`${item.id}-size`}><input id={`${item.id}-size`} value={item.size} onChange={(event) => onChange(item.id, "size", event.target.value)} className={controlClass} /></Field>
            <Field label="Colour" id={`${item.id}-colour`}><input id={`${item.id}-colour`} value={item.colour} onChange={(event) => onChange(item.id, "colour", event.target.value)} className={controlClass} /></Field>
            <Field label="Condition" id={`${item.id}-condition`}><select id={`${item.id}-condition`} value={item.condition} onChange={(event) => onChange(item.id, "condition", event.target.value)} className={controlClass}><option value="either">New or pre-owned</option><option value="new">New only</option><option value="pre_owned">Pre-owned</option></select></Field>
            <Field label="Budget" id={`${item.id}-budget`} hint="Include currency or a range."><input id={`${item.id}-budget`} value={item.budget} onChange={(event) => onChange(item.id, "budget", event.target.value)} placeholder="£1,000–£1,500" className={controlClass} /></Field>
            <div className="md:col-span-2"><ImageUploadField id={`${item.id}-images`} label="Reference images" files={images[item.id] ?? []} onChange={(files) => onImagesChange(item.id, files)} /></div>
            <div className="md:col-span-2 xl:col-span-3"><Field label="Item notes" id={`${item.id}-notes`}><textarea id={`${item.id}-notes`} rows={3} value={item.notes} onChange={(event) => onChange(item.id, "notes", event.target.value)} className={`${controlClass} h-auto py-2.5`} /></Field></div>
          </div>
          {items.length > 1 ? <div className="mt-4 flex justify-end"><button type="button" onClick={() => onRemove(item.id)} className={adminSecondaryButton}>Remove item</button></div> : null}
        </fieldset>
      ))}
      <button type="button" onClick={onAdd} className={adminSecondaryButton}>+ Add another item</button>
    </div>
  );
}

function StylingEditFields({ value, onChange }: { value: StylingEdit; onChange: (value: StylingEdit) => void }) {
  const update = (field: keyof StylingEdit, next: string) => onChange({ ...value, [field]: next });
  return <div className="grid gap-4 md:grid-cols-2">
    <Field label="What is the edit for?" id="editFor" required><select id="editFor" value={value.editFor} onChange={(event) => update("editFor", event.target.value)} className={controlClass}><option value="everyday_wardrobe">Everyday wardrobe</option><option value="event_occasion">Event or occasion</option><option value="holiday_travel">Holiday or travel</option><option value="workwear">Workwear</option><option value="seasonal_refresh">Seasonal refresh</option><option value="other">Other</option></select></Field>
    <Field label="How should it be delivered?" id="editDelivery"><select id="editDelivery" value={value.deliveryMode} onChange={(event) => update("deliveryMode", event.target.value)} className={controlClass}><option value="digital">Digital styling edit</option><option value="in_person">In-person styling</option><option value="either">Either</option></select></Field>
    <Field label="Occasion / trip" id="editOccasion"><input id="editOccasion" value={value.occasion} onChange={(event) => update("occasion", event.target.value)} placeholder="Wedding guest, city break…" className={controlClass} /></Field>
    <Field label="Occasion date" id="editOccasionDate"><input id="editOccasionDate" type="date" value={value.occasionDate} onChange={(event) => update("occasionDate", event.target.value)} className={controlClass} /></Field>
    <Field label="Number of looks" id="numberOfLooks"><input id="numberOfLooks" inputMode="numeric" value={value.numberOfLooks} onChange={(event) => update("numberOfLooks", event.target.value)} className={controlClass} /></Field>
    <Field label="Sizes" id="editSizes"><input id="editSizes" value={value.sizes} onChange={(event) => update("sizes", event.target.value)} placeholder="Top 10, trousers 12, shoes 6" className={controlClass} /></Field>
    <Field label="Budget" id="editBudget"><input id="editBudget" value={value.budget} onChange={(event) => update("budget", event.target.value)} placeholder="Total or per look" className={controlClass} /></Field>
    <div className="md:col-span-2"><Field label="What should the edit achieve?" id="editGoals" required><textarea id="editGoals" rows={4} value={value.goals} onChange={(event) => update("goals", event.target.value)} placeholder="What they need help with, preferred style, gaps to solve…" className={`${controlClass} h-auto py-2.5`} /></Field></div>
  </div>;
}

function WardrobeRefreshFields({ value, onChange }: { value: WardrobeRefresh; onChange: (value: WardrobeRefresh) => void }) {
  const update = (field: keyof WardrobeRefresh, next: string) => onChange({ ...value, [field]: next });
  return <div className="grid gap-4 md:grid-cols-2">
    <Field label="Session format" id="refreshMode"><select id="refreshMode" value={value.sessionMode} onChange={(event) => update("sessionMode", event.target.value)} className={controlClass}><option value="in_person">In person</option><option value="virtual">Virtual consultation</option><option value="either">Either</option></select></Field>
    <Field label="Refresh focus" id="refreshFocus"><select id="refreshFocus" value={value.focus} onChange={(event) => update("focus", event.target.value)} className={controlClass}><option value="full_wardrobe">Full wardrobe</option><option value="seasonal">Seasonal wardrobe</option><option value="category">Specific category</option><option value="organisation">Organisation only</option></select></Field>
    <Field label="Location" id="refreshLocation"><input id="refreshLocation" value={value.location} onChange={(event) => update("location", event.target.value)} className={controlClass} /></Field>
    <Field label="Preferred date" id="refreshDate"><input id="refreshDate" type="date" value={value.preferredDate} onChange={(event) => update("preferredDate", event.target.value)} className={controlClass} /></Field>
    <Field label="Approximate wardrobe size" id="wardrobeSize"><input id="wardrobeSize" value={value.wardrobeSize} onChange={(event) => update("wardrobeSize", event.target.value)} placeholder="Single rail, walk-in wardrobe…" className={controlClass} /></Field>
    <div className="md:col-span-2"><Field label="What should the refresh achieve?" id="refreshGoals" required><textarea id="refreshGoals" rows={4} value={value.goals} onChange={(event) => update("goals", event.target.value)} placeholder="Declutter, identify gaps, build outfits, reorganise…" className={`${controlClass} h-auto py-2.5`} /></Field></div>
  </div>;
}

function ImageUploadField({ id, label, files, onChange }: { id: string; label: string; files: File[]; onChange: (files: File[]) => void }) {
  return <div className="min-w-0">
    <label htmlFor={id} className="block text-xs font-medium text-[#4e4138]">{label}</label>
    <input
      id={id}
      type="file"
      accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
      multiple
      onChange={(event) => onChange(Array.from(event.target.files ?? []))}
      className="mt-1.5 block w-full rounded-[10px] border border-dashed border-[#cfc3b7] bg-white px-3 py-3 text-xs text-[#62564e] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#eee8e1] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#4f4239] hover:file:bg-[#e5ddd4]"
    />
    <p className="mt-1.5 text-xs leading-5 text-[#81746a]">JPEG, PNG, WebP or HEIC. Up to 10 MB per image and 10 images per request.</p>
    {files.length ? <ul className="mt-2 space-y-1 text-xs text-[#62564e]">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-[8px] bg-[#f1ece6] px-2.5 py-1.5"><span className="min-w-0 truncate">{file.name}</span><span className="shrink-0 tabular-nums text-[#81746a]">{formatFileSize(file.size)}</span></li>)}</ul> : null}
  </div>;
}

function withClient(form: RequestForm, client: ClientOption): RequestForm {
  return { ...form, clientId: client.id, clientName: client.name, clientEmail: client.email, clientPhone: client.phone, shippingCountry: client.country || form.shippingCountry };
}

function buildClientProfile(form: RequestForm) {
  const name = form.clientName.trim();
  const email = form.clientEmail.trim().toLowerCase();
  const phone = form.clientPhone.trim();

  return {
    fullName: name,
    email,
    phoneNumber: phone,
    phoneNumberNormalized: normalizePhoneForStorage(phone),
    onboardingCompleted: false,
    source: "admin-manual-request",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    profile: {
      fullName: name,
      phoneNumber: phone,
      contactPreferences: [],
      stylePreferences: [],
      favoriteBrands: [],
      dislikedBrands: [],
      shoppingPriorities: [],
      budgetComfortRange: "",
      fitNotes: "",
      giftingPreferences: "",
      clothingSizes: { tops: "", bottoms: "", dresses: "", shoes: "" },
      shippingAddress: {
        firstName: "",
        lastName: "",
        company: "",
        line1: "",
        line2: "",
        city: "",
        postcode: "",
        country: form.shippingCountry.trim(),
        phone,
      },
    },
  };
}

async function uploadReferenceImages({ requestId, mode, items, itemImages, serviceImages, uploadedPaths }: { requestId: string; mode: RequestMode; items: SourcingItem[]; itemImages: Record<string, File[]>; serviceImages: File[]; uploadedPaths: string[] }) {
  const uploads = mode === "item_sourcing"
    ? items.flatMap((item, itemIndex) =>
        (itemImages[item.id] ?? []).map((file, fileIndex) => ({
          file,
          label: `${item.item.trim() || `Item ${itemIndex + 1}`} reference ${fileIndex + 1}`,
          prefix: `item-${itemIndex + 1}-${fileIndex + 1}`,
        })),
      )
    : serviceImages.map((file, index) => ({
        file,
        label: `Reference image ${index + 1}`,
        prefix: `service-${index + 1}`,
      }));

  try {
    const references = [];
    for (const [index, upload] of uploads.entries()) {
      const path = `request-references/${requestId}/${upload.prefix}-${safeFileName(upload.file.name)}`;
      const imageReference = storageRef(storage, path);
      await uploadBytes(imageReference, upload.file, { contentType: upload.file.type });
      uploadedPaths.push(path);
      const value = await getDownloadURL(imageReference);
      references.push({
        id: `image-${index + 1}`,
        label: upload.label,
        type: "image",
        value,
        storagePath: path,
        fileName: upload.file.name,
        contentType: upload.file.type,
        size: upload.file.size,
      });
    }
    return references;
  } catch (error) {
    await Promise.allSettled(
      uploadedPaths.map((path) => deleteObject(storageRef(storage, path))),
    );
    uploadedPaths.length = 0;
    throw error;
  }
}

function buildServiceDetails(
  mode: RequestMode,
  items: SourcingItem[],
  stylingEdit: StylingEdit,
  wardrobeRefresh: WardrobeRefresh,
) {
  if (mode === "item_sourcing") {
    return {
      mode,
      items: items.map((item, index) => ({
        id: `item-${index + 1}`,
        item: item.item.trim(),
        make: item.make.trim(),
        model: item.model.trim(),
        size: item.size.trim(),
        colour: item.colour.trim(),
        condition: item.condition,
        budget: item.budget.trim(),
        notes: item.notes.trim(),
      })),
    };
  }

  if (mode === "styling_edit") {
    return {
      mode,
      editFor: stylingEdit.editFor,
      deliveryMode: stylingEdit.deliveryMode,
      occasion: stylingEdit.occasion.trim(),
      occasionDate: stylingEdit.occasionDate,
      numberOfLooks: stylingEdit.numberOfLooks.trim(),
      sizes: stylingEdit.sizes.trim(),
      budget: stylingEdit.budget.trim(),
      goals: stylingEdit.goals.trim(),
    };
  }

  return {
    mode,
    sessionMode: wardrobeRefresh.sessionMode,
    focus: wardrobeRefresh.focus,
    location: wardrobeRefresh.location.trim(),
    preferredDate: wardrobeRefresh.preferredDate,
    wardrobeSize: wardrobeRefresh.wardrobeSize.trim(),
    goals: wardrobeRefresh.goals.trim(),
  };
}

function validateModeDetails(
  mode: RequestMode,
  items: SourcingItem[],
  stylingEdit: StylingEdit,
  wardrobeRefresh: WardrobeRefresh,
) {
  if (mode === "item_sourcing") {
    if (!items.length || items.some((item) => !item.item.trim())) {
      return "Enter an item name for every sourcing item.";
    }
    return "";
  }
  if (mode === "styling_edit" && !stylingEdit.goals.trim()) {
    return "Describe what the styling edit should achieve.";
  }
  if (mode === "wardrobe_refresh" && !wardrobeRefresh.goals.trim()) {
    return "Describe what the wardrobe refresh should achieve.";
  }
  return "";
}

function validateForm(form: RequestForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.clientName.trim()) errors.clientName = "Enter the client or contact name.";
  if (form.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim())) errors.clientEmail = "Enter a valid email address or leave this blank.";
  if (!form.title.trim()) errors.title = "Enter a request title.";
  return errors;
}

function validateImageFiles(files: File[]) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
  if (files.length > 10) return "Add no more than 10 reference images to one request.";
  if (files.some((file) => !allowedTypes.has(file.type))) return "Reference images must be JPEG, PNG, WebP or HEIC files.";
  if (files.some((file) => file.size > 10 * 1024 * 1024)) return "Each reference image must be 10 MB or smaller.";
  return "";
}

function normalizeClient(id: string, data: Record<string, unknown>): ClientOption {
  const profile = isRecord(data.profile) ? data.profile : {};
  const address = isRecord(profile.shippingAddress) ? profile.shippingAddress : {};
  return { id, name: readString(profile.fullName) || readString(data.fullName) || "Unnamed client", email: readString(data.email), phone: readString(profile.phoneNumber) || readString(data.phoneNumber), country: readString(address.country) };
}

function createLocalId() { return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function safeFileName(value: string) { return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-120) || "image"; }
function formatFileSize(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`; }
function splitList(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function readString(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function formatDeadline(value: string) { if (!value) return ""; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(value); }
function errorCode(error: unknown) { return isRecord(error) && typeof error.code === "string" ? error.code.replace(/^firestore\//, "") : ""; }
