# reference_ai.py

import json
import math
from typing import Dict, Any, List, Tuple

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


def load_reference_db(path: str = "reference_db.json") -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def features_to_vector(features: Dict[str, float]) -> List[float]:
    vec = []
    for key in FEATURE_KEYS:
        value = features.get(key)
        if value is None:
            value = 0.0
        vec.append(float(value))
    return vec


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """
    cos(theta) = (a·b) / (|a| * |b|)

    dove:
    a·b = somma_i (a_i * b_i)
    |a| = sqrt(somma_i (a_i^2))
    """
    if len(a) != len(b):
        return 0.0

    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0

    for i in range(len(a)):
        dot += a[i] * b[i]
        norm_a += a[i] * a[i]
        norm_b += b[i] * b[i]

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def find_similar_tracks(
    track_features: Dict[str, float],
    reference_db: Dict[str, Any],
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    target_vec = features_to_vector(track_features)

    all_candidates: List[Dict[str, Any]] = []

    for genre_id, genre_data in reference_db.get("genres", {}).items():
        for t in genre_data.get("tracks", []):
            ref_features = t["features"]
            ref_vec = features_to_vector(ref_features)
            sim = cosine_similarity(target_vec, ref_vec)

            all_candidates.append({
                "genre": genre_id,
                "similarity": sim,
                "track": t,
            })

    all_candidates.sort(key=lambda x: x["similarity"], reverse=True)
    return all_candidates[:top_n]


def estimate_genre(similar_tracks: List[Dict[str, Any]]) -> Tuple[str, float]:
    if not similar_tracks:
        return "unknown", 0.0

    genre_scores: Dict[str, float] = {}
    total = 0.0

    for item in similar_tracks:
        g = item["genre"]
        s = max(item["similarity"], 0.0)
        total += s
        genre_scores[g] = genre_scores.get(g, 0.0) + s

    if total == 0:
        return "unknown", 0.0

    best_genre = None
    best_score = -1.0

    for g, s in genre_scores.items():
        score = s / total
        if score > best_score:
            best_score = score
            best_genre = g

    return best_genre, best_score


def compute_adjustments(
    track_features: Dict[str, float],
    genre_stats: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Confronta la traccia con la media del genere e produce differenze semplici.
    I valori sono in "unità naturali" (dB, ratio ecc).
    Non posso confermare questo come sistema definitivo, ma come base è utile.
    """
    mean = genre_stats.get("mean", {})

    adjustments = {}

    def diff(key: str):
        if key in mean and key in track_features:
            return track_features[key] - mean[key]
        return 0.0

    adjustments["lufs_diff"] = diff("lufs_integrated")
    adjustments["crest_factor_diff"] = diff("crest_factor")
    adjustments["sub_ratio_diff"] = diff("sub_ratio")
    adjustments["low_ratio_diff"] = diff("low_ratio")
    adjustments["lowmid_ratio_diff"] = diff("lowmid_ratio")
    adjustments["mid_ratio_diff"] = diff("mid_ratio")
    adjustments["high_ratio_diff"] = diff("high_ratio")
    adjustments["air_ratio_diff"] = diff("air_ratio")
    adjustments["bpm_diff"] = diff("bpm")

    # interpretazione molto semplice
    suggestions = []

    if adjustments["lufs_diff"] < -1.0:
        suggestions.append("Il master è più basso della media del genere, puoi spingere 1–2 dB.")
    elif adjustments["lufs_diff"] > 1.0:
        suggestions.append("Il master è più alto della media, occhio a non schiacciare troppo.")

    if adjustments["sub_ratio_diff"] < -0.03:
        suggestions.append("Hai meno sub rispetto alla media delle reference, valuta di spingere un po' sotto i 60 Hz.")
    elif adjustments["sub_ratio_diff"] > 0.03:
        suggestions.append("I sub sono più presenti della media, controlla che non diventi boomy.")

    if adjustments["lowmid_ratio_diff"] > 0.02:
        suggestions.append("Low mid un po' carichi, rischi di impastare il groove.")

    if abs(adjustments["bpm_diff"]) > 1.5:
        suggestions.append("Il BPM è fuori dalla media delle reference di genere, verifica che sia una scelta intenzionale.")

    return {
        "raw_diffs": adjustments,
        "suggestions": suggestions,
    }


def evaluate_track_with_reference(
    metrics: Dict[str, Any],
    extras: Dict[str, Any],
    reference_db: Dict[str, Any],
) -> Dict[str, Any]:
    # crea feature vector con la stessa logica del builder
    from reference_builder import build_feature_vector

    track_features = build_feature_vector(metrics, extras)

    similar = find_similar_tracks(track_features, reference_db, top_n=5)
    genre_id, genre_conf = estimate_genre(similar)

    genre_stats = {}
    if genre_id != "unknown":
        genre_stats = reference_db.get("genres", {}).get(genre_id, {}).get("feature_stats", {})

    adjustments = compute_adjustments(track_features, genre_stats)

    readable_similar = []
    for item in similar:
        t = item["track"]
        readable_similar.append({
            "genre": item["genre"],
            "similarity": item["similarity"],
            "artist": t["artist"],
            "title": t["title"],
            "bpm": t.get("bpm"),
            "key": t.get("key"),
            "spotify_url": t.get("spotify_url"),
            "beatport_url": t.get("beatport_url"),
        })

    return {
        "guessed_genre": genre_id,
        "genre_confidence": genre_conf,
        "similar_tracks": readable_similar,
        "adjustments": adjustments,
    }
