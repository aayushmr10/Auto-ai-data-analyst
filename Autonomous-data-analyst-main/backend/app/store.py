"""
In-memory dataset session store.

Each uploaded dataset gets a UUID. We keep the raw dataframe and the
current (possibly cleaned) dataframe in memory, keyed by that id, so the
frontend can call /profile, /stats, /charts, /ml etc. without re-uploading.

This is intentionally simple (no DB, no persistence across restarts) --
good enough for a single-user local / demo deployment. Swap for Redis or
Postgres-backed storage if this needs to survive restarts or scale to
multiple workers.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import pandas as pd


@dataclass
class DatasetSession:
    id: str
    filename: str
    raw_df: pd.DataFrame
    df: pd.DataFrame  # working copy, mutated by cleaning operations
    created_at: datetime = field(default_factory=datetime.utcnow)
    cleaning_log: list[str] = field(default_factory=list)


class DatasetStore:
    def __init__(self) -> None:
        self._sessions: dict[str, DatasetSession] = {}

    def create(self, filename: str, df: pd.DataFrame) -> DatasetSession:
        session_id = str(uuid.uuid4())
        session = DatasetSession(
            id=session_id,
            filename=filename,
            raw_df=df.copy(),
            df=df.copy(),
        )
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> Optional[DatasetSession]:
        return self._sessions.get(session_id)

    def require(self, session_id: str) -> DatasetSession:
        session = self.get(session_id)
        if session is None:
            raise KeyError(f"No dataset session found for id={session_id}")
        return session

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def list_ids(self) -> list[str]:
        return list(self._sessions.keys())


# Single process-wide store instance
store = DatasetStore()
