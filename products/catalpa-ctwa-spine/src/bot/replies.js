const store = require("../store");

function merchantName(tenantId) {
  const cat = store.getCatalog(tenantId);
  return cat.merchant?.name || process.env.SELLER_NAME || "our shop";
}

function greet(tenantId) {
  const name = merchantName(tenantId);
  return [
    `Welcome to *${name}* 👋`,
    "",
    "I'm the Catalpa order bot — open 24/7 on WhatsApp.",
    "",
    "Reply *menu* to browse.",
    "Or type a number from the catalog to add it.",
    "",
    "_Commands: menu · cart · checkout · help · reset_",
  ].join("\n");
}

function help() {
  return [
    "*How to order*",
    "1. *menu* — see products + prices (GHS)",
    "2. Send a number (e.g. *1*) or product id to add",
    "3. *cart* — review",
    "4. *checkout* — confirm → Paystack MoMo link",
    "5. Pay → we confirm here automatically",
    "",
    "*reset* starts over.",
  ].join("\n");
}

function catalog(tenantId) {
  const { products, merchant } = store.getCatalog(tenantId);
  const lines = [
    `*${merchant?.name || "Catalog"}*`,
    merchant?.tagline || "",
    "",
  ].filter(Boolean);

  products.forEach((p, i) => {
    lines.push(
      `*${i + 1}.* ${p.name} — ${store.formatGhs(p.price_ghs)}`,
      `   _${p.description || p.id}_`
    );
  });
  lines.push("", "Reply with a *number* to add · *cart* · *checkout*");
  return lines.join("\n");
}

function cartSummary(session, tenantId) {
  if (!session.cart?.length) {
    return "Your cart is empty. Reply *menu* to browse.";
  }
  const lines = ["*Your cart*", ""];
  let total = 0;
  for (const line of session.cart) {
    const product = store.getProduct(tenantId, line.productId);
    if (!product) continue;
    const lineTotal = product.price_ghs * line.qty;
    total += lineTotal;
    lines.push(`• ${product.name} × ${line.qty} — ${store.formatGhs(lineTotal)}`);
  }
  lines.push("", `*Total: ${store.formatGhs(total)}*`);
  lines.push("", "Reply *checkout* to pay · *menu* to add more · *clear* to empty");
  return lines.join("\n");
}

function confirmPrompt(session, tenantId) {
  return [
    cartSummary(session, tenantId),
    "",
    "Ready to pay with *MoMo / Paystack*?",
    "Reply *yes* to get your payment link, or *no* to keep shopping.",
  ].join("\n");
}

function paymentLink(order) {
  return [
    `✅ Order *${order.id}* created`,
    `Amount: *${store.formatGhs(order.amountGhs)}*`,
    "",
    "Pay securely with MTN MoMo / Telecel / card:",
    order.paymentUrl,
    "",
    "After payment you'll get a confirmation here. Thank you!",
  ].join("\n");
}

function paidConfirm(order) {
  return [
    `💚 *PAID* — ${store.formatGhs(order.amountGhs)}`,
    `Order *${order.id}* is confirmed.`,
    "",
    "We're preparing your order. The merchant will update you on delivery.",
    "_Catalpa · Meta WhatsApp + Paystack_",
  ].join("\n");
}

/** —— Lead dogfood (tenant mode: leads) —— */

function leadGreet(tenantId) {
  const name = merchantName(tenantId);
  return [
    `Welcome to *${name}* 👋`,
    "",
    "We help Ghana SMEs take orders on WhatsApp from Meta ads — bot + owner dashboard + dispatch.",
    "No upfront build fee: you see it live first, then you pay.",
    "",
    "_Reply *offers* anytime · *help* · *reset*_",
  ].join("\n");
}

function leadOffers(tenantId) {
  const { products, merchant } = store.getCatalog(tenantId);
  const lines = [
    `*What ${merchant?.name || "Catalpa"} offers*`,
    "(Pilot free → paid when it works for you)",
    "",
  ];
  (products || []).forEach((p, i) => {
    lines.push(`*${i + 1}.* ${p.name}`, `   _${p.description || p.id}_`, "");
  });
  lines.push("Reply a *number* if one interest you, or continue with your business type.");
  return lines.join("\n");
}

function leadAskBusinessType() {
  return "What kind of business do you run? (e.g. chop bar, boutique, clinic, spare parts, salon)";
}

function leadAskCity() {
  return "Which city or town are you in?";
}

function leadAskWhatsapp(currentPhone) {
  return [
    "Best WhatsApp number for Samuel to reach you?",
    `Reply *same* to use this chat (+${currentPhone}), or send another number (024…).`,
  ].join("\n");
}

function leadAskMetaAds() {
  return "Do you already run Meta (Facebook / Instagram) ads? Reply *yes* or *no*.";
}

function leadAskIntent() {
  return [
    "What next?",
    "*1* — Book a *see live demo* (Samuel shows the Catalpa bot working)",
    "*2* — Just leave my details (Samuel follows up)",
  ].join("\n");
}

function leadCaptured(lead) {
  const lines = [
    lead.intent === "demo"
      ? "✅ *Demo booked* — Samuel will WhatsApp you to set a time."
      : "✅ *Got your details* — Samuel will follow up on WhatsApp.",
    "",
    `*${lead.businessType}* · ${lead.city}`,
    `WhatsApp: +${lead.whatsapp}`,
    `Meta ads today: ${lead.hasMetaAds ? "yes" : "no"}`,
    lead.offerInterest ? `Interest: ${lead.offerInterest}` : null,
    "",
    "You can reply *offers* anytime, or *reset* to start again.",
    "_Catalpa Automations · Accra_",
  ].filter(Boolean);
  return lines.join("\n");
}

function leadHelp() {
  return [
    "*Catalpa lead bot*",
    "1. *hi* — start",
    "2. Answer: business type → city → WhatsApp → Meta ads yes/no",
    "3. Pick *1* (live demo) or *2* (leave details)",
    "",
    "*offers* — what we sell · *reset* — start over",
  ].join("\n");
}

module.exports = {
  greet,
  help,
  catalog,
  cartSummary,
  confirmPrompt,
  paymentLink,
  paidConfirm,
  merchantName,
  leadGreet,
  leadOffers,
  leadAskBusinessType,
  leadAskCity,
  leadAskWhatsapp,
  leadAskMetaAds,
  leadAskIntent,
  leadCaptured,
  leadHelp,
};
