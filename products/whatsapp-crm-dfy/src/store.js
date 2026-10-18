const fs = require("fs");
const path = require("path");
const { normalizeGhPhone, waMeLink } = require("./whatsapp");

const DATA_DIR = path.join(__dirname, "..", "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const SAMPLE_FILE = path.join(DATA_DIR, "leads.sample.json");

const STAGES = ["New", "Contacted", "Quoted", "Won", "Lost"];

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LEADS_FILE)) {
    const seed = fs.existsSync(SAMPLE_FILE)
      ? fs.readFileSync(SAMPLE_FILE, "utf8")
      : JSON.stringify({ leads: [] }, null, 2);
    fs.writeFileSync(LEADS_FILE, seed, "utf8");
  }
}

function read() {
  ensureData();
  return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
}

function write(db) {
  ensureData();
  const bak = LEADS_FILE + ".bak";
  if (fs.existsSync(LEADS_FILE)) fs.copyFileSync(LEADS_FILE, bak);
  fs.writeFileSync(LEADS_FILE, JSON.stringify(db, null, 2), "utf8");
}

function enrich(lead) {
  const phone = normalizeGhPhone(lead.phone);
  const name = lead.name || "there";
  const biz = process.env.BUSINESS_NAME || "our shop";
  const greet = `Hi ${name}, this is ${biz}. Following up on your enquiry.`;
  const quoteMsg = `Hi ${name}, here's your quote from ${biz}. Reply here if you have questions.`;
  return {
    ...lead,
    phone,
    stage: STAGES.includes(lead.stage) ? lead.stage : "New",
    waLink: waMeLink(phone, greet),
    waQuoteLink: waMeLink(phone, quoteMsg),
  };
}

function list({ stage, q } = {}) {
  let leads = read().leads.map(enrich);
  if (stage && stage !== "All") {
    leads = leads.filter((l) => l.stage === stage);
  }
  if (q) {
    const needle = String(q).toLowerCase();
    leads = leads.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(needle) ||
        (l.phone || "").includes(needle) ||
        (l.city || "").toLowerCase().includes(needle) ||
        (l.notes || "").toLowerCase().includes(needle) ||
        (l.source || "").toLowerCase().includes(needle)
    );
  }
  leads.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  return leads;
}

function get(id) {
  return list().find((l) => l.id === id) || null;
}

function create(input) {
  const db = read();
  const now = new Date().toISOString();
  const lead = {
    id: `L-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(input.name || "").trim() || "Unknown",
    phone: normalizeGhPhone(input.phone),
    city: String(input.city || process.env.DEFAULT_CITY || "").trim(),
    source: String(input.source || "Walk-in").trim(),
    stage: STAGES.includes(input.stage) ? input.stage : "New",
    valueGhs: Number(input.valueGhs) || 0,
    notes: String(input.notes || "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  if (!lead.phone) throw new Error("Phone required (Ghana: 0XX… or 233…)");
  db.leads.push(lead);
  write(db);
  return enrich(lead);
}

function update(id, patch) {
  const db = read();
  const idx = db.leads.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  const cur = db.leads[idx];
  const next = {
    ...cur,
    name: patch.name !== undefined ? String(patch.name).trim() : cur.name,
    phone:
      patch.phone !== undefined ? normalizeGhPhone(patch.phone) : cur.phone,
    city: patch.city !== undefined ? String(patch.city).trim() : cur.city,
    source:
      patch.source !== undefined ? String(patch.source).trim() : cur.source,
    stage:
      patch.stage !== undefined && STAGES.includes(patch.stage)
        ? patch.stage
        : cur.stage,
    valueGhs:
      patch.valueGhs !== undefined ? Number(patch.valueGhs) || 0 : cur.valueGhs,
    notes: patch.notes !== undefined ? String(patch.notes).trim() : cur.notes,
    updatedAt: new Date().toISOString(),
  };
  if (!next.phone) throw new Error("Phone required");
  db.leads[idx] = next;
  write(db);
  return enrich(next);
}

function remove(id) {
  const db = read();
  const before = db.leads.length;
  db.leads = db.leads.filter((l) => l.id !== id);
  if (db.leads.length === before) return false;
  write(db);
  return true;
}

function stats() {
  const leads = list();
  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0]));
  let pipelineGhs = 0;
  let wonGhs = 0;
  for (const l of leads) {
    byStage[l.stage] = (byStage[l.stage] || 0) + 1;
    if (l.stage === "Won") wonGhs += l.valueGhs || 0;
    else if (l.stage !== "Lost") pipelineGhs += l.valueGhs || 0;
  }
  return { total: leads.length, byStage, pipelineGhs, wonGhs, stages: STAGES };
}

function toCsv() {
  const leads = list();
  const headers = [
    "id",
    "name",
    "phone",
    "city",
    "source",
    "stage",
    "valueGhs",
    "notes",
    "waLink",
    "createdAt",
    "updatedAt",
  ];
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = [headers.join(",")];
  for (const l of leads) {
    rows.push(headers.map((h) => esc(l[h])).join(","));
  }
  return rows.join("\n") + "\n";
}

function replaceFromCsvRows(rows) {
  const db = { leads: [] };
  const now = new Date().toISOString();
  for (const row of rows) {
    if (!row.phone && !row.name) continue;
    db.leads.push({
      id: row.id || `L-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: String(row.name || "Unknown").trim(),
      phone: normalizeGhPhone(row.phone),
      city: String(row.city || "").trim(),
      source: String(row.source || "Import").trim(),
      stage: STAGES.includes(row.stage) ? row.stage : "New",
      valueGhs: Number(row.valueGhs) || 0,
      notes: String(row.notes || "").trim(),
      createdAt: row.createdAt || now,
      updatedAt: now,
    });
  }
  write(db);
  return db.leads.length;
}

module.exports = {
  STAGES,
  list,
  get,
  create,
  update,
  remove,
  stats,
  toCsv,
  replaceFromCsvRows,
  ensureData,
};
