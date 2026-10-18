"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Invoice } from "@/lib/types";

function formatGhs(n: number) {
  return `GHS ${n.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function whatsappShareUrl(invoice: Invoice) {
  const pay = invoice.paymentUrl || "";
  const text = [
    `Invoice from ReceiptMoMo`,
    `${formatGhs(invoice.amountGhs)} — ${invoice.description}`,
    `Pay with MoMo: ${pay}`,
  ].join("\n");
  const phone = invoice.customerPhone.replace(/\D/g, "");
  const waPhone = phone.startsWith("233")
    ? phone
    : phone.startsWith("0")
      ? `233${phone.slice(1)}`
      : phone;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

export default function HomePage() {
  const [amountGhs, setAmountGhs] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Invoice | null>(null);
  const [demo, setDemo] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices");
      const data = await res.json();
      setInvoices(data.invoices || []);
      setDemo(Boolean(data.demo));
    } catch {
      /* ignore list errors on first paint */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountGhs: Number(amountGhs),
          customerName,
          customerPhone,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create invoice");
      setCreated(data.invoice);
      setDemo(Boolean(data.demo));
      setAmountGhs("");
      setCustomerName("");
      setCustomerPhone("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="fade-up">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1>ReceiptMoMo</h1>
        </div>
        <p className="tagline">
          Paystack MoMo links + WhatsApp share — not another chat app. Type
          amount, tap share, get paid.
        </p>

        {demo && (
          <p className="hint" style={{ marginBottom: "1rem" }}>
            <span className="badge badge-demo">Demo mode</span>{" "}
            No Paystack key set — links work locally; webhook stub still marks
            paid.
          </p>
        )}
      </header>

      <section className="panel fade-up" style={{ animationDelay: "60ms" }}>
        <h2 className="section-title">New invoice</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field field-amount">
            <label htmlFor="amount">Amount (GHS)</label>
            <input
              id="amount"
              inputMode="decimal"
              type="number"
              min={1}
              step="0.01"
              placeholder="150.00"
              required
              value={amountGhs}
              onChange={(e) => setAmountGhs(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="name">Customer name</label>
            <input
              id="name"
              type="text"
              placeholder="Ama Mensah"
              required
              autoComplete="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Customer MoMo / phone</label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="024 XXX XXXX"
              required
              autoComplete="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <span className="hint">MTN, Telecel, or AT — used for WhatsApp share</span>
          </div>
          <div className="field">
            <label htmlFor="desc">What for?</label>
            <textarea
              id="desc"
              rows={2}
              placeholder="Dress fitting + fabric"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create MoMo payment link"}
            </button>
          </div>
        </form>
      </section>

      {created && (
        <section className="panel toast-ok">
          <div className="inv-top">
            <strong>Ready to send</strong>
            <span className="badge badge-pending">{created.status}</span>
          </div>
          <p className="inv-amount" style={{ margin: "0.5rem 0" }}>
            {formatGhs(created.amountGhs)}
          </p>
          <p className="inv-meta" style={{ marginTop: 0 }}>
            {created.customerName} · {created.description}
          </p>
          <div className="btn-row">
            <a className="btn btn-wa" href={whatsappShareUrl(created)} target="_blank" rel="noreferrer">
              Share on WhatsApp
            </a>
            <a className="btn btn-secondary" href={`/invoice/${created.id}`}>
              Open invoice
            </a>
          </div>
        </section>
      )}

      <section className="panel fade-up" style={{ animationDelay: "120ms" }}>
        <h2 className="section-title">Recent</h2>
        {invoices.length === 0 ? (
          <p className="empty">No invoices yet. Create your first one above.</p>
        ) : (
          <ul className="invoice-list">
            {invoices.slice(0, 12).map((inv) => (
              <li key={inv.id}>
                <a href={`/invoice/${inv.id}`}>
                  <div className="inv-top">
                    <span className="inv-amount">{formatGhs(inv.amountGhs)}</span>
                    <span
                      className={`badge ${
                        inv.status === "paid" ? "badge-paid" : "badge-pending"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <span className="inv-meta">
                    {inv.customerName} · {inv.description}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="foot">Paystack test → live MoMo (MTN / Telecel / AT) in Ghana</p>
    </main>
  );
}
