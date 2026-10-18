const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { loadEnv } = require("./env");
const store = require("./store");
const paystack = require("./paystack");
const whatsapp = require("./whatsapp");

loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function demoMode() {
  const key = process.env.PAYSTACK_SECRET_KEY || "";
  return !key || key.includes("xxxxxxxx");
}

function baseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  const host = req.headers.host || `localhost:${PORT}`;
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}`;
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      const ctype = req.headers["content-type"] || "";
      if (ctype.includes("application/json")) {
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
        }
      } else {
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({ raw });
        }
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  rel = decodeURIComponent(rel.split("?")[0]);
  if (rel.includes("..")) {
    sendText(res, 400, "Bad path");
    return true;
  }
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 400, "Bad path");
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const ext = path.extname(filePath);
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  res.end(data);
  return true;
}

async function markPaidFromReference(reference, verified) {
  let order = store.findOrderByReference(reference);
  if (!order) {
    const orderId = String(reference).split("_").slice(0, 2).join("_");
    order = store.findOrder(orderId);
  }
  if (!order) {
    console.warn("paid ref with no local order:", reference);
    return null;
  }
  if (order.status === "paid") return order;

  const updated = store.updateOrder(order.id, {
    status: "paid",
    paidAt: new Date().toISOString(),
    paystackReference: reference,
    paystackChannel: verified?.channel || null,
  });

  try {
    await whatsapp.notifyOrder(updated, { paid: true });
  } catch (e) {
    console.error("notify failed:", e.message);
  }

  return updated;
}

/** @returns {boolean} true if route matched */
async function handleApi(req, res, url) {
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      currency: process.env.CURRENCY || "GHS",
      whatsappMode: process.env.WHATSAPP_MODE || "manual",
      demoMode: demoMode(),
      seller: process.env.SELLER_NAME || "Seller",
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/catalog") {
    sendJson(res, 200, store.getCatalog());
    return true;
  }

  if (req.method === "GET" && pathname === "/api/orders") {
    sendJson(res, 200, { orders: store.listOrders() });
    return true;
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (req.method === "GET" && orderMatch) {
    const order = store.findOrder(orderMatch[1]);
    if (!order) sendJson(res, 404, { error: "Order not found" });
    else sendJson(res, 200, { order });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/checkout") {
    const body = await readBody(req);
    const { productId, qty = 1, buyerName, buyerPhone, note } = body || {};
    if (!productId || !buyerName || !buyerPhone) {
      sendJson(res, 400, {
        error: "productId, buyerName, and buyerPhone are required",
      });
      return true;
    }

    const quantity = Math.max(1, Number(qty) || 1);
    const order = store.createOrder({
      productId,
      qty: quantity,
      buyerName,
      buyerPhone,
      note,
    });

    if (demoMode()) {
      const demoPayUrl = `${baseUrl(req)}/pay-demo.html?order=${order.id}`;
      const notify = whatsapp.buildManualLinks(order, { paid: false });
      sendJson(res, 200, {
        order,
        paymentUrl: demoPayUrl,
        demoMode: true,
        whatsapp: notify,
      });
      return true;
    }

    const init = await paystack.initializeTransaction({
      order,
      callbackUrl: `${baseUrl(req)}/order.html?id=${order.id}`,
    });

    store.updateOrder(order.id, {
      paystackReference: init.reference,
      status: "awaiting_payment",
    });

    const updated = store.findOrder(order.id);
    const notify = whatsapp.buildManualLinks(updated, { paid: false });

    sendJson(res, 200, {
      order: updated,
      paymentUrl: init.authorizationUrl,
      reference: init.reference,
      demoMode: false,
      whatsapp: notify,
    });
    return true;
  }

  const demoPayMatch = pathname.match(/^\/api\/demo\/pay\/([^/]+)$/);
  if (req.method === "POST" && demoPayMatch) {
    if (!demoMode()) {
      sendJson(res, 400, { error: "Demo pay only when PAYSTACK keys unset" });
      return true;
    }
    const order = store.findOrder(demoPayMatch[1]);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return true;
    }
    if (order.status === "paid") {
      sendJson(res, 200, {
        order,
        whatsapp: whatsapp.buildManualLinks(order, { paid: true }),
      });
      return true;
    }
    const updated = store.updateOrder(order.id, {
      status: "paid",
      paidAt: new Date().toISOString(),
      paystackReference: `demo_${order.id}`,
    });
    const notify = await whatsapp.notifyOrder(updated, { paid: true });
    sendJson(res, 200, { order: updated, whatsapp: notify });
    return true;
  }

  if (req.method === "POST" && pathname === "/webhooks/paystack") {
    try {
      const event = await readBody(req);
      if (event?.event === "charge.success" && event?.data?.reference) {
        await markPaidFromReference(event.data.reference);
      }
    } catch (e) {
      console.error("webhook error:", e.message);
    }
    res.writeHead(200);
    res.end("ok");
    return true;
  }

  const verifyMatch = pathname.match(/^\/api\/verify\/([^/]+)$/);
  if (req.method === "GET" && verifyMatch) {
    if (demoMode()) {
      sendJson(res, 400, { error: "No Paystack keys — use demo pay" });
      return true;
    }
    const data = await paystack.verifyTransaction(
      decodeURIComponent(verifyMatch[1])
    );
    if (data.status === "success") {
      const order = await markPaidFromReference(data.reference, data);
      sendJson(res, 200, { ok: true, order });
      return true;
    }
    sendJson(res, 200, { ok: false, status: data.status, gateway: data });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/webhooks/")
    ) {
      const matched = await handleApi(req, res, url);
      if (!matched) sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (!serveStatic(req, res, url.pathname)) {
      sendText(res, 404, "Not found");
    }
  } catch (err) {
    console.error(err);
    if (!res.writableEnded) {
      sendJson(res, err.status || 500, { error: err.message || "Server error" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`MoMo WhatsApp checkout listening on http://localhost:${PORT}`);
  console.log(
    `  demoMode=${demoMode()}  whatsapp=${process.env.WHATSAPP_MODE || "manual"}`
  );
});
