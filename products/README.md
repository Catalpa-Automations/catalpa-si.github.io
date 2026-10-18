# Catalpa Ghana money MVPs

Source packs for Ghana cash products under **[Catalpa Automations](https://github.com/Catalpa-Automations)**.

## Platform rule

Every product here **rides on** Meta WhatsApp / Google / Paystack / Telegram. They are **not** competitors to Meta, OpenAI, Google, or WhatsApp. See each product README for the explicit positioning statement.

| Folder | Stack rails | One-liner |
|--------|-------------|-----------|
| [`rateping`](./rateping/) | Telegram + Paystack/MoMo | USD/GHS + fuel alert bot |
| [`momo-whatsapp-checkout`](./momo-whatsapp-checkout/) | Meta WhatsApp (`wa.me` / Cloud API later) + Paystack | Catalog → MoMo pay → WA confirm |
| [`receipt-momo`](./receipt-momo/) | Paystack + WhatsApp share | One-tap MoMo invoices (Next.js PWA) |
| [`job-pack-funnel`](./job-pack-funnel/) | Meta traffic + Paystack + `wa.me` | Graduate job-pack sales funnel |
| [`whatsapp-crm-dfy`](./whatsapp-crm-dfy/) | Meta WhatsApp Business + Sheets | DFY CRM / ops setup kit |
| [`website-sprint-templates`](./website-sprint-templates/) | Google Business + WhatsApp + MoMo | SME website sprint templates |

## Preferred repo layout

1. One private/public repo per folder under `Catalpa-Automations/<name>`
2. Or monorepo `Catalpa-Automations/catalpa-ghana-products`
3. **This path** (`catalpa-si.github.io/products/…`) is the last-resort mirror when org `createRepository` is blocked for the agent token

Secrets: only `.env.example` is committed. Copy to `.env` / `.env.local` locally.
