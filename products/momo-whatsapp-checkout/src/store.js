const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function getCatalog() {
  return readJson(CATALOG_PATH, { seller: {}, products: [] });
}

function getProduct(productId) {
  return getCatalog().products.find((p) => p.id === productId) || null;
}

function listOrders() {
  return readJson(ORDERS_PATH, []);
}

function saveOrders(orders) {
  writeJson(ORDERS_PATH, orders);
}

function createOrder({ productId, qty, buyerName, buyerPhone, note }) {
  const product = getProduct(productId);
  if (!product) {
    const err = new Error("Product not found");
    err.status = 404;
    throw err;
  }
  if (product.stock < qty) {
    const err = new Error("Not enough stock");
    err.status = 400;
    throw err;
  }

  const amount = product.price_ghs * qty;
  const order = {
    id: `ord_${crypto.randomBytes(4).toString("hex")}`,
    createdAt: new Date().toISOString(),
    status: "pending_payment",
    productId: product.id,
    productName: product.name,
    unitPriceGhs: product.price_ghs,
    qty,
    amountGhs: amount,
    buyerName: buyerName.trim(),
    buyerPhone: normalizeGhPhone(buyerPhone),
    note: (note || "").trim(),
    paystackReference: null,
    paidAt: null,
  };

  const orders = listOrders();
  orders.unshift(order);
  saveOrders(orders);
  return order;
}

function updateOrder(orderId, patch) {
  const orders = listOrders();
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...patch };
  saveOrders(orders);
  return orders[idx];
}

function findOrderByReference(reference) {
  return listOrders().find((o) => o.paystackReference === reference) || null;
}

function findOrder(orderId) {
  return listOrders().find((o) => o.id === orderId) || null;
}

/** Accept 024..., +23324..., 23324... → 233XXXXXXXXX */
function normalizeGhPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `233${digits.slice(1)}`;
  if (digits.length === 9) return `233${digits}`;
  return digits;
}

module.exports = {
  getCatalog,
  getProduct,
  listOrders,
  createOrder,
  updateOrder,
  findOrder,
  findOrderByReference,
  normalizeGhPhone,
};
