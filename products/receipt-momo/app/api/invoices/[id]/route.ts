import { NextRequest, NextResponse } from "next/server";
import { getInvoice, markPaid, saveInvoice } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const invoice = await getInvoice(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}

/** Demo helper: simulate MoMo success without Paystack (POST { action: "mark_paid" }). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const invoice = await getInvoice(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty */
  }

  if (body.action === "mark_paid") {
    const updated = await markPaid(invoice.paystackReference);
    return NextResponse.json({ invoice: updated });
  }

  if (body.action === "abandon") {
    const updated = { ...invoice, status: "abandoned" as const };
    await saveInvoice(updated);
    return NextResponse.json({ invoice: updated });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
