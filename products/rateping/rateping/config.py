"""Environment configuration for RatePing."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATA_DIR = Path(os.getenv("RATEPING_DATA_DIR", str(ROOT / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Settings:
    bot_token: str
    admin_telegram_ids: frozenset[int]
    subscription_ghs: int
    momo_number: str
    momo_name: str
    paystack_payment_url: str
    paystack_secret: str
    webhook_host: str
    webhook_port: int
    alert_interval_minutes: int
    fx_move_threshold_pct: float
    fuel_move_threshold_ghs: float
    db_path: Path
    fuel_cache_path: Path
    # Optional seed fuel prices (GHS/litre) when live scrape is unavailable
    petrol_ghs: float | None
    diesel_ghs: float | None


def _ints(raw: str) -> frozenset[int]:
    out: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            out.add(int(part))
    return frozenset(out)


def _opt_float(key: str) -> float | None:
    raw = os.getenv(key, "").strip()
    if not raw:
        return None
    return float(raw)


def load_settings() -> Settings:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise SystemExit(
            "TELEGRAM_BOT_TOKEN is required. Copy .env.example → .env and add your BotFather token."
        )
    return Settings(
        bot_token=token,
        admin_telegram_ids=_ints(os.getenv("ADMIN_TELEGRAM_IDS", "")),
        subscription_ghs=int(os.getenv("SUBSCRIPTION_GHS", "15")),
        momo_number=os.getenv("MOMO_NUMBER", "024XXXXXXX"),
        momo_name=os.getenv("MOMO_NAME", "RatePing GH"),
        paystack_payment_url=os.getenv(
            "PAYSTACK_PAYMENT_URL",
            "https://paystack.com/pay/rateping-stub",
        ),
        paystack_secret=os.getenv("PAYSTACK_SECRET", "sk_test_stub"),
        webhook_host=os.getenv("WEBHOOK_HOST", "127.0.0.1"),
        webhook_port=int(os.getenv("WEBHOOK_PORT", "8787")),
        alert_interval_minutes=int(os.getenv("ALERT_INTERVAL_MINUTES", "30")),
        fx_move_threshold_pct=float(os.getenv("FX_MOVE_THRESHOLD_PCT", "0.5")),
        fuel_move_threshold_ghs=float(os.getenv("FUEL_MOVE_THRESHOLD_GHS", "0.10")),
        db_path=DATA_DIR / "rateping.sqlite3",
        fuel_cache_path=DATA_DIR / "fuel_cache.json",
        petrol_ghs=_opt_float("PETROL_GHS"),
        diesel_ghs=_opt_float("DIESEL_GHS"),
    )
