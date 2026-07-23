const { BRAND, createLogoHtml, escapeHtml } = require("./email-brand");

const WELCOME_EMAIL_SUBJECT = "Welcome to Tufffinds";

function createWelcomeEmailBuilder({ logoUrl, whatsappUrl, contactUrl }) {
  const logoHtml = createLogoHtml(logoUrl);

  return function buildWelcomeEmail({ sourceLabel = "Email list signup" } = {}) {
    const safeSourceLabel = escapeHtml(sourceLabel);
    const safeContactUrl = escapeHtml(contactUrl);
    const safeWhatsappUrl = escapeHtml(whatsappUrl);

    const html = `
      <div style="margin:0; padding:0; background:${BRAND.cream}; font-family:Arial, Helvetica, sans-serif; color:${BRAND.black};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.cream}; padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px; background:${BRAND.cream};">
                <tr>
                  <td style="padding:26px 24px 18px 24px; text-align:center; background:${BRAND.cream};">
                    ${logoHtml({ width: 220 })}
                    <div style="margin-top:12px; font-size:11px; line-height:1.6; letter-spacing:1.9px; text-transform:uppercase; color:${BRAND.gold};">
                      Personal Shopping &amp; Sourcing
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px 24px 8px 24px;">
                    <div style="display:inline-block; padding:8px 13px; border-radius:999px; font-size:12px; letter-spacing:1.2px; text-transform:uppercase; color:${BRAND.taupe}; background:${BRAND.cream};">
                      ${safeSourceLabel}
                    </div>

                    <h1 style="margin:20px 0 16px 0; font-size:32px; line-height:1.15; letter-spacing:-0.6px; color:${BRAND.black}; font-weight:600;">
                      You’re on the list.
                    </h1>

                    <p style="margin:0 0 18px 0; font-size:17px; line-height:1.75; color:${BRAND.charcoal};">
                      Thank you for joining Tufffinds. We’ll keep you updated with new finds, styling edits, sourcing updates and selected pieces from the world of luxury fashion.
                    </p>

                    <p style="margin:0; font-size:17px; line-height:1.75; color:${BRAND.charcoal};">
                      Looking for something now? Send us your brief or message us on WhatsApp and our team will be happy to help.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:22px 24px 6px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.softCream}; border:1px solid ${BRAND.border}; border-radius:14px;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <div style="font-size:12px; line-height:1.6; letter-spacing:1.5px; text-transform:uppercase; color:${BRAND.gold}; margin-bottom:10px;">
                            What you can expect
                          </div>
                          <p style="margin:0; font-size:15px; line-height:1.7; color:${BRAND.muted};">
                            New finds, styling edits, sourcing updates and selected pieces, shared thoughtfully by the Tufffinds team.
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
                          <a href="${safeContactUrl}" style="display:inline-block; padding:15px 28px; font-size:12px; line-height:1; letter-spacing:1.4px; color:${BRAND.white}; text-decoration:none; font-weight:700;">
                            Send us your brief
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:14px 0 0 0; font-size:13px; line-height:1.7; color:${BRAND.muted};">
                      Prefer WhatsApp? <a href="${safeWhatsappUrl}" style="color:${BRAND.brown}; font-weight:700; text-decoration:underline;">Message the Tufffinds team</a>.
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
                      Personal Shopping &amp; Sourcing
                    </p>
                    <p style="margin:0; font-size:13px; line-height:1.7; color:${BRAND.muted};">
                      info@tufffinds.com<br />
                      tufffinds.com<br />
                      Instagram: @tufffinds
                    </p>
                    <p style="margin:14px 0 0 0; font-size:11px; line-height:1.65; color:${BRAND.muted};">
                      You received this email because you joined the Tufffinds email list. To stop receiving emails, reply with “unsubscribe” or contact info@tufffinds.com.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const text = `You’re on the list.

Thank you for joining Tufffinds. We’ll keep you updated with new finds, styling edits, sourcing updates and selected pieces from the world of luxury fashion.

Looking for something now? Send us your brief or message us on WhatsApp and our team will be happy to help.

Send us your brief: ${contactUrl}
Message us on WhatsApp: ${whatsappUrl}

Warmly,
The Tufffinds Team

You received this email because you joined the Tufffinds email list. To stop receiving emails, reply with “unsubscribe” or contact info@tufffinds.com.`;

    return {
      subject: WELCOME_EMAIL_SUBJECT,
      html,
      text,
    };
  };
}

module.exports = {
  createWelcomeEmailBuilder,
};
