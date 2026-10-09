"""SQLite store for synchronised observations (FR-16 / FR-19).

Observations are kept as the JSON document the app produces, keyed by id, so a
re-sent offline queue is idempotent.
"""
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(os.getenv("DB_PATH", Path(__file__).resolve().parents[1] / "data" / "cocofarm.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


with _connect() as c:
    c.execute(
        """CREATE TABLE IF NOT EXISTS observations (
             id TEXT PRIMARY KEY,
             plot_id TEXT NOT NULL,
             timestamp TEXT NOT NULL,
             received_at TEXT NOT NULL,
             body TEXT NOT NULL)"""
    )
    c.execute("CREATE INDEX IF NOT EXISTS idx_obs_plot ON observations (plot_id, timestamp)")


def upsert_observation(plot_id: str, obs: dict) -> str:
    received_at = datetime.now(timezone.utc).isoformat()
    with _connect() as c:
        c.execute(
            """INSERT INTO observations (id, plot_id, timestamp, received_at, body) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET body = excluded.body, received_at = excluded.received_at""",
            (obs["id"], plot_id, obs["timestamp"], received_at, json.dumps(obs)),
        )
    return received_at


def list_observations(plot_id: str | None = None) -> list[dict]:
    sql = "SELECT body FROM observations"
    args: tuple = ()
    if plot_id:
        sql += " WHERE plot_id = ?"
        args = (plot_id,)
    with _connect() as c:
        return [json.loads(r["body"]) for r in c.execute(sql + " ORDER BY timestamp", args)]
