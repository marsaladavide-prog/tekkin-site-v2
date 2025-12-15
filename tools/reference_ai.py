# reference_ai.py



import json

import math

from typing import Any, Dict, List, Tuple



from tools.model_math import compute_model_match

from reference_builder import build_feature_vector



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





def _ensure_dict(value: Any) -> Dict[str, Any]:

    return value if isinstance(value, dict) else {}





def _ensure_list(value: Any) -> List[Any]:

    return value if isinstance(value, list) else []





def features_to_vector(features: Dict[str, float]) -> List[float]:

    features_safe = _ensure_dict(features)

    vec = []

    for key in FEATURE_KEYS:

        value = features_safe.get(key)

        if value is None:

            value = 0.0

        vec.append(float(value))

    return vec





def cosine_similarity(a: List[float], b: List[float]) -> float:

    """

    cos(theta) = (aÃÂ·b) / (|a| * |b|)



    dove:

    aÃÂ·b = somma_i (a_i * b_i)

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

    genres = _ensure_dict(reference_db).get("genres", {})

    if not isinstance(genres, dict):

        genres = {}



    for genre_id, genre_data in genres.items():

        genre_data = _ensure_dict(genre_data)

        for t in _ensure_list(genre_data.get("tracks")):

            track_data = _ensure_dict(t)

            ref_features = _ensure_dict(track_data.get("features"))

            if not ref_features:

                continue

            ref_vec = features_to_vector(ref_features)

            sim = cosine_similarity(target_vec, ref_vec)



            all_candidates.append({

                "genre": genre_id,

                "similarity": sim,

                "track": track_data,

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

    genre_stats: Dict[str, Any] | None,

) -> Dict[str, Any]:

    """

    Confronta la traccia con la media del genere e produce differenze semplici.

    I valori sono in "unitÃÂ  naturali" (dB, ratio ecc).

    Non posso confermare questo come sistema definitivo, ma come base ÃÂ¨ utile.

    """

    # Se genre_stats ÃÂ¨ None o non ÃÂ¨ un dict, uso un dict vuoto

    if not isinstance(genre_stats, dict):

        genre_stats = {}



    genre_stats_safe = _ensure_dict(genre_stats)

    mean = _ensure_dict(genre_stats_safe.get("mean"))



    # Se mean non ÃÂ¨ un dict, fallback a dict vuoto

    if not isinstance(mean, dict):

        mean = {}



    adjustments: Dict[str, float | None] = {}



    def diff(key: str) -> float | None:
        if key not in track_features or key not in mean:
            return None
        track_value = track_features[key]
        mean_value = mean[key]
        if track_value is None or mean_value is None:
            return None
        try:
            return float(track_value) - float(mean_value)
        except (TypeError, ValueError):
            return None


    adjustments["lufs_diff"] = diff("lufs_integrated")

    adjustments["crest_factor_diff"] = diff("crest_factor")

    adjustments["sub_ratio_diff"] = diff("sub_ratio")

    adjustments["low_ratio_diff"] = diff("low_ratio")

    adjustments["lowmid_ratio_diff"] = diff("lowmid_ratio")

    adjustments["mid_ratio_diff"] = diff("mid_ratio")

    adjustments["high_ratio_diff"] = diff("high_ratio")

    adjustments["air_ratio_diff"] = diff("air_ratio")

    adjustments["bpm_diff"] = diff("bpm")

    adjustments["key_diff"] = None



    suggestions: List[str] = []



    lufs_diff = adjustments['lufs_diff']

    if lufs_diff is not None and lufs_diff < -1.0:

        suggestions.append("Il master Ã¨ piÃ¹ basso della media del genere, spingi 1-2 dB.")

    elif lufs_diff is not None and lufs_diff > 1.0:

        suggestions.append("Il master Ã¨ piÃ¹ alto della media, occhio a non schiacciare troppo.")



    sub_diff = adjustments['sub_ratio_diff']

    if sub_diff is not None and sub_diff < -0.03:

                suggestions.append("Hai meno sub rispetto alle reference, aumenta un po' l'energia sotto i 60 Hz.")

    elif sub_diff is not None and sub_diff > 0.03:

        suggestions.append('I sub sono piÃ¹ presenti della media, controlla il boominess.')



    lowmid_diff = adjustments['lowmid_ratio_diff']

    if lowmid_diff is not None and lowmid_diff > 0.02:

        suggestions.append("Low mid un po' in evidenza, puÃ² impastare il groove.")



    bpm_diff = adjustments['bpm_diff']

    if bpm_diff is not None and abs(bpm_diff) > 1.5:

        suggestions.append('Il BPM Ã¨ fuori dalla media del genere; verifica che sia intenzionale.')



    return {

        "raw_diffs": adjustments,

        "suggestions": suggestions,

    }





def evaluate_track_with_reference(

    *,

    db: Dict[str, Any] | None,

    metrics: Dict[str, Any],

    extras: Dict[str, Any],

    genre_model: Dict[str, Any] | None = None,

    public_output: bool = False,

) -> Dict[str, Any]:

    """
    Valuta la traccia rispetto al reference_db + eventuale modello Tekkin.
    db può essere None: in quel caso ritorna un errore pulito invece di crashare.
    """

    try:
        if not isinstance(db, dict):
            raise ValueError("reference_db_not_loaded_or_invalid")

        reference_db: Dict[str, Any] = db

        if not isinstance(metrics, dict):
            raise ValueError("metrics_missing_or_invalid")
        metrics_safe = metrics

        extras_safe = extras if isinstance(extras, dict) else {}

        if genre_model is not None and not isinstance(genre_model, dict):
            raise ValueError("genre_model_invalid")

        track_features = build_feature_vector(metrics_safe, extras_safe)

        similar = find_similar_tracks(track_features, reference_db, top_n=5)
        genre_id, genre_conf = estimate_genre(similar)

        genres = _ensure_dict(reference_db.get("genres"))
        genre_stats: Dict[str, Any] = {}
        if genre_id != "unknown":
            genre_section = _ensure_dict(genres.get(genre_id))
            genre_stats = _ensure_dict(genre_section.get("feature_stats"))

        adjustments = compute_adjustments(track_features, genre_stats)

        readable_similar = []
        for item in similar:
            track_info = _ensure_dict(item.get("track"))
            readable_similar.append({
                "genre": item.get("genre"),
                "similarity": item.get("similarity"),
                "artist": track_info.get("artist"),
                "title": track_info.get("title"),
                "bpm": track_info.get("bpm"),
                "key": track_info.get("key"),
                "spotify_url": track_info.get("spotify_url"),
                "beatport_url": track_info.get("beatport_url"),
            })

        model_match = None
        if genre_model is not None:
            band_norm = {
                "sub": metrics_safe.get("sub_ratio"),
                "low": metrics_safe.get("low_ratio"),
                "lowmid": metrics_safe.get("lowmid_ratio"),
                "mid": metrics_safe.get("mid_ratio"),
                "presence": metrics_safe.get("presence_ratio"),
                "high": metrics_safe.get("high_ratio"),
                "air": metrics_safe.get("air_ratio"),
            }

            model_match = compute_model_match(
                band_norm=band_norm,
                extras=extras_safe,
                model=genre_model,
                lufs=metrics_safe.get("lufs_integrated"),
            )

        response = {
            "guessed_genre": genre_id,
            "genre_confidence": genre_conf,
            "similar_tracks": readable_similar,
            "adjustments": adjustments,
            "model_match": model_match,
        }

        if public_output:
            return {"adjustments": adjustments}

        return response
    except Exception as exc:
        return {"error": str(exc) or "evaluate_track_with_reference_error"}

