# WhatsApp CRM DFY (Ghana)

Done-for-you **Meta WhatsApp Business** ops kit for Accra/Kumasi SMEs: lead pipeline, `wa.me` outreach, Google Sheets import, and staff-facing tracker.

### Positioning (non-negotiable)

This product **rides on Meta WhatsApp Business** (and optional Google Sheets). It does **not**:

- compete with Meta, WhatsApp, Google, or OpenAI
- invent a rival chat network or inbox
- ship a generic LLM / ChatGPT clone

Inbox stays in Meta’s WhatsApp Business / Business Suite. We sell Ghana delivery: setup checklists, thin lead tracker, MoMo/Paystack link packing, and training.

Payments stay on **Paystack / MoMo** (licensed PSP) — native WhatsApp Pay is not the Ghana path.

## What’s in the box

| Path | Purpose |
|------|---------|
| `src/` | Zero-dep Node lead tracker (`wa.me` buttons, stages) |
| `public/` | Staff UI |
| `sheets/` | Leads CSV template + import helper |
| `sales/` | One-pager + onboarding checklist (agency pitch) |
| `data/leads.sample.json` | Sample seed (runtime writes `data/leads.json`, gitignored) |

## Quick start

```bash
cp .env.example .env
npm start   # node src/server.js — no install required
```

Open http://localhost:3847

## Stack

- Node 18+ (`http` only)
- Meta WhatsApp via **`wa.me` deep links** (Cloud API optional later)
- Optional Google Sheets CSV import for offline ops

## Repo target

Canonical home: **https://github.com/Catalpa-Automations/whatsapp-crm-dfy** (preferred).  
Until org `createRepository` is granted to the agent token, this pack may live under `products/whatsapp-crm-dfy` on the Catalpa site repo.
