# RatePing

Ghana-ready **Telegram** bot for **USD/GHS** and **fuel** price alerts, with a MoMo/Paystack micro-subscription gate.

Pricing target: ~**GHS 10–20/mo** (default **GHS 15**).

### Positioning (deliberate)

RatePing is a **thin Telegram utility** — subscribe, get rate/fuel pings, pay with MoMo/Paystack. It is **not** an AI assistant, chatbot personality, or social network, and it does **not** compete with Meta or OpenAI products.

- **Build on Telegram** (Bot API). Delivery cost stays near zero vs SMS.
- **Keep the MoMo/Paystack paid gate** for alert unlock.
- **Optional later:** also notify via **WhatsApp Cloud API** (official Meta channel). Do not invent a rival chat surface.

## What it does

| Command | Who | Action |
|---------|-----|--------|
| `/start` | anyone | Welcome + pricing |
| `/rates` | anyone | Live USD/GHS + petrol/diesel snapshot |
| `/pay` | anyone | MoMo + Paystack instructions + payment reference |
| `/verify <ref>` | payer | Stub unlock (30 days) after MoMo/Paystack |
| `/subscribe` | paid | Choose FX / fuel / both |
| `/unsubscribe` | anyone | Stop alerts |
| `/status` | anyone | Paid-until + alert topics |
| `/setfuel <p> <d>` | admin | Pin NPA-window pump prices into cache |
| `/grant <id> [days]` | admin | Comp a subscriber |

Background job polls rates on `ALERT_INTERVAL_MINUTES` (default 30) and pings paid subscribers when FX moves ≥ `FX_MOVE_THRESHOLD_PCT` or fuel moves ≥ `FUEL_MOVE_THRESHOLD_GHS`.

A **stub webhook** listens on `WEBHOOK_PORT` for Paystack/MoMo callbacks so you can wire real checkout later without changing the bot.

## Data sources & refresh cadence

| Data | Source | Cadence |
|------|--------|---------|
| **USD → GHS** | Primary: [open.er-api.com](https://open.er-api.com/v6/latest/USD) (free, no key). Backup: jsDelivr [`@fawazahmed0/currency-api`](https://github.com/fawazahmed0/currency-api) | Upstream ~daily; RatePing polls every **30 min** (configurable) and alerts on *moves* |
| **Petrol / diesel** | (1) `PETROL_GHS` / `DIESEL_GHS` env, (2) `data/fuel_cache.json` or `/setfuel`, (3) best-effort scrape of public GH fuel news | Same poll interval; after each NPA window, run `/setfuel` or set env |

Rates are **indicative** (market API ≠ BoG mid-rate; news scrape ≠ NPA gazette). Say that in marketing.

## BotFather setup (Samuel)

1. Open Telegram → search **@BotFather** → `/start`.
2. `/newbot` → name e.g. `RatePing GH` → username e.g. `RatePingGH_bot`.
3. Copy the **HTTP API token**.
4. Optional: `/setdescription`, `/setabouttext`, `/setcommands` with:

```
start - Welcome & pricing
rates - Current USD/GHS + fuel
pay - MoMo / Paystack unlock
verify - Verify payment reference
subscribe - Choose FX / fuel alerts
unsubscribe - Stop alerts
status - Your plan
```

5. Message `@userinfobot` (or similar) to get your numeric Telegram ID for `ADMIN_TELEGRAM_IDS`.

## Run locally

```bash
cd /cursor/stores/self/internal/builds/rateping
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env → TELEGRAM_BOT_TOKEN=...  ADMIN_TELEGRAM_IDS=...
python main.py
```

Smoke test (no Telegram token needed):

```bash
source .venv/bin/activate
python scripts/smoke_test.py
```

### Stub payment webhook

With the bot running:

```bash
# After /pay in Telegram, copy the RP-… reference, then:
curl -sS -X POST "http://127.0.0.1:8787/webhooks/paystack" \
  -H "Content-Type: application/json" \
  -H "X-Paystack-Signature: stub" \
  -d '{"reference":"RP-YOURID-TIMESTAMP","status":"success"}'
```

Or in-chat: `/verify RP-…` (MVP accepts self-verify; replace with webhook-only in production).

## Paid gate flow

1. User `/subscribe` → blocked until paid.
2. `/pay` creates `RP-<telegram_id>-<unix>` and shows MoMo number + Paystack link.
3. User pays MoMo with that reference **or** Paystack hits the stub webhook.
4. `/verify <ref>` or webhook → `paid_until += 30 days`.
5. `/subscribe` → alerts enabled.

## Layout

```
rateping/                 # package
  config.py  db.py  rates.py  payments.py
  handlers.py  alerts.py  webhook.py
main.py                   # entrypoint
scripts/smoke_test.py
data/fuel_cache.json
.env.example
requirements.txt
```

## Next monetization steps

- Real Paystack MoMo Checkout + verify signature with live secret (drop `stub`).
- Hubtel/Arkesel SMS upsell for users who want SMS at GHS 15–30.
- Optional free delayed Telegram channel; paid bot = instant threshold alerts.
- Optional: mirror paid alerts to WhatsApp Cloud API (Meta) — same product, second Meta-owned pipe.

## GitHub — Catalpa-Automations/rateping

Intended remote: `https://github.com/Catalpa-Automations/rateping`

### Auth failure on this agent (2026-10-18)

Push was attempted from the Cloud Agent environment. Exact CLI output:

```text
$ gh auth status
You are not logged into any GitHub hosts. To log in, run: gh auth login

$ gh repo create Catalpa-Automations/rateping --private --source=. --remote=origin --push
To get started with GitHub CLI, please run:  gh auth login
Alternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.
(exit 4)
```

No `GH_TOKEN` / `GITHUB_TOKEN` was present. Local git history is ready on `main` (`bc67619` Initial RatePing MVP…).

### Push-ready commands (Samuel / org owner)

From a machine with access to **Catalpa-Automations**:

```bash
cd /cursor/stores/self/internal/builds/rateping   # or a clone of this tree
gh auth login
# or: export GH_TOKEN=<PAT with repo + create repo in Catalpa-Automations>

gh repo create Catalpa-Automations/rateping --private --source=. --remote=origin --push
# public alternative:
# gh repo create Catalpa-Automations/rateping --public --source=. --remote=origin --push

# Manual fallback (create empty repo in the org UI first):
git remote add origin git@github.com:Catalpa-Automations/rateping.git
# git remote add origin https://github.com/Catalpa-Automations/rateping.git
git push -u origin main
```
