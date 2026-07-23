const projectId = process.env.FIREBASE_PROJECT_ID || "demo-tufffinds";
const firestoreBase = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`;
const authBase = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
const adminEmail = "admin@tufffinds.local";
const adminPassword = "sample-admin-123";

async function waitForEmulator(url, label) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // The emulator is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${label} emulator did not become ready`);
}

function encode(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encode) } };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, encode(entry)]),
        ),
      },
    };
  }
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  return { stringValue: String(value) };
}

async function putDocument(collection, id, data) {
  const response = await fetch(
    `${firestoreBase}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, encode(value)]),
        ),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Could not seed ${collection}/${id}: ${await response.text()}`);
  }
}

await waitForEmulator("http://127.0.0.1:8080", "Firestore");
await waitForEmulator("http://127.0.0.1:9099", "Auth");

const authResponse = await fetch(`${authBase}/accounts:signUp?key=demo-key`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: adminEmail,
    password: adminPassword,
    returnSecureToken: true,
  }),
});
const authResult = await authResponse.json();
if (!authResponse.ok || !authResult.localId) {
  throw new Error(`Could not seed sample admin: ${JSON.stringify(authResult)}`);
}

const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 86_400_000);

await Promise.all([
  putDocument("admin_users", authResult.localId, {
    active: true,
    role: "admin",
    email: adminEmail,
  }),
  putDocument("client_profiles", "client-ava", {
    email: "ava@example.test",
    fullName: "Ava Morgan",
    phoneNumber: "+44 7700 900101",
    phoneNumberNormalized: "+447700900101",
    onboardingCompleted: true,
    createdAt: daysAgo(45),
    updatedAt: daysAgo(1),
    profile: {
      fullName: "Ava Morgan",
      phoneNumber: "+44 7700 900101",
      budgetComfortRange: "£500–£1,200",
      clothingSizes: { tops: "UK 10", bottoms: "UK 10", dresses: "UK 10", shoes: "UK 6" },
      contactPreferences: ["WhatsApp", "Email"],
      favoriteBrands: ["Toteme", "The Row", "Khaite"],
      dislikedBrands: ["Logo-heavy pieces"],
      fitNotes: "Prefers relaxed tailoring and full-length trousers.",
      giftingPreferences: "No gifts currently planned.",
      shoppingPriorities: ["Quality", "Versatility"],
      stylePreferences: ["Minimal", "Neutral", "Tailored"],
      shippingAddress: {
        firstName: "Ava", lastName: "Morgan", country: "United Kingdom",
        line1: "18 Sample Street", line2: "", company: "", city: "London",
        postcode: "W1A 1AA", phone: "+44 7700 900101",
      },
    },
  }),
  putDocument("client_profiles", "client-maya", {
    email: "maya@example.test",
    fullName: "Maya Okafor",
    phoneNumber: "+44 7700 900202",
    phoneNumberNormalized: "+447700900202",
    onboardingCompleted: true,
    createdAt: daysAgo(21),
    updatedAt: daysAgo(2),
    profile: {
      fullName: "Maya Okafor",
      phoneNumber: "+44 7700 900202",
      budgetComfortRange: "£250–£700",
      clothingSizes: { tops: "UK 12", bottoms: "UK 12", dresses: "UK 12", shoes: "UK 7" },
      contactPreferences: ["Email"],
      favoriteBrands: ["Ganni", "Staud", "Jacquemus"],
      dislikedBrands: [],
      fitNotes: "Likes colour and strong silhouettes.",
      giftingPreferences: "Birthday gifts in September.",
      shoppingPriorities: ["Statement pieces", "Fast delivery"],
      stylePreferences: ["Colourful", "Contemporary"],
      shippingAddress: {
        firstName: "Maya", lastName: "Okafor", country: "United Kingdom",
        line1: "42 Example Road", line2: "Flat 3", company: "", city: "Manchester",
        postcode: "M1 1AE", phone: "+44 7700 900202",
      },
    },
  }),
  putDocument("requests", "request-summer-event", {
    clientId: "client-ava",
    clientName: "Ava Morgan",
    clientEmail: "ava@example.test",
    status: "sourcing",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
    detail: {
      id: "request-summer-event",
      title: "Summer event wardrobe",
      requestType: "Occasion styling",
      status: "sourcing",
      urgency: "timely",
      notes: "Source a polished dinner look and a lighter daytime option.",
      styleNotes: "Warm neutrals, clean lines, no prominent logos.",
      categories: ["Dresses", "Shoes", "Bags"],
      favoriteBrands: ["Khaite", "Toteme"],
      dislikedBrands: ["Logo-heavy pieces"],
      shippingCountry: "United Kingdom",
      purchaseMode: "invoice-me-first",
      references: [], linkedEdits: [], linkedMessagesPreview: [],
      activitySummary: [], statusTimeline: [],
      createdDateLabel: "16 July 2026",
      whatHappensNext: "Stylist is preparing the first edit.",
      href: "/admin/requests/request-summer-event",
    },
  }),
  putDocument("requests", "request-birthday-bag", {
    clientId: "client-maya",
    clientName: "Maya Okafor",
    clientEmail: "maya@example.test",
    status: "needs_info",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
    detail: {
      id: "request-birthday-bag",
      title: "Birthday statement bag",
      requestType: "Single item search",
      status: "needs_info",
      urgency: "flexible",
      notes: "Find a colourful evening bag under £700.",
      styleNotes: "Sculptural shapes welcome.",
      categories: ["Bags"], favoriteBrands: ["Staud"], dislikedBrands: [],
      shippingCountry: "United Kingdom", purchaseMode: "recommendation-only",
      references: [], linkedEdits: [], linkedMessagesPreview: [],
      activitySummary: [], statusTimeline: [],
      createdDateLabel: "20 July 2026",
      whatHappensNext: "Confirm preferred colours with the client.",
      href: "/admin/requests/request-birthday-bag",
    },
  }),
  putDocument("orders", "order-khaite-dress", {
    clientId: "client-ava", clientEmail: "ava@example.test",
    requestId: "request-summer-event", title: "Khaite Livia midi dress",
    brand: "Khaite", item: "Livia midi dress", size: "UK 10", colour: "Sand",
    status: "paid", salePrice: 980, costPrice: 760, currency: "GBP",
    invoiceNumber: "TF-2026-0104", supplier: "Sample Boutique",
    courier: "", trackingNumber: "", createdAt: daysAgo(4), updatedAt: daysAgo(1),
  }),
  putDocument("message_threads", "thread-ava-summer", {
    clientId: "client-ava",
    lastMessagePreview: "The neutral dress option sounds perfect—thank you!",
    unreadCount: 1,
    updatedAt: daysAgo(1),
    detail: {
      id: "thread-ava-summer", title: "Summer event wardrobe",
      participantName: "Ava Morgan", composerPlaceholder: "Reply to Ava…",
      lifecycleLinks: [{ href: "/admin/requests/request-summer-event", label: "Summer event wardrobe", type: "request" }],
      messages: [
        { id: "message-1", body: "I’d love something polished but still easy to wear.", timestampLabel: "21 July, 10:14", type: "client" },
        { id: "message-2", body: "The neutral dress option sounds perfect—thank you!", timestampLabel: "22 July, 16:40", type: "client" },
      ],
    },
  }),
]);

console.log(`Sample data ready. Sign in with ${adminEmail} / ${adminPassword}`);
