#!/usr/bin/env node
/**
 * End-to-end sandbox walkthrough against a running server (or boots inline).
 * Usage: npm run demo   (expects server on PORT, default 3040)
 */

const PORT = Number(process.env.PORT) || 3040;
const BASE = process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`;
const TENANT = process.env.TENANT_ID || "demo-ama";
const PHONE = "233249998877";

async function msg(text) {
  const res = await fetch(`${BASE}/api/sandbox/message?tenant=${TENANT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
    },
    body: JSON.stringify({ from: PHONE, text, name: "Demo Buyer" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  console.log(`\n▶ YOU: ${text}`);
  for (const r of data.botReplies) {
    console.log(`◀ BOT:\n${r}`);
  }
  return data;
}

async function main() {
  console.log(`Catalpa CTWA sandbox demo → ${BASE} tenant=${TENANT}`);
  await msg("hi");
  await msg("5"); // black soap
  await msg("cart");
  await msg("checkout");
  const paidPrep = await msg("yes");
  const orderId = paidPrep.order?.id;
  if (!orderId) throw new Error("No order created");

  const pay = await fetch(`${BASE}/api/demo/pay/${orderId}?tenant=${TENANT}`, {
    method: "POST",
    headers: { "X-Tenant-Id": TENANT },
  });
  const payData = await pay.json();
  if (!pay.ok) throw new Error(payData.error || "demo pay failed");
  console.log(`\n💰 PAID ${orderId} → ${payData.order.status}`);

  const dispatch = await fetch(
    `${BASE}/api/orders/${orderId}/dispatch?tenant=${TENANT}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": TENANT,
      },
      body: JSON.stringify({
        riderNote: "Okada to East Legon, call on arrival",
        logisticsPhone: "233200000001",
      }),
    }
  );
  const d = await dispatch.json();
  if (!dispatch.ok) throw new Error(d.error || "dispatch failed");
  console.log("\n🚚 DISPATCH MESSAGE:\n" + d.dispatchMessage);
  console.log("\nwa.me:", d.waMeLink);
  console.log("\n✅ Spine demo complete.");
}

main().catch((e) => {
  console.error(e.message);
  console.error("Is the server running?  npm start");
  process.exit(1);
});
