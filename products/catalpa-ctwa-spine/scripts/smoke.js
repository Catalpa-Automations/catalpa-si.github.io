#!/usr/bin/env node
/** Offline unit smoke: state machine + store without HTTP. */

const path = require("path");
process.chdir(path.join(__dirname, ".."));

const { loadEnv } = require("../src/env");
loadEnv();
process.env.WHATSAPP_MODE = "mock";
process.env.PAYSTACK_SECRET_KEY = "sk_test_xxxxxxxx";

const bot = require("../src/bot/state-machine");
const store = require("../src/store");

async function run() {
  const tenantId = "demo-ama";
  const phone = "233241234567";
  store.resetSession(tenantId, phone);

  let r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "hi",
    baseUrl: "http://localhost:3040",
  });
  if (!r.replies[0].includes("Welcome")) throw new Error("greet failed");

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "5",
    baseUrl: "http://localhost:3040",
  });
  if (!r.session.cart?.length) throw new Error("add to cart failed");

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "checkout",
    baseUrl: "http://localhost:3040",
  });
  if (r.session.state !== "confirm") throw new Error("confirm state failed");

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "yes",
    baseUrl: "http://localhost:3040",
  });
  if (!r.order?.paymentUrl) throw new Error("payment link failed");
  if (r.order.status !== "awaiting_payment") throw new Error("status failed");

  const paid = bot.markOrderPaid(tenantId, r.order);
  if (paid.status !== "paid") throw new Error("mark paid failed");

  const msg = store.buildDispatchMessage(paid, "Test rider");
  if (!msg.includes("DISPATCH")) throw new Error("dispatch msg failed");

  console.log("smoke ok:", paid.id, paid.amountGhs, "GHS");
}

run().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
