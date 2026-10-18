const fs = require("fs");
const path = require("path");

const TENANTS_DIR = path.join(__dirname, "..", "data", "tenants");

/**
 * Multi-tenant sketch for Catalpa demo-per-client:
 *   1. Header X-Tenant-Id / query ?tenant=
 *   2. Path prefix /t/:tenantId/...
 *   3. Subdomain demo-ama.localhost → demo-ama
 *   4. Env TENANT_ID / DEFAULT_TENANT_ID
 */
function listTenantIds() {
  if (!fs.existsSync(TENANTS_DIR)) return [];
  return fs
    .readdirSync(TENANTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function tenantDir(tenantId) {
  return path.join(TENANTS_DIR, tenantId);
}

function tenantExists(tenantId) {
  return tenantId && fs.existsSync(tenantDir(tenantId));
}

function ensureTenant(tenantId) {
  const id = String(tenantId || "").trim();
  if (!id || !/^[a-z0-9][a-z0-9-]{1,62}$/i.test(id)) {
    const err = new Error("Invalid tenant id");
    err.status = 400;
    throw err;
  }
  const dir = tenantDir(id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return id;
}

function resolveTenantId(req, url) {
  const header = req.headers["x-tenant-id"];
  if (header && tenantExists(String(header).trim())) {
    return String(header).trim();
  }

  const q = url.searchParams.get("tenant");
  if (q && tenantExists(q)) return q;

  const pathMatch = url.pathname.match(/^\/t\/([a-z0-9-]+)/i);
  if (pathMatch && tenantExists(pathMatch[1])) return pathMatch[1];

  const host = (req.headers.host || "").split(":")[0];
  const sub = host.split(".")[0];
  if (sub && sub !== "localhost" && sub !== "www" && tenantExists(sub)) {
    return sub;
  }

  const envId = process.env.TENANT_ID || process.env.DEFAULT_TENANT_ID || "demo-ama";
  if (tenantExists(envId)) return envId;

  const all = listTenantIds();
  return all[0] || "demo-ama";
}

/** Strip /t/:tenantId prefix so routing stays clean. */
function stripTenantPath(pathname) {
  const m = pathname.match(/^\/t\/[a-z0-9-]+(\/.*)?$/i);
  if (!m) return pathname;
  return m[1] || "/";
}

module.exports = {
  TENANTS_DIR,
  listTenantIds,
  tenantDir,
  tenantExists,
  ensureTenant,
  resolveTenantId,
  stripTenantPath,
};
