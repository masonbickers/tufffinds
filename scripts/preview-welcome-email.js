async function generatePreview() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const campaignEmailModule = await import("../functions/email-campaigns.js");
  const { buildEmailTemplate } = campaignEmailModule.default;
  const { html } = buildEmailTemplate("welcome");
  const outputDirectory = path.resolve(__dirname, "..", ".email-previews");
  const outputPath = path.join(outputDirectory, "welcome-email.html");

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");

  console.log(outputPath);
}

void generatePreview();
