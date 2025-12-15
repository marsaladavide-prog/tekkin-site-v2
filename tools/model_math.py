import math
from typing import Any, Dict, Mapping, Optional

# Tipi base per chiarezza
BandNorm = Mapping[str, Any]
Extras = Mapping[str, Any]
ModelStats = Mapping[str, Any]


# Bande che ci aspettiamo in band_norm e nel modello
BAND_KEYS = (
    "sub",
    "low",
    "lowmid",
    "mid",
    "presence",
    "high",
    "air",
)

# Feature spettrali che ci aspettiamo in extras e nel modello
SPECTRAL_KEYS = (
    "spectral_centroid_hz",
    "spectral_rolloff_hz",
    "spectral_bandwidth_hz",
    "spectral_flatness",
    "zero_crossing_rate",
)

# Pesi di default per il calcolo della distanza combinata
DEFAULT_WEIGHTS: Dict[str, float] = {
    "bands": 0.5,
    "spectral": 0.3,
    "loudness": 0.1,
    "bpm": 0.1,
}

# Fattori di scala per portare le differenze su range comparabili
LOUDNESS_SCALE = 3.0  # 3 LU = 1 unita di distanza
BPM_SCALE = 5.0       # 5 BPM = 1 unita di distanza


def _coerce_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _rmse_from_squared(diffs_sq: list[float]) -> Optional[float]:
    """Calcola l'RMSE da una lista di differenze al quadrato."""
    if not diffs_sq:
        return None
    return math.sqrt(sum(diffs_sq) / len(diffs_sq))


def _squash_distance_to_match(distance: float) -> float:
    """
    Converte una distanza >= 0 in match percentuale 0 - 100.

    Formula: match = 100 * (1 / (1 + distance))
    - distance = 0  => 100
    - distance = 1  => 50
    - distance = 2  => 33.3
    - distance -> inf => 0
    """
    if distance < 0:
        distance = 0.0

    raw = 100.0 * (1.0 / (1.0 + distance))
    return max(0.0, min(100.0, raw))


def _normalized_diff(value: Any, stats: Mapping[str, Any]) -> Optional[float]:
    """
    Restituisce la differenza normalizzata rispetto alle mean/std di uno stat block.
    Se la std e' assente o zero, usa la differenza semplice.
    """
    if not isinstance(stats, Mapping):
        return None

    current = _coerce_float(value)
    mean = _coerce_float(stats.get("mean"))
    if current is None or mean is None:
        return None

    std = _coerce_float(stats.get("std"))
    diff = current - mean
    if std is None or std == 0.0:
        return diff
    return diff / std


def _extract_stat_block(model: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = model.get(key)
    if isinstance(value, Mapping):
        return value
    return {}


def compute_model_match(
    band_norm: BandNorm,
    extras: Extras,
    model: ModelStats,
    lufs: Optional[float] = None,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Optional[float]]:
    """
    Calcola quanto una traccia e' vicina al "centro" statistico del genere.

    Il modello deve contenere almeno:
    {
        "bands_norm_stats": {
            "sub": {"mean": float, "std": float},
            ...
        },
        "features_stats": {
            "spectral_centroid_hz": {"mean": float, "std": float},
            "bpm": {"mean": float, "std": float},
            "lufs": {"mean": float, "std": float},
            ...
        }
    }
    """
    w = weights or DEFAULT_WEIGHTS
    bands_norm_stats = _extract_stat_block(model, "bands_norm_stats")
    features_stats = _extract_stat_block(model, "features_stats")

    band_data = band_norm or {}
    extras_data = extras or {}

    # -------- 1) Bande (RMSE normalizzato) --------
    band_diffs_sq: list[float] = []
    for band in BAND_KEYS:
        stats = bands_norm_stats.get(band)
        if not isinstance(stats, Mapping):
            continue

        diff = _normalized_diff(band_data.get(band), stats)
        if diff is not None:
            band_diffs_sq.append(diff * diff)

    band_rmse = _rmse_from_squared(band_diffs_sq)

    # -------- 2) Feature spettro (RMSE normalizzato) --------
    spec_diffs_sq: list[float] = []
    for feature in SPECTRAL_KEYS:
        stats = features_stats.get(feature)
        if not isinstance(stats, Mapping):
            continue

        diff = _normalized_diff(extras_data.get(feature), stats)
        if diff is not None:
            spec_diffs_sq.append(diff * diff)

    spec_rmse = _rmse_from_squared(spec_diffs_sq)

    # -------- 3) Loudness / BPM --------
    loudness_stats = features_stats.get("lufs")
    lufs_mean = (
        _coerce_float(loudness_stats.get("mean"))
        if isinstance(loudness_stats, Mapping)
        else None
    )
    if lufs is not None and lufs_mean is not None:
        loudness_diff = abs(float(lufs) - lufs_mean)
    else:
        loudness_diff = None

    bpm_stats = features_stats.get("bpm")
    bpm_mean = (
        _coerce_float(bpm_stats.get("mean"))
        if isinstance(bpm_stats, Mapping)
        else None
    )
    bpm_value = _coerce_float(extras_data.get("bpm"))
    if bpm_mean is not None and bpm_value is not None:
        bpm_diff = abs(bpm_value - bpm_mean)
    else:
        bpm_diff = None

    # -------- 4) Combino in una distanza unica --------
    distance = 0.0
    weight_sum = 0.0

    if band_rmse is not None and w.get("bands", 0.0) > 0.0:
        distance += band_rmse * w["bands"]
        weight_sum += w["bands"]

    if spec_rmse is not None and w.get("spectral", 0.0) > 0.0:
        distance += spec_rmse * w["spectral"]
        weight_sum += w["spectral"]

    if loudness_diff is not None and w.get("loudness", 0.0) > 0.0:
        distance += (loudness_diff / LOUDNESS_SCALE) * w["loudness"]
        weight_sum += w["loudness"]

    if bpm_diff is not None and w.get("bpm", 0.0) > 0.0:
        distance += (bpm_diff / BPM_SCALE) * w["bpm"]
        weight_sum += w["bpm"]

    if weight_sum > 0.0:
        distance = distance / weight_sum
    else:
        distance = None

    # -------- 5) Match finale (0 - 100%) --------
    if distance is not None:
        match_percent = _squash_distance_to_match(distance)
    else:
        match_percent = None

    return {
        "band_rmse": band_rmse,
        "spec_rmse": spec_rmse,
        "loudness_diff": loudness_diff,
        "bpm_diff": bpm_diff,
        "distance": distance,
        "match_percent": match_percent,
    }
