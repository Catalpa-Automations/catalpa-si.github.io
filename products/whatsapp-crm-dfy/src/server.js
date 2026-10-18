const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { loadEnv } = require("./env");
const store = require("./store");

loadEnv();
store.ensureData();

const PORT = Number(process.env.PORT) || 3847;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  rel = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, pathname, url) {
  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        business: process.env.BUSINESS_NAME || null,
        stages: store.STAGES,
      });
    }

    if (req.method === "GET" && pathname === "/api/stats") {
      return sendJson(res, 200, store.stats());
    }

    if (req.method === "GET" && pathname === "/api/leads") {
      const stage = url.searchParams.get("stage") || "All";
      const q = url.searchParams.get("q") || "";
      return sendJson(res, 200, { leads: store.list({ stage, q }) });
    }

    if (req.method === "GET" && pathname === "/api/export.csv") {
      const csv = store.toCsv();
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="leads.csv"',
      });
      return res.end(csv);
    }

    const leadMatch = pathname.match(/^\/api\/leads\/([^/]+)$/);
    if (leadMatch) {
      const id = decodeURIComponent(leadMatch[1]);
      if (req.method === "GET") {
        const lead = store.get(id);
        if (!lead) return sendJson(res, 404, { error: "Lead not found" });
        return sendJson(res, 200, { lead });
      }
      if (req.method === "PATCH" || req.method === "PUT") {
        const body = await readBody(req);
        const lead = store.update(id, body);
        if (!lead) return sendJson(res, 404, { error: "Lead not found" });
        return sendJson(res, 200, { lead });
      }
      if (req.method === "DELETE") {
        const ok = store.remove(id);
        if (!ok) return sendJson(res, 404, { error: "Lead not found" });
        return sendJson(res, 200, { ok: true });
      }
    }

    if (req.method === "POST" && pathname === "/api/leads") {
      const body = await readBody(req);
      const lead = store.create(body);
      return sendJson(res, 201, { lead });
    }

    sendJson(res, 404, { error: "Unknown API route" });
  } catch (err) {
    sendJson(res, 400, { error: err.message || String(err) });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, pathname, url);
  }
  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`WhatsApp CRM DFY → http://127.0.0.1:${PORT}`);
  console.log(`Stages: ${store.STAGES.join(" → ")}`);
});
