const { createCustomerEmailLayout } = require("./customer-email-layout");

const WELCOME_EMAIL_SUBJECT = "Welcome to Tufffinds";
const WELCOME_FOOTER_NOTICE =
  "You received this email because you joined the Tufffinds email list. To stop receiving emails, reply with “unsubscribe” or contact info@tufffinds.com.";

function createWelcomeEmailBuilder({ logoUrl, whatsappUrl, contactUrl }) {
  const buildCustomerEmailHtml = createCustomerEmailLayout({
    logoUrl,
    whatsappUrl,
  });

  return function buildWelcomeEmail({ sourceLabel = "Email list signup" } = {}) {
    const html = buildCustomerEmailHtml({
      contentEyebrow: sourceLabel,
      heading: "You’re on the list.",
      paragraphs: [
        "Thank you for joining Tufffinds. We’ll keep you updated with new finds, styling edits, sourcing updates and selected pieces from the world of luxury fashion.",
        "Looking for something now? Send us your brief or message us on WhatsApp and our team will be happy to help.",
      ],
      panelEyebrow: "What you can expect",
      panelBody:
        "New finds, styling edits, sourcing updates and selected pieces, shared thoughtfully by the Tufffinds team.",
      actions: [{ label: "Send us your brief", url: contactUrl }],
      footerNotice: WELCOME_FOOTER_NOTICE,
    });

    const text = `You’re on the list.

Thank you for joining Tufffinds. We’ll keep you updated with new finds, styling edits, sourcing updates and selected pieces from the world of luxury fashion.

Looking for something now? Send us your brief or message us on WhatsApp and our team will be happy to help.

Send us your brief: ${contactUrl}
Message us on WhatsApp: ${whatsappUrl}

Warmly,
The Tufffinds Team

${WELCOME_FOOTER_NOTICE}`;

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
