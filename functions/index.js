const { setGlobalOptions } = require("firebase-functions");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const { Resend } = require("resend");

setGlobalOptions({ maxInstances: 10 });

const BRAND = {
  cream: "#F8F4EF",
  softCream: "#FCFAF7",
  white: "#FFFFFF",
  black: "#151515",
  brown: "#40342F",
  charcoal: "#2B2927",
  taupe: "#8A7A6A",
  gold: "#B89B72",
  border: "#E8DDD0",
  muted: "#6F675F",
};

const SITE_URL = (
  process.env.SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://tufffinds.com"
).replace(/\/$/, "");

const WHATSAPP_URL =
  process.env.WHATSAPP_URL ||
  "https://wa.me/447591207418?text=Hi%20Tufffinds%2C%20I%27ve%20submitted%20a%20sourcing%20brief.";

const LOGO_URL = process.env.BRAND_LOGO_URL || `${SITE_URL}/finallogobrown.png`;

function logoHtml({ width = 220, margin = "0 auto 8px auto" } = {}) {
  return `
    <div style="margin:${margin}; text-align:center;">
      <img src="${LOGO_URL}" width="${width}" alt="Tufffinds" style="display:block; width:${width}px; max-width:100%; height:auto; margin:0 auto; border:0; outline:none; text-decoration:none;" />
      <div style="mso-hide:all; display:none; max-height:0; overflow:hidden; font-family:Georgia, 'Times New Roman', serif; font-size:24px; line-height:1; font-style:italic; letter-spacing:-0.4px; color:${BRAND.black}; white-space:nowrap;">
        TUFFFINDS
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMultiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function formatNamePart(value, fallback = "there") {
  const part = String(value || "").trim();

  if (!part) return fallback;

  return part
    .split("-")
    .map((segment) =>
      segment
        ? `${segment.charAt(0).toUpperCase()}${segment.slice(1).toLowerCase()}`
        : segment
    )
    .join("-");
}

exports.sendTufffindsRequestEmails = onDocumentCreated(
  {
    document: "requests/{requestId}",
    region: "europe-west2",
  },
  async (event) => {
    const snap = event.data;

    if (!snap) {
      logger.warn("No request document found.");
      return;
    }

    const request = snap.data();
    const requestId = event.params.requestId;

    const detail = request.detail || {};

    const customerEmail = request.clientEmail || request.email;
    const rawFullName =
      request.clientName || request.fullName || request.name || "New customer";
    const formattedFullName = String(rawFullName)
      .trim()
      .split(/\s+/)
      .map((part) => formatNamePart(part, ""))
      .filter(Boolean)
      .join(" ") || "New customer";
    const firstName = formatNamePart(formattedFullName.split(" ")[0], "there");

    const phone = request.phone || request.clientPhone || "Not provided";

    const brief =
      detail.notes ||
      detail.styleNotes ||
      request.brief ||
      request.message ||
      "No brief provided";

    const requestType =
      detail.requestType || request.requestType || "Website enquiry";
    const purchaseMode = detail.purchaseMode || "Not provided";
    const shippingCountry = detail.shippingCountry || "Not provided";
    const urgency = detail.urgency || "Not provided";
    const source = request.source || "Website";

    if (!customerEmail) {
      logger.warn(`Request ${requestId} has no email address.`);
      return;
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      logger.error("Missing RESEND_API_KEY environment variable.");
      return;
    }

    const resend = new Resend(resendApiKey);
    const adminEmail = process.env.ADMIN_EMAIL || "info@tufffinds.com";

    const safeFirstName = escapeHtml(firstName);
    const safeFullName = escapeHtml(formattedFullName);
    const safeCustomerEmail = escapeHtml(customerEmail);
    const safePhone = escapeHtml(phone);
    const safeBrief = formatMultiline(brief);
    const safeRequestType = escapeHtml(requestType);
    const safePurchaseMode = escapeHtml(purchaseMode);
    const safeShippingCountry = escapeHtml(shippingCountry);
    const safeUrgency = escapeHtml(urgency);
    const safeRequestId = escapeHtml(requestId);
    const safeSource = escapeHtml(source);

    const customerHtml = `
      <div style="margin:0; padding:0; background:${BRAND.cream}; font-family:Arial, Helvetica, sans-serif; color:${BRAND.black};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.cream}; padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px; background:${BRAND.cream};">
                
                <tr>
                  <td style="padding:26px 24px 18px 24px; text-align:center; background:${BRAND.cream};">
                    ${logoHtml({ width: 220 })}
                    <div style="margin-top:12px; font-size:11px; line-height:1.6; letter-spacing:1.9px; text-transform:uppercase; color:${BRAND.gold};">
                      Personal Shopping & Sourcing
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px 24px 8px 24px;">
                    <div style="display:inline-block; padding:8px 13px; border-radius:999px; font-size:12px; letter-spacing:1.2px; text-transform:uppercase; color:${BRAND.taupe}; background:${BRAND.cream};">
                      Enquiry received
                    </div>

                    <h1 style="margin:20px 0 16px 0; font-size:32px; line-height:1.15; letter-spacing:-0.6px; color:${BRAND.black}; font-weight:600;">
                      Thank you, ${safeFirstName}
                    </h1>

                    <p style="margin:0 0 18px 0; font-size:17px; line-height:1.75; color:${BRAND.charcoal};">
                      We’ve received your Tufffinds enquiry and our team will review your brief shortly.
                    </p>

                    <p style="margin:0; font-size:17px; line-height:1.75; color:${BRAND.charcoal};">
                      We’ll be in touch by email once we have an update, or if we need any further details from you.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:22px 24px 6px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.softCream}; border:1px solid ${BRAND.border}; border-radius:14px;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <div style="font-size:12px; line-height:1.6; letter-spacing:1.5px; text-transform:uppercase; color:${BRAND.gold}; margin-bottom:10px;">
                            Your enquiry details
                          </div>
                          <p style="margin:0 0 6px 0; font-size:14px; line-height:1.6; color:${BRAND.muted};">
                            <strong style="color:${BRAND.charcoal};">Name:</strong> ${safeFullName}
                          </p>
                          <p style="margin:0 0 6px 0; font-size:14px; line-height:1.6; color:${BRAND.muted};">
                            <strong style="color:${BRAND.charcoal};">Email:</strong> ${safeCustomerEmail}
                          </p>
                          <p style="margin:0 0 6px 0; font-size:14px; line-height:1.6; color:${BRAND.muted};">
                            <strong style="color:${BRAND.charcoal};">Phone:</strong> ${safePhone}
                          </p>
                          <p style="margin:0; font-size:14px; line-height:1.65; color:${BRAND.muted};">
                            <strong style="color:${BRAND.charcoal};">Brief:</strong> ${safeBrief}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px 24px 8px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.cream};">
                      <tr>
                        <td style="padding:22px;">
                          <div style="font-size:13px; line-height:1.6; letter-spacing:1.5px; text-transform:uppercase; color:${BRAND.gold}; margin-bottom:8px;">
                            What happens next
                          </div>
                          <p style="margin:0; font-size:15px; line-height:1.7; color:${BRAND.muted};">
                            Your enquiry has been added to our client request list. Our team will carefully review your brief and respond directly by email with the next steps.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 24px 6px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="background:${BRAND.brown};">
                          <a href="${WHATSAPP_URL}" style="display:inline-block; padding:15px 28px; font-size:12px; line-height:1; letter-spacing:1.4px; color:${BRAND.white}; text-decoration:none; font-weight:700;">
                            Message us on WhatsApp
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:14px 0 0 0; font-size:13px; line-height:1.7; color:${BRAND.muted};">
                      Prefer WhatsApp? Send us a message with any extra details, reference images, sizing or budget notes.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:22px 24px 36px 24px;">
                    <p style="margin:0 0 3px 0; font-size:17px; line-height:1.7; color:${BRAND.charcoal};">
                      Warmly,
                    </p>
                    <p style="margin:0; font-size:17px; line-height:1.7; color:${BRAND.black}; font-weight:700;">
                      The Tufffinds Team
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px; background:${BRAND.cream}; text-align:center;">
                    ${logoHtml({ width: 150, margin: "0 auto 10px auto" })}
                    <p style="margin:0 0 8px 0; font-size:11px; line-height:1.6; letter-spacing:1.8px; text-transform:uppercase; color:${BRAND.gold};">
                      Personal Shopping & Sourcing
                    </p>
                    <p style="margin:0; font-size:13px; line-height:1.7; color:${BRAND.muted};">
                      info@tufffinds.com<br />
                      tufffinds.com<br />
                      Instagram: @tufffinds
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const adminHtml = `
      <div style="margin:0; padding:0; background:#F4F1ED; font-family:Arial, Helvetica, sans-serif; color:${BRAND.black};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F1ED; padding:34px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px; background:${BRAND.white}; border:1px solid ${BRAND.border}; border-radius:20px; overflow:hidden;">
                
                <tr>
                  <td style="padding:28px 30px; background:${BRAND.softCream}; border-bottom:1px solid ${BRAND.border};">
                    <div style="text-align:left; margin:0 0 18px 0;">
                      <img src="${LOGO_URL}" width="170" alt="Tufffinds" style="display:block; width:170px; max-width:78%; height:auto; margin:0; border:0; outline:none; text-decoration:none;" />
                      <div style="mso-hide:all; display:none; max-height:0; overflow:hidden; font-family:Georgia, 'Times New Roman', serif; font-size:22px; line-height:1; font-style:italic; letter-spacing:-0.4px; color:${BRAND.black}; white-space:nowrap;">
                        TUFFFINDS
                      </div>
                    </div>
                    <div style="font-size:11px; line-height:1.6; letter-spacing:2px; text-transform:uppercase; color:${BRAND.gold}; margin-bottom:8px;">
                      Website enquiry
                    </div>
                    <h1 style="margin:0; font-size:28px; line-height:1.2; color:${BRAND.black};">
                      New Tufffinds enquiry
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:28px 30px 12px 30px;">
                    <h2 style="margin:0 0 18px 0; font-size:20px; line-height:1.3; color:${BRAND.black};">
                      Client details
                    </h2>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; width:160px; color:${BRAND.muted}; font-size:14px;">Name</td>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.black}; font-size:15px; font-weight:700;">${safeFullName}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.muted}; font-size:14px;">Email</td>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.black}; font-size:15px;">${safeCustomerEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.muted}; font-size:14px;">Phone</td>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.black}; font-size:15px;">${safePhone}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 30px 12px 30px;">
                    <h2 style="margin:0 0 18px 0; font-size:20px; line-height:1.3; color:${BRAND.black};">
                      Request details
                    </h2>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; width:160px; color:${BRAND.muted}; font-size:14px;">Type</td>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.black}; font-size:15px;">${safeRequestType}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.muted}; font-size:14px;">Purchase mode</td>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.black}; font-size:15px;">${safePurchaseMode}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.muted}; font-size:14px;">Shipping country</td>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.black}; font-size:15px;">${safeShippingCountry}</td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.muted}; font-size:14px;">Urgency</td>
                        <td style="padding:12px 0; border-bottom:1px solid ${BRAND.border}; color:${BRAND.black}; font-size:15px;">${safeUrgency}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 30px;">
                    <h2 style="margin:0 0 12px 0; font-size:20px; line-height:1.3; color:${BRAND.black};">
                      Brief / notes
                    </h2>
                    <div style="padding:18px 20px; background:${BRAND.softCream}; border:1px solid ${BRAND.border}; border-radius:14px; font-size:15px; line-height:1.7; color:${BRAND.charcoal};">
                      ${safeBrief}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 30px 30px 30px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FAF8F5; border:1px solid ${BRAND.border}; border-radius:14px;">
                      <tr>
                        <td style="padding:16px 18px;">
                          <p style="margin:0 0 8px 0; font-size:13px; line-height:1.6; color:${BRAND.muted};">
                            <strong>Request ID:</strong> ${safeRequestId}
                          </p>
                          <p style="margin:0; font-size:13px; line-height:1.6; color:${BRAND.muted};">
                            <strong>Source:</strong> ${safeSource}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    await resend.emails.send({
      from: "Tufffinds <info@tufffinds.com>",
      to: customerEmail,
      subject: "We’ve received your Tufffinds enquiry",
      html: customerHtml,
    });

    await resend.emails.send({
      from: "Tufffinds Website <info@tufffinds.com>",
      to: adminEmail,
      replyTo: customerEmail,
      subject: `New Tufffinds enquiry from ${formattedFullName}`,
      html: adminHtml,
    });

    logger.info(`Emails sent for request ${requestId}`);
  }
);
