/** Ghana phone + wa.me helpers (no Meta API — ship today). */

function normalizeGhPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "233" + d.slice(1);
  if (d.length === 9 && /^[235]/.test(d)) d = "233" + d;
  return d;
}

function waMeLink(phoneE164Digits, text) {
  const phone = normalizeGhPhone(phoneE164Digits);
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return phone ? `https://wa.me/${phone}${q}` : "";
}

function businessWaLink(text) {
  const phone = normalizeGhPhone(process.env.BUSINESS_WHATSAPP || "");
  return waMeLink(phone, text);
}

module.exports = { normalizeGhPhone, waMeLink, businessWaLink };
