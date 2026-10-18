/**
 * Conversation state machine:
 *   greet → browse → cart → confirm → awaiting_payment → paid
 *
 * Keyword-driven (no LLM). OpenAI can sit behind NLU later without changing this spine.
 */

const store = require("../store");
const replies = require("./replies");
const paystack = require("../paystack");
const { isDemoPaystack } = require("../env");

function normalizeInput(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findProductByInput(tenantId, input) {
  const catalog = store.getCatalog(tenantId);
  const products = catalog.products || [];

  // Numeric menu index (1-based)
  if (/^\d+$/.test(input)) {
    const idx = Number(input) - 1;
    if (idx >= 0 && idx < products.length) return products[idx];
  }

  // Exact id
  const byId = products.find((p) => p.id.toLowerCase() === input);
  if (byId) return byId;

  // Fuzzy name contains
  const byName = products.find(
    (p) =>
      p.name.toLowerCase() === input ||
      p.name.toLowerCase().includes(input) ||
      input.includes(p.name.toLowerCase().slice(0, 8))
  );
  return byName || null;
}

function cartTotal(session, tenantId) {
  let total = 0;
  for (const line of session.cart || []) {
    const p = store.getProduct(tenantId, line.productId);
    if (p) total += p.price_ghs * line.qty;
  }
  return total;
}

async function createPaymentForSession(tenantId, session, baseUrl) {
  const order = store.createOrder(tenantId, {
    items: session.cart,
    customerPhone: session.phone,
    customerName: session.customerName,
  });

  let paymentUrl;
  let reference;

  if (isDemoPaystack()) {
    reference = `demo_${order.id}`;
    paymentUrl = `${baseUrl}/t/${tenantId}/pay-demo.html?order=${order.id}`;
  } else {
    const init = await paystack.initializeTransaction({
      order,
      callbackUrl: `${baseUrl}/t/${tenantId}/dashboard.html?paid=${order.id}`,
    });
    paymentUrl = init.authorizationUrl;
    reference = init.reference;
  }

  const updated = store.updateOrder(tenantId, order.id, {
    status: "awaiting_payment",
    paystackReference: reference,
    paymentUrl,
  });

  store.updateSession(tenantId, session.phone, {
    state: "awaiting_payment",
    orderId: order.id,
    cart: session.cart,
  });

  return updated;
}

/**
 * Handle one inbound customer message.
 * @returns {{ replies: string[], session, order? }}
 */
async function handleMessage({
  tenantId,
  fromPhone,
  text,
  contactName,
  baseUrl,
}) {
  let session = store.getSession(tenantId, fromPhone);
  if (contactName && !session.customerName) {
    session = store.updateSession(tenantId, fromPhone, {
      customerName: contactName,
    });
  }

  const input = normalizeInput(text);
  const out = [];

  // Global commands
  if (!input || ["hi", "hello", "hey", "start", "hola"].includes(input)) {
    store.updateSession(tenantId, fromPhone, { state: "browse" });
    out.push(replies.greet(tenantId));
    out.push(replies.catalog(tenantId));
    return { replies: out, session: store.getSession(tenantId, fromPhone) };
  }

  if (["help", "?", "commands"].includes(input)) {
    out.push(replies.help());
    return { replies: out, session };
  }

  if (["menu", "catalog", "shop", "browse"].includes(input)) {
    store.updateSession(tenantId, fromPhone, { state: "browse" });
    out.push(replies.catalog(tenantId));
    return { replies: out, session: store.getSession(tenantId, fromPhone) };
  }

  if (["reset", "restart", "cancel"].includes(input)) {
    session = store.resetSession(tenantId, fromPhone);
    out.push("Cart cleared. Starting fresh.");
    out.push(replies.greet(tenantId));
    return { replies: out, session };
  }

  if (["clear", "empty"].includes(input)) {
    session = store.updateSession(tenantId, fromPhone, {
      cart: [],
      state: "browse",
    });
    out.push("Cart emptied. Reply *menu* to shop.");
    return { replies: out, session };
  }

  if (["cart", "basket"].includes(input)) {
    store.updateSession(tenantId, fromPhone, {
      state: session.cart?.length ? "cart" : "browse",
    });
    out.push(replies.cartSummary(session, tenantId));
    return { replies: out, session: store.getSession(tenantId, fromPhone) };
  }

  if (["checkout", "pay", "order", "done"].includes(input)) {
    if (!session.cart?.length) {
      out.push("Cart is empty. Reply *menu* first.");
      return { replies: out, session };
    }
    store.updateSession(tenantId, fromPhone, { state: "confirm" });
    out.push(replies.confirmPrompt(session, tenantId));
    return { replies: out, session: store.getSession(tenantId, fromPhone) };
  }

  // Confirm / decline payment
  if (session.state === "confirm") {
    if (["yes", "y", "ok", "sure", "confirm", "pay"].includes(input)) {
      try {
        const order = await createPaymentForSession(
          tenantId,
          session,
          baseUrl
        );
        out.push(replies.paymentLink(order));
        return {
          replies: out,
          session: store.getSession(tenantId, fromPhone),
          order,
        };
      } catch (e) {
        out.push(`Could not create payment: ${e.message}`);
        return { replies: out, session };
      }
    }
    if (["no", "n", "back"].includes(input)) {
      store.updateSession(tenantId, fromPhone, { state: "cart" });
      out.push(replies.cartSummary(session, tenantId));
      return { replies: out, session: store.getSession(tenantId, fromPhone) };
    }
  }

  if (session.state === "awaiting_payment") {
    if (["status", "paid?", "paid"].includes(input)) {
      const order = session.orderId
        ? store.findOrder(tenantId, session.orderId)
        : null;
      if (order?.status === "paid") {
        out.push(replies.paidConfirm(order));
      } else if (order?.paymentUrl) {
        out.push(
          `Still awaiting payment for *${order.id}*.\n${order.paymentUrl}`
        );
      } else {
        out.push("No open payment. Reply *checkout* to start again.");
      }
      return { replies: out, session };
    }
  }

  // Add to cart (browse / cart / greet)
  const product = findProductByInput(tenantId, input);
  if (product) {
    const cart = [...(session.cart || [])];
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) existing.qty += 1;
    else cart.push({ productId: product.id, qty: 1 });

    session = store.updateSession(tenantId, fromPhone, {
      cart,
      state: "cart",
    });
    out.push(
      `Added *${product.name}* (${store.formatGhs(product.price_ghs)}).`
    );
    out.push(replies.cartSummary(session, tenantId));
    return { replies: out, session };
  }

  // Qty shortcut: "2x1" or "1 x 2" meaning product index × qty — keep simple: "add 2"
  const addMatch = input.match(/^(?:add\s+)?(\d+)\s*[x×]\s*(\d+)$/);
  if (addMatch) {
    const product = findProductByInput(tenantId, addMatch[1]);
    const qty = Math.max(1, Number(addMatch[2]));
    if (product) {
      const cart = [...(session.cart || [])];
      const existing = cart.find((c) => c.productId === product.id);
      if (existing) existing.qty += qty;
      else cart.push({ productId: product.id, qty });
      session = store.updateSession(tenantId, fromPhone, {
        cart,
        state: "cart",
      });
      out.push(`Added ${qty}× *${product.name}*.`);
      out.push(replies.cartSummary(session, tenantId));
      return { replies: out, session };
    }
  }

  out.push(
    "I didn't catch that. Reply *menu*, a product *number*, *cart*, or *help*."
  );
  return { replies: out, session };
}

/**
 * Mark order paid and advance session + customer reply.
 */
function markOrderPaid(tenantId, order, extras = {}) {
  const updated = store.updateOrder(tenantId, order.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
    ...extras,
  });
  if (updated?.customerPhone) {
    store.updateSession(tenantId, updated.customerPhone, {
      state: "paid",
      orderId: updated.id,
      cart: [],
    });
  }
  return updated;
}

module.exports = {
  handleMessage,
  createPaymentForSession,
  markOrderPaid,
  cartTotal,
  findProductByInput,
};
