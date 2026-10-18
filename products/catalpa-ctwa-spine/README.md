# Catalpa CTWA Spine (FOUNDATION)

**Canonical product spine** for Catalpa Automations:

> Meta click-to-WhatsApp ad → 24/7 WhatsApp Cloud API bot → order capture → Paystack / MoMo → merchant dashboard → dispatch handoff.

This is **not** a rival chat app, not a ChatGPT clone, and not a side MVP. It rides **Meta WhatsApp + CTWA + Paystack**. OpenAI is optional later for NLU only, behind this bot.

Related earlier experiment: `../momo-whatsapp-checkout/` (web catalog + wa.me). **This repo is the foundation** — inbound bot + multi-tenant demo tenants + dispatch.

## Catalpa commercial

**Solution-first demos — no upfront development fee.**

| Stage | What Catalpa does | Client pays |
|-------|-------------------|-------------|
| Demo tenant | Spin `data/tenants/<client-id>/` with their catalog; connect sandbox or test WABA; show live bot in &lt;1 day | **Free** until they see it working |
| Commit | Client agrees after watching real WhatsApp orders + MoMo pay + dashboard | Fair retainer / revenue share (terms TBD per deal) |
| Go-live | Point CTWA ads + production WABA + live Paystack keys at the same spine | Ongoing |

Architecture rule: **every client is a tenant folder + env**, not a rewrite. Samuel can clone `demo-ama` → `client-xyz`, edit `catalog.json`, set `TENANT_ID`, and demo the same day.

## Spine flow

```
CTWA ad / wa.me
      ↓
WhatsApp Cloud API webhook  (/webhooks/whatsapp)
      ↓
State machine: greet → browse → cart → confirm → Paystack link
      ↓
Paystack MoMo (or demo pay) → /webhooks/paystack
      ↓
Order status: paid → preparing → dispatched → delivered
      ↓
Merchant dashboard → dispatch WhatsApp to rider / logistics
```

## Stack

- Node 18+ only (zero npm dependencies — `http` + `fetch`)
- File-backed multi-tenant data: `data/tenants/<id>/{catalog,orders,sessions}.json`
- Meta WhatsApp Cloud API (mock mode default)
- Paystack Transactions API (GHS, mobile_money channel)
- Merchant UI: `/dashboard.html`

## Run locally

```bash
cd catalpa-ctwa-spine
cp .env.example .env
npm start          # http://localhost:3040
npm run smoke      # offline state-machine check
npm run demo       # full sandbox walkthrough (server must be up)
```

Open **http://localhost:3040/dashboard.html**

### Mock mode (no Meta / no Paystack keys)

Default `WHATSAPP_MODE=mock` + placeholder Paystack keys:

1. Dashboard → Sandbox bot: `hi` → `5` → `checkout` → `yes`
2. Open the demo pay link (or click it from the order row)
3. Status becomes **paid**; use **Dispatch** to generate rider WhatsApp text + `wa.me` link

### Samuel: live demo in &lt;1 day

1. **Copy a tenant**  
   `cp -r data/tenants/demo-ama data/tenants/client-acme`  
   Edit `catalog.json` (merchant name, GHS prices).

2. **Run locally or Railway**  
   `TENANT_ID=client-acme npm start`  
   Share `/dashboard.html?tenant=client-acme` with the client on a call.

3. **Sandbox walkthrough on the call**  
   Use the dashboard sandbox (or `npm run demo`) so they see greet → cart → MoMo pay → dispatch without waiting on Meta review.

4. **Wire Meta when ready (same day if WABA exists)**  
   - Meta App → WhatsApp → Configuration  
   - Callback URL: `https://YOUR_HOST/webhooks/whatsapp?tenant=client-acme`  
   - Verify token: `META_WA_VERIFY_TOKEN`  
   - Subscribe to `messages`  
   - Set `WHATSAPP_MODE=cloud` + `META_WA_*` tokens  

5. **Paystack**  
   - Ghana account → Test keys in `.env`  
   - Webhook: `https://YOUR_HOST/webhooks/paystack` (`charge.success`)  
   - Buyer pays with MTN MoMo / Telecel / card on Paystack hosted page  

6. **CTWA ad**  
   Meta Ads → engagement / messages → Click-to-WhatsApp → same WABA number the webhook serves. Ad copy lands in the bot; first message triggers `greet` + catalog.

## Meta CTWA + Cloud API setup

1. [Meta for Developers](https://developers.facebook.com/) → create app → add **WhatsApp** product.
2. Add a test number or production WABA phone number.
3. Set webhook to `/webhooks/whatsapp` with verify token matching `.env`.
4. Generate a permanent system user token with `whatsapp_business_messaging`.
5. Create a Click-to-WhatsApp campaign pointing at that number.
6. Optional: ice-breaker / greeting text in WhatsApp Manager — bot still owns catalog/order logic.

Docs: [Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) · [CTWA](https://www.facebook.com/business/help/1544612049161958)

## Paystack MoMo (Ghana)

Native WhatsApp Pay is **not** live in Ghana. Paystack hosted checkout is the rail (`channels: mobile_money, card, …`).

- Test keys work before full live KYC.
- [Test payments](https://paystack.com/docs/payments/test-payments/) for MoMo numbers in test mode.
- On `charge.success`, spine marks order **paid** and texts the customer confirmation (Cloud API or mock log).

## Dogfood: Catalpa leads

Tenant id: **`catalpa`** (`data/tenants/catalpa/`, catalog `mode: "leads"`).

This is Catalpa selling Catalpa — not chop-bar food orders. Inbound WhatsApp from Meta CTWA ads for Catalpa’s own pipeline.

| Step | Bot asks / does |
|------|-----------------|
| Greet | Welcome + short Ghana SME pitch + offer list (CTWA bot, dashboard, dispatch) |
| Qualify | Business type → city → WhatsApp number → already run Meta ads? yes/no |
| Close | *1* book “see live demo” or *2* capture lead only |
| Notify | Lead appears on dashboard; optional `wa.me` / Cloud API ping to `SAMUEL_WHATSAPP` |

```bash
TENANT_ID=catalpa npm start
# Dashboard: http://localhost:3040/dashboard.html?tenant=catalpa
# Sandbox: hi → chop bar → Accra → same → no → 1
```

Offers in catalog: pilot then paid (solution-first). LinkedIn outreach is already live; this tenant is the WhatsApp dogfood path before client rollouts.

See go-live runbook: repo `docs/catalpa-meta-go-live.md` (Meta Business from zero → Cloud API → webhook → first CTWA ad → measure leads here).

## Multi-tenant sketch

| Mechanism | Example |
|-----------|---------|
| Env | `TENANT_ID=demo-kofi` |
| Header | `X-Tenant-Id: demo-ama` |
| Query | `/api/orders?tenant=demo-ama` |
| Path | `/t/demo-ama/dashboard.html` |
| Subdomain | `demo-ama.yourdomain.com` (first label) |

Three tenants ship in-tree: **catalpa** (lead dogfood), **demo-ama** (fashion orders), **demo-kofi** (food orders).

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Modes + tenant list |
| GET | `/api/tenants` | Demo tenants |
| GET | `/api/catalog` | Products (GHS) |
| GET | `/api/orders` | Merchant board |
| PATCH | `/api/orders/:id` | Status / notes |
| POST | `/api/orders/:id/dispatch` | Ready + rider note + wa.me message |
| GET | `/api/leads` | Catalpa inbound leads (tenant `catalpa`) |
| PATCH | `/api/leads/:id` | Lead status / note |
| POST | `/api/sandbox/message` | Simulate inbound WA (mock) |
| GET/POST | `/webhooks/whatsapp` | Meta verify + inbound |
| POST | `/webhooks/paystack` | Payment success |
| POST | `/api/demo/pay/:id` | Demo MoMo when keys unset |

### Bot commands (customer)

`hi` · `menu` · product number · `cart` · `checkout` · `yes` / `no` · `help` · `reset`

States: `greet → browse → cart → confirm → awaiting_payment → paid`

## Out of scope (intentionally)

- Building a consumer chat network or OpenAI-branded chat UI
- Replacing Meta Business Suite
- Full CMS / inventory ERP
- LLM NLU (hook later behind `handleMessage` only)

## Push note

Store deliverable is enough for Catalpa foundation work. GitHub org create is often blocked from agents — a push worker with org access can PR later from:

`/cursor/stores/self/internal/builds/catalpa-ctwa-spine/`
