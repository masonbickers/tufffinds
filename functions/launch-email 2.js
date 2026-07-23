const { createCustomerEmailLayout } = require("./customer-email-layout");

const LAUNCH_EMAIL_SUBJECT = "Tufffinds is now live";
const LAUNCH_FOOTER_NOTICE =
  "You received this email because you joined the Tufffinds email list. You can unsubscribe at any time by replying “unsubscribe” or contacting info@tufffinds.com.";

function createLaunchEmailBuilder({
  logoUrl,
  whatsappUrl,
  siteUrl,
  contactUrl,
}) {
  const buildCustomerEmailHtml = createCustomerEmailLayout({
    logoUrl,
    whatsappUrl,
  });

  return function buildLaunchEmail() {
    const html = buildCustomerEmailHtml({
      contentEyebrow: "THE WAIT IS OVER",
      heading: "Tufffinds is now live.",
      paragraphs: [
        "We’re so excited to finally welcome you to Tufffinds.",
        "Our new website is now live — a place to discover more about our personal shopping and sourcing service, explore how we work and send us your sourcing brief directly.",
        "Whether you’re searching for a specific piece, building the perfect wardrobe or looking for something impossible to find, we’d love to help.",
      ],
      panelEyebrow: "Personal shopping & sourcing",
      panelBody:
        "Discover how Tufffinds works, explore our services and send the team your sourcing brief directly from the new website.",
      actions: [
        { label: "VISIT TUFFFINDS", url: siteUrl },
        { label: "SEND US YOUR BRIEF", url: contactUrl },
      ],
      footerNotice: LAUNCH_FOOTER_NOTICE,
    });

    const text = `THE WAIT IS OVER

Tufffinds is now live.

We’re so excited to finally welcome you to Tufffinds.

Our new website is now live — a place to discover more about our personal shopping and sourcing service, explore how we work and send us your sourcing brief directly.

Whether you’re searching for a specific piece, building the perfect wardrobe or looking for something impossible to find, we’d love to help.

VISIT TUFFFINDS: ${siteUrl}
SEND US YOUR BRIEF: ${contactUrl}
Message us on WhatsApp: ${whatsappUrl}

Warmly,
The Tufffinds Team

${LAUNCH_FOOTER_NOTICE}`;

    return {
      subject: LAUNCH_EMAIL_SUBJECT,
      html,
      text,
    };
  };
}

module.exports = {
  createLaunchEmailBuilder,
};
