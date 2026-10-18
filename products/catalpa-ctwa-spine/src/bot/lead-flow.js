/**
 * Dogfood lead bot for tenant `catalpa` (mode: leads).
 * Flow: greet → business type → city → WhatsApp number → Meta ads? → demo or capture → notify Samuel.
 */

const store = require("../store");
const replies = require("./replies");
const whatsapp = require("../whatsapp");

const LEAD_STATES = [
  "greet",
  "ask_business_type",
  "ask_city",
  "ask_whatsapp",
  "ask_meta_ads",
  "ask_intent",
  "done",
];

function isLeadTenant(tenantId) {
  const cat = store.getCatalog(tenantId);
  return cat.mode === "leads";
}

function normalizeInput(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseYesNo(input) {
  if (["yes", "y", "yeah", "yep", "true", "1", "we do", "i do"].includes(input)) {
    return true;
  }
  if (["no", "n", "nope", "false", "0", "not yet", "nah"].includes(input)) {
    return false;
  }
  return null;
}

function parseIntent(input) {
  if (
    ["1", "demo", "see live demo", "live demo", "book", "book demo", "see demo"].includes(
      input
    ) ||
    input.includes("demo")
  ) {
    return "demo";
  }
  if (
    ["2", "lead", "details", "call me", "later", "just lead", "leave details"].includes(
      input
    ) ||
    input.includes("later") ||
    input.includes("call")
  ) {
    return "lead";
  }
  return null;
}

function samuelNotifyTarget() {
  const raw =
    process.env.SAMUEL_WHATSAPP ||
    process.env.SELLER_WHATSAPP ||
    "";
  return String(raw).replace(/\D/g, "") || null;
}

function buildNotifyMessage(lead) {
  const intent =
    lead.intent === "demo" ? "BOOK DEMO" : "LEAD CAPTURED";
  return [
    `🌱 *Catalpa inbound* — ${intent}`,
    `Lead: ${lead.id}`,
    `Name: ${lead.customerName || "—"}`,
    `From WA: +${lead.fromPhone}`,
    `Business: ${lead.businessType || "—"}`,
    `City: ${lead.city || "—"}`,
    `Their WhatsApp: +${lead.whatsapp || lead.fromPhone}`,
    `Runs Meta ads: ${lead.hasMetaAds === true ? "yes" : lead.hasMetaAds === false ? "no" : "—"}`,
    `Interest: ${lead.offerInterest || "general"}`,
    "",
    "_Catalpa dogfood lead bot_",
  ].join("\n");
}

/**
 * Persist lead + attach Samuel notify payload (dashboard + optional wa.me).
 */
function finalizeLead(tenantId, session, { intent }) {
  const lead = store.createLead(tenantId, {
    fromPhone: session.phone,
    customerName: session.customerName,
    businessType: session.leadBusinessType,
    city: session.leadCity,
    whatsapp: session.leadWhatsapp || session.phone,
    hasMetaAds: session.leadHasMetaAds,
    intent,
    offerInterest: session.leadOfferInterest || null,
    status: intent === "demo" ? "demo_booked" : "new",
  });

  const notifyBody = buildNotifyMessage(lead);
  const samuelPhone = samuelNotifyTarget();
  const notifyWaMe = samuelPhone
    ? whatsapp.waMeLink(samuelPhone, notifyBody)
    : null;

  const updated = store.updateLead(tenantId, lead.id, {
    notifyMessage: notifyBody,
    notifyWaMe,
    samuelPhone,
  });

  store.updateSession(tenantId, session.phone, {
    state: "done",
    leadId: updated.id,
    cart: [],
  });

  return { lead: updated, notifyWaMe, notifyBody };
}

/**
 * @returns {{ replies: string[], session, lead?, notifyWaMe? }}
 */
async function handleLeadMessage({
  tenantId,
  fromPhone,
  text,
  contactName,
}) {
  let session = store.getSession(tenantId, fromPhone);
  if (contactName && !session.customerName) {
    session = store.updateSession(tenantId, fromPhone, {
      customerName: contactName,
    });
  }

  const input = normalizeInput(text);
  const out = [];

  if (["help", "?", "commands"].includes(input)) {
    out.push(replies.leadHelp());
    return { replies: out, session };
  }

  if (["reset", "restart", "cancel", "start over"].includes(input)) {
    session = store.resetSession(tenantId, fromPhone);
    session = store.updateSession(tenantId, fromPhone, {
      state: "ask_business_type",
      leadBusinessType: null,
      leadCity: null,
      leadWhatsapp: null,
      leadHasMetaAds: null,
      leadOfferInterest: null,
      leadId: null,
    });
    out.push("Starting fresh.");
    out.push(replies.leadGreet(tenantId));
    out.push(replies.leadAskBusinessType());
    return { replies: out, session };
  }

  if (["offers", "menu", "catalog", "services", "what do you sell"].includes(input)) {
    out.push(replies.leadOffers(tenantId));
    if (session.state === "done" || session.state === "greet") {
      out.push("Reply *hi* to leave your details or book a live demo.");
    }
    return { replies: out, session };
  }

  // Fresh start / greet
  if (
    !input ||
    ["hi", "hello", "hey", "start", "hola"].includes(input) ||
    session.state === "greet" ||
    session.state === "done"
  ) {
    const product = findOffer(tenantId, input);
    const patch = {
      state: "ask_business_type",
      leadBusinessType: null,
      leadCity: null,
      leadWhatsapp: null,
      leadHasMetaAds: null,
      leadId: null,
    };
    if (product) patch.leadOfferInterest = product.name;

    session = store.updateSession(tenantId, fromPhone, patch);
    out.push(replies.leadGreet(tenantId));
    if (product) {
      out.push(`Noted interest in *${product.name}*.`);
    } else {
      out.push(replies.leadOffers(tenantId));
    }
    out.push(replies.leadAskBusinessType());
    return { replies: out, session };
  }

  if (session.state === "ask_business_type") {
    if (input.length < 2) {
      out.push("What kind of business do you run? (e.g. chop bar, boutique, clinic, spare parts)");
      return { replies: out, session };
    }
    session = store.updateSession(tenantId, fromPhone, {
      leadBusinessType: text.trim(),
      state: "ask_city",
    });
    out.push(replies.leadAskCity());
    return { replies: out, session };
  }

  if (session.state === "ask_city") {
    if (input.length < 2) {
      out.push("Which city or town are you in? (e.g. Accra, Kumasi, Tema)");
      return { replies: out, session };
    }
    session = store.updateSession(tenantId, fromPhone, {
      leadCity: text.trim(),
      state: "ask_whatsapp",
    });
    out.push(replies.leadAskWhatsapp(session.phone));
    return { replies: out, session };
  }

  if (session.state === "ask_whatsapp") {
    let phone;
    if (["same", "this", "this number", "use this", "yes"].includes(input)) {
      phone = session.phone;
    } else {
      phone = store.normalizeGhPhone(text);
      if (!phone || phone.length < 10) {
        out.push(
          "Send a Ghana WhatsApp number (e.g. 024xxxxxxx) or reply *same* to use this chat."
        );
        return { replies: out, session };
      }
    }
    session = store.updateSession(tenantId, fromPhone, {
      leadWhatsapp: phone,
      state: "ask_meta_ads",
    });
    out.push(replies.leadAskMetaAds());
    return { replies: out, session };
  }

  if (session.state === "ask_meta_ads") {
    const yn = parseYesNo(input);
    if (yn === null) {
      out.push("Do you already run Meta (Facebook/Instagram) ads? Reply *yes* or *no*.");
      return { replies: out, session };
    }
    session = store.updateSession(tenantId, fromPhone, {
      leadHasMetaAds: yn,
      state: "ask_intent",
    });
    out.push(replies.leadAskIntent());
    return { replies: out, session };
  }

  if (session.state === "ask_intent") {
    const intent = parseIntent(input);
    if (!intent) {
      out.push(
        "Reply *1* to book a live demo, or *2* to leave your details for Samuel to follow up."
      );
      return { replies: out, session };
    }
    const { lead, notifyWaMe } = finalizeLead(tenantId, session, { intent });
    out.push(replies.leadCaptured(lead));
    return {
      replies: out,
      session: store.getSession(tenantId, fromPhone),
      lead,
      notifyWaMe,
    };
  }

  out.push(
    "I didn't catch that. Reply *hi* to start, *offers* to see what Catalpa does, or *help*."
  );
  return { replies: out, session };
}

function findOffer(tenantId, input) {
  if (!input || ["hi", "hello", "hey", "start", "hola"].includes(input)) {
    return null;
  }
  const catalog = store.getCatalog(tenantId);
  const products = catalog.products || [];
  if (/^\d+$/.test(input)) {
    const idx = Number(input) - 1;
    if (idx >= 0 && idx < products.length) return products[idx];
  }
  return (
    products.find(
      (p) =>
        p.id.toLowerCase() === input ||
        p.name.toLowerCase().includes(input) ||
        input.includes(p.name.toLowerCase().slice(0, 8))
    ) || null
  );
}

module.exports = {
  LEAD_STATES,
  isLeadTenant,
  handleLeadMessage,
  finalizeLead,
  buildNotifyMessage,
  samuelNotifyTarget,
};
