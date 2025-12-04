import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

# Carico le env dal file .env.local nella root del progetto
load_dotenv(dotenv_path=".env.local")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Optional[Client] = None

if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    print("reference_models: inizializzo client Supabase")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
else:
    print("reference_models: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti, salto modello AI.")


def fetch_genre_model(profile_key: str) -> Optional[Dict[str, Any]]:
    """Ritorna la riga di reference_genre_models per il profilo dato."""
    if supabase is None:
        return None

    resp = (
        supabase.table("reference_genre_models")
        .select("*")
        .eq("profile_key", profile_key)
        .execute()
    )

    data = resp.data or []
    if not data:
        return None

    return data[0]
