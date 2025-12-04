import math
from typing import Dict, Any, Optional, Mapping

# Tipi base per chiarezza (non obbligatori ma aiutano a leggere il codice)
BandNorm = Mapping[str, float]
Extras = Mapping[str, Any]
ModelStats = Mapping[str, Any]


# Bande che ci aspettiamo in band_norm e nel modello (avg_{band}_ratio)
BAND_KEYS = (
    "sub",
    "low",
    "lowmid",
    "mid",
    "presence",
    "high",
    "air",
)

# Feature spettrali che ci aspettiamo in extras e nel modello (avg_{key})
SPECTRAL_KEYS = (
    "spectral_centroid_hz",
    "spectral_rolloff_hz",
    "spectral_bandwidth_hz",
    "spectral_flatness",
    "zero_crossing_rate",
)

# Pesi di default per il calcolo della distanza combinata
DEFAULT_WEIGHTS = {
    "bands": 0.5,
    "spectral": 0.3,
    "loudness": 0.1,
    "bpm": 0.1,
}

# Fattori di scala per portare le differenze su range più "compatibili"
# Questi sono iperparametri: se in futuro vedi match troppo alti/bassi,
# si sistemano qui senza toccare il resto del codice.
LOUDNESS_SCALE = 3.0  # 3 LU = 1 unità di distanza
BPM_SCALE = 5.0       # 5 BPM = 1 unità di distanza


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
    # Clamp per sicurezza
    if raw < 0.0:
        return 0.0
    if raw > 100.0:
        return 100.0
    return raw


def compute_model_match(
    band_norm: BandNorm,
    extras: Extras,
    model: ModelStats,
    lufs: Optional[float] = None,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Calcola quanto una traccia assomiglia a un modello Tekkin.

    Parametri
    ---------
    band_norm:
        Dizionario con le bande normalizzate in dB/RMS/ratio, es:
        { "sub": 0.9, "low": 1.1, ... } già portate su base "profilo".
    extras:
        Dizionario dei metadati extra del Tekkin Analyzer, contenente ad es.:
        - "bpm"
        - "spectral_centroid_hz"
        - "spectral_rolloff_hz"
        - "spectral_bandwidth_hz"
        - "spectral_flatness"
        - "zero_crossing_rate"
    model:
        Statistiche medie del modello target, tipicamente derivate da
        molte tracce di riferimento. Es:
        - "avg_lufs"
        - "avg_bpm"
        - "avg_sub_ratio", "avg_low_ratio", ...
        - "avg_spectral_centroid_hz", ecc.
    lufs:
        LUFS integrato della traccia corrente.
    weights:
        Pesi opzionali per combinare le parti:
        {
            "bands": float,
            "spectral": float,
            "loudness": float,
            "bpm": float,
        }
        Se None, usa DEFAULT_WEIGHTS.

    Ritorna
    -------
    dict con:
        - band_rmse: float | None
        - spec_rmse: float | None
        - loudness_diff: float | None
        - bpm_diff: float | None
        - distance: float | None
        - match_percent: float | None
    """
    w = weights or DEFAULT_WEIGHTS

    # -------- 1) Bande (RMSE) --------
    band_diffs_sq: list[float] = []

    for b in BAND_KEYS:
        v = band_norm.get(b)
        avg_v = model.get(f"avg_{b}_ratio")
        if v is None or avg_v is None:
            continue

        v_f = float(v)
        avg_f = float(avg_v)
        diff = v_f - avg_f
        band_diffs_sq.append(diff * diff)

    band_rmse = _rmse_from_squared(band_diffs_sq)

    # -------- 2) Feature spettro (RMSE con normalizzazione Hz) --------
    spec_diffs_sq: list[float] = []

    for k in SPECTRAL_KEYS:
        v = extras.get(k)
        avg_v = model.get(f"avg_{k}")
        if v is None or avg_v is None:
            continue

        v_f = float(v)
        avg_f = float(avg_v)

        # Normalizzazione per valori in Hz, così confrontiamo rapporti
        if k.endswith("_hz") and avg_f != 0.0:
            v_norm = v_f / avg_f
            diff = v_norm - 1.0
        else:
            diff = v_f - avg_f

        spec_diffs_sq.append(diff * diff)

    spec_rmse = _rmse_from_squared(spec_diffs_sq)

    # -------- 3) Loudness / BPM --------
    if lufs is not None and model.get("avg_lufs") is not None:
        loudness_diff = abs(float(lufs) - float(model["avg_lufs"]))
    else:
        loudness_diff = None

    if model.get("avg_bpm") is not None and extras.get("bpm") is not None:
        bpm_diff = abs(float(extras["bpm"]) - float(model["avg_bpm"]))
    else:
        bpm_diff = None

    # -------- 4) Combino in una distanza unica --------
    distance = 0.0
    weight_sum = 0.0

    # Bande
    if band_rmse is not None and w.get("bands", 0.0) > 0.0:
        distance += band_rmse * w["bands"]
        weight_sum += w["bands"]

    # Spettro
    if spec_rmse is not None and w.get("spectral", 0.0) > 0.0:
        distance += spec_rmse * w["spectral"]
        weight_sum += w["spectral"]

    # Loudness
    if loudness_diff is not None and w.get("loudness", 0.0) > 0.0:
        distance += (loudness_diff / LOUDNESS_SCALE) * w["loudness"]
        weight_sum += w["loudness"]

    # BPM
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
