import { NextRequest, NextResponse } from "next/server";
import { newInvoiceId } from "@/lib/id";
import { createPaymentLink, isDemoMode, newReference } from "@/lib/paystack";
import { listInvoices, saveInvoice } from "@/lib/store";
import type { CreateInvoiceInput, Invoice } from "@/lib/types";

export const runtime = "nodejs";

function appOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export async function GET() {
  const invoices = await listInvoices();
  return NextResponse.json({ invoices, demo: isDemoMode() });
}

export async function POST(req: NextRequest) {
  let body: Partial<CreateInvoiceInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amountGhs = Number(body.amountGhs);
  const customerName = String(body.customerName || "").trim();
  const customerPhone = String(body.customerPhone || "").trim();
  const description = String(body.description || "").trim();

  if (!Number.isFinite(amountGhs) || amountGhs < 1) {
    return NextResponse.json(
      { error: "Amount must be at least GHS 1" },
      { status: 400 }
    );
  }
  if (!customerName) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }
  if (!customerPhone || customerPhone.replace(/\D/g, "").length < 9) {
    return NextResponse.json(
      { error: "Valid Ghana phone number is required" },
      { status: 400 }
    );
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }

  const id = newInvoiceId();
  const reference = newReference("rm");
  const origin = appOrigin(req);
  const callbackUrl = `${origin}/invoice/${id}`;

  try {
    const link = await createPaymentLink(
      { amountGhs, customerName, customerPhone, description },
      reference,
      callbackUrl
    );

    const paymentUrl = link.demo
      ? `${origin}/invoice/${id}?demo=1`
      : link.paymentUrl;

    const invoice: Invoice = {
      id,
      amountGhs: Math.round(amountGhs * 100) / 100,
      customerName,
      customerPhone,
      description,
      status: "pending",
      paystackReference: link.reference,
      paymentUrl,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };

    await saveInvoice(invoice);

    return NextResponse.json({ invoice, demo: link.demo }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
