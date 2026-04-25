"""Lazy Supabase client. Returns None if creds are missing so the rest of
the backend can run in dev without a Supabase project."""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from canvasai.config import get_settings


@lru_cache(maxsize=1)
def get_supabase() -> Client | None:
    s = get_settings()
    if not (s.supabase_url and s.supabase_service_role_key):
        return None
    return create_client(s.supabase_url, s.supabase_service_role_key)
