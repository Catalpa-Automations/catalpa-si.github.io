#!/usr/bin/env node
/**
 * Import a Google Sheets export (CSV) into data/leads.json.
 * Usage: node sheets/scripts/import-csv.js [path/to/leads.csv]
 */
const fs = require("fs");
const path = require("path");
const store = require("../../src/store");

const csvPath =
  process.argv[2] ||
  path.join(__dirname, "..", "leads-template.csv");

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (cols[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitRow(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const n = store.replaceFromCsvRows(rows);
console.log(`Imported ${n} leads from ${csvPath} → data/leads.json`);
