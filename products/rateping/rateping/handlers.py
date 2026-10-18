"""Telegram command handlers."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes

from .config import Settings
from .db import Database
from .payments import ensure_paid_for_alerts, payment_instructions
from .rates import fetch_market, format_rates, save_fuel_cache, FuelQuote

log = logging.getLogger("rateping.handlers")


def _db(context: ContextTypes.DEFAULT_TYPE) -> Database:
    return context.application.bot_data["db"]


def _settings(context: ContextTypes.DEFAULT_TYPE) -> Settings:
    return context.application.bot_data["settings"]


def _paid_line(user) -> str:
    if user.is_paid:
        until = datetime.fromtimestamp(user.paid_until, tz=timezone.utc).strftime(
            "%Y-%m-%d %H:%M UTC"
        )
        return f"Paid until: *{until}*"
    return "Paid: *no* — run /pay"


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.effective_user and update.message
    db, settings = _db(context), _settings(context)
    user = db.upsert_user(update.effective_user.id, update.effective_user.username)
    ghs = settings.subscription_ghs
    text = (
        "*Welcome to RatePing*\n"
        "Thin Telegram utility — cedi FX + Ghana fuel price alerts.\n"
        "_Not an AI chat; just rates, pings, and MoMo unlock._\n\n"
        f"Micro-sub: *GHS {ghs}/mo* (MoMo / Paystack).\n\n"
        "Commands:\n"
        "/rates — current USD/GHS + fuel\n"
        "/subscribe — pick FX and/or fuel alerts\n"
        "/unsubscribe — stop alerts\n"
        "/status — your plan\n"
        "/pay — pay with MoMo/Paystack\n"
        "/verify <ref> — unlock after payment\n\n"
        f"{_paid_line(user)}"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)


async def rates_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.message
    settings = _settings(context)
    await update.message.reply_text("Fetching rates…")
    snap = await fetch_market(
        cache_path=settings.fuel_cache_path,
        petrol_override=settings.petrol_ghs,
        diesel_override=settings.diesel_ghs,
    )
    db = _db(context)
    db.save_snapshot(
        usd_ghs=snap.fx.usd_ghs if snap.fx else None,
        petrol_ghs=snap.fuel.petrol_ghs,
        diesel_ghs=snap.fuel.diesel_ghs,
        fx_source=snap.fx.source if snap.fx else None,
        fuel_source=snap.fuel.source,
    )
    await update.message.reply_text(format_rates(snap), parse_mode=ParseMode.MARKDOWN)


async def status_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.effective_user and update.message
    db = _db(context)
    user = db.upsert_user(update.effective_user.id, update.effective_user.username)
    alerts = []
    if user.want_fx:
        alerts.append("USD/GHS")
    if user.want_fuel:
        alerts.append("fuel")
    alert_txt = ", ".join(alerts) if alerts else "none"
    await update.message.reply_text(
        f"*Your RatePing status*\n"
        f"{_paid_line(user)}\n"
        f"Alerts: *{alert_txt}*\n"
        f"Last payment ref: `{user.last_payment_ref or '—'}`",
        parse_mode=ParseMode.MARKDOWN,
    )


async def pay_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.effective_user and update.message
    db, settings = _db(context), _settings(context)
    user = db.upsert_user(update.effective_user.id, update.effective_user.username)
    ref = db.create_payment_ref(user.telegram_id, settings.subscription_ghs)
    user = db.get_user(user.telegram_id)
    assert user
    await update.message.reply_text(
        payment_instructions(settings, user, ref),
        parse_mode=ParseMode.MARKDOWN,
        disable_web_page_preview=True,
    )


async def verify_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.effective_user and update.message
    db = _db(context)
    db.upsert_user(update.effective_user.id, update.effective_user.username)
    if not context.args:
        await update.message.reply_text("Usage: `/verify RP-123-…`", parse_mode=ParseMode.MARKDOWN)
        return
    ref = context.args[0].strip()
    # MVP stub: accepting /verify marks paid (operator should cross-check MoMo).
    # Webhook path is preferred in production.
    user = db.verify_payment(ref, days=30)
    if not user:
        await update.message.reply_text(
            "Unknown reference. Run /pay first, then `/verify <ref>`.",
            parse_mode=ParseMode.MARKDOWN,
        )
        return
    if user.telegram_id != update.effective_user.id:
        await update.message.reply_text("That reference belongs to another Telegram account.")
        return
    until = datetime.fromtimestamp(user.paid_until, tz=timezone.utc).strftime("%Y-%m-%d")
    await update.message.reply_text(
        f"Payment verified (stub). Alerts unlocked until *{until}*.\n"
        "Now run /subscribe to choose FX and/or fuel.",
        parse_mode=ParseMode.MARKDOWN,
    )


async def subscribe_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.effective_user and update.message
    db = _db(context)
    user = db.upsert_user(update.effective_user.id, update.effective_user.username)
    gate = ensure_paid_for_alerts(user)
    if gate:
        await update.message.reply_text(gate)
        return
    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("USD/GHS only", callback_data="sub:fx"),
                InlineKeyboardButton("Fuel only", callback_data="sub:fuel"),
            ],
            [InlineKeyboardButton("Both FX + fuel", callback_data="sub:both")],
        ]
    )
    await update.message.reply_text(
        "Choose alert topics (paid plan active):", reply_markup=keyboard
    )


async def subscribe_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.callback_query and update.effective_user
    q = update.callback_query
    await q.answer()
    db = _db(context)
    user = db.upsert_user(update.effective_user.id, update.effective_user.username)
    gate = ensure_paid_for_alerts(user)
    if gate:
        await q.edit_message_text(gate)
        return
    data = q.data or ""
    want_fx = data in ("sub:fx", "sub:both")
    want_fuel = data in ("sub:fuel", "sub:both")
    user = db.set_alerts(user.telegram_id, want_fx, want_fuel)
    topics = []
    if user.want_fx:
        topics.append("USD/GHS")
    if user.want_fuel:
        topics.append("fuel")
    await q.edit_message_text(
        f"Subscribed to: *{' + '.join(topics)}*.\n"
        "You'll get pings when prices move past the configured thresholds.",
        parse_mode=ParseMode.MARKDOWN,
    )


async def unsubscribe_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    assert update.effective_user and update.message
    db = _db(context)
    db.upsert_user(update.effective_user.id, update.effective_user.username)
    db.clear_alerts(update.effective_user.id)
    await update.message.reply_text("Alerts stopped. /subscribe anytime (while paid).")


async def admin_setfuel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Admin: /setfuel <petrol> <diesel> — update cache from NPA window."""
    assert update.effective_user and update.message
    settings = _settings(context)
    if update.effective_user.id not in settings.admin_telegram_ids:
        await update.message.reply_text("Admin only.")
        return
    if len(context.args) != 2:
        await update.message.reply_text("Usage: /setfuel 13.45 14.10")
        return
    try:
        petrol, diesel = float(context.args[0]), float(context.args[1])
    except ValueError:
        await update.message.reply_text("Prices must be numbers.")
        return
    quote = FuelQuote(
        petrol_ghs=petrol,
        diesel_ghs=diesel,
        source=f"admin setfuel @ {int(time.time())}",
    )
    save_fuel_cache(settings.fuel_cache_path, quote)
    db = _db(context)
    prev = db.get_snapshot()
    db.save_snapshot(
        usd_ghs=prev.usd_ghs if prev else None,
        petrol_ghs=petrol,
        diesel_ghs=diesel,
        fx_source=prev.fx_source if prev else None,
        fuel_source=quote.source,
    )
    await update.message.reply_text(
        f"Fuel cache updated: petrol {petrol:.2f}, diesel {diesel:.2f} GHS/L"
    )


async def admin_grant(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Admin: /grant <telegram_id> [days]"""
    assert update.effective_user and update.message
    settings = _settings(context)
    if update.effective_user.id not in settings.admin_telegram_ids:
        await update.message.reply_text("Admin only.")
        return
    if not context.args:
        await update.message.reply_text("Usage: /grant <telegram_id> [days]")
        return
    tid = int(context.args[0])
    days = int(context.args[1]) if len(context.args) > 1 else 30
    db = _db(context)
    if not db.get_user(tid):
        db.upsert_user(tid, None)
    user = db.grant_days(tid, days=days)
    await update.message.reply_text(
        f"Granted {days}d to `{tid}` until {user.paid_until:.0f}",
        parse_mode=ParseMode.MARKDOWN,
    )
