#!/usr/bin/env python3
"""Offline smoke test — FX fetch, DB, payment verify, webhook health (no Telegram token)."""

from __future__ import annotations

import asyncio
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from aiohttp import ClientSession
from aiohttp.test_utils import TestClient, TestServer

from rateping.db import Database
from rateping.payments import apply_successful_payment
from rateping.rates import fetch_market, format_rates
from rateping.webhook import build_app


class _StubSettings:
    paystack_secret = "sk_test_stub"
    webhook_host = "127.0.0.1"
    webhook_port = 8787


async def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        cache = tmp_path / "fuel.json"
        cache.write_text(
            json.dumps({"petrol_ghs": 13.5, "diesel_ghs": 14.1, "source": "test"}),
            encoding="utf-8",
        )
        snap = await fetch_market(
            cache_path=cache, petrol_override=None, diesel_override=None
        )
        assert snap.fx is not None and snap.fx.usd_ghs > 1, snap
        print("FX OK:", snap.fx.usd_ghs, snap.fx.source)
        print(format_rates(snap)[:200], "…")

        db = Database(tmp_path / "t.sqlite3")
        u = db.upsert_user(42, "samuel")
        ref = db.create_payment_ref(42, 15)
        assert not u.is_paid
        paid = apply_successful_payment(db, ref)
        assert paid and paid.is_paid
        db.set_alerts(42, True, True)
        subs = db.list_alert_subscribers()
        assert len(subs) == 1
        print("DB/payment OK:", ref, "paid_until", paid.paid_until)

        app = build_app(db, _StubSettings())  # type: ignore[arg-type]
        async with TestClient(TestServer(app)) as client:
            h = await client.get("/health")
            assert h.status == 200
            bad = await client.post(
                "/webhooks/paystack",
                json={"reference": ref, "status": "success"},
                headers={"X-Paystack-Signature": "wrong"},
            )
            assert bad.status == 401
            # new ref for second verify path
            ref2 = db.create_payment_ref(42, 15)
            ok = await client.post(
                "/webhooks/paystack",
                json={"reference": ref2, "status": "success"},
                headers={"X-Paystack-Signature": "stub"},
            )
            assert ok.status == 200, await ok.text()
            print("Webhook OK:", await ok.json())

    print("SMOKE PASS")


if __name__ == "__main__":
    asyncio.run(main())
