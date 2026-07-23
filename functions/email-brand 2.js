const BRAND = Object.freeze({
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
});

function createLogoHtml(logoUrl) {
  return function logoHtml({ width = 220, margin = "0 auto 8px auto" } = {}) {
    return `
    <div style="margin:${margin}; text-align:center;">
      <img src="${logoUrl}" width="${width}" alt="Tufffinds" style="display:block; width:${width}px; max-width:100%; height:auto; margin:0 auto; border:0; outline:none; text-decoration:none;" />
      <div style="mso-hide:all; display:none; max-height:0; overflow:hidden; font-family:Georgia, 'Times New Roman', serif; font-size:24px; line-height:1; font-style:italic; letter-spacing:-0.4px; color:${BRAND.black}; white-space:nowrap;">
        TUFFFINDS
      </div>
    </div>
  `;
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

module.exports = {
  BRAND,
  createLogoHtml,
  escapeHtml,
};
