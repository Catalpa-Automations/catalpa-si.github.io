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

module.exports = {
  greet,
  help,
  catalog,
  cartSummary,
  confirmPrompt,
  paymentLink,
  paidConfirm,
  merchantName,
};
