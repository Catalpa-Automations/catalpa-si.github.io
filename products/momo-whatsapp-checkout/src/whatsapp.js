/**
 * WhatsApp notify — Meta channel, Catalpa ops.
 *
 * We never replace WhatsApp. We open or message the existing Meta chat:
 *   manual (default): official wa.me / click-to-chat deep links (no WABA delay)
 *   cloud:            WhatsApp Cloud API templates (after Meta Business + WABA)
 *   twilio:           optional Meta BSP / sandbox bridge while Cloud API is pending
 */

function sellerWhatsApp() {
  return String(process.env.SELLER_WHATSAPP || "").replace(/\D/g, "");
}

function formatOrderMessage(order, { paid } = {}) {
  const seller = process.env.SELLER_NAME || "Seller";
  const lines = [
    paid ? `✅ *PAID* — ${seller}` : `🛒 New order — ${seller}`,
    `Order: ${order.id}`,
    `Item: ${order.productName} × ${order.qty}`,
    `Amount: GHS ${order.amountGhs.toFixed(2)}`,
    `Buyer: ${order.buyerName}`,
    `WhatsApp: +${order.buyerPhone}`,
  ];
  if (order.note) lines.push(`Note: ${order.note}`);
  if (paid && order.paystackReference) {
    lines.push(`Paystack ref: ${order.paystackReference}`);
  }
  lines.push("", "_Sent via Catalpa checkout · chat stays on WhatsApp_");
  return lines.join("\n");
}

/** Official Meta click-to-chat URL — https://faq.whatsapp.com/591339308402805 */
function waMeLink(phoneE164Digits, text) {
  const phone = String(phoneE164Digits || "").replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** Links that open native WhatsApp with a prefilled PAID/order message. */
function buildManualLinks(order, { paid } = {}) {
  const text = formatOrderMessage(order, { paid });
  return {
    mode: "manual",
    channel: "whatsapp_meta_wame",
    message: text,
    sellerNotifyUrl: waMeLink(sellerWhatsApp(), text),
    buyerNotifyUrl: waMeLink(order.buyerPhone, text),
  };
}

/**
 * WhatsApp Cloud API — stub for post-WABA production.
 * Set WHATSAPP_MODE=cloud and fill META_* env vars when approved.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
async function sendCloudApiWhatsApp({ toPhone, body }) {
  const token = process.env.META_WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    const err = new Error(
      "META_WA_ACCESS_TOKEN / META_WA_PHONE_NUMBER_ID missing — use WHATSAPP_MODE=manual until WABA is ready"
    );
    err.status = 503;
    throw err;
  }

  const to = String(toPhone).replace(/\D/g, "");
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
  return data;
}

async function sendTwilioWhatsApp({ toPhone, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!sid || !token) {
    const err = new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing");
    err.status = 503;
    throw err;
  }

  const to = toPhone.startsWith("whatsapp:")
    ? toPhone
    : `whatsapp:+${String(toPhone).replace(/\D/g, "")}`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ From: from, To: to, Body: body });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Twilio error (${res.status})`);
    err.status = res.status;
    err.twilio = data;
    throw err;
  }
  return data;
}

async function notifyOrder(order, { paid } = {}) {
  const mode = (process.env.WHATSAPP_MODE || "manual").toLowerCase();
  const message = formatOrderMessage(order, { paid });
  const links = buildManualLinks(order, { paid });

  if (mode === "manual") {
    return { ...links, sent: false };
  }

  const send =
    mode === "cloud"
      ? (phone) => sendCloudApiWhatsApp({ toPhone: phone, body: message })
      : (phone) => sendTwilioWhatsApp({ toPhone: phone, body: message });

  const results = {
    mode,
    channel: mode === "cloud" ? "whatsapp_cloud_api" : "twilio_bsp",
    message,
    sent: true,
    errors: [],
    ...links,
  };

  try {
    await send(order.buyerPhone);
  } catch (e) {
    results.errors.push({ to: "buyer", error: e.message });
  }

  const seller = sellerWhatsApp();
  if (seller) {
    try {
      await send(seller);
    } catch (e) {
      results.errors.push({ to: "seller", error: e.message });
    }
  }

  return results;
}

module.exports = {
  formatOrderMessage,
  buildManualLinks,
  notifyOrder,
  waMeLink,
};
