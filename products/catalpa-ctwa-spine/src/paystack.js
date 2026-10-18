const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || key.includes("xxxxxxxx")) {
    const err = new Error(
      "Set PAYSTACK_SECRET_KEY in .env (use sk_test_… from Paystack dashboard)"
    );
    err.status = 503;
    throw err;
  }
  return key;
}

async function paystackFetch(apiPath, { method = "GET", body } = {}) {
  const res = await fetch(`${PAYSTACK_BASE}${apiPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    const err = new Error(data.message || `Paystack error (${res.status})`);
    err.status = res.status >= 400 ? res.status : 502;
    err.paystack = data;
    throw err;
  }
  return data;
}

/**
 * Hosted Paystack checkout (GHS).
 * Buyers pay with MTN MoMo / Telecel Cash / AirtelTigo / card.
 */
async function initializeTransaction({ order, callbackUrl }) {
  const currency = process.env.CURRENCY || "GHS";
  const amountPesewas = Math.round(order.amountGhs * 100);

  const payload = {
    email: `${order.customerPhone}@catalpa.orders`,
    amount: amountPesewas,
    currency,
    reference: `${order.tenantId}_${order.id}_${Date.now()}`,
    callback_url: callbackUrl,
    metadata: {
      order_id: order.id,
      tenant_id: order.tenantId,
      customer_phone: order.customerPhone,
      custom_fields: [
        {
          display_name: "Order",
          variable_name: "order_id",
          value: order.id,
        },
        {
          display_name: "Tenant",
          variable_name: "tenant_id",
          value: order.tenantId,
        },
      ],
    },
    channels: ["mobile_money", "card", "bank", "ussd"],
  };

  const result = await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: payload,
  });

  return {
    authorizationUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    reference: result.data.reference,
  };
}

async function verifyTransaction(reference) {
  const result = await paystackFetch(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
  return result.data;
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
};
