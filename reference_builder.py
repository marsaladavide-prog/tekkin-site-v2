# reference_builder.py

import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Dict, Any, List

# TODO: importa la tua funzione reale
# from tekkin_analyzer_api import analyze_file_to_metrics
# oppure da analyze_master_web import ...

def analyze_file_to_metrics(audio_path: str) -> Dict[str, Any]:
    """
    Stub. Qui devi collegare la tua analisi reale.
    Deve ritornare almeno:

    {
      "metrics": {
        "lufs_integrated": float,
        "crest_factor": float,
        "tonal_balance": {
          "sub": float,
          "low": float,
          "lowmid": float,
          "mid": float,
          "high": float,
          "air": float
        }
      },
      "extras": {
        "bpm": float,
        "spectral_centroid_hz": float,
        "spectral_rolloff_hz": float,
        "zero_crossing_rate": float
      }
    }
    """
    raise NotImplementedError("Collega qui la tua funzione di analisi reale")


FEATURE_KEYS = [
    "lufs_integrated",
    "crest_factor",
    "sub_ratio",
    "low_ratio",
    "lowmid_ratio",
    "mid_ratio",
    "high_ratio",
    "air_ratio",
    "spectral_centroid_hz",
    "spectral_rolloff_hz",
    "zero_crossing_rate",
    "bpm",
]


def build_feature_vector(metrics: Dict[str, Any], extras: Dict[str, Any]) -> Dict[str, float]:
    tonal = metrics.get("tonal_balance", {}) or {}

    feature_vector = {
        "lufs_integrated": float(metrics.get("lufs_integrated")),
        "crest_factor": float(metrics.get("crest_factor")),
        "sub_ratio": float(tonal.get("sub", 0.0)),
        "low_ratio": float(tonal.get("low", 0.0)),
        "lowmid_ratio": float(tonal.get("lowmid", 0.0)),
        "mid_ratio": float(tonal.get("mid", 0.0)),
        "high_ratio": float(tonal.get("high", 0.0)),
        "air_ratio": float(tonal.get("air", 0.0)),
        "spectral_centroid_hz": float(extras.get("spectral_centroid_hz", 0.0)),
        "spectral_rolloff_hz": float(extras.get("spectral_rolloff_hz", 0.0)),
        "zero_crossing_rate": float(extras.get("zero_crossing_rate", 0.0)),
        "bpm": float(extras.get("bpm", 0.0)),
    }

    return feature_vector


def compute_mean_std(vectors: List[Dict[str, float]]):
    mean = {}
    std = {}

    if not vectors:
        return mean, std

    for key in FEATURE_KEYS:
        vals = [v[key] for v in vectors if key in v and v[key] is not None]
        if not vals:
            continue

        # media
        s = 0.0
        for x in vals:
            s += x
        m = s / len(vals)

        # varianza
        sv = 0.0
        for x in vals:
            sv += (x - m) * (x - m)
        variance = sv / len(vals)
        std_dev = math.sqrt(variance)

        mean[key] = m
        std[key] = std_dev

    return mean, std


def main():
    manifest_path = Path("reference_manifest.json")
    out_path = Path("reference_db.json")

    with manifest_path.open("r", encoding="utf-8") as f:
        manifest = json.load(f)

    tracks_input = manifest.get("tracks", [])

    genres_data = {}
    genre_vectors: Dict[str, List[Dict[str, float]]] = defaultdict(list)

    for t in tracks_input:
        audio_path = t["audio_path"]
        print(f"Analizzo reference {t['id']} - {audio_path}")

        analysis = analyze_file_to_metrics(audio_path)
        metrics = analysis["metrics"]
        extras = analysis.get("extras", {})

        features = build_feature_vector(metrics, extras)

        genre = t["genre"]
        if genre not in genres_data:
            genres_data[genre] = {
                "name": genre.replace("_", " ").title(),
                "tracks": [],
                "feature_stats": {},
            }

        genres_data[genre]["tracks"].append({
            "id": t["id"],
            "artist": t["artist"],
            "title": t["title"],
            "bpm": float(extras.get("bpm", 0.0)),
            "key": extras.get("key", None),
            "features": features,
            "spotify_url": t.get("spotify_url"),
            "beatport_url": t.get("beatport_url"),
            "notes": t.get("notes"),
        })

        genre_vectors[genre].append(features)

    # calcolo medie e std per ogni genere
    for genre, vectors in genre_vectors.items():
        mean, std = compute_mean_std(vectors)
        genres_data[genre]["feature_stats"] = {
            "mean": mean,
            "std": std,
        }

    db = {
        "genres": genres_data
    }

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)

    print(f"Salvato reference_db.json con {len(genres_data)} generi")


if __name__ == "__main__":
    main()
