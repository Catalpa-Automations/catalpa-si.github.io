const params = new URLSearchParams(location.search);
let tenant =
  params.get("tenant") || localStorage.getItem("catalpa_tenant") || "demo-ama";

const els = {
  merchantName: document.getElementById("merchant-name"),
  merchantSub: document.getElementById("merchant-sub"),
  tenantSelect: document.getElementById("tenant-select"),
  modePill: document.getElementById("mode-pill"),
  orders: document.getElementById("orders"),
  ordersTitle: document.getElementById("orders-title"),
  sandboxHint: document.getElementById("sandbox-hint"),
  sandboxText: document.getElementById("sandbox-text"),
  sandboxForm: document.getElementById("sandbox-form"),
  sandboxPhone: document.getElementById("sandbox-phone"),
  sandboxOut: document.getElementById("sandbox-out"),
  refreshBtn: document.getElementById("refresh-btn"),
  dispatchDialog: document.getElementById("dispatch-dialog"),
  dispatchForm: document.getElementById("dispatch-form"),
  dispatchOrderLabel: document.getElementById("dispatch-order-label"),
  riderNote: document.getElementById("rider-note"),
  logisticsPhone: document.getElementById("logistics-phone"),
  dispatchCancel: document.getElementById("dispatch-cancel"),
  dispatchPreview: document.getElementById("dispatch-preview"),
  dispatchLinkWrap: document.getElementById("dispatch-link-wrap"),
  dispatchLink: document.getElementById("dispatch-link"),
};

let dispatchOrderId = null;
let tenantMode = "orders";

function api(path, opts = {}) {
  const url = new URL(path, location.origin);
  url.searchParams.set("tenant", tenant);
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": tenant,
      ...(opts.headers || {}),
    },
  }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  });
}

function setTenant(id) {
  tenant = id;
  localStorage.setItem("catalpa_tenant", id);
  const u = new URL(location.href);
  u.searchParams.set("tenant", id);
  history.replaceState({}, "", u);
}

function formatMoney(n) {
  return `GHS ${Number(n).toFixed(2)}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOrder(order) {
  const items = (order.items || [])
    .map((i) => `${i.name} × ${i.qty}`)
    .join(", ");
  const canDispatch = ["paid", "preparing", "dispatched"].includes(order.status);
  const statusOptions = [
    "new",
    "awaiting_payment",
    "paid",
    "preparing",
    "dispatched",
    "delivered",
    "cancelled",
  ];

  return `
    <article class="order" data-id="${order.id}">
      <div class="order-top">
        <span class="order-id">${order.id}</span>
        <span class="status ${order.status}">${order.status}</span>
      </div>
      <p class="amount">${formatMoney(order.amountGhs)}</p>
      <p class="meta">+${order.customerPhone} · ${order.customerName || "Customer"}</p>
      <p class="meta">${items}</p>
      ${order.note ? `<p class="meta">Note: ${escapeHtml(order.note)}</p>` : ""}
      <div class="actions">
        <select data-status="${order.id}" aria-label="Status">
          ${statusOptions
            .map(
              (s) =>
                `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`
            )
            .join("")}
        </select>
        ${
          canDispatch
            ? `<button type="button" data-dispatch="${order.id}">Dispatch</button>`
            : ""
        }
        ${
          order.status === "awaiting_payment" && order.paymentUrl
            ? `<a href="${order.paymentUrl}" target="_blank" rel="noopener">Open pay link</a>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderLead(lead) {
  const statusOptions = ["new", "demo_booked", "contacted", "won", "lost"];
  const metaAds =
    lead.hasMetaAds === true ? "yes" : lead.hasMetaAds === false ? "no" : "—";
  return `
    <article class="order" data-lead="${lead.id}">
      <div class="order-top">
        <span class="order-id">${lead.id}</span>
        <span class="status ${lead.status}">${lead.status}</span>
      </div>
      <p class="amount">${lead.intent === "demo" ? "See live demo" : "Lead capture"}</p>
      <p class="meta">${escapeHtml(lead.businessType || "—")} · ${escapeHtml(lead.city || "—")}</p>
      <p class="meta">WA +${lead.whatsapp || lead.fromPhone} · Meta ads: ${metaAds}</p>
      <p class="meta">${escapeHtml(lead.customerName || "")}${
        lead.offerInterest ? ` · ${escapeHtml(lead.offerInterest)}` : ""
      }</p>
      <div class="actions">
        <select data-lead-status="${lead.id}" aria-label="Lead status">
          ${statusOptions
            .map(
              (s) =>
                `<option value="${s}" ${s === lead.status ? "selected" : ""}>${s}</option>`
            )
            .join("")}
        </select>
        ${
          lead.notifyWaMe
            ? `<a href="${lead.notifyWaMe}" target="_blank" rel="noopener">Notify Samuel (wa.me)</a>`
            : ""
        }
      </div>
    </article>
  `;
}

async function loadHealth() {
  const h = await api("/api/health");
  tenantMode = h.mode || "orders";
  els.modePill.textContent =
    (tenantMode === "leads" ? "Leads · " : "Orders · ") +
    (h.whatsappMock
      ? "WA mock · " + (h.paystackDemo ? "Paystack demo" : "Paystack live")
      : "WA cloud · " + (h.paystackDemo ? "Paystack demo" : "Paystack live"));
  els.modePill.classList.toggle("ok", !h.whatsappMock || h.paystackDemo);
}

async function loadTenants() {
  const data = await api("/api/tenants");
  els.tenantSelect.innerHTML = data.tenants
    .map(
      (t) =>
        `<option value="${t.id}" ${t.id === tenant ? "selected" : ""}>${t.name} (${t.id})${
          t.mode === "leads" ? " · leads" : ""
        }</option>`
    )
    .join("");
}

async function loadCatalogHeader() {
  const cat = await api("/api/catalog");
  tenantMode = cat.mode === "leads" ? "leads" : "orders";
  els.merchantName.textContent = cat.merchant?.name || tenant;
  els.merchantSub.textContent =
    (cat.merchant?.tagline ||
      (tenantMode === "leads" ? "Catalpa inbound leads" : "WhatsApp orders")) +
    (cat.merchant?.city ? ` · ${cat.merchant.city}` : "");
  if (els.ordersTitle) {
    els.ordersTitle.textContent =
      tenantMode === "leads" ? "Inbound leads" : "Orders";
  }
  if (els.sandboxHint) {
    els.sandboxHint.textContent =
      tenantMode === "leads"
        ? "Simulate a Catalpa lead (no Meta tokens). Flow: hi → business type → city → same → yes/no → 1 (demo) or 2 (lead)."
        : "Simulate a customer WhatsApp message (no Meta tokens needed). Flow: hi → menu number → checkout → yes → demo pay.";
  }
  if (els.sandboxText) {
    els.sandboxText.placeholder =
      tenantMode === "leads"
        ? "hi / chop bar / Accra / same / no / 1"
        : "hi / menu / 5 / checkout / yes";
  }
  if (cat.merchant?.logisticsWhatsApp) {
    els.logisticsPhone.placeholder = cat.merchant.logisticsWhatsApp;
  }
}

async function loadBoard() {
  if (tenantMode === "leads") {
    const data = await api("/api/leads");
    if (!data.leads.length) {
      els.orders.innerHTML =
        '<p class="empty">No leads yet. Use the sandbox bot above (tenant: catalpa).</p>';
      return;
    }
    els.orders.innerHTML = data.leads.map(renderLead).join("");
    return;
  }
  const data = await api("/api/orders");
  if (!data.orders.length) {
    els.orders.innerHTML =
      '<p class="empty">No orders yet. Use the sandbox bot above to place one.</p>';
    return;
  }
  els.orders.innerHTML = data.orders.map(renderOrder).join("");
}

els.orders.addEventListener("change", async (e) => {
  const leadSel = e.target.closest("select[data-lead-status]");
  if (leadSel) {
    const id = leadSel.getAttribute("data-lead-status");
    try {
      await api(`/api/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: leadSel.value }),
      });
      await loadBoard();
    } catch (err) {
      alert(err.message);
    }
    return;
  }
  const sel = e.target.closest("select[data-status]");
  if (!sel) return;
  const id = sel.getAttribute("data-status");
  try {
    await api(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: sel.value }),
    });
    await loadBoard();
  } catch (err) {
    alert(err.message);
  }
});

els.orders.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-dispatch]");
  if (!btn) return;
  dispatchOrderId = btn.getAttribute("data-dispatch");
  els.dispatchOrderLabel.textContent = `Order ${dispatchOrderId}`;
  els.riderNote.value = "";
  els.dispatchPreview.hidden = true;
  els.dispatchLinkWrap.hidden = true;
  els.dispatchDialog.showModal();
});

els.dispatchCancel.addEventListener("click", () => els.dispatchDialog.close());

els.dispatchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!dispatchOrderId) return;
  try {
    const data = await api(`/api/orders/${dispatchOrderId}/dispatch`, {
      method: "POST",
      body: JSON.stringify({
        riderNote: els.riderNote.value,
        logisticsPhone: els.logisticsPhone.value || undefined,
      }),
    });
    els.dispatchPreview.hidden = false;
    els.dispatchPreview.textContent = data.dispatchMessage;
    if (data.waMeLink) {
      els.dispatchLinkWrap.hidden = false;
      els.dispatchLink.href = data.waMeLink;
    }
    await loadBoard();
  } catch (err) {
    alert(err.message);
  }
});

els.sandboxForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await api("/api/sandbox/message", {
      method: "POST",
      body: JSON.stringify({
        from: els.sandboxPhone.value,
        text: els.sandboxText.value,
        name: "Sandbox Customer",
      }),
    });
    els.sandboxOut.hidden = false;
    let out = (data.botReplies || []).join("\n\n---\n\n");
    if (data.notifyWaMe) {
      out += `\n\n---\nNotify Samuel: ${data.notifyWaMe}`;
    }
    els.sandboxOut.textContent = out;
    els.sandboxText.value = "";
    els.sandboxText.focus();
    await loadBoard();
  } catch (err) {
    alert(err.message);
  }
});

els.tenantSelect.addEventListener("change", async () => {
  setTenant(els.tenantSelect.value);
  await refreshAll();
});

els.refreshBtn.addEventListener("click", () => refreshAll());

async function refreshAll() {
  await loadHealth();
  await loadCatalogHeader();
  await loadBoard();
}

(async function init() {
  setTenant(tenant);
  await loadTenants();
  await refreshAll();
  setInterval(loadBoard, 8000);
})();
