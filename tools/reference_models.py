import json
from pathlib import Path
from typing import Any, Dict, Optional


REFERENCE_MODELS_DIR = Path(__file__).resolve().parent / "reference_models"
DEFAULT_PROFILE_KEY = "minimal_deep_tech"


def _coerce_profile_key(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    return value


def _load_model_file(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        print(f"[reference-models] file non trovato: {path.name}")
        return None

    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError as exc:
        print(f"[reference-models] JSON invalido '{path.name}': {exc}")
        return None
    except Exception as exc:
        print(f"[reference-models] errore leggendo '{path.name}': {repr(exc)}")
        return None

    if not isinstance(data, dict):
        print(f"[reference-models] formato inatteso in '{path.name}'")
        return None

    return data


def fetch_genre_model(profile_key: str) -> Optional[Dict[str, Any]]:
    """
    Carica il modello di riferimento per il profilo richiesto dai JSON offline.

    Se il profilo non ha un file dedicato, prova a usare il fallback
    'minimal_deep_tech'. In caso di errori o dati mancanti, ritorna None.
    """
    if not REFERENCE_MODELS_DIR.exists():
        print(
            f"[reference-models] cartella '{REFERENCE_MODELS_DIR}' mancante, impossibile caricare modelli"
        )
        return None

    candidates: list[str] = []
    seen: set[str] = set()

    def _add_candidate(key: Optional[str]) -> None:
        normalized = _coerce_profile_key(key)
        if normalized and normalized not in seen:
            seen.add(normalized)
            candidates.append(normalized)

    _add_candidate(profile_key)
    _add_candidate(DEFAULT_PROFILE_KEY)

    tried_files: list[str] = []

    for key in candidates:
        model_path = REFERENCE_MODELS_DIR / f"{key}.json"
        tried_files.append(model_path.name)
        model = _load_model_file(model_path)
        if model is not None:
            return model

    print(
        "[reference-models] nessun modello trovato per profilo "
        f"'{profile_key}' (provati: {', '.join(tried_files)})"
    )
    return None
