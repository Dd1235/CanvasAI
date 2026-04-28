from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from canvasai.config import get_settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """
    Initializes a singleton Supabase client using the public Anon key.
    Relies on application-level filtering (Fake RLS) using the user_id.
    """
    s = get_settings()
    
    if not s.supabase_url or not s.supabase_anon_key:
        raise ValueError(
            "Database integration requires SUPABASE_URL and SUPABASE_ANON_KEY "
            "in your .env file."
        )
        
    return create_client(s.supabase_url, s.supabase_anon_key)