# Google Business + Website Sprint — Template Pack (Ghana)

**Initiative #1** from the Ghana money portfolio. Door-opener cash in **1–7 days**.

## Positioning (read this)

These are **complementary local SME sites**, not a rival to Google Maps/Search, Meta, WhatsApp, or OpenAI.

| Layer | Who owns it | What we do |
|---|---|---|
| Discovery | **Google Business Profile** | Claim, clean, photos, hours, pin |
| Conversation | **WhatsApp** | `wa.me` CTAs with prefilled messages |
| Payment | **Paystack / MoMo** | Button → existing checkout link |
| Conversion page | **This template pack** | Mobile landing that wires the three above |

Do **not** pitch “we’ll beat Google/Meta.” Pitch: *“Your Maps listing and WhatsApp already work — we’ll give you a proper phone site that connects them and takes MoMo.”*

---

## Pack contents

```
website-sprint-templates/
├── README.md                          ← you are here
├── templates/
│   ├── restaurant.html                ← chop bar / grill
│   ├── salon-barber.html              ← barber + salon
│   └── pharmacy-clinic.html           ← pharmacy + nurse desk
├── checklists/
│   ├── delivery-checklist.md          ← day-by-day delivery
│   └── gbp-optimization-ghana.md      ← Maps / GBP for Ghana
└── proposals/
    └── ghs-proposal-template.md       ← client-facing GHS quote
```

Each HTML file is **static, mobile-first, single-file** (fonts via Google Fonts CDN). Swap brand, WA number (`233…`), copy, GHS prices, and Paystack href — ship on Netlify / Cloudflare Pages / Vercel.

---

## Sell → deliver → upsell

### 1) Sell (corridor / DM)

1. Find shops with weak or missing websites (IG bio = only WhatsApp number; Maps listing incomplete).
2. Offer: **“Homepage mock in 48h after deposit.”**
3. Send [`proposals/ghs-proposal-template.md`](proposals/ghs-proposal-template.md) — quote **GH₵ 800–2,500** (GBP pack) or **GH₵ 2,500–9,000** (full sprint).
4. Collect **50%** via MoMo/Paystack before build.

**Pitch line:** “Google shows you; WhatsApp closes you; MoMo gets you paid. The site just connects those three.”

### 2) Deliver (3–7 days)

Follow [`checklists/delivery-checklist.md`](checklists/delivery-checklist.md) + [`checklists/gbp-optimization-ghana.md`](checklists/gbp-optimization-ghana.md).

1. Copy the niche template → customize.
2. Wire `https://wa.me/233…?text=…` on hero + sticky bar.
3. Replace Paystack placeholder with real payment page URL.
4. Point GBP **Website** field at the live URL.
5. 15–20 min handover; collect balance; ask for WA testimonial.

**Done when:** phone opens site → WhatsApp prefills → MoMo pays → Maps hours match.

### 3) Upsell (same week as handover)

Every sprint client is a warm lead for the shared MoMo + WhatsApp spine:

| Pain you just saw | Upsell | Typical GHS |
|---|---|---|
| Orders lost when one phone is offline | **WhatsApp CRM Setup (DFY)** | Setup 1.5–5k + 300–1.5k/mo |
| “Send MoMo screenshot” chaos | **ReceiptMoMo** | 25–80/mo or per-invoice |
| Salon/clinic no-shows | **BookMe GH** | Setup 1.2–3.5k + 30–120/mo |
| Want more inbound chats | **Click-to-WhatsApp ads** | Mgmt 1.5–4k/mo (ad spend separate) |
| Menu orders in chat | **Chat Catalog + MoMo Bot** | SaaS 50–400/mo or DFY |

Handover script: *“Your site sends people to WhatsApp. Next we tidy the inbox and stop screenshot payments — I can set that up this week.”*

---

## Quick customize (per client)

In the chosen HTML file:

1. Business name in `<title>`, `.brand`, footer  
2. `wa.me/233…` links (hero + sticky)  
3. Menu / services + **GH₵** prices  
4. Hours + Maps query  
5. `#paystack-placeholder` → real Paystack payment page or Hubtel MoMo link  

Deploy: drag the single HTML to Netlify Drop, or `npx serve` for local preview.

---

## Stack notes

- **No** Meta Cloud API required for v1 — use `wa.me`  
- **No** native WhatsApp Pay (not live in Ghana) — always external MoMo link  
- Prefer Paystack channels including `mobile_money`  
- Never treat screenshots as paid proof (upsell ReceiptMoMo webhooks)

---

## Repo target

Canonical home: **https://github.com/Catalpa-Automations/ghana-website-sprint-templates** (new repo OK).

### Push to Catalpa-Automations (when you have org auth)

```bash
cd internal/builds/website-sprint-templates   # or this folder
gh auth status   # must see Catalpa-Automations access
gh repo create Catalpa-Automations/ghana-website-sprint-templates \
  --private --source=. --remote=origin --push \
  --description "Ghana GBP + Website Sprint — complementary SME sites on Maps + WhatsApp + MoMo"
```

Until `GH_TOKEN` / org access is available, the pack stays in the Project store (see `../website-sprint-templates-catalpa-handoff.md`).
