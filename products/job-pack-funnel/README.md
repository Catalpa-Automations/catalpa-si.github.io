# JobPack GH — Graduate Job-Seeker Starter Funnel

**What this is:** a thin sales + fulfillment funnel for a digital CV/LinkedIn pack (GHS 99–250).  
**What this is not:** a social network, messaging platform, or ChatGPT clone. We do **not** compete with Meta or OpenAI.

**Distribution (use their rails, sell our pack):** WhatsApp Status/chat, TikTok, Instagram Reels/DM → this landing → **Paystack MoMo** → download + WhatsApp handoff.

Built for fastest first cedis (content scout #1 / portfolio rank #4).

## Positioning

| We sell | We borrow | We avoid |
|---------|-----------|----------|
| Pack files + optional 1:1 CV rewrite | WhatsApp / TikTok / Instagram reach | Building a feed, DMs product, or AI chat app |
| MoMo checkout + instant unlock | Paystack Ghana MoMo | Screenshot-as-proof payments |
| Fulfillment deep link (`wa.me`) | Meta apps as traffic | Competing with Meta/OpenAI features |

## What’s in this folder

```
job-pack-funnel/
├── public/           # Landing, success, confirm pages
├── packs/            # Buyer deliverables (CV, LinkedIn, interview, WA tips)
├── server/index.js   # Node 18+ stdlib only: checkout, callback, webhook, unlock
├── .env.example
├── package.json      # scripts only — no runtime npm deps
└── README.md
```

## Pricing suggestion

| SKU | GHS | Notes |
|-----|-----|--------|
| Starter pack (this funnel) | **99–149** | Launch price; market already clears here |
| Premium pack (+ mock interview PDF) | **180–250** | Same checkout, higher `PACK_PRICE_PESEWAS` |
| 1:1 CV rewrite (upsell on WhatsApp) | **130–300** | Manual fulfillment after pack purchase |

Default in `.env.example`: **GHS 149.00** (`PACK_PRICE_PESEWAS=14900`).

## Quick start (demo, no real Paystack keys)

```bash
cd /cursor/stores/self/internal/builds/job-pack-funnel
cp .env.example .env
npm start          # runs: node server/index.js  (no npm install required)
```

Open **http://localhost:3847**

1. Submit checkout → placeholder/missing keys → **demo unlock** → success page.  
2. Or open **/confirm.html** with code `JOBPACK-DEMO`.  
3. Download pack files + tap WhatsApp.

Requires **Node 18+** only (uses built-in `fetch` + `http`).

## Go live (Paystack + MoMo + Meta traffic)

1. Create a [Paystack](https://paystack.com) Ghana business; enable **Mobile Money**.  
2. Dashboard → **Settings → API Keys & Webhooks**  
   - Put real Test/Live keys in `.env` (replace `xxxxxxxx` placeholders)  
   - Webhook: `https://YOUR_DOMAIN/api/paystack/webhook` · event `charge.success`  
3. Set `BASE_URL=https://YOUR_DOMAIN` and `WHATSAPP_NUMBER=233…`.  
4. Deploy (`npm start` behind HTTPS — Railway / Render / Fly / VPS).  
5. Traffic: TikTok/IG hooks (“3 CV mistakes Accra recruiters skip”) → bio link → this page; close on WhatsApp.  
6. Set `ALLOW_MANUAL_CONFIRM=false` once webhook + callback are solid.

### Payment flow

```
TikTok / IG / WA Status  →  landing  →  POST /api/checkout  →  Paystack MoMo
  →  GET /api/paystack/callback (verify)
  →  success.html?token=…  (downloads + wa.me)
Webhook POST /api/paystack/webhook  (unlock if tab closed)
```

Never trust MoMo screenshots — webhook/verify only.

## Environment variables

See `.env.example`.

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Initialize + verify + webhook HMAC |
| `PAYSTACK_PUBLIC_KEY` | Exposed via `/api/config` |
| `PACK_PRICE_PESEWAS` | Amount × 100 (GHS 99 → `9900`) |
| `WHATSAPP_NUMBER` | Fulfillment / support deep link |
| `ALLOW_MANUAL_CONFIRM` | Demo/ops fallback; off in prod |

## Smoke test

- [ ] `/` Ghana copy + price from config  
- [ ] Checkout without real keys → success + downloads  
- [ ] `/confirm.html` + `JOBPACK-DEMO` unlocks  
- [ ] Test MoMo → callback → success  
- [ ] WhatsApp button opens `wa.me` with ref  

## Repo / Catalpa-Automations

Intended home: **https://github.com/Catalpa-Automations/job-pack-funnel** (new repo OK).

### Push to Catalpa-Automations (when you have org access)

```bash
cd /cursor/stores/self/internal/builds/job-pack-funnel
git init
git add .
git commit -m "Initial JobPack GH funnel — Paystack MoMo + WhatsApp delivery"
gh repo create Catalpa-Automations/job-pack-funnel --private --source=. --remote=origin --push
# or: git remote add origin git@github.com:Catalpa-Automations/job-pack-funnel.git && git push -u origin main
```

This agent environment had **no** `GH_TOKEN` / `gh auth` / SSH — cannot create the org repo from here. Unblock with a PAT that has `repo` + org create on Catalpa-Automations.

## License

Private MVP scaffold — pack sales + Paystack fulfillment, not a platform play.
