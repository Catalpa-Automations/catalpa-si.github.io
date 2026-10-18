#!/usr/bin/env python3
"""RatePing entrypoint — Telegram bot + payment webhook stub."""

from __future__ import annotations

import logging
import sys

from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
)

from rateping.alerts import poll_and_alert
from rateping.config import load_settings
from rateping.db import Database
from rateping import handlers
from rateping.webhook import start_webhook

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("rateping")


def main() -> None:
    settings = load_settings()
    db = Database(settings.db_path)

    app = (
        Application.builder()
        .token(settings.bot_token)
        .post_init(_make_post_init(db, settings))
        .post_shutdown(_post_shutdown)
        .build()
    )
    app.bot_data["db"] = db
    app.bot_data["settings"] = settings

    app.add_handler(CommandHandler("start", handlers.start))
    app.add_handler(CommandHandler("rates", handlers.rates_cmd))
    app.add_handler(CommandHandler("status", handlers.status_cmd))
    app.add_handler(CommandHandler("pay", handlers.pay_cmd))
    app.add_handler(CommandHandler("verify", handlers.verify_cmd))
    app.add_handler(CommandHandler("subscribe", handlers.subscribe_cmd))
    app.add_handler(CommandHandler("unsubscribe", handlers.unsubscribe_cmd))
    app.add_handler(CommandHandler("setfuel", handlers.admin_setfuel))
    app.add_handler(CommandHandler("grant", handlers.admin_grant))
    app.add_handler(CallbackQueryHandler(handlers.subscribe_callback, pattern=r"^sub:"))

    if app.job_queue is None:
        log.error(
            "JobQueue missing — install python-telegram-bot[job-queue]. Alerts disabled."
        )
    else:
        app.job_queue.run_repeating(
            poll_and_alert,
            interval=settings.alert_interval_minutes * 60,
            first=15,
            name="rateping-poll",
        )

    log.info(
        "RatePing starting (alerts every %sm, webhook :%s)",
        settings.alert_interval_minutes,
        settings.webhook_port,
    )
    app.run_polling(allowed_updates=["message", "callback_query"])


def _make_post_init(db: Database, settings):
    async def _post_init(application: Application) -> None:
        runner = await start_webhook(db, settings)
        application.bot_data["webhook_runner"] = runner

    return _post_init


async def _post_shutdown(application: Application) -> None:
    runner = application.bot_data.get("webhook_runner")
    if runner is not None:
        await runner.cleanup()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
