/**
 * Meta WhatsApp Cloud API — send + webhook helpers.
 * Mock/sandbox mode logs outbound messages so demos run without Meta tokens.
 */

const { isMockWhatsApp } = require("./env");

const outboundLog = [];

function getOutboundLog({ limit = 50, clear = false } = {}) {
  const slice = outboundLog.slice(-limit);
  if (clear) outboundLog.length = 0;
  return slice;
}

function waMeLink(phoneE164Digits, text) {
  const phone = String(phoneE164Digits || "").replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

async function sendText({ toPhone, body, tenantId }) {
  const to = String(toPhone).replace(/\D/g, "");
  const entry = {
    at: new Date().toISOString(),
    tenantId: tenantId || null,
    to,
    body,
    mode: isMockWhatsApp() ? "mock" : "cloud",
  };

  if (isMockWhatsApp()) {
    outboundLog.push(entry);
    console.log(`[WA mock → +${to}] ${body.slice(0, 120).replace(/\n/g, " | ")}`);
    return { mock: true, ...entry };
  }

  const token = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Cloud API error (${res.status})`);
    err.status = res.status;
    err.meta = data;
    throw err;
  }
  outboundLog.push({ ...entry, metaMessageId: data.messages?.[0]?.id });
  return data;
}

/**
 * Parse inbound WhatsApp Cloud API webhook payload.
 * Returns array of { from, text, messageId, timestamp, phoneNumberId }.
 */
function parseInboundWebhook(body) {
  const out = [];
  const entries = body?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const phoneNumberId = value.metadata?.phone_number_id;
      for (const msg of value.messages || []) {
        let text = "";
        if (msg.type === "text") text = msg.text?.body || "";
        else if (msg.type === "button") text = msg.button?.text || msg.button?.payload || "";
        else if (msg.type === "interactive") {
          text =
            msg.interactive?.button_reply?.title ||
            msg.interactive?.list_reply?.title ||
            msg.interactive?.button_reply?.id ||
            "";
        } else {
          text = `[${msg.type}]`;
        }
        out.push({
          from: msg.from,
          text: String(text).trim(),
          messageId: msg.id,
          timestamp: msg.timestamp,
          phoneNumberId,
          contactName: value.contacts?.[0]?.profile?.name || null,
        });
      }
    }
  }
  return out;
}

/** Meta webhook verification (GET hub.mode / hub.verify_token / hub.challenge). */
function verifyWebhookChallenge(query) {
  const mode = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const challenge = query.get("hub.challenge");
  const expected = process.env.META_WA_VERIFY_TOKEN || "catalpa_verify";
  if (mode === "subscribe" && token === expected) {
    return challenge;
  }
  return null;
}

module.exports = {
  sendText,
  waMeLink,
  parseInboundWebhook,
  verifyWebhookChallenge,
  getOutboundLog,
  isMockWhatsApp,
};
