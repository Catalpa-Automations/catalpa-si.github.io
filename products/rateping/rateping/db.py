"""SQLite persistence for RatePing subscribers."""

from __future__ import annotations

import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  created_at REAL NOT NULL,
  paid_until REAL NOT NULL DEFAULT 0,
  want_fx INTEGER NOT NULL DEFAULT 0,
  want_fuel INTEGER NOT NULL DEFAULT 0,
  last_payment_ref TEXT
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  usd_ghs REAL,
  petrol_ghs REAL,
  diesel_ghs REAL,
  fx_source TEXT,
  fuel_source TEXT,
  updated_at REAL
);

CREATE TABLE IF NOT EXISTS payment_refs (
  ref TEXT PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  amount_ghs INTEGER NOT NULL,
  created_at REAL NOT NULL,
  verified_at REAL,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
"""


@dataclass
class User:
    telegram_id: int
    username: str | None
    created_at: float
    paid_until: float
    want_fx: bool
    want_fuel: bool
    last_payment_ref: str | None

    @property
    def is_paid(self) -> bool:
        return self.paid_until > time.time()

    @property
    def has_alerts(self) -> bool:
        return self.want_fx or self.want_fuel


@dataclass
class Snapshot:
    usd_ghs: float | None
    petrol_ghs: float | None
    diesel_ghs: float | None
    fx_source: str | None
    fuel_source: str | None
    updated_at: float | None


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as conn:
            conn.executescript(SCHEMA)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def upsert_user(self, telegram_id: int, username: str | None) -> User:
        now = time.time()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO users (telegram_id, username, created_at)
                VALUES (?, ?, ?)
                ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username
                """,
                (telegram_id, username, now),
            )
        return self.get_user(telegram_id)  # type: ignore[return-value]

    def get_user(self, telegram_id: int) -> User | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
            ).fetchone()
        return self._user(row) if row else None

    def set_alerts(self, telegram_id: int, want_fx: bool, want_fuel: bool) -> User:
        with self._conn() as conn:
            conn.execute(
                "UPDATE users SET want_fx = ?, want_fuel = ? WHERE telegram_id = ?",
                (int(want_fx), int(want_fuel), telegram_id),
            )
        return self.get_user(telegram_id)  # type: ignore[return-value]

    def clear_alerts(self, telegram_id: int) -> User:
        return self.set_alerts(telegram_id, False, False)

    def create_payment_ref(self, telegram_id: int, amount_ghs: int) -> str:
        ref = f"RP-{telegram_id}-{int(time.time())}-{uuid.uuid4().hex[:6]}"
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO payment_refs (ref, telegram_id, amount_ghs, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (ref, telegram_id, amount_ghs, time.time()),
            )
            conn.execute(
                "UPDATE users SET last_payment_ref = ? WHERE telegram_id = ?",
                (ref, telegram_id),
            )
        return ref

    def verify_payment(self, ref: str, days: int = 30) -> User | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM payment_refs WHERE ref = ?", (ref,)
            ).fetchone()
            if not row:
                return None
            paid_until = time.time() + days * 86400
            conn.execute(
                "UPDATE payment_refs SET verified_at = ? WHERE ref = ?",
                (time.time(), ref),
            )
            conn.execute(
                "UPDATE users SET paid_until = MAX(paid_until, ?) WHERE telegram_id = ?",
                (paid_until, row["telegram_id"]),
            )
            tid = int(row["telegram_id"])
        return self.get_user(tid)

    def grant_days(self, telegram_id: int, days: int = 30) -> User:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT paid_until FROM users WHERE telegram_id = ?", (telegram_id,)
            ).fetchone()
            if not row:
                raise KeyError(telegram_id)
            base = max(time.time(), float(row["paid_until"] or 0))
            conn.execute(
                "UPDATE users SET paid_until = ? WHERE telegram_id = ?",
                (base + days * 86400, telegram_id),
            )
        return self.get_user(telegram_id)  # type: ignore[return-value]

    def list_alert_subscribers(self) -> list[User]:
        now = time.time()
        with self._conn() as conn:
            rows = conn.execute(
                """
                SELECT * FROM users
                WHERE paid_until > ?
                  AND (want_fx = 1 OR want_fuel = 1)
                """,
                (now,),
            ).fetchall()
        return [self._user(r) for r in rows]

    def get_snapshot(self) -> Snapshot | None:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM snapshots WHERE id = 1").fetchone()
        if not row:
            return None
        return Snapshot(
            usd_ghs=row["usd_ghs"],
            petrol_ghs=row["petrol_ghs"],
            diesel_ghs=row["diesel_ghs"],
            fx_source=row["fx_source"],
            fuel_source=row["fuel_source"],
            updated_at=row["updated_at"],
        )

    def save_snapshot(
        self,
        *,
        usd_ghs: float | None,
        petrol_ghs: float | None,
        diesel_ghs: float | None,
        fx_source: str | None,
        fuel_source: str | None,
    ) -> Snapshot:
        now = time.time()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO snapshots (id, usd_ghs, petrol_ghs, diesel_ghs, fx_source, fuel_source, updated_at)
                VALUES (1, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  usd_ghs = excluded.usd_ghs,
                  petrol_ghs = excluded.petrol_ghs,
                  diesel_ghs = excluded.diesel_ghs,
                  fx_source = excluded.fx_source,
                  fuel_source = excluded.fuel_source,
                  updated_at = excluded.updated_at
                """,
                (usd_ghs, petrol_ghs, diesel_ghs, fx_source, fuel_source, now),
            )
        return self.get_snapshot()  # type: ignore[return-value]

    @staticmethod
    def _user(row: sqlite3.Row) -> User:
        return User(
            telegram_id=int(row["telegram_id"]),
            username=row["username"],
            created_at=float(row["created_at"]),
            paid_until=float(row["paid_until"] or 0),
            want_fx=bool(row["want_fx"]),
            want_fuel=bool(row["want_fuel"]),
            last_payment_ref=row["last_payment_ref"],
        )


def iter_users(users: Iterable[User]) -> list[User]:
    return list(users)
