# Catalpa SI selling-ad videos

**Rule:** Every product in `products/` gets one selling ad ≤ **78 seconds** (~1.3 min). Show end-to-end: what it is, what it does, how it helps the business.

**Brand on screen / end card:** Always **Catalpa SI**. Never “Catalpa Automations” (that name is GitHub / developer workspace only).

## Structure (timed beats)

| Beat | Time | Job |
|------|------|-----|
| Hook | 0–8s | Owner’s pain or win in one line |
| Problem | 8–20s | Missed chats / unpaid orders / no overnight proof |
| Demo flow | 20–60s | Real WhatsApp/bot or UI → MoMo/pay if relevant → dashboard |
| Benefit + CTA | 60–78s | One clear business outcome + how to try / book |

## Always show

1. WhatsApp/bot or product UI **for real** (screen record, not mockups alone)
2. MoMo / Paystack pay step if the product takes money
3. Owner dashboard (or ledger) with a live result
4. **One** business outcome (e.g. “order paid while you sleep”)

## Tone

Ghana SME owner. Simple English. No jargon (no “webhook,” “tenant,” “CTWA” unless you say “ad that opens WhatsApp”).

## Files

| Artifact | Path |
|----------|------|
| Video | `media/catalpa-ads/<product-slug>.mp4` |
| Script (optional) | `media/catalpa-ads/<product-slug>-script.md` |

Site mirror: `docs/catalpa-ad-videos.md` + scripts under `docs/catalpa-ads/`.

## Products that need ads

| Priority | Slug | Notes |
|----------|------|-------|
| **1 · core** | `catalpa-ctwa-spine` | First ad — full wedge |
| 2 | `momo-whatsapp-checkout` | Catalog → MoMo → confirm |
| 3 | `receipt-momo` | Invoice → MoMo → receipt |
| 4 | `whatsapp-crm-dfy` | Multi-staff WA + SOP |
| 5 | `website-sprint-templates` | Site + WA/MoMo CTA |
| 6 | `job-pack-funnel` | Pack → pay → deliver |
| 7 | `rateping` | Alerts + MoMo sub |

Ship spine first. Others follow the same 78s rule.
