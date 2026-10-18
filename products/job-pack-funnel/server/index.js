/**
 * Job Pack Funnel — Paystack MoMo checkout + download / WhatsApp delivery
 * Zero npm deps (Node 18+ stdlib only) so it runs on agent-store / simple VPS.
 */
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const PACKS = path.join(ROOT, "packs");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 3847);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
function envKey(name) {
  const v = (process.env[name] || "").trim();
  if (!v || /x{8,}/i.test(v) || v.includes("xxxxxxxx")) return "";
  return v;
}
const SECRET = envKey("PAYSTACK_SECRET_KEY");
const PUBLIC_KEY = envKey("PAYSTACK_PUBLIC_KEY");
const PACK_NAME = process.env.PACK_NAME || "Graduate Job-Seeker Starter Pack";
const PRICE = Number(process.env.PACK_PRICE_PESEWAS || 14900);
const CURRENCY = process.env.CURRENCY || "GHS";
const WA_NUMBER = (process.env.WHATSAPP_NUMBER || "233241234567").replace(/\D/g, "");
const WA_MSG =
  process.env.WHATSAPP_MESSAGE ||
  "Hi! I just paid for the Graduate Job Pack. Please send my download link.";
const ALLOW_MANUAL = String(process.env.ALLOW_MANUAL_CONFIRM || "true") === "true";
const MANUAL_CODE = process.env.MANUAL_CONFIRM_CODE || "JOBPACK-DEMO";
const ADMIN_NOTIFY = String(process.env.ADMIN_NOTIFY || "true") === "true";

/** @type {Map<string, object>} */
const unlocks = new Map();
const UNLOCK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

function grantUnlock(reference, meta = {}) {
  const token = crypto.randomBytes(24).toString("hex");
  unlocks.set(token, {
    reference,
    email: meta.email || null,
    amount: meta.amount || PRICE,
    createdAt: Date.now(),
    expiresAt: Date.now() + UNLOCK_TTL_MS,
  });
  unlocks.set(`ref:${reference}`, token);
  return token;
}

function getUnlock(token) {
  const row = unlocks.get(token);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    unlocks.delete(token);
    return null;
  }
  return row;
}

function whatsappUrl(extra = "") {
  const text = encodeURIComponent(extra ? `${WA_MSG}\n${extra}` : WA_MSG);
  return `https://wa.me/${WA_NUMBER}?text=${text}`;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(text);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJsonBody(buf) {
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

async function paystackFetch(pathname, options = {}) {
  if (!SECRET) throw new Error("PAYSTACK_SECRET_KEY is not set");
  const res = await fetch(`https://api.paystack.co${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || data.status === false) {
    throw new Error(data.message || res.statusText);
  }
  return data;
}

function listPackFiles() {
  if (!fs.existsSync(PACKS)) return [];
  return fs
    .readdirSync(PACKS)
    .filter((f) => !f.startsWith(".") && f !== "README.md")
    .map((f) => ({ name: f }));
}

function safeJoin(root, rel) {
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function serveFile(res, filePath, downloadName) {
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendText(res, 404, "Not found");
  }
  const ext = path.extname(filePath).toLowerCase();
  const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
  if (downloadName) {
    headers["Content-Disposition"] = `attachment; filename="${downloadName}"`;
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url, bodyBuf) {
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/health") {
    return sendJson(res, 200, { ok: true, pack: PACK_NAME, pricePesewas: PRICE });
  }

  if (req.method === "GET" && pathname === "/api/config") {
    return sendJson(res, 200, {
      publicKey: PUBLIC_KEY,
      packName: PACK_NAME,
      amount: PRICE,
      currency: CURRENCY,
      amountGhs: (PRICE / 100).toFixed(2),
      whatsappNumber: WA_NUMBER,
      hasSecret: Boolean(SECRET),
      allowManualConfirm: ALLOW_MANUAL,
    });
  }

  if (req.method === "POST" && pathname === "/api/checkout") {
    const body = parseJsonBody(bodyBuf);
    if (!body) return sendJson(res, 400, { error: "Invalid JSON" });
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    if (!email || !email.includes("@")) {
      return sendJson(res, 400, { error: "Valid email is required" });
    }

    if (!SECRET) {
      const reference = `demo_${Date.now()}`;
      const token = grantUnlock(reference, { email, amount: PRICE });
      return sendJson(res, 200, {
        demo: true,
        message: "No PAYSTACK_SECRET_KEY — demo unlock issued.",
        reference,
        accessToken: token,
        authorization_url: `${BASE_URL}/success.html?token=${token}&ref=${reference}`,
      });
    }

    try {
      const reference = `jp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const init = await paystackFetch("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email,
          amount: PRICE,
          currency: CURRENCY,
          reference,
          callback_url: `${BASE_URL}/api/paystack/callback`,
          metadata: {
            pack: PACK_NAME,
            name,
            phone,
            custom_fields: [
              { display_name: "Pack", variable_name: "pack", value: PACK_NAME },
              { display_name: "Name", variable_name: "name", value: name || "—" },
              { display_name: "Phone", variable_name: "phone", value: phone || "—" },
            ],
          },
          channels: ["mobile_money", "card", "bank", "ussd"],
        }),
      });
      return sendJson(res, 200, {
        authorization_url: init.data.authorization_url,
        access_code: init.data.access_code,
        reference: init.data.reference,
        publicKey: PUBLIC_KEY,
        amount: PRICE,
        email,
      });
    } catch (err) {
      console.error("checkout error:", err.message);
      return sendJson(res, 500, { error: err.message || "Checkout failed" });
    }
  }

  if (req.method === "GET" && pathname === "/api/paystack/callback") {
    const reference = String(url.searchParams.get("reference") || url.searchParams.get("trxref") || "");
    if (!reference) return redirect(res, "/confirm.html?error=missing_reference");
    try {
      const verified = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`);
      if (verified.data.status !== "success") {
        return redirect(res, `/confirm.html?error=not_paid&ref=${encodeURIComponent(reference)}`);
      }
      let token = unlocks.get(`ref:${reference}`);
      if (!token) {
        token = grantUnlock(reference, {
          email: verified.data.customer?.email,
          amount: verified.data.amount,
        });
      }
      if (ADMIN_NOTIFY) {
        console.log(`[PAID] ref=${reference} email=${verified.data.customer?.email} amount=${verified.data.amount}`);
      }
      return redirect(res, `/success.html?token=${token}&ref=${encodeURIComponent(reference)}`);
    } catch (err) {
      console.error("callback verify error:", err.message);
      return redirect(res, `/confirm.html?error=verify_failed&ref=${encodeURIComponent(reference)}`);
    }
  }

  if (req.method === "POST" && pathname === "/api/paystack/webhook") {
    try {
      const signature = req.headers["x-paystack-signature"];
      if (SECRET && signature) {
        const hash = crypto.createHmac("sha512", SECRET).update(bodyBuf).digest("hex");
        if (hash !== signature) return sendText(res, 401, "Invalid signature");
      }
      const event = parseJsonBody(bodyBuf) || {};
      if (event.event === "charge.success" && event.data?.status === "success") {
        const reference = event.data.reference;
        if (!unlocks.get(`ref:${reference}`)) {
          grantUnlock(reference, {
            email: event.data.customer?.email,
            amount: event.data.amount,
          });
        }
        if (ADMIN_NOTIFY) {
          console.log(`[WEBHOOK PAID] ref=${reference} email=${event.data.customer?.email}`);
        }
      }
      res.writeHead(200);
      return res.end("ok");
    } catch (err) {
      console.error("webhook error:", err.message);
      res.writeHead(200);
      return res.end("ok");
    }
  }

  if (req.method === "POST" && pathname === "/api/confirm-manual") {
    if (!ALLOW_MANUAL) return sendJson(res, 403, { error: "Manual confirm disabled" });
    const body = parseJsonBody(bodyBuf);
    if (!body) return sendJson(res, 400, { error: "Invalid JSON" });
    const code = String(body.code || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const reference = String(body.reference || `manual_${Date.now()}`).trim();
    if (code !== MANUAL_CODE) return sendJson(res, 401, { error: "Invalid confirm code" });
    const token = grantUnlock(reference, { email, amount: PRICE });
    return sendJson(res, 200, {
      ok: true,
      accessToken: token,
      successUrl: `/success.html?token=${token}&ref=${encodeURIComponent(reference)}`,
      whatsapp: whatsappUrl(`Ref: ${reference}`),
    });
  }

  const unlockMatch = pathname.match(/^\/api\/unlock\/([^/]+)$/);
  if (req.method === "GET" && unlockMatch) {
    const row = getUnlock(unlockMatch[1]);
    if (!row) return sendJson(res, 404, { error: "Invalid or expired unlock" });
    return sendJson(res, 200, {
      ok: true,
      reference: row.reference,
      email: row.email,
      packName: PACK_NAME,
      amountGhs: (row.amount / 100).toFixed(2),
      expiresAt: row.expiresAt,
      files: listPackFiles(),
      whatsapp: whatsappUrl(`Ref: ${row.reference}`),
      downloadBase: "/api/download/" + unlockMatch[1],
    });
  }

  const dlMatch = pathname.match(/^\/api\/download\/([^/]+)\/(.+)$/);
  if (req.method === "GET" && dlMatch) {
    const row = getUnlock(dlMatch[1]);
    if (!row) return sendText(res, 403, "Unlock required. Complete payment first.");
    const safe = path.basename(decodeURIComponent(dlMatch[2]));
    const full = safeJoin(PACKS, safe);
    return serveFile(res, full, safe);
  }

  return sendJson(res, 404, { error: "Not found" });
}

function handleStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";

  if (rel.startsWith("/packs/")) {
    const full = safeJoin(PACKS, rel.slice("/packs/".length));
    return serveFile(res, full);
  }

  const full = safeJoin(PUBLIC, rel.slice(1));
  return serveFile(res, full);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", BASE_URL);
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      const bodyBuf = ["POST", "PUT", "PATCH"].includes(req.method || "")
        ? await readBody(req)
        : Buffer.alloc(0);
      return await handleApi(req, res, url, bodyBuf);
    }
    return handleStatic(req, res, url);
  } catch (err) {
    console.error("request error:", err);
    sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Job Pack Funnel → ${BASE_URL}`);
  console.log(`Pack: ${PACK_NAME} · ${(PRICE / 100).toFixed(2)} ${CURRENCY}`);
  console.log(`Paystack secret: ${SECRET ? "set" : "MISSING (demo mode)"}`);
  console.log(`WhatsApp: https://wa.me/${WA_NUMBER}`);
});
