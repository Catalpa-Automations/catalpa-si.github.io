"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { Invoice } from "@/lib/types";

function formatGhs(n: number) {
  return `GHS ${n.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function InvoiceView() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const isDemoPay = search.get("demo") === "1";
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${params.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaidDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark paid");
      setInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function simulateWebhook() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/webhooks/paystack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": "demo",
        },
        body: JSON.stringify({
          event: "charge.success",
          data: {
            reference: invoice.paystackReference,
            status: "success",
            paid_at: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Webhook failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Webhook failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !invoice) {
    return (
      <main className="app-shell">
        <div className="panel error">{error}</div>
        <a className="btn btn-secondary" href="/">
          Back
        </a>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="app-shell">
        <p className="empty">Loading invoice…</p>
      </main>
    );
  }

  const paid = invoice.status === "paid";

  return (
    <main className="app-shell">
      <header className="fade-up">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <h1>ReceiptMoMo</h1>
        </div>
      </header>

      <section className="panel toast-ok">
        <div className="receipt-hero">
          <span className={`badge ${paid ? "badge-paid" : "badge-pending"}`}>
            {paid ? "Paid" : "Awaiting MoMo"}
          </span>
          <p className="amount">{formatGhs(invoice.amountGhs)}</p>
          <p className="desc">{invoice.description}</p>
        </div>

        <dl className="kv">
          <div>
            <dt>Customer</dt>
            <dd>{invoice.customerName}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{invoice.customerPhone}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd style={{ fontSize: "0.82rem", wordBreak: "break-all" }}>
              {invoice.paystackReference}
            </dd>
          </div>
          {paid && invoice.paidAt && (
            <div>
              <dt>Paid at</dt>
              <dd>{new Date(invoice.paidAt).toLocaleString("en-GH")}</dd>
            </div>
          )}
        </dl>

        {error && <div className="error">{error}</div>}

        <div className="btn-row">
          {!paid && invoice.paymentUrl && !isDemoPay && (
            <a
              className="btn btn-primary"
              href={invoice.paymentUrl}
              target="_blank"
              rel="noreferrer"
            >
              Pay with MoMo (Paystack)
            </a>
          )}

          {!paid && isDemoPay && (
            <>
              <button
                className="btn btn-gold"
                type="button"
                disabled={busy}
                onClick={() => void markPaidDemo()}
              >
                {busy ? "…" : "Simulate MoMo payment"}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => void simulateWebhook()}
              >
                Fire webhook stub
              </button>
            </>
          )}

          {!paid && !isDemoPay && (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              onClick={() => void simulateWebhook()}
            >
              Test webhook → mark paid
            </button>
          )}

          <a className="btn btn-secondary" href="/">
            New invoice
          </a>
        </div>
      </section>
    </main>
  );
}

export default function InvoicePage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell">
          <p className="empty">Loading invoice…</p>
        </main>
      }
    >
      <InvoiceView />
    </Suspense>
  );
}
