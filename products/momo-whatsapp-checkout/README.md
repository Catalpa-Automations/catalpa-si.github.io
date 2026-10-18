# MoMo WhatsApp Checkout (Ghana MVP)

**Catalpa Automations** — Ghana MoMo / Paystack **order ops beside WhatsApp**, not a WhatsApp replacement.

Customers already live in Meta WhatsApp. This product is the payment + order confirmation layer you drop into that chat: catalog link → Paystack (MoMo-friendly, GHS) → PAID confirmation back into WhatsApp via **official `wa.me` deep links** (day one) and later **WhatsApp Cloud API**.

We do **not** compete with Meta Business Suite, invent a rival chat network, or clone OpenAI consumer chat. We build **on** WhatsApp as the channel.

Native WhatsApp Pay is **not** live in Ghana — Paystack hosted checkout (MTN MoMo / Telecel Cash / AirtelTigo / card) is the rail.

## Positioning

| We own | Meta owns |
|--------|-----------|
| Catalog, cart, Paystack/MoMo, webhooks, order board | WhatsApp thread, identity, delivery of messages |
| GHS settlement ops for small sellers | Business presence, click-to-WhatsApp ads, Cloud API |

## Stack

- Node 18+ only (zero npm dependencies — `http` + `fetch`)
- JSON catalog + file-backed orders (`data/`)
- Paystack Transactions API
- WhatsApp: `wa.me` (default) → upgrade path to **WhatsApp Cloud API**
- Deploy: **Railway**

Intended GitHub home: [`Catalpa-Automations/momo-whatsapp-checkout`](https://github.com/Catalpa-Automations/momo-whatsapp-checkout) (create under the org if missing).

## WhatsApp path (Meta-first)

| Mode | Meta? | When |
|------|-------|------|
| **`WHATSAPP_MODE=manual` (default)** | Yes — official `wa.me` / click-to-chat | Ship today. Prefills PAID order text; opens native WhatsApp. No Cloud API review delay. |
| **`WHATSAPP_MODE=cloud` (roadmap stub)** | Yes — WhatsApp Cloud API | After Meta Business + WABA approval: server-sent template messages. Same Paystack spine. |
| `WHATSAPP_MODE=twilio` (optional) | Twilio as Meta BSP / sandbox | Temporary auto-send while WABA is pending. Prefer Cloud API for production. |

**Day-one cash path:** share shop URL in WhatsApp → buyer pays MoMo on Paystack → tap `wa.me` confirm. Add Cloud API templates when Meta approves — do not block first GHS on review.

## Run locally

```bash
cd momo-whatsapp-checkout   # this folder
cp .env.example .env
npm start                   # node src/server.js — no npm install required
```

Open http://localhost:3000

### Demo mode (no Paystack keys)

If `PAYSTACK_SECRET_KEY` is missing or still the `sk_test_xxxx…` placeholder, a **demo pay page** walks product → order → confirm → WhatsApp links without a Paystack account.

### First real test payment in GHS (Samuel)

1. Create a [Paystack](https://paystack.com) Ghana account. **Test keys** work before full live KYC.
2. Dashboard → **Settings → API Keys & Webhooks** → put Test keys in `.env`:
   ```
   PAYSTACK_SECRET_KEY=sk_test_...
   PAYSTACK_PUBLIC_KEY=pk_test_...
   PUBLIC_BASE_URL=http://localhost:3000
   SELLER_WHATSAPP=233XXXXXXXXX
   WHATSAPP_MODE=manual
   ```
3. `npm start` — badge should say **Live Paystack · GHS**.
4. Order with your WhatsApp number; on Paystack pick **Mobile Money** ([test MoMo numbers](https://paystack.com/docs/payments/test-payments/) in test mode).
5. After pay, `/order.html` → **WhatsApp buyer / seller** (`wa.me`) to drop the PAID note into the real chat.
6. After Railway deploy, webhook: `https://YOUR_HOST/webhooks/paystack` (`charge.success`).

Cheapest sample SKU for smoke: **African Black Soap** (GHS 25).

## Seller day-one

1. Edit `data/catalog.json` (GHS prices, stock).
2. Run or deploy; paste the shop URL into WhatsApp (status, broadcast, or 1:1).
3. Buyer pays → **paid** on `/orders.html` → fulfill in the same WhatsApp thread.

## Deploy on Railway

1. Repo under **Catalpa-Automations** (see push steps below).
2. Railway → New Project → Deploy from that repo (Nixpacks).
3. Env from `.env.example` (`PAYSTACK_*`, `PUBLIC_BASE_URL`, `SELLER_WHATSAPP`).
4. Paystack webhook → `https://your-app.up.railway.app/webhooks/paystack`.
5. Share that URL in WhatsApp — click-to-catalog, pay in browser, confirm back in WhatsApp.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/catalog` | Products |
| POST | `/api/checkout` | Order + Paystack / demo payment URL |
| GET | `/api/orders` | Seller board |
| GET | `/api/verify/:reference` | Confirm Paystack payment |
| POST | `/webhooks/paystack` | Paystack events |

## Out of scope (intentionally)

SaaS multi-tenant, inbound Cloud API keyword bot, cloning Meta Business Suite, rival chat app, Flutterwave failover, delivery routing. Ops layer first; Cloud API templates next.

## Push to Catalpa-Automations

This agent environment has **no GitHub credentials** (`gh` not logged in; no `GH_TOKEN` / SSH). Code is finished in the Project store and a local git history is prepared — a human with org access must create/push the repo.

```bash
# On a machine with access to github.com/Catalpa-Automations
cd /path/to/momo-whatsapp-checkout   # or copy from the Project store path below

# Create empty repo (once)
gh repo create Catalpa-Automations/momo-whatsapp-checkout \
  --private --description "Ghana MoMo/Paystack order ops beside WhatsApp" --source=. --remote=origin

# Or if the repo already exists empty:
git remote add origin git@github.com:Catalpa-Automations/momo-whatsapp-checkout.git

git checkout -b cursor/momo-whatsapp-checkout-032a   # if not already on it
git push -u origin cursor/momo-whatsapp-checkout-032a

# Open PR into main
gh pr create --base main --head cursor/momo-whatsapp-checkout-032a \
  --title "feat: Ghana MoMo WhatsApp checkout MVP" \
  --body "Paystack GHS + wa.me confirm. Ops layer beside Meta WhatsApp."
```

**Store copy (source of truth until push):**  
`/cursor/stores/self/internal/builds/momo-whatsapp-checkout/`

**Blocker for this agent:** cannot create `Catalpa-Automations/momo-whatsapp-checkout` or push without org OAuth / PAT. Grant a token with `repo` + org create permission, or push from a Catalpa member laptop using the steps above.
