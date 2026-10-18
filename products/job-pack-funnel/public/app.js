(async function () {
  const priceDisplay = document.getElementById("priceDisplay");
  const payAmount = document.getElementById("payAmount");
  const form = document.getElementById("checkoutForm");
  const formError = document.getElementById("formError");
  const payBtn = document.getElementById("payBtn");

  let config = { amountGhs: "149.00", currency: "GHS" };

  try {
    const res = await fetch("/api/config");
    config = await res.json();
    if (priceDisplay) {
      priceDisplay.innerHTML =
        "GHS " + config.amountGhs + " <small>one-time</small>";
    }
    if (payAmount) payAmount.textContent = "GHS " + config.amountGhs;
  } catch (_) {
    if (payAmount) payAmount.textContent = "GHS 149";
  }

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    formError.textContent = "";
    payBtn.disabled = true;
    payBtn.textContent = "Opening Paystack…";

    try {
      const body = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error("No authorization URL returned");
    } catch (err) {
      formError.textContent = err.message || "Something went wrong";
      payBtn.disabled = false;
      payBtn.textContent = "Pay GHS " + (config.amountGhs || "149") + " with MoMo";
    }
  });
})();
