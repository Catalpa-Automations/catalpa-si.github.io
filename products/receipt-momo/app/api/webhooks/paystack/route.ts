import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { markPaid } from "@/lib/store";

export const runtime = "nodejs";

/**
 * Paystack webhook stub.
 * Configure in Paystack Dashboard → Settings → API Keys & Webhooks:
 *   https://YOUR_DOMAIN/api/webhooks/paystack
 *
 * Events handled: charge.success → mark invoice paid by reference.
 * Without PAYSTACK_SECRET_KEY, signatures are accepted (local demo).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    data?: { reference?: string; status?: string; paid_at?: string };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event === "charge.success" && event.data?.reference) {
    const invoice = await markPaid(
      event.data.reference,
      event.data.paid_at || new Date().toISOString()
    );
    return NextResponse.json({
      received: true,
      handled: "charge.success",
      invoiceId: invoice?.id ?? null,
      status: invoice?.status ?? "unknown_reference",
    });
  }

  // Acknowledge other events so Paystack does not retry forever.
  return NextResponse.json({
    received: true,
    handled: event.event ?? "ignored",
  });
}

/** Health check for webhook URL in dashboards / curl. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/webhooks/paystack",
    note: "POST charge.success events here. Stub accepts unsigned bodies when PAYSTACK_SECRET_KEY is unset.",
  });
}
