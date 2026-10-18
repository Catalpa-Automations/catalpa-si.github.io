"""Stub Paystack / MoMo payment webhook (aiohttp)."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from aiohttp import web

from .config import Settings
from .db import Database
from .payments import apply_successful_payment

log = logging.getLogger("rateping.webhook")


def build_app(db: Database, settings: Settings) -> web.Application:
    app = web.Application()
    app["db"] = db
    app["settings"] = settings
    app.router.add_get("/health", health)
    app.router.add_post("/webhooks/paystack", paystack_webhook)
    app.router.add_post("/webhooks/momo", momo_webhook)
    return app


async def health(_: web.Request) -> web.Response:
    return web.json_response({"ok": True, "service": "rateping-webhook"})


def _signature_ok(settings: Settings, body: bytes, header: str | None) -> bool:
    """Accept literal 'stub' or HMAC-SHA512(body, secret) like Paystack."""
    if not header:
        return False
    if header.strip().lower() == "stub":
        return True
    digest = hmac.new(
        settings.paystack_secret.encode("utf-8"),
        body,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(digest, header)


async def paystack_webhook(request: web.Request) -> web.Response:
    settings: Settings = request.app["settings"]
    db: Database = request.app["db"]
    body = await request.read()
    sig = request.headers.get("X-Paystack-Signature")
    if not _signature_ok(settings, body, sig):
        return web.json_response({"error": "invalid signature"}, status=401)

    try:
        payload: dict[str, Any] = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return web.json_response({"error": "bad json"}, status=400)

    # Support both Paystack-like and flat stub shapes
    event = payload.get("event")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
    status = str(data.get("status", "")).lower()
    reference = data.get("reference") or data.get("reference_id")

    if event and event not in ("charge.success", "payment.success"):
        # Still allow flat stub without event
        if status not in ("success", "successful", "completed"):
            return web.json_response({"ok": True, "ignored": event})

    if status and status not in ("success", "successful", "completed", ""):
        return web.json_response({"ok": True, "ignored_status": status})

    if not reference:
        return web.json_response({"error": "missing reference"}, status=400)

    user = apply_successful_payment(db, str(reference), days=30)
    if not user:
        log.warning("Webhook ref not found: %s", reference)
        return web.json_response({"error": "unknown reference"}, status=404)

    log.info("Verified payment %s for telegram_id=%s", reference, user.telegram_id)
    return web.json_response(
        {
            "ok": True,
            "telegram_id": user.telegram_id,
            "paid_until": user.paid_until,
        }
    )


async def momo_webhook(request: web.Request) -> web.Response:
    """Same stub contract as Paystack for Hubtel/MoMo adapters."""
    return await paystack_webhook(request)


async def start_webhook(db: Database, settings: Settings) -> web.AppRunner:
    app = build_app(db, settings)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, settings.webhook_host, settings.webhook_port)
    await site.start()
    log.info(
        "Webhook listening on http://%s:%s/webhooks/paystack",
        settings.webhook_host,
        settings.webhook_port,
    )
    return runner
