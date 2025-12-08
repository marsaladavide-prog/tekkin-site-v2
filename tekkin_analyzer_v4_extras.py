from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple, Union

import librosa
import numpy as np


N_FFT = 4096
HOP_LENGTH = 1024
ONSET_HOP = 512
STEREO_BANDS = [
    ("low", 20, 120),
    ("mid", 120, 3000),
    ("high", 3000, 16000),
]
SPECTRAL_BANDS = [
    ("low", 20, 120),
    ("lowmid", 120, 400),
    ("mid", 400, 2000),
    ("high", 2000, 10000),
    ("air", 10000, 16000),
]
DANCE_TARGET_BPM = 128.0
def _db_from_power(value: float) -> float:
    """Convertiamo energia (potenza) in dB evitando log(0)."""
    return 10.0 * math.log10(max(value, 1e-12))


def _build_stft_power(
    y: np.ndarray,
    sr: int,
    n_fft: int = N_FFT,
    hop_length: int = HOP_LENGTH,
) -> Tuple[np.ndarray, np.ndarray]:
    """Calcola lo STFT e restituisce la potenza media per frequenza."""
    if y.size == 0:
        return np.zeros(0), np.zeros(0)
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length, window="hann"))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)
    power = S**2
    return power, freqs


def _normalize_vector(v: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(v)
    if norm == 0:
        return v
    return v / norm


def _rotate_profile(profile: np.ndarray, steps: int) -> np.ndarray:
    return np.roll(profile, steps)


def _trim_to_signal(y: np.ndarray, top_db: float = 60.0) -> np.ndarray:
    if y.size == 0:
        return y
    trimmed, _ = librosa.effects.trim(y.astype(np.float32, copy=False), top_db=top_db)
    return trimmed if trimmed.size > 0 else y


def _bounded_confidence(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def _tempo_from_autocorrelation(
    y: np.ndarray, sr: int, hop_length: int = ONSET_HOP
) -> Union[float, None]:
    if y.size == 0 or sr <= 0:
        return None
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    if onset_env.size < 4:
        return None
    ac = librosa.autocorrelate(onset_env, max_size=len(onset_env))
    if ac.size < 4:
        return None
    min_lag = max(1, int((sr / hop_length) * 60.0 / 160.0))
    max_lag = min(len(ac) - 1, int((sr / hop_length) * 60.0 / 72.0))
    if min_lag >= max_lag:
        return None
    segment = ac[min_lag : max_lag + 1]
    if segment.size == 0:
        return None
    best_idx = int(np.argmax(segment))
    best_lag = min_lag + best_idx
    if best_lag == 0:
        return None
    return 60.0 * sr / (best_lag * hop_length)

def _select_tempo_candidate(
    candidates: List[Union[float, None]]
) -> Union[float, None]:
    """
    Sceglie il BPM combinando i candidati in modo robusto.

    - Filtra i None e i valori non positivi.
    - Se i candidati sono vicini tra loro (es. 129 e 130),
      fa la media e poi estimate_bpm li arrotonderà all'intero.
    - Altrimenti usa la mediana, che è piu robusta a outlier.
    """
    valid = [c for c in candidates if c is not None and c > 0]
    if not valid:
        return None

    valid_arr = np.array(valid, dtype=float)

    # Se la differenza tra minimo e massimo è piccola, uso la media
    if valid_arr.size >= 2 and (valid_arr.max() - valid_arr.min()) <= 1.5:
        return float(valid_arr.mean())

    # Altrimenti uso la mediana
    return float(np.median(valid_arr))



def estimate_bpm(
    y: np.ndarray, sr: int, max_duration_seconds: float = 240.0
) -> Tuple[Union[float, None], float]:
    if y.size == 0 or sr <= 0:
        return None, 0.0

    max_samples = int(max_duration_seconds * sr)
    y_for_bpm = y if y.size <= max_samples else y[:max_samples]
    y_trimmed = _trim_to_signal(y_for_bpm, top_db=60.0)
    if y_trimmed.size == 0:
        y_trimmed = y_for_bpm

    total_seconds = max(1.0, len(y_trimmed) / sr)

    tempo, beats = librosa.beat.beat_track(y=y_trimmed, sr=sr, trim=False)
    tempo_librosa = float(tempo) if tempo > 0 else None
    if tempo_librosa is not None and tempo_librosa < 90:
        tempo_librosa *= 2.0

    autocorr_tempo = _tempo_from_autocorrelation(y_trimmed, sr)
    bpm_candidate = _select_tempo_candidate([tempo_librosa, autocorr_tempo])
    if bpm_candidate is None or bpm_candidate <= 0:
        return None, 0.0

    final_bpm = int(round(bpm_candidate))
    beat_density = len(beats) / total_seconds if total_seconds > 0 else 0.0
    confidence = _bounded_confidence(min(1.0, beat_density / 2.5 + 0.1))
    return float(final_bpm), confidence


def compute_spectral_features(y: np.ndarray, sr: int) -> Tuple[Dict[str, float], Dict[str, Any]]:
    if y.size == 0 or sr <= 0:
        base = {
            "spectral_centroid_hz": 0.0,
            "spectral_rolloff_hz": 0.0,
            "spectral_bandwidth_hz": 0.0,
            "spectral_flatness": 0.0,
            "zero_crossing_rate": 0.0,
            "low_db": -120.0,
            "lowmid_db": -120.0,
            "mid_db": -120.0,
            "high_db": -120.0,
            "air_db": -120.0,
        }
        return base, {"power": np.zeros(0), "freqs": np.zeros(0)}

    power, freqs = _build_stft_power(y, sr)
    mag = np.mean(np.sqrt(power), axis=1) + 1e-12
    mag_sum = float(np.sum(mag))

    if mag_sum > 0:
        centroid = float(np.sum(freqs * mag) / mag_sum)
    else:
        centroid = 0.0

    cum = np.cumsum(mag)
    thresh = 0.95 * mag_sum
    idx_roll = np.searchsorted(cum, thresh)
    if idx_roll >= freqs.size:
        idx_roll = freqs.size - 1

    rolloff = float(freqs[idx_roll]) if freqs.size > 0 else 0.0

    if mag_sum > 0:
        bandwidth = float(math.sqrt(np.sum(((freqs - centroid) ** 2) * mag) / mag_sum))
    else:
        bandwidth = 0.0

    log_mag = np.log(mag)
    g_mean = float(np.exp(np.mean(log_mag)))
    a_mean = float(np.mean(mag))
    flatness = float(g_mean / (a_mean + 1e-12))
    zc = np.mean(y[1:] * y[:-1] < 0.0)

    bands = SPECTRAL_BANDS

    band_energy: Dict[str, float] = {}
    power_db = 10.0 * np.log10(power + 1e-12)
    for label, fmin, fmax in bands:
        mask = (freqs >= fmin) & (freqs < fmax)
        if not np.any(mask):
            band_energy[label] = -120.0
            continue
        band_energy[label] = float(np.mean(power_db[mask]))

    return (
        {
            "spectral_centroid_hz": round(centroid, 2),
            "spectral_rolloff_hz": round(rolloff, 2),
            "spectral_bandwidth_hz": round(bandwidth, 2),
            "spectral_flatness": round(flatness, 4),
            "zero_crossing_rate": round(float(zc), 4),
            "low_db": round(band_energy["low"], 2),
            "lowmid_db": round(band_energy["lowmid"], 2),
            "mid_db": round(band_energy["mid"], 2),
            "high_db": round(band_energy["high"], 2),
            "air_db": round(band_energy["air"], 2),
        },
        {"power": power, "freqs": freqs},
    )


def detect_key(y: np.ndarray, sr: int) -> Tuple[Union[str, None], float]:
    if y.size == 0 or sr <= 0:
        return None, 0.0

    hop_length = 2048
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    if chroma.size == 0:
        return None, 0.0

    rms_energy = librosa.feature.rms(y=y, frame_length=4096, hop_length=hop_length)[0]
    mask = rms_energy > 1e-7
    if not np.any(mask):
        return None, 0.0

    chroma_trimmed = chroma[:, mask]
    if chroma_trimmed.size == 0:
        return None, 0.0

    chroma_mean = np.mean(chroma_trimmed, axis=1)
    if not np.any(chroma_mean > 0):
        return None, 0.0

    chroma_norm = _normalize_vector(chroma_mean)
    major_template = np.array(
        [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
        dtype=float,
    )
    minor_template = np.array(
        [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
        dtype=float,
    )

    best_score = -1.0
    best_key: Union[str, None] = None
    notes = [
        "C",
        "C#",
        "D",
        "D#",
        "E",
        "F",
        "F#",
        "G",
        "G#",
        "A",
        "A#",
        "B",
    ]

    for idx in range(12):
        major_profile = _normalize_vector(_rotate_profile(major_template, idx))
        minor_profile = _normalize_vector(_rotate_profile(minor_template, idx))
        major_score = float(np.dot(chroma_norm, major_profile))
        minor_score = float(np.dot(chroma_norm, minor_profile))
        if major_score > best_score:
            best_score = major_score
            best_key = f"{notes[idx]}maj"
        if minor_score > best_score:
            best_score = minor_score
            best_key = f"{notes[idx]}min"

    confidence = _bounded_confidence(best_score)
    return best_key, confidence


def _compute_crest_factor(y: np.ndarray) -> float:
    if y.size == 0:
        return 0.0
    peak = float(np.max(np.abs(y))) + 1e-12
    rms = math.sqrt(float(np.mean(y**2))) + 1e-12
    return 20.0 * math.log10(peak / rms)


def _compute_band_rms(
    signal: np.ndarray,
    sr: int,
    fmin: float,
    fmax: float,
    n_fft: int = N_FFT,
    hop_length: int = HOP_LENGTH,
) -> float:
    power, freqs = _build_stft_power(signal, sr, n_fft=n_fft, hop_length=hop_length)
    mask = (freqs >= fmin) & (freqs < fmax)
    if not np.any(mask):
        return 0.0
    band_power = float(np.mean(power[mask]))
    return math.sqrt(max(band_power, 1e-18))


def _width_db(side_rms: float, mid_rms: float) -> float:
    eps = 1e-6
    ratio = max(side_rms, eps) / max(mid_rms, eps)
    width = 20.0 * math.log10(ratio)
    return float(max(-40.0, min(6.0, width)))


def _build_stereo_width(y_stereo: np.ndarray, sr: int) -> Dict[str, Any]:
    if y_stereo.ndim < 2 or y_stereo.shape[1] == 0:
        mono = y_stereo if y_stereo.ndim == 1 else y_stereo[0]
        return {
            "is_mono": True,
            "global_correlation": 1.0,
            "lr_balance_db": 0.0,
            "band_widths_db": {"low": 0.0, "mid": 0.0, "high": 0.0},
        }

    left, right = y_stereo[0], y_stereo[1]
    min_len = min(len(left), len(right))
    left = left[:min_len]
    right = right[:min_len]

    corr_num = float(np.sum(left * right))
    corr_den = math.sqrt(float(np.sum(left**2) * np.sum(right**2))) + 1e-12
    global_corr = corr_num / corr_den if corr_den > 0 else 0.0

    mid = (left + right) * 0.5
    side = (left - right) * 0.5

    band_widths: Dict[str, float] = {}
    total_side_energy = 0.0
    for label, fmin, fmax in STEREO_BANDS:
        mid_rms = _compute_band_rms(mid, sr, fmin, fmax)
        side_rms = _compute_band_rms(side, sr, fmin, fmax)
        band_widths[label] = round(_width_db(side_rms, mid_rms), 2)
        total_side_energy += side_rms

    left_rms = math.sqrt(float(np.mean(left**2)) + 1e-12)
    right_rms = math.sqrt(float(np.mean(right**2)) + 1e-12)
    lr_balance_db = 20.0 * math.log10((left_rms + 1e-6) / (right_rms + 1e-6))
    is_mono = total_side_energy < 1e-3

    return {
        "is_mono": is_mono,
        "global_correlation": round(global_corr, 3),
        "lr_balance_db": round(lr_balance_db, 2),
        "band_widths_db": band_widths,
    }


def _build_warnings(
    duration: float,
    y: np.ndarray,
    spectral_flatness: float,
    crest_db: float,
    stereo_width: Dict[str, Any],
    loudness_stats: dict[str, float] | None = None,
) -> List[Dict[str, Union[str, float]]]:
    warnings: List[Dict[str, Union[str, float]]] = []
    max_amp = float(np.max(np.abs(y))) if y.size else 0.0

    if duration > 0 and duration < 15:
        warnings.append(
            {
                "code": "short_audio",
                "message": "Traccia molto breve (meno di 15 secondi): alcuni algoritmi possono essere instabili.",
                "severity": "warning",
            }
        )

    if max_amp < 0.05:
        warnings.append(
            {
                "code": "low_level",
                "message": "Livello medio del file molto basso: normalizza prima dell'analisi.",
                "severity": "warning",
            }
        )

    if spectral_flatness > 0.7:
        warnings.append(
            {
                "code": "noisy_mix",
                "message": "Elevata flatness spettrale: la traccia sembra molto rumorosa/non tonale.",
                "severity": "warning",
            }
        )

    if loudness_stats:
        short_min = loudness_stats.get("short_lufs_min")
        short_max = loudness_stats.get("short_lufs_max")
        if short_min is not None and short_max is not None:
            lra = short_max - short_min
            if lra < 1.0:
                warnings.append(
                    {
                        "code": "dynamics_compressed",
                        "message": "LRA molto basso: il mix è molto compresso e i transienti sono piatti.",
                        "severity": "warning",
                    }
                )
        short_std = loudness_stats.get("short_lufs_std")
        if short_std is not None and short_std < 0.1:
            warnings.append(
                {
                    "code": "dynamics_flat",
                    "message": "La deviazione standard dei short-term è molto bassa: manca movimento dinamico.",
                    "severity": "info",
                }
            )

    if crest_db > 20:
        warnings.append(
            {
                "code": "high_crest",
                "message": "Crest factor molto alto: potrebbe esserci troppa dinamica o clipping isolato.",
                "severity": "warning",
            }
        )

    if total_width := stereo_width.get("band_widths_db"):
        for band, value in total_width.items():
            if value > 6:
                warnings.append(
                    {
                        "code": f"{band}_too_wide",
                        "message": f"{band.capitalize()} troppo spazioso: valuta di contenere lo stereo per club.",
                        "severity": "warning",
                    }
                )
            elif value < -4 and band != "high":
                warnings.append(
                    {
                        "code": f"{band}_too_mono",
                        "message": f"{band.capitalize()} troppo mono: potresti perdere energia in sistemi stereo.",
                        "severity": "info",
                    }
                )

    lr_balance = abs(stereo_width.get("lr_balance_db", 0.0))
    if lr_balance > 4:
        warnings.append(
            {
                "code": "lr_imbalance",
                "message": "Bilanciamento L/R sbilanciato: la traccia potrebbe suonare spostata su un lato.",
                "severity": "warning",
            }
        )

    if len(warnings) == 0:
        warnings.append(
            {
                "code": "analysis_clean",
                "message": "L'audio sembra stabile e pronto per essere comparato.",
                "severity": "info",
            }
        )

    return warnings


def analyze_v4_extras(
    y_mono: np.ndarray,
    y_stereo: np.ndarray,
    sr: int,
    loudness_stats: dict[str, float] | None = None,
) -> Dict[str, Any]:
    duration = float(len(y_mono) / sr) if sr > 0 else 0.0

    mid_signal = y_mono
    if y_stereo.ndim == 2:
        left, right = y_stereo[0], y_stereo[1]
        min_len = min(left.size, right.size)
        left = left[:min_len]
        right = right[:min_len]
        mid_signal = (left + right) * 0.5

    bpm_value, bpm_confidence = estimate_bpm(mid_signal, sr)
    spectral_features, _ = compute_spectral_features(y_mono, sr)
    key_value, key_confidence = detect_key(mid_signal, sr)
    crest_db = _compute_crest_factor(y_mono)
    stereo_width = _build_stereo_width(y_stereo, sr)
    spectral_confidence = _bounded_confidence(1.0 - spectral_features["spectral_flatness"])

    band_ratios = stereo_width.get("band_widths_ratio", {})
    avg_ratio = (
        sum(band_ratios.values()) / len(band_ratios)
        if band_ratios
        else 0.0
    )

    # Un avg_ratio intorno a 0.2 - 0.3 è normale per minimal / tech
    width_score = _bounded_confidence(avg_ratio / 0.35)

    corr = float(stereo_width.get("global_correlation", 0.0))
    # Correlazione molto vicina a 1 abbassa un po' la confidence
    corr_score = _bounded_confidence(1.0 - max(0.0, corr - 0.1))

    stereo_confidence = _bounded_confidence(0.6 * width_score + 0.4 * corr_score)


    target_lufs = -8.5
    integrated_lufs = loudness_stats.get("integrated_lufs") if loudness_stats else None
    if integrated_lufs is not None:
        loudness_confidence = _bounded_confidence(
            1.0
            - min(1.0, abs(integrated_lufs - target_lufs) / 8.0)
        )
    else:
        loudness_confidence = 0.5

    warnings = _build_warnings(
        duration=duration,
        y=y_mono,
        spectral_flatness=spectral_features["spectral_flatness"],
        crest_db=crest_db,
        stereo_width=stereo_width,
        loudness_stats=loudness_stats,
    )

    harmonic_tilt = spectral_features["lowmid_db"] - spectral_features["high_db"]
    low_end_coherence = max(
        0.0,
        1.0
        - min(
            1.0,
            abs(spectral_features["low_db"] - spectral_features["lowmid_db"]) / 12.0,
        ),
    )
    hi_end_diff = spectral_features["high_db"] - spectral_features["air_db"]
    hi_end_harshness = max(
        0.0,
        min(
            1.0,
            (hi_end_diff / 8.0) + (spectral_features["spectral_flatness"] * 0.4),
        ),
    )

    short_min = loudness_stats.get("short_lufs_min") if loudness_stats else None
    short_max = loudness_stats.get("short_lufs_max") if loudness_stats else None
    short_std = loudness_stats.get("short_lufs_std") if loudness_stats else None
    lra = max(0.0, (short_max - short_min) if short_min is not None and short_max is not None else 0.0)
    dynamics_score = 0.5
    if short_min is not None and short_max is not None:
        dynamics_score = max(0.0, 1.0 - min(1.0, abs(lra - 7.5) / 8.0))
    if short_std is not None and short_std < 0.25:
        dynamics_score *= max(0.0, short_std / 0.25)
    dynamics_score = _bounded_confidence(dynamics_score)
    dynamics_obj = {
        "score": round(dynamics_score * 100.0, 1),
        "lra": round(lra, 2),
        "short_term_std": round(short_std or 0.0, 2),
        "crest_factor_db": round(crest_db, 2),
    }

    loudness_stats_output: dict[str, Union[float, None]] = {}
    if loudness_stats:
        for key, value in loudness_stats.items():
            if value is None:
                loudness_stats_output[key] = None
            else:
                loudness_stats_output[key] = round(float(value), 3)

    harmonic_balance = {
        "tilt_db": round(harmonic_tilt, 2),
        "low_end_definition": round(low_end_coherence * 100.0, 1),
        "hi_end_harshness": round(hi_end_harshness * 100.0, 1),
    }

    return {
        "duration_seconds": duration,
        "bpm": bpm_value,
        "bpm_confidence": bpm_confidence,
        "key": key_value,
        "key_confidence": key_confidence,
        "spectral": spectral_features,
        "spectral_centroid_hz": spectral_features["spectral_centroid_hz"],
        "spectral_rolloff_hz": spectral_features["spectral_rolloff_hz"],
        "spectral_bandwidth_hz": spectral_features["spectral_bandwidth_hz"],
        "spectral_flatness": spectral_features["spectral_flatness"],
        "zero_crossing_rate": spectral_features["zero_crossing_rate"],
        "spectral_low_db": spectral_features["low_db"],
        "spectral_lowmid_db": spectral_features["lowmid_db"],
        "spectral_mid_db": spectral_features["mid_db"],
        "spectral_high_db": spectral_features["high_db"],
        "spectral_air_db": spectral_features["air_db"],
        "harmonic_balance": harmonic_balance,
        "stereo_width": stereo_width,
        "dynamics": dynamics_obj,
        "loudness_stats": loudness_stats_output or None,
        "confidence": {
            "bpm": bpm_confidence,
            "key": key_confidence,
            "lufs": loudness_confidence,
            "spectral": spectral_confidence,
            "stereo": stereo_confidence,
        },
        "warnings": warnings,
    }
