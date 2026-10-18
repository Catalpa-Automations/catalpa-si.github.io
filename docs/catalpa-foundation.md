# Catalpa Automations — Company Foundation

**Owner:** Samuel · Catalpa Automations (Ghana)  
**GitHub:** [https://github.com/Catalpa-Automations](https://github.com/Catalpa-Automations)  
**Status:** Operating framework (living doc) · **Not legal advice** — have a Ghana lawyer review any client contract before use.

---

## 1. Vision / wedge

**Wedge in one line:** Meta already pays for the click. Catalpa owns what happens after — 24/7 WhatsApp bots that take orders, show the owner a live dashboard, and push dispatch — while the owner sleeps or works.

**Why now (Ghana):**
- Click-to-WhatsApp (CTWA) ads dump high-intent buyers into chat. Most SMEs reply late or never.
- Buyers already pay with MoMo. Native WhatsApp Pay is not the Ghana path — Paystack/MoMo is.
- Owners need proof of what sold overnight — not another inbox to babysit.

**What we sell:** Digitization of order-taking businesses (chop bars, boutiques, clinics, spare parts, multi-staff shops) — small and larger — via bots + owner dashboard + payment + dispatch handoff.

**What we never sell:** A rival messenger, a ChatGPT clone, or “we beat Meta.” We build **on** Meta Ads + WhatsApp Cloud API, and **on** Paystack/MoMo. OpenAI (if used) is utility only — classify, extract, draft — never the product.

**North star:** Every paid CTWA click becomes a tracked conversation → order → payment → dispatch — visible on the owner dashboard without the owner typing.

---

## 2. Product foundation

### Flow (canonical)

```
Meta Ads (CTWA)
  → Buyer clicks → WhatsApp open
  → Catalpa 24/7 bot greets, qualifies, catalogs, takes order
  → Paystack / MoMo checkout (webhook = truth)
  → Owner dashboard: leads, orders, paid, pending, SLA
  → Dispatch handoff (rider / kitchen / counter / staff alert)
```

### Module map

| Module | Job | Who uses it |
|--------|-----|-------------|
| **CTWA intake** | Capture ad click → WA thread with UTM/ad metadata | Bot + ads ops |
| **Conversation bot** | Menu, FAQ, qualify, upsell, handoff to human | Buyer 24/7 |
| **Catalog / order** | SKUs, cart, modifiers, stock holds | Buyer + seller |
| **Payments** | Paystack link (MoMo channels); webhook marks PAID | Buyer → Catalpa spine |
| **Owner dashboard** | Live orders, unpaid, paid, staff actions while owner offline | Business owner / manager |
| **Dispatch** | Notify kitchen/rider/counter; status: preparing → out → delivered | Ops staff |
| **CRM lite** | Labels, stages, staff SOP (on Meta WA, not a rival inbox) | Multi-staff shops |
| **Admin / tenant** | Multi-client tenants, branding, numbers, feature flags | Catalpa ops |

**Product rule:** Screenshot “I paid” is never proof. Only Paystack `charge.success` (or equivalent PSP webhook) moves an order to PAID.

---

## 3. Tech spine

| Layer | Choice | Rule |
|-------|--------|------|
| Messaging | **WhatsApp Cloud API** (Meta) | No rival messenger as product. Telegram only for satellite utilities (e.g. RatePing). |
| Acquisition | **Meta Ads CTWA** | Client owns ad account + spend unless retainer says otherwise. |
| Payments | **Paystack** (MoMo / card GHS) | Webhook-first; demo mode OK for pilots without live keys. |
| App surface | Thin web/PWA dashboard + bot backend | Owner sees truth while asleep. |
| Webhooks | Meta WA webhooks + Paystack webhooks | Idempotent handlers; signed where available. |
| AI | Optional OpenAI utility calls | Never the SKU; never a “ChatGPT for X” pitch. |

**Day-one vs go-live:** Pilots may start with `wa.me` deep links + manual confirm if WABA approval is pending. **Live paid commitment** requires Cloud API (or agreed BSP) + real Paystack webhook — not screenshots.

**Repo home:** New product code → [Catalpa-Automations](https://github.com/Catalpa-Automations). Prefer one repo per product; site repo may temporarily hold `products/` mirrors until org create-repo rights exist.

---

## 4. Commercial framework (pilot → live → pay)

### Principle

**Solution-first:** No upfront fee **for development**. Client pays only after they see their bot/solution **live and working**. Terms must be simple, fair, and protect both sides — Catalpa must not bleed unpaid forever; clients must not feel trapped or litigious.

> This section is an **operating commercial policy**, not a lawyer-drafted contract. A Ghana lawyer should review templates in §5 before client use.

### Stages

| Stage | What happens | Money |
|-------|--------------|-------|
| **0 · Corridor qualify** | Fit check: has WA number, sells via chat/ads, willing to share catalog + MoMo settlement path | None |
| **1 · Pilot / demo** | Catalpa spins a **demo tenant**: branded bot flow, sample catalog, dashboard, optional test Paystack | **Free** (Catalpa absorbs build time within pilot caps) |
| **2 · Live proof** | Bot on **client’s** WhatsApp Business number; real CTWA or organic WA traffic; real or sandbox orders visible on dashboard | Still free until commitment signed — **time-boxed** |
| **3 · Paid commitment** | Client signs Live Commitment / Order Form; billing starts | Subscription **and/or** per-order fee **and/or** retainer |

### What Catalpa provides free in pilot

- Scoped demo tenant (one business, one catalog slice, one WA number path)
- Core bot flows: greet → catalog → order → pay link → paid status → basic dispatch alert
- Owner dashboard view for that tenant
- Walkthrough (in-person or WA video) so the client *sees* it work
- Up to **N revision rounds** and **T calendar days** (default: **2 rounds / 14 days** live-proof window — set on Pilot Agreement)

### What is *not* free (even in pilot)

- Meta **ad spend** (client’s money, client’s ad account — Catalpa may manage creatives under a separate paid ads retainer)
- Extra businesses, locations, or numbers beyond the pilot scope
- Custom integrations outside the module map (ERP, custom POS, multi-warehouse)
- Unlimited redesign / “while you’re at it” features
- Training for large staff cohorts beyond one SOP session
- Content production packs, website sprints, or digital products sold as separate SKUs

### What triggers payment

Payment starts when **any** of these is true (whichever first, as written on the Order Form):

1. Client signs **Live Commitment / Order Form**, **or**
2. Live-proof window ends and client continues using the live bot/number without signing (grace day then **suspend**), **or**
3. Client asks to keep production live past the pilot end date

**Pricing patterns (pick one primary + optional add-ons):**

| Model | When to use | Notes |
|-------|-------------|-------|
| **Subscription** (monthly GHS) | Steady order volume; dashboard seat | Default for most SMEs |
| **Per-order / take-rate** | High volume, variable months | Cap or floor so Catalpa isn’t underwater |
| **Retainer** (managed ops) | Catalpa runs ads + bot tuning + reports | Separate from platform fee; ads spend still client-side |
| **Hybrid** | Sub + small per paid order | Best fairness when volume is uncertain |

**Refunds:** Pilot work is free — no “refund of development.” After paid start: no refund of elapsed subscription days; unused prepaid months only if Catalpa cancels for convenience. Chargebacks for delivered SaaS months → investigate, then suspend access pending resolution.

### Risk controls (both sides)

| Risk | Control |
|------|---------|
| Catalpa unpaid forever | Hard pilot end date; auto-suspend; written scope; no “free forever” oral promises |
| Client feels bait-and-switch | Written free list vs paid list; live demo before any invoice |
| Scope creep | Change requests → written addendum + fee or new pilot |
| Ads spend disputes | Client owns ad account; Catalpa never runs personal cards for client spend |
| Data / number hostage | Client owns WABA number + customer data export; Catalpa keeps platform IP |
| Litigation optics | Plain language; Ghana lawyer review; keep chat trail of agreements |

---

## 5. Plain-language templates

**Disclaimer (put on every template header):**  
*This is a practical working template for Catalpa Automations, not formal legal advice. Have a Ghana lawyer review before signing with clients.*

### 5A — Pilot Agreement (outline)

1. **Parties** — Catalpa Automations / Samuel [legal name] ↔ Client business name, contact, WhatsApp number  
2. **Purpose** — Free pilot to show a WhatsApp order bot + dashboard for [business type]  
3. **Pilot scope (included)** — Bullet the free list from §4 for *this* client  
4. **Pilot exclusions** — Ads spend, extra locations, custom integrations, unlimited revisions  
5. **Duration** — Start date; live-proof end date (default 14 days after go-live on client number)  
6. **Success criteria** — e.g. “Bot takes a test order end-to-end; paid webhook updates dashboard; owner can list today’s orders”  
7. **Client duties** — Catalog, prices, WA Business access, Paystack/subaccount if live pay tests, timely feedback (48h)  
8. **Catalpa duties** — Spin tenant, configure bot, one walkthrough, stay within revision cap  
9. **No payment due for pilot** — Explicit  
10. **What happens next** — If happy → Live Commitment; if not → pilot ends, demo tenant shut off, no fee  
11. **IP** — Catalpa platform/code stays Catalpa; client content/branding stays client (see 5C)  
12. **Data** — Pilot data handled for demo only; delete or export on request at pilot end  
13. **Not an employment / partnership** — Independent services  
14. **Governing note** — Disputes: good-faith WA/call first; Ghana law; lawyer-reviewed final text preferred  

**Signature block:** Name, role, date, WhatsApp confirmation acceptable if both parties reply “AGREED” to the full text.

### 5B — Live Commitment / Order Form (outline)

1. **Reference** — Pilot Agreement date (if any) + “Client has seen the solution live”  
2. **Services live** — Bot modules on; dashboard URL; WA number; business name  
3. **Fees** — Choose: subscription GHS ___ /mo · and/or GHS ___ per paid order · and/or retainer GHS ___ /mo  
4. **Billing start** — Date (usually signature date or next calendar day)  
5. **Payment method** — Paystack / MoMo to Catalpa; due within X days of invoice  
6. **Included monthly** — Uptime target (best effort), bug fixes in scope, minor copy/catalog edits (cap hours)  
7. **Out of scope** — New modules, new branches, ads creatives unless retainer  
8. **Ads** — Client owns spend + ad account; optional Catalpa management fee separate  
9. **Term** — Month-to-month **or** ___ months; notice period for cancel (default 14 days)  
10. **Suspension** — Non-payment after ___ days → bot pause (with notice)  
11. **IP & data** — Same as 5C  
12. **Limitation** — Catalpa not liable for Meta/Paystack outages, ad performance, or client staff misuse; liability capped at fees paid in prior 3 months *(lawyer to confirm)*  
13. **Signatures**

### 5C — Cancellation & IP notes (plain language)

**Cancellation**
- Client may cancel with written notice (WA or email) per Order Form notice period.
- Access to Catalpa-hosted bot/dashboard ends on cancel effective date.
- Client keeps: their WhatsApp Business number, customer chat history in Meta, exported order CSV, their brand assets.
- Catalpa keeps: platform software, bot frameworks, dashboards, templates, know-how.
- No refund for the current paid period already started, unless Catalpa fails materially and cannot cure in 7 days.

**IP**
- **Catalpa IP:** code, prompts/flows as productized modules, UI, infra.
- **Client IP:** logo, product photos, prices, customer list, ad creatives they paid for.
- **License:** While paid, client gets a non-exclusive right to use the configured bot for their business. No resale of Catalpa platform to other businesses.
- **Portfolio:** Catalpa may show anonymized screenshots unless client opts out in writing.

**Data**
- Customer PII from WhatsApp is processed to run orders; not sold.
- On cancel: export on request within 14 days; then delete Catalpa copies except invoices/tax records Catalpa must keep.

---

## 6. Operating playbook

### Corridor → convert (weekly rhythm)

| Phase | Actions | Exit criteria |
|-------|---------|---------------|
| **Sales corridor** | Walk Osu/Madina/Adum (or niche); pitch CTWA → bot → sleep dashboard; collect catalog + WA | Qualified lead + Pilot Agreement “AGREED” |
| **Spin demo tenant** | Clone tenant; load catalog slice; wire test Paystack or demo pay; internal QA | Demo URL + test order works |
| **Live proof** | Connect client WABA / agreed number; optional CTWA with **client** ad account; owner watches real traffic | Success criteria met (§5A) |
| **Convert** | Walk Order Form; pick fee model; first invoice via MoMo | Paid commitment signed + first payment |
| **Operate** | Weekly: catalog tweaks, failed-pay review, dispatch SLA; monthly: simple report | Retention |

### Demo tenant checklist (ops)

1. Business name, logo, WA number, GHS catalog (even 8–15 SKUs)  
2. Greeting + hours + delivery zones / pickup rules  
3. Paystack test or demo pay path  
4. Owner dashboard login (one seat)  
5. Dispatch alert target (kitchen WA / phone)  
6. Pilot end date on calendar + reminder day −2  

### Conversion script (short)

> “You’ve seen orders hit the dashboard without you typing. Pilot stays free through [date]. To keep it live after that, we use a simple monthly [or per-order] fee — no surprise development bill. Here’s the Order Form.”

### Do not

- Promise free forever to close the corridor  
- Run client ads on Catalpa’s personal MoMo/card  
- Expand scope mid-pilot without a written addendum  
- Go live on production without webhook-based payment truth (unless explicitly demo-only and labeled)

---

## 7. Litigation / risk checklist

Use before every pilot and every go-live.

| # | Check | Safe if… |
|---|-------|----------|
| 1 | **Scope creep** | Written included/excluded list; change = addendum |
| 2 | **“Free forever”** | End date + convert-or-suspend on Pilot + Order Form; no oral override |
| 3 | **Data** | Export/delete path; no selling lists; access limited to need-to-know |
| 4 | **Ads spend ownership** | Client ad account; Catalpa never funds spend; spend ≠ Catalpa fee |
| 5 | **Refunds** | Pilot free (no refund concept); paid periods non-refundable once started except material uncured failure |
| 6 | **Number / hostage fears** | Client owns WABA; Catalpa can disconnect *platform* only |
| 7 | **Payment proof** | Webhook only; documented in dashboard |
| 8 | **Uptime / Meta outage** | Best-effort; disclaimer that Meta/Paystack downtime is outside Catalpa control |
| 9 | **Staff misuse** | Client responsible for staff logins and wrong prices they set |
| 10 | **Lawyer gate** | Any deal > significant GHS or multi-site → lawyer-reviewed contract, not template alone |
| 11 | **Chat evidence** | Keep Pilot + Order Form text + “AGREED” replies |
| 12 | **Tax / invoices** | Issue proper invoices; don’t mix ad spend with software fees on one vague line |

---

## 8. How existing MVPs map in

| MVP | Role | Core vs satellite | Maps to modules |
|-----|------|-------------------|-----------------|
| **momo-whatsapp-checkout** | Catalog → Paystack MoMo → paid → WA confirm / order board | **CORE** — order + payment spine | Catalog/order, Payments, Dispatch alert |
| **receipt-momo** | Amount + phone → invoice link → MoMo → receipt/ledger | **CORE** — payments/ledger wedge (also standalone SKU) | Payments, thin dashboard |
| **whatsapp-crm-dfy** | DFY WA Business ops, leads, SOP, staff tracker on Meta | **CORE** — agency wrap + CRM lite for multi-staff | CTWA intake, CRM lite, sales onboarding |
| **website-sprint** | GBP + mobile site with WA + MoMo CTA | **Satellite (door-opener)** — corridor cash & lead-in to bot | Acquisition landing, not the bot itself |
| **job-pack** | Digital pack funnel (CV etc.) via Paystack + WA handoff | **Satellite (content cash)** — reuses MoMo→deliver spine | Shared checkout pattern only |
| **rateping** | Telegram FX/fuel alerts + MoMo sub | **Satellite (micro-cash)** — not the CTWA wedge | Shared Paystack habit; Telegram allowed as utility |

**Integration intent:** Core MVPs converge into one **tenant platform** (bot + dashboard + Paystack webhooks). Satellites keep separate repos/SKUs but share Paystack webhook patterns and Catalpa branding — they do not redefine the company wedge.

**Build priority for the wedge:** CTWA → WhatsApp Cloud bot → momo-whatsapp-checkout spine → owner dashboard → dispatch → CRM DFY packaging. Website sprint opens doors; job-pack and RatePing fund sideways cash without distracting the Meta story.

---

## Related

- Portfolio ranking & platform rule: [`docs/ghana-money-portfolio.md`](./ghana-money-portfolio.md)
- Solution-first principle: [`principles/catalpa-solution-first.md`](../principles/catalpa-solution-first.md)
