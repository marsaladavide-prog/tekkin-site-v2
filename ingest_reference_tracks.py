import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import create_client, Client


# Carico variabili da .env (se presente)
load_dotenv(dotenv_path=".env.local")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti. "
        "Configura il file .env o le variabili di ambiente."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def build_tonal_balance(reference_ai: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """Estraggo le percentuali bande da reference_ai.bands_status."""
    if not reference_ai:
        return None

    bands_status = reference_ai.get("bands_status") or {}
    bands = ["sub", "low", "lowmid", "mid", "presence", "high", "air"]

    tb: Dict[str, float] = {}
    for band in bands:
        band_data = bands_status.get(band) or {}
        value = band_data.get("value")
        if value is not None:
            try:
                tb[band] = float(value)
            except (TypeError, ValueError):
                continue

    return tb or None


def build_spectral_features(analysis: Dict[str, Any]) -> Optional[Dict[str, float]]:
    """Estraggo extras spettrali dal JSON di analisi."""
    keys = [
        "spectral_centroid_hz",
        "spectral_rolloff_hz",
        "spectral_bandwidth_hz",
        "spectral_flatness",
        "zero_crossing_rate",
    ]
    data: Dict[str, float] = {}
    for k in keys:
        v = analysis.get(k)
        if v is not None:
            try:
                data[k] = float(v)
            except (TypeError, ValueError):
                continue
    return data or None


def save_reference_track(analysis: Dict[str, Any], meta: Dict[str, Any]) -> None:
    """
    analysis = JSON dell'analyzer (quello loggato in [run-analyzer] Analyzer result JSON)
    meta = metadati della traccia reference, es:
      {
        "track_title": "Nome traccia",
        "track_artist": "Artista",
        "label_name": "Label",
        "source": "local" | "beatport" | "spotify",
        "source_id": "id beatport/spotify o None",
        "source_url": "url beatport/spotify o None",
        "profile_key": "minimal_deep_tech",
        "genre_label": "Minimal / Deep Tech",
        "analyzer_version": "v3.6"
      }
    """

    reference_ai = analysis.get("reference_ai") or {}
    tonal_balance = build_tonal_balance(reference_ai)
    spectral_features = build_spectral_features(analysis)

    # Prendo profile_key/label dal reference_ai se presenti, altrimenti da meta
    profile_key = reference_ai.get("profile_key") or meta.get("profile_key")
    genre_label = reference_ai.get("profile_label") or meta.get("genre_label")

    if not profile_key:
        raise ValueError("profile_key mancante per reference track")

    row = {
        "profile_key": profile_key,
        "genre_label": genre_label,

        "track_title": meta.get("track_title"),
        "track_artist": meta.get("track_artist"),
        "label_name": meta.get("label_name"),

        "source": meta.get("source", "local"),
        "source_id": meta.get("source_id"),
        "source_url": meta.get("source_url"),

        # Loudness e tempo
        "lufs": float(analysis["lufs"]) if analysis.get("lufs") is not None else None,
        "bpm": float(analysis["bpm"]) if analysis.get("bpm") is not None else None,

        # Questi per ora li lasciamo null: nel JSON attuale sono solo dentro il testo "feedback"
        # Non posso confermare questo come numeri separati finché non li esponi come campi.
        "rms": None,
        "true_peak": None,
        "crest_factor": None,

        # Strutture JSON
        "tonal_balance": tonal_balance,
        "spectral_features": spectral_features,
        "energy_curve": None,  # da aggiungere in futuro se la calcoli

        "analyzer_version": meta.get("analyzer_version") or "v3.6",
        "analyzer_raw": analysis,
    }

    resp = supabase.table("reference_tracks").insert(row).execute()
    print("Inserted reference track:", resp.data)


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def ingest_reference_batch(references: List[Dict[str, Any]]) -> None:
    """
    references è una lista di dict del tipo:

    {
      "json_path": "references/minimal/track1.json",
      "meta": {
        "track_title": "Track Name",
        "track_artist": "Artist",
        "label_name": "Label",
        "source": "local",
        "source_id": None,
        "source_url": None,
        "profile_key": "minimal_deep_tech",
        "genre_label": "Minimal / Deep Tech",
        "analyzer_version": "v3.6"
      }
    }
    """
    for ref in references:
        json_path = Path(ref["json_path"])
        meta = ref["meta"]

        print(f"\n[INGEST] {meta.get('track_artist')} - {meta.get('track_title')} ({json_path})")

        if not json_path.exists():
            print(f"  ERRORE: file JSON non trovato: {json_path}")
            continue

        analysis = load_json(json_path)
        save_reference_track(analysis, meta)


if __name__ == "__main__":
    # Lista di reference da ingestare
    references_to_ingest: List[Dict[str, Any]] = [
        {
            "json_path": "references/minimal_deep_tech/track1.json",
            "meta": {
                "track_title": "Nome traccia reference",
                "track_artist": "Artista reference",
                "label_name": "Label reference",
                "source": "local",
                "source_id": None,
                "source_url": None,
                "profile_key": "minimal_deep_tech",
                "genre_label": "Minimal / Deep Tech",
                "analyzer_version": "v3.6",
            },
        },
        # Esempio per aggiungere una seconda traccia in futuro:
        # {
        #     "json_path": "references/minimal_deep_tech/track2.json",
        #     "meta": {
        #         "track_title": "My Reference Track 2",
        #         "track_artist": "Another Artist",
        #         "label_name": "Another Label",
        #         "source": "local",
        #         "source_id": None,
        #         "source_url": None,
        #         "profile_key": "minimal_deep_tech",
        #         "genre_label": "Minimal / Deep Tech",
        #         "analyzer_version": "v3.6",
        #     },
        # },
    ]

    ingest_reference_batch(references_to_ingest)
