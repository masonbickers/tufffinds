const { BRAND, createLogoHtml, escapeHtml } = require("./email-brand");

function createCustomerEmailLayout({ logoUrl, whatsappUrl }) {
  const logoHtml = createLogoHtml(logoUrl);

  return function buildCustomerEmailHtml({
    contentEyebrow,
    heading,
    paragraphs,
    panelEyebrow,
    panelBody,
    actions,
    footerNotice,
  }) {
    const safeWhatsappUrl = escapeHtml(whatsappUrl);
    const paragraphHtml = paragraphs
      .map(
        (paragraph, index) => `
                    <p style="margin:0${index < paragraphs.length - 1 ? " 0 18px 0" : ""}; font-size:17px; line-height:1.75; color:${BRAND.charcoal};">
                      ${escapeHtml(paragraph)}
                    </p>`
      )
      .join("");
    const actionHtml = actions
      .map(
        (action, index) => `
                    <table role="presentation" cellspacing="0" cellpadding="0"${index ? ' style="margin-top:12px;"' : ""}>
                      <tr>
                        <td style="background:${BRAND.brown};">
                          <a href="${escapeHtml(action.url)}" style="display:inline-block; padding:15px 28px; font-size:12px; line-height:1; letter-spacing:1.4px; color:${BRAND.white}; text-decoration:none; font-weight:700;">
                            ${escapeHtml(action.label)}
                          </a>
                        </td>
                      </tr>
                    </table>`
      )
      .join("");

    return `
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
                    <div style="font-size:12px; line-height:1.6; letter-spacing:1.5px; text-transform:uppercase; color:${BRAND.gold};">
                      ${escapeHtml(contentEyebrow)}
                    </div>

                    <h1 style="margin:20px 0 16px 0; font-size:32px; line-height:1.15; letter-spacing:-0.6px; color:${BRAND.black}; font-weight:600;">
                      ${escapeHtml(heading)}
                    </h1>
${paragraphHtml}
                  </td>
                </tr>

                <tr>
                  <td style="padding:22px 24px 6px 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.softCream}; border:1px solid ${BRAND.border}; border-radius:14px;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <div style="font-size:12px; line-height:1.6; letter-spacing:1.5px; text-transform:uppercase; color:${BRAND.gold}; margin-bottom:10px;">
                            ${escapeHtml(panelEyebrow)}
                          </div>
                          <p style="margin:0; font-size:15px; line-height:1.7; color:${BRAND.muted};">
                            ${escapeHtml(panelBody)}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:18px 24px 6px 24px;">
${actionHtml}
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
                      ${escapeHtml(footerNotice)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
  };
}

module.exports = {
  createCustomerEmailLayout,
};
