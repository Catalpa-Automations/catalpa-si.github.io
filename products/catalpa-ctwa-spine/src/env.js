const fs = require("fs");
const path = require("path");

/** Minimal .env loader (no dotenv dependency). */
function loadEnv(filePath = path.join(__dirname, "..", ".env")) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function isMockWhatsApp() {
  const mode = (process.env.WHATSAPP_MODE || "mock").toLowerCase();
  if (mode === "mock" || mode === "sandbox") return true;
  const token = process.env.META_WA_ACCESS_TOKEN || "";
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID || "";
  return !token || !phoneId || token.includes("xxxxxxxx");
}

function isDemoPaystack() {
  const key = process.env.PAYSTACK_SECRET_KEY || "";
  return !key || key.includes("xxxxxxxx");
}

module.exports = { loadEnv, isMockWhatsApp, isDemoPaystack };
