"""MoMo / Paystack payment gate (manual verify + stub webhook)."""

from __future__ import annotations

from .config import Settings
from .db import Database, User


def payment_instructions(settings: Settings, user: User, ref: str) -> str:
    ghs = settings.subscription_ghs
    return (
        f"*Unlock RatePing alerts — GHS {ghs}/month*\n\n"
        "Pay with *MTN / Telecel / AT MoMo* or Paystack, then verify.\n\n"
        f"1. MoMo: send *GHS {ghs}* to `{settings.momo_number}` "
        f"({settings.momo_name})\n"
        f"   Reference / name: `{ref}`\n"
        f"2. Or open Paystack: {settings.paystack_payment_url}\n"
        f"   Use the same reference: `{ref}`\n\n"
        f"After paying, send:\n`/verify {ref}`\n\n"
        "_Webhook stub:_ POST your Paystack/MoMo callback to "
        f"`http://{settings.webhook_host}:{settings.webhook_port}/webhooks/paystack` "
        "with JSON `{\"reference\": \"" + ref + "\", \"status\": \"success\"}` "
        "and header `X-Paystack-Signature: stub` (or set PAYSTACK_SECRET).\n\n"
        "Alerts stay off until payment is verified."
    )


def ensure_paid_for_alerts(user: User) -> str | None:
    """Return an error message if the user cannot enable alerts yet."""
    if user.is_paid:
        return None
    return (
        "Alerts are behind a micro-subscription gate.\n"
        "Run /pay to get MoMo/Paystack instructions, then /verify <ref>."
    )


def apply_successful_payment(db: Database, reference: str, days: int = 30) -> User | None:
    return db.verify_payment(reference, days=days)
