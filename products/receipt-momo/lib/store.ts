import { promises as fs } from "fs";
import path from "path";
import type { Invoice } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "invoices.json");

/** In-memory fallback when the filesystem is read-only (e.g. some serverless hosts). */
const memory = new Map<string, Invoice>();

async function readAll(): Promise<Map<string, Invoice>> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const list = JSON.parse(raw) as Invoice[];
    const map = new Map<string, Invoice>();
    for (const inv of list) map.set(inv.id, inv);
    return map;
  } catch {
    return new Map(memory);
  }
}

async function writeAll(map: Map<string, Invoice>): Promise<void> {
  for (const [id, inv] of map) memory.set(id, inv);
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      DATA_FILE,
      JSON.stringify([...map.values()], null, 2),
      "utf8"
    );
  } catch {
    // Serverless / read-only FS — memory still works for the current instance.
  }
}

export async function listInvoices(): Promise<Invoice[]> {
  const map = await readAll();
  return [...map.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const map = await readAll();
  return map.get(id) ?? memory.get(id) ?? null;
}

export async function getInvoiceByReference(
  reference: string
): Promise<Invoice | null> {
  const map = await readAll();
  for (const inv of map.values()) {
    if (inv.paystackReference === reference) return inv;
  }
  for (const inv of memory.values()) {
    if (inv.paystackReference === reference) return inv;
  }
  return null;
}

export async function saveInvoice(invoice: Invoice): Promise<Invoice> {
  const map = await readAll();
  map.set(invoice.id, invoice);
  await writeAll(map);
  return invoice;
}

export async function markPaid(
  reference: string,
  paidAt = new Date().toISOString()
): Promise<Invoice | null> {
  const map = await readAll();
  let found: Invoice | null = null;
  for (const [id, inv] of map) {
    if (inv.paystackReference === reference) {
      found = { ...inv, status: "paid", paidAt };
      map.set(id, found);
      break;
    }
  }
  if (!found) {
    for (const [id, inv] of memory) {
      if (inv.paystackReference === reference) {
        found = { ...inv, status: "paid", paidAt };
        map.set(id, found);
        break;
      }
    }
  }
  if (!found) return null;
  await writeAll(map);
  return found;
}
