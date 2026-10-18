#!/usr/bin/env node
/** Offline unit smoke: order state machine + Catalpa lead dogfood. */

const path = require("path");
process.chdir(path.join(__dirname, ".."));

const { loadEnv } = require("../src/env");
loadEnv();
process.env.WHATSAPP_MODE = "mock";
process.env.PAYSTACK_SECRET_KEY = "sk_test_xxxxxxxx";
process.env.SAMUEL_WHATSAPP = "233241234567";

const bot = require("../src/bot/state-machine");
const store = require("../src/store");

async function smokeOrders() {
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

  console.log("smoke orders ok:", paid.id, paid.amountGhs, "GHS");
}

async function smokeLeads() {
  const tenantId = "catalpa";
  const phone = "233209998877";
  store.resetSession(tenantId, phone);

  if (!store.isLeadMode(tenantId)) throw new Error("catalpa should be leads mode");

  let r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "hi",
    contactName: "Ama Test",
    baseUrl: "http://localhost:3040",
  });
  if (!r.replies.some((x) => /Catalpa|Welcome/i.test(x))) {
    throw new Error("lead greet failed");
  }
  if (r.session.state !== "ask_business_type") {
    throw new Error("expected ask_business_type");
  }

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "chop bar",
    baseUrl: "http://localhost:3040",
  });
  if (r.session.state !== "ask_city") throw new Error("ask_city failed");

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "Accra",
    baseUrl: "http://localhost:3040",
  });
  if (r.session.state !== "ask_whatsapp") throw new Error("ask_whatsapp failed");

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "same",
    baseUrl: "http://localhost:3040",
  });
  if (r.session.state !== "ask_meta_ads") throw new Error("ask_meta_ads failed");

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "no",
    baseUrl: "http://localhost:3040",
  });
  if (r.session.state !== "ask_intent") throw new Error("ask_intent failed");

  r = await bot.handleMessage({
    tenantId,
    fromPhone: phone,
    text: "1",
    baseUrl: "http://localhost:3040",
  });
  if (!r.lead) throw new Error("lead not created");
  if (r.lead.status !== "demo_booked") throw new Error("demo_booked expected");
  if (!r.notifyWaMe || !r.notifyWaMe.includes("wa.me")) {
    throw new Error("notify wa.me missing");
  }
  if (r.session.state !== "done") throw new Error("done state failed");

  const leads = store.listLeads(tenantId);
  if (!leads.find((l) => l.id === r.lead.id)) throw new Error("lead not listed");

  console.log("smoke leads ok:", r.lead.id, r.lead.intent);
}

async function run() {
  await smokeOrders();
  await smokeLeads();
  console.log("smoke ok: orders + catalpa leads");
}

run().catch((e) => {
  console.error("smoke failed:", e);
  process.exit(1);
});
