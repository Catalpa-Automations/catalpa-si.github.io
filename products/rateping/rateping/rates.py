"""Fetch USD/GHS FX and Ghana fuel prices from public sources."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

import httpx

log = logging.getLogger("rateping.rates")

# Primary: Open ExchangeRate-API (no key). Updates ~daily; we poll more often and cache.
FX_PRIMARY = "https://open.er-api.com/v6/latest/USD"
# Backup: Fawaz Ahmed currency CDN (no key).
FX_BACKUP = (
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json"
)

# Scrape-friendly public page that often lists indicative GH pump prices.
# NPA official site redirects; this aggregator is used as a best-effort scrape.
FUEL_SCRAPE_URL = "https://www.myjoyonline.com/tag/fuel-prices/"
USER_AGENT = "RatePing/0.1 (+https://t.me/RatePingBot; Ghana FX/fuel alerts MVP)"


@dataclass
class FxQuote:
    usd_ghs: float
    source: str
    as_of: str | None = None


@dataclass
class FuelQuote:
    petrol_ghs: float | None
    diesel_ghs: float | None
    source: str


@dataclass
class MarketSnapshot:
    fx: FxQuote | None
    fuel: FuelQuote


async def fetch_usd_ghs(client: httpx.AsyncClient) -> FxQuote:
    try:
        r = await client.get(FX_PRIMARY, timeout=20.0)
        r.raise_for_status()
        data = r.json()
        rate = float(data["rates"]["GHS"])
        return FxQuote(
            usd_ghs=rate,
            source="open.er-api.com (USD base → GHS)",
            as_of=data.get("time_last_update_utc"),
        )
    except Exception as exc:  # noqa: BLE001 — fall through to backup
        log.warning("Primary FX failed: %s", exc)

    r = await client.get(FX_BACKUP, timeout=20.0)
    r.raise_for_status()
    data = r.json()
    rate = float(data["usd"]["ghs"])
    return FxQuote(
        usd_ghs=rate,
        source="jsdelivr currency-api (usd.ghs)",
        as_of=data.get("date"),
    )


def _load_fuel_cache(path: Path) -> FuelQuote | None:
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return FuelQuote(
            petrol_ghs=_num(raw.get("petrol_ghs")),
            diesel_ghs=_num(raw.get("diesel_ghs")),
            source=str(raw.get("source", "local fuel_cache.json")),
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("Fuel cache unreadable: %s", exc)
        return None


def save_fuel_cache(path: Path, quote: FuelQuote) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "petrol_ghs": quote.petrol_ghs,
                "diesel_ghs": quote.diesel_ghs,
                "source": quote.source,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def _num(v: object) -> float | None:
    if v is None or v == "":
        return None
    return float(v)


async def fetch_fuel(
    client: httpx.AsyncClient,
    *,
    cache_path: Path,
    petrol_override: float | None,
    diesel_override: float | None,
) -> FuelQuote:
    """Resolve fuel prices: env → cache → scrape → empty.

    News scrapes are noisy; prefer admin/env/cache so NPA-window numbers stick.
    """
    if petrol_override is not None or diesel_override is not None:
        quote = FuelQuote(
            petrol_ghs=petrol_override,
            diesel_ghs=diesel_override,
            source="env PETROL_GHS / DIESEL_GHS (manual NPA window)",
        )
        save_fuel_cache(cache_path, quote)
        return quote

    cached = _load_fuel_cache(cache_path)
    if cached and (cached.petrol_ghs is not None or cached.diesel_ghs is not None):
        return cached

    scraped = await _try_scrape_fuel(client)
    if scraped and (scraped.petrol_ghs or scraped.diesel_ghs):
        save_fuel_cache(cache_path, scraped)
        return scraped

    return FuelQuote(petrol_ghs=None, diesel_ghs=None, source="unavailable")


async def _try_scrape_fuel(client: httpx.AsyncClient) -> FuelQuote | None:
    """Best-effort: pull GHS/litre figures mentioned near petrol/diesel keywords."""
    try:
        r = await client.get(
            FUEL_SCRAPE_URL,
            timeout=25.0,
            headers={"User-Agent": USER_AGENT},
            follow_redirects=True,
        )
        if r.status_code >= 400:
            return None
        text = r.text.lower()
        petrol = _near_price(text, ("petrol", "gasoline", "pms"))
        diesel = _near_price(text, ("diesel", "ago"))
        if petrol is None and diesel is None:
            return None
        return FuelQuote(
            petrol_ghs=petrol,
            diesel_ghs=diesel,
            source=f"scrape {FUEL_SCRAPE_URL}",
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("Fuel scrape failed: %s", exc)
        return None


def _near_price(text: str, keywords: tuple[str, ...]) -> float | None:
    """Find a plausible GHS/litre price (8–30) near fuel keywords."""
    for kw in keywords:
        for m in re.finditer(rf".{{0,80}}{kw}.{{0,80}}", text):
            window = m.group(0)
            for num in re.findall(r"(\d{1,2}(?:\.\d{1,2})?)", window):
                val = float(num)
                if 8.0 <= val <= 30.0:
                    return val
    return None


async def fetch_market(
    *,
    cache_path: Path,
    petrol_override: float | None,
    diesel_override: float | None,
) -> MarketSnapshot:
    async with httpx.AsyncClient() as client:
        fx: FxQuote | None
        try:
            fx = await fetch_usd_ghs(client)
        except Exception as exc:  # noqa: BLE001
            log.error("FX fetch failed entirely: %s", exc)
            fx = None
        fuel = await fetch_fuel(
            client,
            cache_path=cache_path,
            petrol_override=petrol_override,
            diesel_override=diesel_override,
        )
    return MarketSnapshot(fx=fx, fuel=fuel)


def format_rates(snap: MarketSnapshot) -> str:
    lines = ["*RatePing — live snapshot*\n"]
    if snap.fx:
        lines.append(f"USD/GHS: *{snap.fx.usd_ghs:.4f}*")
        lines.append(f"_Source: {snap.fx.source}_")
        if snap.fx.as_of:
            lines.append(f"_As of: {snap.fx.as_of}_")
    else:
        lines.append("USD/GHS: _unavailable_")
    lines.append("")
    petrol = (
        f"{snap.fuel.petrol_ghs:.2f}" if snap.fuel.petrol_ghs is not None else "n/a"
    )
    diesel = (
        f"{snap.fuel.diesel_ghs:.2f}" if snap.fuel.diesel_ghs is not None else "n/a"
    )
    lines.append(f"Petrol: *GHS {petrol}*/L")
    lines.append(f"Diesel: *GHS {diesel}*/L")
    lines.append(f"_Fuel source: {snap.fuel.source}_")
    lines.append(
        "\n_Indicative only — not BoG/NPA official. Confirm before trading._"
    )
    return "\n".join(lines)
