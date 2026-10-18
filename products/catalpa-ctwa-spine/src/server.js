const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { loadEnv, isMockWhatsApp, isDemoPaystack } = require("./env");
const store = require("./store");
const paystack = require("./paystack");
const whatsapp = require("./whatsapp");
const bot = require("./bot/state-machine");
const replies = require("./bot/replies");
const tenants = require("./tenants");

loadEnv();

const PORT = Number(process.env.PORT) || 3040;
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
    "Access-Control-Allow-Origin": "*",
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
      if (!raw) return resolve({ raw: "", json: {} });
      const ctype = req.headers["content-type"] || "";
      try {
        const json = JSON.parse(raw);
        resolve({ raw, json });
      } catch {
        if (ctype.includes("application/json")) {
          reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
        } else {
          resolve({ raw, json: {} });
        }
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/dashboard.html" : urlPath;
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

async function notifyCustomerPaid(tenantId, order) {
  try {
    await whatsapp.sendText({
      toPhone: order.customerPhone,
      body: replies.paidConfirm(order),
      tenantId,
    });
  } catch (e) {
    console.error("paid notify failed:", e.message);
  }
}

async function markPaid(tenantId, order, extras = {}) {
  if (order.status === "paid") return order;
  const updated = bot.markOrderPaid(tenantId, order, extras);
  await notifyCustomerPaid(tenantId, updated);
  return updated;
}

async function processInboundMessages(tenantId, messages, req) {
  const results = [];
  for (const msg of messages) {
    if (!msg.text || msg.text.startsWith("[")) {
      const hint = store.isLeadMode(tenantId)
        ? "Please send a text message. Reply *hi* to start."
        : "Please send a text message. Reply *menu* to browse.";
      await whatsapp.sendText({
        toPhone: msg.from,
        body: hint,
        tenantId,
      });
      continue;
    }
    const result = await bot.handleMessage({
      tenantId,
      fromPhone: msg.from,
      text: msg.text,
      contactName: msg.contactName,
      baseUrl: baseUrl(req),
    });
    for (const reply of result.replies) {
      await whatsapp.sendText({
        toPhone: msg.from,
        body: reply,
        tenantId,
      });
    }
    if (result.lead?.notifyMessage && result.lead.samuelPhone && !isMockWhatsApp()) {
      try {
        await whatsapp.sendText({
          toPhone: result.lead.samuelPhone,
          body: result.lead.notifyMessage,
          tenantId,
        });
      } catch (e) {
        console.error("Samuel notify failed:", e.message);
      }
    }
    results.push(result);
  }
  return results;
}

async function handleApi(req, res, url, tenantId) {
  const pathname = tenants.stripTenantPath(url.pathname);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Tenant-Id",
    });
    res.end();
    return true;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      product: "catalpa-ctwa-spine",
      tenantId,
      mode: store.isLeadMode(tenantId) ? "leads" : "orders",
      currency: process.env.CURRENCY || "GHS",
      whatsappMock: isMockWhatsApp(),
      paystackDemo: isDemoPaystack(),
      tenants: tenants.listTenantIds(),
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/tenants") {
    sendJson(res, 200, {
      tenants: tenants.listTenantIds().map((id) => {
        const cat = store.getCatalog(id);
        return {
          id,
          name: cat.merchant?.name || id,
          city: cat.merchant?.city || null,
          mode: cat.mode === "leads" ? "leads" : "orders",
        };
      }),
      active: tenantId,
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/catalog") {
    sendJson(res, 200, store.getCatalog(tenantId));
    return true;
  }

  if (req.method === "GET" && pathname === "/api/orders") {
    sendJson(res, 200, {
      tenantId,
      orders: store.listOrders(tenantId),
      statuses: store.ORDER_STATUSES,
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/leads") {
    sendJson(res, 200, {
      tenantId,
      mode: store.isLeadMode(tenantId) ? "leads" : "orders",
      leads: store.listLeads(tenantId),
      statuses: store.LEAD_STATUSES,
    });
    return true;
  }

  const leadMatch = pathname.match(/^\/api\/leads\/([^/]+)$/);
  if (req.method === "PATCH" && leadMatch) {
    const { json } = await readBody(req);
    const patch = {};
    if (json.status) patch.status = json.status;
    if (json.note !== undefined) patch.note = String(json.note);
    const lead = store.updateLead(tenantId, leadMatch[1], patch);
    if (!lead) {
      sendJson(res, 404, { error: "Lead not found" });
      return true;
    }
    sendJson(res, 200, { lead });
    return true;
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (req.method === "GET" && orderMatch) {
    const order = store.findOrder(tenantId, orderMatch[1]);
    if (!order) sendJson(res, 404, { error: "Order not found" });
    else sendJson(res, 200, { order });
    return true;
  }

  if (req.method === "PATCH" && orderMatch) {
    const { json } = await readBody(req);
    const patch = {};
    if (json.status) patch.status = json.status;
    if (json.riderNote !== undefined) patch.riderNote = String(json.riderNote);
    if (json.note !== undefined) patch.note = String(json.note);

    let order = store.updateOrder(tenantId, orderMatch[1], patch);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return true;
    }
    sendJson(res, 200, { order });
    return true;
  }

  /** Mark ready + assign rider note + generate dispatch WhatsApp message. */
  const dispatchMatch = pathname.match(/^\/api\/orders\/([^/]+)\/dispatch$/);
  if (req.method === "POST" && dispatchMatch) {
    const { json } = await readBody(req);
    const order = store.findOrder(tenantId, dispatchMatch[1]);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return true;
    }
    if (!["paid", "preparing", "dispatched"].includes(order.status)) {
      sendJson(res, 400, {
        error: "Order must be paid (or preparing) before dispatch",
        status: order.status,
      });
      return true;
    }

    const riderNote = String(json.riderNote || order.riderNote || "").trim();
    const logisticsPhone = String(
      json.logisticsPhone ||
        process.env.LOGISTICS_WHATSAPP ||
        process.env.SELLER_WHATSAPP ||
        ""
    ).replace(/\D/g, "");

    const dispatchMessage = store.buildDispatchMessage(
      { ...order, status: "dispatched", riderNote },
      riderNote
    );

    const updated = store.updateOrder(tenantId, order.id, {
      status: "dispatched",
      riderNote,
      dispatchMessage,
      dispatchedAt: new Date().toISOString(),
      logisticsPhone: logisticsPhone || null,
    });

    const waLink = logisticsPhone
      ? whatsapp.waMeLink(logisticsPhone, dispatchMessage)
      : null;

    if (json.sendViaCloud && logisticsPhone && !isMockWhatsApp()) {
      try {
        await whatsapp.sendText({
          toPhone: logisticsPhone,
          body: dispatchMessage,
          tenantId,
        });
      } catch (e) {
        sendJson(res, 200, {
          order: updated,
          dispatchMessage,
          waMeLink: waLink,
          cloudError: e.message,
        });
        return true;
      }
    }

    sendJson(res, 200, {
      order: updated,
      dispatchMessage,
      waMeLink: waLink,
      mock: isMockWhatsApp(),
    });
    return true;
  }

  /** Sandbox: simulate customer WhatsApp messages without Meta. */
  if (req.method === "POST" && pathname === "/api/sandbox/message") {
    const { json } = await readBody(req);
    const from = json.from || json.phone || "233241111111";
    const text = json.text || json.message || "";
    const contactName = json.name || "Sandbox Customer";

    const before = whatsapp.getOutboundLog({ clear: false }).length;
    const result = await bot.handleMessage({
      tenantId,
      fromPhone: from,
      text,
      contactName,
      baseUrl: baseUrl(req),
    });
    for (const reply of result.replies) {
      await whatsapp.sendText({ toPhone: from, body: reply, tenantId });
    }

    // Dogfood: optional notify Samuel via Cloud API when a lead is captured
    if (result.lead?.notifyMessage && result.lead.samuelPhone && !isMockWhatsApp()) {
      try {
        await whatsapp.sendText({
          toPhone: result.lead.samuelPhone,
          body: result.lead.notifyMessage,
          tenantId,
        });
      } catch (e) {
        console.error("Samuel notify failed:", e.message);
      }
    }

    const sent = whatsapp.getOutboundLog({ clear: false }).slice(before);

    sendJson(res, 200, {
      tenantId,
      session: result.session,
      order: result.order || null,
      lead: result.lead || null,
      notifyWaMe: result.notifyWaMe || result.lead?.notifyWaMe || null,
      botReplies: result.replies,
      outbound: sent,
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/sandbox/outbound") {
    sendJson(res, 200, {
      messages: whatsapp.getOutboundLog({
        limit: Number(url.searchParams.get("limit")) || 50,
      }),
    });
    return true;
  }

  const demoPayMatch = pathname.match(/^\/api\/demo\/pay\/([^/]+)$/);
  if (req.method === "POST" && demoPayMatch) {
    if (!isDemoPaystack()) {
      sendJson(res, 400, { error: "Demo pay only when PAYSTACK keys unset" });
      return true;
    }
    const order = store.findOrder(tenantId, demoPayMatch[1]);
    if (!order) {
      sendJson(res, 404, { error: "Order not found" });
      return true;
    }
    const updated = await markPaid(tenantId, order, {
      paystackReference: order.paystackReference || `demo_${order.id}`,
    });
    sendJson(res, 200, { order: updated });
    return true;
  }

  // —— Meta WhatsApp Cloud API webhook ——
  if (req.method === "GET" && pathname === "/webhooks/whatsapp") {
    const challenge = whatsapp.verifyWebhookChallenge(url.searchParams);
    if (challenge != null) {
      sendText(res, 200, challenge);
      return true;
    }
    sendText(res, 403, "Verification failed");
    return true;
  }

  if (req.method === "POST" && pathname === "/webhooks/whatsapp") {
    const { json } = await readBody(req);
    const messages = whatsapp.parseInboundWebhook(json);
    // Optional: map phone_number_id → tenant via env META_WA_PHONE_NUMBER_ID
    const tid =
      url.searchParams.get("tenant") ||
      process.env.TENANT_ID ||
      tenantId;
    await processInboundMessages(tid, messages, req);
    res.writeHead(200);
    res.end("EVENT_RECEIVED");
    return true;
  }

  // —— Paystack webhook ——
  if (req.method === "POST" && pathname === "/webhooks/paystack") {
    try {
      const { json } = await readBody(req);
      if (json?.event === "charge.success" && json?.data?.reference) {
        const ref = json.data.reference;
        let found = store.findOrderByReference(tenantId, ref);
        let tid = tenantId;
        if (!found) {
          const global = store.findOrderByReferenceGlobal(ref);
          if (global) {
            found = global.order;
            tid = global.tenantId;
          }
        }
        // Fallback: reference prefix tenantId_ord_xxx_
        if (!found && typeof ref === "string") {
          const parts = ref.split("_");
          if (parts.length >= 3) {
            const maybeTenant = parts[0];
            const maybeOrder = `${parts[1]}_${parts[2]}`;
            if (tenants.tenantExists(maybeTenant)) {
              found = store.findOrder(maybeTenant, maybeOrder);
              tid = maybeTenant;
            }
          }
        }
        if (found) {
          await markPaid(tid, found, {
            paystackReference: ref,
            paystackChannel: json.data.channel || null,
          });
        } else {
          console.warn("Paystack success with no local order:", ref);
        }
      }
    } catch (e) {
      console.error("paystack webhook error:", e.message);
    }
    res.writeHead(200);
    res.end("ok");
    return true;
  }

  const verifyMatch = pathname.match(/^\/api\/verify\/([^/]+)$/);
  if (req.method === "GET" && verifyMatch) {
    if (isDemoPaystack()) {
      sendJson(res, 400, { error: "No Paystack keys — use demo pay" });
      return true;
    }
    const data = await paystack.verifyTransaction(
      decodeURIComponent(verifyMatch[1])
    );
    if (data.status === "success") {
      const global = store.findOrderByReferenceGlobal(data.reference);
      if (global) {
        const order = await markPaid(global.tenantId, global.order, {
          paystackReference: data.reference,
          paystackChannel: data.channel || null,
        });
        sendJson(res, 200, { ok: true, order });
        return true;
      }
    }
    sendJson(res, 200, { ok: false, status: data.status, gateway: data });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const tenantId = tenants.resolveTenantId(req, url);
    const pathname = tenants.stripTenantPath(url.pathname);

    if (
      pathname.startsWith("/api/") ||
      pathname.startsWith("/webhooks/")
    ) {
      const matched = await handleApi(req, res, url, tenantId);
      if (!matched) sendJson(res, 404, { error: "Not found" });
      return;
    }

    // Support /t/:tenant/... static paths
    if (!serveStatic(req, res, pathname)) {
      sendText(res, 404, "Not found");
    }
  } catch (err) {
    console.error(err);
    if (!res.writableEnded) {
      sendJson(res, err.status || 500, {
        error: err.message || "Server error",
      });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Catalpa CTWA spine → http://localhost:${PORT}`);
  console.log(
    `  tenant=${process.env.TENANT_ID || process.env.DEFAULT_TENANT_ID || "demo-ama"}  waMock=${isMockWhatsApp()}  paystackDemo=${isDemoPaystack()}`
  );
  console.log(`  dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`  sandbox:   POST /api/sandbox/message`);
  console.log(`  WA hook:   GET/POST /webhooks/whatsapp`);
});
