#!/usr/bin/env node
/**
 * Smoke test — starts server, hits health/stats/CRUD + wa.me shape, exits.
 */
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 3847;
const BASE = `http://127.0.0.1:${PORT}`;

function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      `${BASE}${urlPath}`,
      {
        method,
        headers: data
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(data),
            }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch (_) {}
          resolve({ status: res.statusCode, json, raw });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function waitHealth(retries = 40) {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < retries; i++) {
      try {
        const h = await req("GET", "/api/health");
        if (h.status === 200 && h.json?.ok) return resolve(h);
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 100));
    }
    reject(new Error("Server did not become healthy"));
  });
}

async function main() {
  const child = spawn("node", [path.join(__dirname, "..", "src", "server.js")], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(PORT),
      BUSINESS_NAME: "Smoke Test Shop",
      BUSINESS_WHATSAPP: "233201234567",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let failed = false;
  try {
    await waitHealth();

    const stats = await req("GET", "/api/stats");
    if (stats.status !== 200 || !stats.json.stages) throw new Error("stats failed");

    const created = await req("POST", "/api/leads", {
      name: "Smoke Lead",
      phone: "0244000111",
      city: "Accra",
      stage: "New",
      valueGhs: 1500,
      source: "Smoke",
    });
    if (created.status !== 201) throw new Error("create failed: " + created.raw);
    const lead = created.json.lead;
    if (!lead.waLink || !lead.waLink.startsWith("https://wa.me/233244000111")) {
      throw new Error("wa.me link wrong: " + lead.waLink);
    }

    const advanced = await req("PATCH", `/api/leads/${lead.id}`, {
      stage: "Contacted",
    });
    if (advanced.json.lead.stage !== "Contacted") throw new Error("stage patch failed");

    const listed = await req("GET", "/api/leads?stage=Contacted");
    if (!listed.json.leads.some((l) => l.id === lead.id)) {
      throw new Error("list filter failed");
    }

    const del = await req("DELETE", `/api/leads/${lead.id}`);
    if (!del.json.ok) throw new Error("delete failed");

    console.log("smoke_test OK — health, CRUD, stages, wa.me");
  } catch (err) {
    failed = true;
    console.error("smoke_test FAIL:", err.message);
  } finally {
    child.kill("SIGTERM");
  }
  process.exit(failed ? 1 : 0);
}

main();
