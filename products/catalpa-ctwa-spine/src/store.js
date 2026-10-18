const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { tenantDir, ensureTenant } = require("./tenants");

const ORDER_STATUSES = [
  "new",
  "awaiting_payment",
  "paid",
  "preparing",
  "dispatched",
  "delivered",
  "cancelled",
];

const LEAD_STATUSES = [
  "new",
  "demo_booked",
  "contacted",
  "won",
  "lost",
];

/** Conversation states for the WhatsApp bot (orders + lead dogfood). */
const SESSION_STATES = [
  "greet",
  "browse",
  "cart",
  "confirm",
  "awaiting_payment",
  "paid",
  "ask_business_type",
  "ask_city",
  "ask_whatsapp",
  "ask_meta_ads",
  "ask_intent",
  "done",
];

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function paths(tenantId) {
  const dir = tenantDir(ensureTenant(tenantId));
  return {
    dir,
    catalog: path.join(dir, "catalog.json"),
    orders: path.join(dir, "orders.json"),
    sessions: path.join(dir, "sessions.json"),
    leads: path.join(dir, "leads.json"),
  };
}

function isLeadMode(tenantId) {
  return getCatalog(tenantId).mode === "leads";
}

function getCatalog(tenantId) {
  return readJson(paths(tenantId).catalog, { merchant: {}, products: [] });
}

function getProduct(tenantId, productId) {
  return getCatalog(tenantId).products.find((p) => p.id === productId) || null;
}

function listOrders(tenantId) {
  return readJson(paths(tenantId).orders, []);
}

function saveOrders(tenantId, orders) {
  writeJson(paths(tenantId).orders, orders);
}

function findOrder(tenantId, orderId) {
  return listOrders(tenantId).find((o) => o.id === orderId) || null;
}

function findOrderByReference(tenantId, reference) {
  return (
    listOrders(tenantId).find((o) => o.paystackReference === reference) || null
  );
}

/** Search all tenants for a Paystack reference (webhook may not carry tenant). */
function findOrderByReferenceGlobal(reference) {
  const { listTenantIds } = require("./tenants");
  for (const tid of listTenantIds()) {
    const order = findOrderByReference(tid, reference);
    if (order) return { tenantId: tid, order };
  }
  return null;
}

function createOrder(tenantId, { items, customerPhone, customerName, note }) {
  if (!items || !items.length) {
    const err = new Error("Cart is empty");
    err.status = 400;
    throw err;
  }

  const lineItems = items.map((line) => {
    const product = getProduct(tenantId, line.productId);
    if (!product) {
      const err = new Error(`Product not found: ${line.productId}`);
      err.status = 404;
      throw err;
    }
    const qty = Math.max(1, Number(line.qty) || 1);
    return {
      productId: product.id,
      name: product.name,
      unitPriceGhs: product.price_ghs,
      qty,
      lineTotalGhs: product.price_ghs * qty,
    };
  });

  const amountGhs = lineItems.reduce((s, l) => s + l.lineTotalGhs, 0);
  const catalog = getCatalog(tenantId);
  const order = {
    id: `ord_${crypto.randomBytes(4).toString("hex")}`,
    tenantId,
    createdAt: new Date().toISOString(),
    status: "new",
    items: lineItems,
    amountGhs,
    currency: "GHS",
    customerName: (customerName || "").trim() || "WhatsApp customer",
    customerPhone: normalizeGhPhone(customerPhone),
    note: (note || "").trim(),
    paystackReference: null,
    paymentUrl: null,
    paidAt: null,
    riderNote: null,
    dispatchMessage: null,
    dispatchedAt: null,
    merchantName: catalog.merchant?.name || tenantId,
  };

  const orders = listOrders(tenantId);
  orders.unshift(order);
  saveOrders(tenantId, orders);
  return order;
}

function updateOrder(tenantId, orderId, patch) {
  const orders = listOrders(tenantId);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  if (patch.status && !ORDER_STATUSES.includes(patch.status)) {
    const err = new Error(`Invalid status: ${patch.status}`);
    err.status = 400;
    throw err;
  }
  orders[idx] = { ...orders[idx], ...patch, updatedAt: new Date().toISOString() };
  saveOrders(tenantId, orders);
  return orders[idx];
}

function listSessions(tenantId) {
  return readJson(paths(tenantId).sessions, {});
}

function saveSessions(tenantId, sessions) {
  writeJson(paths(tenantId).sessions, sessions);
}

function getSession(tenantId, phone) {
  const key = normalizeGhPhone(phone);
  const sessions = listSessions(tenantId);
  if (sessions[key]) return sessions[key];
  const fresh = {
    phone: key,
    tenantId,
    state: "greet",
    cart: [],
    orderId: null,
    customerName: null,
    updatedAt: new Date().toISOString(),
  };
  sessions[key] = fresh;
  saveSessions(tenantId, sessions);
  return fresh;
}

function updateSession(tenantId, phone, patch) {
  const key = normalizeGhPhone(phone);
  const sessions = listSessions(tenantId);
  const current = sessions[key] || getSession(tenantId, key);
  sessions[key] = {
    ...current,
    ...patch,
    phone: key,
    tenantId,
    updatedAt: new Date().toISOString(),
  };
  saveSessions(tenantId, sessions);
  return sessions[key];
}

function resetSession(tenantId, phone) {
  return updateSession(tenantId, phone, {
    state: "greet",
    cart: [],
    orderId: null,
    leadId: null,
    leadBusinessType: null,
    leadCity: null,
    leadWhatsapp: null,
    leadHasMetaAds: null,
    leadOfferInterest: null,
  });
}

function listLeads(tenantId) {
  return readJson(paths(tenantId).leads, []);
}

function saveLeads(tenantId, leads) {
  writeJson(paths(tenantId).leads, leads);
}

function findLead(tenantId, leadId) {
  return listLeads(tenantId).find((l) => l.id === leadId) || null;
}

function createLead(tenantId, fields) {
  const lead = {
    id: `lead_${crypto.randomBytes(4).toString("hex")}`,
    tenantId,
    createdAt: new Date().toISOString(),
    status: fields.status || "new",
    fromPhone: normalizeGhPhone(fields.fromPhone),
    customerName: (fields.customerName || "").trim() || "WhatsApp lead",
    businessType: (fields.businessType || "").trim(),
    city: (fields.city || "").trim(),
    whatsapp: normalizeGhPhone(fields.whatsapp || fields.fromPhone),
    hasMetaAds:
      typeof fields.hasMetaAds === "boolean" ? fields.hasMetaAds : null,
    intent: fields.intent || "lead",
    offerInterest: fields.offerInterest || null,
    notifyMessage: null,
    notifyWaMe: null,
    samuelPhone: null,
    note: (fields.note || "").trim(),
  };
  const leads = listLeads(tenantId);
  leads.unshift(lead);
  saveLeads(tenantId, leads);
  return lead;
}

function updateLead(tenantId, leadId, patch) {
  const leads = listLeads(tenantId);
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx === -1) return null;
  if (patch.status && !LEAD_STATUSES.includes(patch.status)) {
    const err = new Error(`Invalid lead status: ${patch.status}`);
    err.status = 400;
    throw err;
  }
  leads[idx] = {
    ...leads[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveLeads(tenantId, leads);
  return leads[idx];
}

/** Accept 024..., +23324..., 23324... → 233XXXXXXXXX */
function normalizeGhPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

function formatGhs(amount) {
  return `GHS ${Number(amount).toFixed(2)}`;
}

function buildDispatchMessage(order, riderNote) {
  const lines = [
    `🚚 *DISPATCH* — ${order.merchantName || "Merchant"}`,
    `Order: ${order.id}`,
    `Status: ${order.status}`,
    `Customer: ${order.customerName}`,
    `Phone: +${order.customerPhone}`,
    `Total: ${formatGhs(order.amountGhs)}`,
    "",
    "*Items:*",
    ...order.items.map(
      (i) => `• ${i.name} × ${i.qty} — ${formatGhs(i.lineTotalGhs)}`
    ),
  ];
  if (order.note) lines.push("", `Customer note: ${order.note}`);
  if (riderNote) lines.push("", `Rider / logistics: ${riderNote}`);
  lines.push("", "_Catalpa CTWA spine · handoff via WhatsApp_");
  return lines.join("\n");
}

module.exports = {
  ORDER_STATUSES,
  LEAD_STATUSES,
  SESSION_STATES,
  getCatalog,
  getProduct,
  isLeadMode,
  listOrders,
  createOrder,
  updateOrder,
  findOrder,
  findOrderByReference,
  findOrderByReferenceGlobal,
  listLeads,
  createLead,
  updateLead,
  findLead,
  getSession,
  updateSession,
  resetSession,
  normalizeGhPhone,
  formatGhs,
  buildDispatchMessage,
};
