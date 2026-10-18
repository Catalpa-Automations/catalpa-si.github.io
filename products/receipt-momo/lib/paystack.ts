import crypto from "crypto";
import type { CreateInvoiceInput } from "./types";

const PAYSTACK_BASE = "https://api.paystack.co";


export function isDemoMode(): boolean {
  return !process.env.PAYSTACK_SECRET_KEY;
}

export function getPublicKey(): string {
  return process.env.PAYSTACK_PUBLIC_KEY ?? "pk_test_demo";
}

/** Normalize Ghana numbers to E.164-ish for Paystack customer.phone */
export function normalizeGhPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`;
  if (digits.length === 9) return `+233${digits}`;
  return phone.trim();
}

export function newReference(prefix = "rm"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`;
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

/**
 * Creates a Paystack payment page / checkout link.
 * Amount is in GHS — Paystack expects pesewas (×100).
 * In Ghana test + live, customers can pay with MTN / Telecel / AT MoMo.
 */
export async function createPaymentLink(
  input: CreateInvoiceInput,
  reference: string,
  callbackUrl: string
): Promise<{ paymentUrl: string; reference: string; demo: boolean }> {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";
    return {
      paymentUrl: `${origin}/invoice/${reference}?demo=1`,
      reference,
      demo: true,
    };
  }

  const amountPesewas = Math.round(input.amountGhs * 100);
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: `${normalizeGhPhone(input.customerPhone).replace("+", "")}@receiptmomo.gh`,
      amount: amountPesewas,
      currency: "GHS",
      reference,
      callback_url: callbackUrl,
      channels: ["mobile_money", "card", "bank", "ussd"],
      metadata: {
        customer_name: input.customerName,
        customer_phone: normalizeGhPhone(input.customerPhone),
        description: input.description,
        product: "ReceiptMoMo",
      },
    }),
  });

  const json = (await res.json()) as PaystackInitResponse;
  if (!res.ok || !json.status || !json.data?.authorization_url) {
    throw new Error(json.message || "Paystack initialize failed");
  }

  return {
    paymentUrl: json.data.authorization_url,
    reference: json.data.reference,
    demo: false,
  };
}

/** Verify webhook signature (Paystack sends x-paystack-signature). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    // Demo / stub mode: accept all events so local testing works.
    return true;
  }
  if (!signature) return false;

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}
