export type InvoiceStatus = "pending" | "paid" | "failed" | "abandoned";

export interface Invoice {
  id: string;
  amountGhs: number;
  customerName: string;
  customerPhone: string;
  description: string;
  status: InvoiceStatus;
  paystackReference: string;
  paymentUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface CreateInvoiceInput {
  amountGhs: number;
  customerName: string;
  customerPhone: string;
  description: string;
}
