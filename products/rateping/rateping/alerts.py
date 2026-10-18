"""Periodic rate poll + Telegram alert fan-out."""

from __future__ import annotations

import logging

from telegram.constants import ParseMode
from telegram.ext import Application, ContextTypes

from .config import Settings
from .db import Database
from .rates import fetch_market

log = logging.getLogger("rateping.alerts")


async def poll_and_alert(context: ContextTypes.DEFAULT_TYPE) -> None:
    app: Application = context.application
    db: Database = app.bot_data["db"]
    settings: Settings = app.bot_data["settings"]

    snap = await fetch_market(
        cache_path=settings.fuel_cache_path,
        petrol_override=settings.petrol_ghs,
        diesel_override=settings.diesel_ghs,
    )
    prev = db.get_snapshot()
    new_usd = snap.fx.usd_ghs if snap.fx else None
    new_petrol = snap.fuel.petrol_ghs
    new_diesel = snap.fuel.diesel_ghs

    db.save_snapshot(
        usd_ghs=new_usd,
        petrol_ghs=new_petrol,
        diesel_ghs=new_diesel,
        fx_source=snap.fx.source if snap.fx else None,
        fuel_source=snap.fuel.source,
    )

    fx_msg = _fx_move_message(prev.usd_ghs if prev else None, new_usd, settings)
    fuel_msg = _fuel_move_message(
        prev.petrol_ghs if prev else None,
        prev.diesel_ghs if prev else None,
        new_petrol,
        new_diesel,
        settings,
    )

    if not fx_msg and not fuel_msg:
        log.debug("No threshold breach; skipping alerts")
        return

    for user in db.list_alert_subscribers():
        parts: list[str] = []
        if user.want_fx and fx_msg:
            parts.append(fx_msg)
        if user.want_fuel and fuel_msg:
            parts.append(fuel_msg)
        if not parts:
            continue
        text = "*RatePing alert*\n\n" + "\n\n".join(parts)
        try:
            await app.bot.send_message(
                chat_id=user.telegram_id,
                text=text,
                parse_mode=ParseMode.MARKDOWN,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("Failed to alert %s: %s", user.telegram_id, exc)


def _fx_move_message(
    old: float | None, new: float | None, settings: Settings
) -> str | None:
    if old is None or new is None or old <= 0:
        return None
    pct = abs(new - old) / old * 100.0
    if pct < settings.fx_move_threshold_pct:
        return None
    direction = "up" if new > old else "down"
    return (
        f"USD/GHS moved *{direction}* {pct:.2f}%\n"
        f"{old:.4f} → *{new:.4f}*\n"
        f"_Threshold: {settings.fx_move_threshold_pct}%_"
    )


def _fuel_move_message(
    old_p: float | None,
    old_d: float | None,
    new_p: float | None,
    new_d: float | None,
    settings: Settings,
) -> str | None:
    lines: list[str] = []
    thr = settings.fuel_move_threshold_ghs
    if old_p is not None and new_p is not None and abs(new_p - old_p) >= thr:
        lines.append(f"Petrol: {old_p:.2f} → *{new_p:.2f}* GHS/L")
    if old_d is not None and new_d is not None and abs(new_d - old_d) >= thr:
        lines.append(f"Diesel: {old_d:.2f} → *{new_d:.2f}* GHS/L")
    if not lines:
        return None
    return "Fuel price move:\n" + "\n".join(lines) + f"\n_Threshold: GHS {thr:.2f}/L_"
