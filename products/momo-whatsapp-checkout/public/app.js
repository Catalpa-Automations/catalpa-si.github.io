const catalogEl = document.getElementById("catalog");
const dialog = document.getElementById("checkout-dialog");
const form = document.getElementById("checkout-form");
const formError = document.getElementById("form-error");

let selectedProduct = null;

async function boot() {
  const [health, catalogRes] = await Promise.all([
    fetch("/api/health").then((r) => r.json()),
    fetch("/api/catalog").then((r) => r.json()),
  ]);

  document.getElementById("seller-name").textContent =
    catalogRes.seller?.name || health.seller;
  document.getElementById("seller-tagline").textContent =
    catalogRes.seller?.tagline || "";

  const badge = document.getElementById("mode-badge");
  if (health.demoMode) {
    badge.textContent = "Demo mode — no Paystack keys (local fake pay)";
    badge.classList.add("demo");
  } else {
    badge.textContent = `Live Paystack · ${health.currency} · WhatsApp: ${health.whatsappMode}`;
  }

  catalogEl.innerHTML = "";
  for (const p of catalogRes.products || []) {
    const el = document.createElement("article");
    el.className = "product";
    el.innerHTML = `
      <h2>${escapeHtml(p.name)}</h2>
      <div class="meta">
        <span class="price">GHS ${Number(p.price_ghs).toFixed(2)}</span>
        <span>${p.stock} in stock</span>
        <span>${escapeHtml(p.category || "")}</span>
      </div>
      <p class="desc">${escapeHtml(p.description || "")}</p>
      <button type="button" data-id="${escapeHtml(p.id)}">Order</button>
    `;
    el.querySelector("button").addEventListener("click", () => openCheckout(p));
    catalogEl.appendChild(el);
  }
}

function openCheckout(product) {
  selectedProduct = product;
  document.getElementById("dialog-title").textContent = product.name;
  document.getElementById("product-id").value = product.id;
  document.getElementById("qty").value = 1;
  document.getElementById("qty").max = product.stock;
  formError.hidden = true;
  dialog.showModal();
}

document.getElementById("cancel-btn").addEventListener("click", () => {
  dialog.close();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.hidden = true;
  const payBtn = document.getElementById("pay-btn");
  payBtn.disabled = true;
  payBtn.textContent = "Creating payment…";

  try {
    const body = {
      productId: document.getElementById("product-id").value,
      qty: Number(document.getElementById("qty").value) || 1,
      buyerName: document.getElementById("buyer-name").value.trim(),
      buyerPhone: document.getElementById("buyer-phone").value.trim(),
      note: document.getElementById("note").value.trim(),
    };

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Checkout failed");

    // Persist WhatsApp links for the order page
    sessionStorage.setItem(
      `wa_${data.order.id}`,
      JSON.stringify(data.whatsapp || {})
    );

    window.location.href = data.paymentUrl;
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
    payBtn.disabled = false;
    payBtn.textContent = "Pay with MoMo / Paystack";
  }
});

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

boot().catch((err) => {
  catalogEl.innerHTML = `<p class="error">Failed to load catalog: ${escapeHtml(err.message)}</p>`;
});
