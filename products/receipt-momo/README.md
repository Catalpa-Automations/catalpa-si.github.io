# ReceiptMoMo

One-tap **MoMo-friendly invoices** for Ghana SMEs. Create an invoice (amount in GHS, customer phone/name, description) → **Paystack** payment link → share via **`wa.me`** → mark paid via webhook.

Built as a tiny **Next.js PWA** (mobile-first for traders on phones).

### Positioning (non-negotiable)

ReceiptMoMo is **complementary ops tooling** — Paystack/MoMo invoicing + WhatsApp share links. It does **not**:

- compete with Meta or OpenAI
- run a messaging network or WhatsApp Cloud API bot
- ship a generic LLM / chat product

WhatsApp stays the distribution channel (`https://wa.me/...` deep links only). Payments stay on Paystack (licensed PSP).

Scout context: digital-products top-3 wedge — invoice + MoMo, not a full POS.

## Features

- Create invoice → Paystack `transaction/initialize` with `currency: GHS` and `mobile_money` channel
- **WhatsApp share** via `wa.me` (pre-filled invoice + Paystack link) — no Meta API required
- Webhook at `/api/webhooks/paystack` (`charge.success` → mark paid)
- **Demo mode** when `PAYSTACK_SECRET_KEY` is unset (local links + simulate pay / fire webhook stub)
- Installable PWA (`manifest.webmanifest`)


## Quick start

```bash
cd internal/builds/receipt-momo   # or your checkout of this folder
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Paystack keys, create an invoice → open it → **Simulate MoMo payment** or **Fire webhook stub**.

### With Paystack test keys

1. Create a [Paystack](https://paystack.com) account (Ghana).
2. Copy **Test** Secret + Public keys into `.env.local`.
3. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
4. Restart `npm run dev`.
5. Create an invoice — you’ll get a real Paystack checkout URL. In test mode use Paystack’s [test MoMo / card details](https://paystack.com/docs/payments/test-payments/).

### Webhook (local)

Use a tunnel (ngrok / Cloudflare Tunnel) and point Paystack’s webhook to:

```text
https://YOUR_TUNNEL/api/webhooks/paystack
```

Or POST a stub yourself:

```bash
curl -s -X POST http://localhost:3000/api/webhooks/paystack \
  -H 'Content-Type: application/json' \
  -H 'x-paystack-signature: demo' \
  -d '{"event":"charge.success","data":{"reference":"rm_REF_FROM_INVOICE","status":"success"}}'
```

## Test mode → live MoMo in Ghana

| Step | Action |
|------|--------|
| 1 | Build & demo with **test** keys (`sk_test_…` / `pk_test_…`) |
| 2 | Confirm MoMo channels appear on Paystack checkout (MTN / Telecel / AT) |
| 3 | Complete business activation / settlement bank or MoMo in Paystack Dashboard |
| 4 | Switch env to **live** keys (`sk_live_…` / `pk_live_…`) |
| 5 | Update webhook URL to production; verify signature with live secret |
| 6 | Send one real GHS 1–2 invoice to yourself before onboarding SMEs |

Paystack Ghana checkout is overwhelmingly Mobile Money — keep `channels` including `mobile_money` (already set in `lib/paystack.ts`).

## Deploy on Vercel

1. Import this folder as a Vercel project (or monorepo root = this directory).
2. Framework: **Next.js** (auto-detected).
3. Environment variables (Production + Preview):

   - `PAYSTACK_SECRET_KEY`
   - `PAYSTACK_PUBLIC_KEY`
   - `NEXT_PUBLIC_APP_URL` = `https://your-app.vercel.app`

4. Deploy. Then in Paystack Dashboard → Settings → Webhooks:

   ```text
   https://your-app.vercel.app/api/webhooks/paystack
   ```

5. (Optional) Add to Home Screen on Android/iOS for PWA feel.

### Storage note

Invoices persist to `data/invoices.json` when the filesystem is writable (local / long-running Node). On Vercel serverless, the in-memory fallback is **instance-local** — fine for demos; for production swap `lib/store.ts` for Vercel KV, Neon, or Supabase.

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/invoices` | List invoices |
| `POST` | `/api/invoices` | Create invoice + payment link |
| `GET` | `/api/invoices/:id` | Fetch one |
| `POST` | `/api/invoices/:id` | `{ "action": "mark_paid" }` demo helper |
| `POST` | `/api/webhooks/paystack` | Paystack events (stub + signed verify) |

### Create body

```json
{
  "amountGhs": 150,
  "customerName": "Ama Mensah",
  "customerPhone": "0244123456",
  "description": "Dress fitting"
}
```

## Project layout

```text
app/                  UI + API routes
lib/paystack.ts       Initialize + webhook HMAC
lib/store.ts          Invoice persistence
public/               PWA manifest + icon
.env.example          Keys template
```

## Scripts

```bash
npm run dev      # local
npm run build    # production build
npm start        # serve build
```
