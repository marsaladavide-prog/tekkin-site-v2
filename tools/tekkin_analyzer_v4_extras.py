from __future__ import annotations

import logging
import math
import os
from typing import Any, Dict, List, Union

import numpy as np

# -----------------------------------------------------------------------------
# Optional Essentia
# -----------------------------------------------------------------------------
_DEBUG = os.environ.get("TEKKIN_ANALYZER_DEBUG", "").strip().lower() in ("1", "true", "yes")
_LOGGER = logging.getLogger("tekkin-analyzer-v4")


def _log(msg: str) -> None:
    if _DEBUG:
        _LOGGER.debug(msg)


try:
    import essentia  # type: ignore
    import essentia.standard as es  # type: ignore

    _ESSENTIA_AVAILABLE: bool = True
    _log(f"[PY-ANALYZER] Essentia IMPORTED: {getattr(essentia, '__version__', 'unknown')}")
except Exception as exc:  # pragma: no cover
    essentia = None
    es = None
    _ESSENTIA_AVAILABLE = False
    _log(f"[PY-ANALYZER] Essentia NOT AVAILABLE: {exc}")

# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------
N_FFT = 4096
HOP_LENGTH = 1024

MAX_ANALYSIS_SECONDS = 240.0

# Stereo width thresholds (dB)
WIDTH_TOO_WIDE_DB = 7.0
WIDTH_TOO_MONO_DB = -4.0

# Stereo width: bands that matter for club translation
STEREO_BANDS = [
    ("low", 20.0, 120.0),
    ("mid", 120.0, 3000.0),
    ("high", 3000.0, 16000.0),
]

# Spectral bands for energy balance (legacy UI)
SPECTRAL_BANDS = [
    ("low", 20.0, 120.0),
    ("lowmid", 120.0, 400.0),
    ("mid", 400.0, 2000.0),
    ("high", 2000.0, 10000.0),
    ("air", 10000.0, 16000.0),
]

# Bands schema v2 (coerente con reference models)
BAND_DEFS_V2 = [
    ("sub", 30.0, 60.0),
    ("low", 60.0, 150.0),
    ("lowmid", 150.0, 400.0),
    ("mid", 400.0, 2000.0),
    ("presence", 2000.0, 5000.0),
    ("high", 5000.0, 10000.0),
    ("air", 10000.0, 16000.0),
]

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def _bounded_confidence(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def _trim_to_max_duration(signal: np.ndarray, sr: int, max_seconds: float) -> np.ndarray:
    if signal.size == 0 or sr <= 0:
        return signal
    max_samples = int(max_seconds * sr)
    if max_samples <= 0:
        return signal
    return signal if signal.size <= max_samples else signal[:max_samples]


def _zero_crossing_rate(signal: np.ndarray) -> float:
    if signal.size < 2:
        return 0.0
    crossings = np.sum(signal[:-1] * signal[1:] < 0)
    return float(crossings) / max(1, signal.size - 1)


def _compute_crest_factor(signal: np.ndarray) -> float:
    if signal.size == 0:
        return 0.0
    peak = float(np.max(np.abs(signal))) + 1e-12
    rms = math.sqrt(float(np.mean(signal**2))) + 1e-12
    return 20.0 * math.log10(peak / rms)


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _sequence_to_float_list(value: Any) -> list[float] | None:
    if value is None:
        return None
    try:
        array = np.asarray(value, dtype=float)
    except Exception:
        return None
    if array.size == 0:
        return None
    return [float(x) for x in array]


def _float_stats(arr: Any) -> dict[str, float | None]:
    defaults = {"mean": None, "min": None, "max": None, "std": None}
    if arr is None:
        return defaults.copy()
    try:
        a = np.asarray(arr, dtype=np.float32)
    except Exception:
        return defaults.copy()
    if a.size == 0:
        return defaults.copy()
    return {
        "mean": float(np.mean(a)),
        "min": float(np.min(a)),
        "max": float(np.max(a)),
        "std": float(np.std(a)),
    }


def _prepare_stereo_signal(y_stereo: np.ndarray | None, y_mono: np.ndarray) -> np.ndarray:
    """
    Returns shape (2, N) float32.
    """
    if y_stereo is None:
        mono = np.asarray(y_mono, dtype=np.float32)
        return np.stack([mono, mono], axis=0)

    arr = np.asarray(y_stereo, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr[np.newaxis, :]

    if arr.shape[0] == 1:
        arr = np.vstack([arr[0], arr[0]])
    elif arr.shape[0] > 2:
        arr = arr[:2]

    left, right = arr[0], arr[1]
    min_len = min(left.shape[0], right.shape[0])
    return np.stack([left[:min_len], right[:min_len]], axis=0)


def _db_to_energy(db_val: float | None) -> float:
    if db_val is None or (not math.isfinite(db_val)):
        return 0.0
    return float(10 ** (db_val / 10.0))


def _bands_db_to_norm(bands_db: Dict[str, float]) -> Dict[str, float]:
    energies = {k: _db_to_energy(v) for k, v in bands_db.items()}
    total = float(sum(energies.values())) + 1e-12
    out = {k: float(v / total) for k, v in energies.items()}
    for k, _, _ in BAND_DEFS_V2:
        out.setdefault(k, 0.0)
    return out


# -----------------------------------------------------------------------------
# Efficient STFT power for band computations (NumPy)
# -----------------------------------------------------------------------------
def _stft_power_mean(
    signal: np.ndarray,
    sr: int,
    n_fft: int = N_FFT,
    hop: int = HOP_LENGTH,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns (freqs_hz, mean_power_db_per_bin)
    - Uses Hann window
    - Computes mean power across frames
    """
    if signal.size == 0 or sr <= 0:
        freqs = np.linspace(0.0, float(sr) / 2.0, n_fft // 2 + 1)
        return freqs, np.full(freqs.shape, -120.0, dtype=np.float32)

    x = np.asarray(signal, dtype=np.float32)
    if x.size < n_fft:
        x = np.pad(x, (0, n_fft - x.size), mode="constant")

    window = np.hanning(n_fft).astype(np.float32)

    n_frames = 1 + max(0, (x.size - n_fft) // hop)
    if n_frames <= 0:
        n_frames = 1

    power_accum = np.zeros((n_fft // 2 + 1,), dtype=np.float64)
    eps = 1e-12

    for i in range(n_frames):
        start = i * hop
        frame = x[start : start + n_fft]
        if frame.size < n_fft:
            frame = np.pad(frame, (0, n_fft - frame.size), mode="constant")
        spec = np.fft.rfft(frame * window)
        mag = np.abs(spec).astype(np.float64)
        power_accum += mag * mag

    power_mean = power_accum / float(n_frames)
    power_db = 10.0 * np.log10(power_mean + eps)

    freqs = np.fft.rfftfreq(n_fft, d=1.0 / float(sr)).astype(np.float32)
    return freqs, power_db.astype(np.float32)


def _band_mean_db(freqs: np.ndarray, power_db: np.ndarray, fmin: float, fmax: float) -> float:
    mask = (freqs >= fmin) & (freqs < fmax)
    if not np.any(mask):
        return -120.0
    return float(np.mean(power_db[mask]))


def _width_db_from_band_db(side_db: float, mid_db: float) -> float:
    width = side_db - mid_db
    return float(max(-40.0, min(20.0, width)))


def _compute_bands_v2_numpy(signal: np.ndarray, sr: int) -> tuple[Dict[str, float], Dict[str, float]]:
    freqs, power_db = _stft_power_mean(signal, sr, n_fft=N_FFT, hop=HOP_LENGTH)

    band_values_v2: Dict[str, float] = {}
    for label, fmin, fmax in BAND_DEFS_V2:
        band_values_v2[label] = _band_mean_db(freqs, power_db, fmin, fmax)

    bands_db_v2 = {k: round(float(v), 2) for k, v in band_values_v2.items()}
    band_norm_v2 = _bands_db_to_norm(bands_db_v2)
    band_norm_v2_rounded = {k: round(float(v), 6) for k, v in band_norm_v2.items()}
    return bands_db_v2, band_norm_v2_rounded


# -----------------------------------------------------------------------------
# Blocks
# -----------------------------------------------------------------------------
def _default_rhythm_block() -> Dict[str, Any]:
    return {"bpm": None, "bpm_conf": None, "beats": None, "tempo_curve": None}


def _default_tonal_block() -> Dict[str, Any]:
    return {"key": None, "scale": None, "key_conf": None, "tonal_strength": None, "hpcp_stats": None}


def _default_loudness_block() -> Dict[str, Any]:
    return {
        "integrated_lufs": None,
        "lra": None,
        "momentary_lufs": None,
        "short_term_lufs": None,
        "momentary_stats": None,
        "short_term_stats": None,
        "true_peak_db": None,
        "short_lufs_min": None,
        "short_lufs_max": None,
        "short_lufs_std": None,
        "short_lufs_mean": None,
    }


def _default_spectral_block(signal: np.ndarray) -> Dict[str, Any]:
    # bands_db/band_norm sempre presenti almeno come fallback numpy in analyze_v4_extras
    return {
        "centroid_hz": None,
        "rolloff_hz": None,
        "bandwidth_hz": None,
        "flatness": None,
        "mfcc_mean": None,
        "mfcc_std": None,
        "low_db": None,
        "lowmid_db": None,
        "mid_db": None,
        "high_db": None,
        "air_db": None,
        "zero_crossing_rate": _zero_crossing_rate(signal),
        "crest_factor_db": None,
        "bands_db": None,
        "band_norm": None,
    }


# -----------------------------------------------------------------------------
# Essentia extractors
# -----------------------------------------------------------------------------
def _extract_rhythm_block(signal: np.ndarray, sr: int) -> Dict[str, Any]:
    block = _default_rhythm_block()
    if es is None or signal.size == 0 or sr <= 0:
        return block

    trimmed = _trim_to_max_duration(signal, sr, MAX_ANALYSIS_SECONDS)
    rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
    result = rhythm_extractor(trimmed)

    bpm_value = _safe_float(result[0]) if len(result) > 0 else None
    if bpm_value is not None and bpm_value > 0:
        block["bpm"] = float(bpm_value)

    conf_raw = _safe_float(result[2]) if len(result) > 2 else None
    block["bpm_conf"] = _bounded_confidence((conf_raw / 5.0) if conf_raw is not None else 0.0)

    block["beats"] = _sequence_to_float_list(result[1]) if len(result) > 1 else None
    block["tempo_curve"] = _sequence_to_float_list(result[3]) if len(result) > 3 else None
    return block


def _collect_hpcp_stats(signal: np.ndarray, sr: int) -> dict[str, list[float]] | None:
    if es is None or signal.size == 0 or sr <= 0:
        return None

    freq_bins = np.linspace(0, sr / 2, N_FFT // 2 + 1).astype(np.float32)
    hpcp_algo = es.HPCP(sampleRate=sr, size=12)
    windowing = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=N_FFT)

    collected: List[np.ndarray] = []
    for frame in es.FrameGenerator(signal, frameSize=N_FFT, hopSize=HOP_LENGTH):
        frame_arr = np.asarray(frame, dtype=np.float32)
        if frame_arr.size < N_FFT:
            frame_arr = np.pad(frame_arr, (0, N_FFT - frame_arr.size))
        mag = np.asarray(spectrum(windowing(frame_arr)), dtype=np.float32)
        if mag.size != freq_bins.size:
            continue
        raw = hpcp_algo(mag, freq_bins)
        arr = np.asarray(raw, dtype=np.float32)
        if arr.size == 0:
            continue
        collected.append(arr)

    if not collected:
        return None

    stack = np.vstack(collected)
    return {
        "mean": [float(v) for v in stack.mean(axis=0)],
        "std": [float(v) for v in stack.std(axis=0)],
    }


def _extract_tonal_block(signal: np.ndarray, sr: int) -> Dict[str, Any]:
    block = _default_tonal_block()
    if es is None or signal.size == 0 or sr <= 0:
        return block

    key_extractor = es.KeyExtractor()
    key, scale, strength = key_extractor(signal)
    if not key:
        return block

    scale_label = (scale or "").lower()
    key_suffix = "maj" if scale_label.startswith("maj") else "min"
    block["key"] = f"{key}{key_suffix}"
    block["scale"] = scale

    if strength is not None:
        block["key_conf"] = _bounded_confidence(float(strength))
        block["tonal_strength"] = float(strength)

    block["hpcp_stats"] = _collect_hpcp_stats(signal, sr)
    return block


def _extract_loudness_block(signal: np.ndarray, sr: int, stereo_signal: np.ndarray | None = None) -> Dict[str, Any]:
    block = _default_loudness_block()
    if es is None or signal.size == 0 or sr <= 0:
        return block

    trimmed = _trim_to_max_duration(signal, sr, MAX_ANALYSIS_SECONDS).astype(np.float32, copy=False)

    ebu = es.LoudnessEBUR128(sampleRate=sr)
    raw = ebu(trimmed)

    # Compat: diverse build possono ritornare tuple in ordini diversi
    # Obiettivo: estrarre integrated, lra, momentary(array), short_term(array) con euristiche sicure.
    integrated_lufs = None
    lra = None
    momentary = None
    short_term = None

    if isinstance(raw, tuple) or isinstance(raw, list):
        items = list(raw)

        # prova a trovare le due sequenze (momentary, short_term)
        seqs = [x for x in items if _sequence_to_float_list(x) is not None]
        floats = [_safe_float(x) for x in items if _safe_float(x) is not None]

        # momentary/short_term: tipicamente due array
        if len(seqs) >= 2:
            momentary = seqs[0]
            short_term = seqs[1]

        # integrated + lra: tipicamente 2 float
        if len(floats) >= 2:
            # spesso sono gli ultimi due o i primi due, qui scegliamo quelli con range plausibile
            # integrated_lufs tipico: -30..0, lra: 0..30
            cand = []
            for f in floats:
                if f is None:
                    continue
                cand.append(float(f))
            # pick integrated = valore più negativo (di solito)
            if cand:
                cand_sorted = sorted(cand)
                # integrated: più piccolo (più negativo)
                integrated_lufs = cand_sorted[0]
                # lra: tra i restanti, scegli quello non negativo più sensato
                rest = [v for v in cand_sorted[1:] if v >= 0.0]
                lra = rest[0] if rest else (cand_sorted[1] if len(cand_sorted) > 1 else None)

    block["integrated_lufs"] = float(integrated_lufs) if integrated_lufs is not None else None
    block["lra"] = float(lra) if lra is not None else None

    momentary_list = _sequence_to_float_list(momentary)
    short_term_list = _sequence_to_float_list(short_term)

    block["momentary_lufs"] = momentary_list
    block["short_term_lufs"] = short_term_list

    m_stats = _float_stats(momentary_list)
    s_stats = _float_stats(short_term_list)
    block["momentary_stats"] = m_stats
    block["short_term_stats"] = s_stats

    block["short_lufs_min"] = s_stats.get("min")
    block["short_lufs_max"] = s_stats.get("max")
    block["short_lufs_std"] = s_stats.get("std")
    block["short_lufs_mean"] = s_stats.get("mean")

    try:
        tp = es.TruePeakDetector(sampleRate=sr)
        if stereo_signal is not None and isinstance(stereo_signal, np.ndarray) and stereo_signal.ndim == 2 and stereo_signal.shape[0] >= 2:
            L = np.ascontiguousarray(stereo_signal[0], dtype=np.float32)
            R = np.ascontiguousarray(stereo_signal[1], dtype=np.float32)
            n = min(L.shape[0], R.shape[0])
            stereo_lr = np.ascontiguousarray(np.stack([L[:n], R[:n]], axis=1), dtype=np.float32)  # (N,2)
            block["true_peak_db"] = float(tp(stereo_lr))
        else:
            block["true_peak_db"] = None
    except Exception:
        block["true_peak_db"] = None

    return block


def _extract_spectral_block(signal: np.ndarray, sr: int) -> Dict[str, Any]:
    if es is None or signal.size == 0 or sr <= 0:
        return {}

    crest_value = round(_compute_crest_factor(signal), 2)

    frame_size = N_FFT
    hop_size = HOP_LENGTH
    bins = frame_size // 2 + 1
    freq_bins = np.linspace(0, sr / 2, bins).astype(np.float32)

    windowing = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=frame_size)

    # MFCC direttamente sullo spettro (mag), non su MelBands
    mfcc_algo = es.MFCC(numberCoefficients=13, inputSize=bins)

    centroids = 0.0
    rolloff_total = 0.0
    bandwidth_total = 0.0
    flatness_total = 0.0

    power_accum = np.zeros(bins, dtype=np.float64)
    mfcc_frames: List[np.ndarray] = []
    processed = 0

    eps = 1e-12

    for frame in es.FrameGenerator(signal, frameSize=frame_size, hopSize=hop_size):
        frame_arr = np.asarray(frame, dtype=np.float32)
        if frame_arr.size < frame_size:
            frame_arr = np.pad(frame_arr, (0, frame_size - frame_arr.size))

        mag = np.asarray(spectrum(windowing(frame_arr)), dtype=np.float32)
        if mag.size != bins:
            continue

        processed += 1

        power = (mag.astype(np.float64) ** 2)
        power_accum += power

        mag_sum = float(np.sum(mag))
        centroid = float(np.sum(freq_bins * mag) / mag_sum) if mag_sum > 0 else 0.0
        centroids += centroid

        cumsum = np.cumsum(mag)
        threshold = 0.95 * mag_sum
        idx = int(np.searchsorted(cumsum, threshold)) if mag_sum > 0 else 0
        idx = min(max(idx, 0), bins - 1)
        rolloff_total += float(freq_bins[idx])

        bandwidth = float(math.sqrt(np.sum(((freq_bins - centroid) ** 2) * mag) / mag_sum)) if mag_sum > 0 else 0.0
        bandwidth_total += bandwidth

        log_mag = np.log(mag + eps)
        g_mean = float(np.exp(np.mean(log_mag)))
        a_mean = float(np.mean(mag))
        flatness_total += float(g_mean / (a_mean + eps))

        # MFCC
        try:
            _, mfcc_coeffs = mfcc_algo(mag)
        except Exception:
            continue

        coeffs_array = np.asarray(mfcc_coeffs, dtype=np.float32)
        if coeffs_array.size == 13:
            mfcc_frames.append(coeffs_array)

    if processed == 0:
        return {}

    centroid_avg = centroids / processed
    rolloff_avg = rolloff_total / processed
    bandwidth_avg = bandwidth_total / processed
    flatness_avg = flatness_total / processed

    power_avg = power_accum / float(processed)
    power_db = 10.0 * np.log10(power_avg + eps)

    band_values: Dict[str, float] = {}
    for label, fmin, fmax in SPECTRAL_BANDS:
        band_values[label] = _band_mean_db(freq_bins, power_db.astype(np.float32), fmin, fmax)

    if mfcc_frames:
        stack = np.vstack(mfcc_frames)
        mfcc_mean = [float(v) for v in stack.mean(axis=0)]
        mfcc_std = [float(v) for v in stack.std(axis=0)]
    else:
        mfcc_mean = [0.0] * 13
        mfcc_std = [0.0] * 13

    return {
        "centroid_hz": round(float(centroid_avg), 2),
        "rolloff_hz": round(float(rolloff_avg), 2),
        "bandwidth_hz": round(float(bandwidth_avg), 2),
        "flatness": round(float(flatness_avg), 4),
        "mfcc_mean": [round(v, 3) for v in mfcc_mean],
        "mfcc_std": [round(v, 3) for v in mfcc_std],
        "low_db": round(float(band_values["low"]), 2),
        "lowmid_db": round(float(band_values["lowmid"]), 2),
        "mid_db": round(float(band_values["mid"]), 2),
        "high_db": round(float(band_values["high"]), 2),
        "air_db": round(float(band_values["air"]), 2),
        "zero_crossing_rate": _zero_crossing_rate(signal),
        "crest_factor_db": crest_value,
    }


# -----------------------------------------------------------------------------
# Stereo width (optimized)
# -----------------------------------------------------------------------------
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
    min_len = min(left.shape[0], right.shape[0])
    left = left[:min_len].astype(np.float32, copy=False)
    right = right[:min_len].astype(np.float32, copy=False)

    corr_num = float(np.sum(left * right))
    corr_den = math.sqrt(float(np.sum(left**2) * np.sum(right**2))) + 1e-12
    global_corr = corr_num / corr_den if corr_den > 0 else 0.0

    mid = (left + right) * 0.5
    side = (left - right) * 0.5

    freqs_m, mid_db = _stft_power_mean(mid, sr)
    freqs_s, side_db = _stft_power_mean(side, sr)
    freqs = freqs_m if freqs_m.shape == freqs_s.shape else freqs_m

    band_widths: Dict[str, float] = {}
    side_energy_total = 0.0

    for label, fmin, fmax in STEREO_BANDS:
        m_db = _band_mean_db(freqs, mid_db, fmin, fmax)
        s_db = _band_mean_db(freqs, side_db, fmin, fmax)
        width_db = _width_db_from_band_db(s_db, m_db)
        band_widths[label] = round(width_db, 2)
        side_energy_total += float(10.0 ** (s_db / 10.0))

    left_rms = math.sqrt(float(np.mean(left**2)) + 1e-12)
    right_rms = math.sqrt(float(np.mean(right**2)) + 1e-12)
    lr_balance_db = 20.0 * math.log10((left_rms + 1e-6) / (right_rms + 1e-6))

    is_mono = side_energy_total < 1e-6

    return {
        "is_mono": bool(is_mono),
        "global_correlation": round(float(global_corr), 3),
        "lr_balance_db": round(float(lr_balance_db), 2),
        "band_widths_db": band_widths,
    }


# -----------------------------------------------------------------------------
# Warnings
# -----------------------------------------------------------------------------
def _build_warnings(
    duration: float,
    y: np.ndarray,
    spectral_flatness: float,
    crest_db: float,
    stereo_width: Dict[str, Any],
    loudness_block: Dict[str, Any] | None = None,
    loudness_stats: dict[str, float] | None = None,
) -> List[Dict[str, Union[str, float]]]:
    warnings: List[Dict[str, Union[str, float]]] = []
    max_amp = float(np.max(np.abs(y))) if y.size else 0.0

    if duration > 0 and duration < 15:
        warnings.append(
            {"code": "short_audio", "message": "Traccia molto breve (meno di 15 secondi): alcuni algoritmi possono essere instabili.", "severity": "warning"}
        )

    if max_amp < 0.05:
        warnings.append({"code": "low_level", "message": "Livello medio del file molto basso: normalizza prima dell'analisi.", "severity": "warning"})

    if spectral_flatness > 0.7:
        warnings.append({"code": "noisy_mix", "message": "Elevata flatness spettrale: la traccia sembra molto rumorosa o poco tonale.", "severity": "warning"})

    if loudness_block:
        st_stats = loudness_block.get("short_term_stats")
        if isinstance(st_stats, dict):
            lra_proxy = float(st_stats.get("max", 0.0) - st_stats.get("min", 0.0))
            if lra_proxy < 1.0:
                warnings.append({"code": "dynamics_compressed", "message": "Short-term molto piatto: il mix sembra molto compresso e i transienti sono schiacciati.", "severity": "warning"})
            std_val = float(st_stats.get("std", 0.0))
            if std_val < 0.1:
                warnings.append({"code": "dynamics_flat", "message": "Poco movimento dinamico (std short-term molto bassa).", "severity": "info"})
    elif loudness_stats:
        short_min = loudness_stats.get("short_lufs_min")
        short_max = loudness_stats.get("short_lufs_max")
        if short_min is not None and short_max is not None:
            lra = short_max - short_min
            if lra < 1.0:
                warnings.append({"code": "dynamics_compressed", "message": "LRA molto basso: il mix è molto compresso e i transienti sono piatti.", "severity": "warning"})
        short_std = loudness_stats.get("short_lufs_std")
        if short_std is not None and short_std < 0.1:
            warnings.append({"code": "dynamics_flat", "message": "Deviazione standard short-term molto bassa: manca movimento dinamico.", "severity": "info"})

    if crest_db > 20:
        warnings.append({"code": "high_crest", "message": "Crest factor molto alto: potrebbe esserci troppa dinamica o clipping isolato.", "severity": "warning"})

    band_widths = stereo_width.get("band_widths_db") if isinstance(stereo_width, dict) else None
    if isinstance(band_widths, dict):
        for band, value in band_widths.items():
            try:
                v = float(value)
            except Exception:
                continue

            if v >= WIDTH_TOO_WIDE_DB:
                warnings.append({"code": f"{band}_too_wide", "message": f"{band.capitalize()} molto wide: valuta di contenere lo stereo per club e mono compatibility.", "severity": "warning"})
            elif v <= WIDTH_TOO_MONO_DB and band != "high":
                warnings.append({"code": f"{band}_too_mono", "message": f"{band.capitalize()} molto mono: potresti perdere percezione stereo su sistemi larghi.", "severity": "info"})

    lr_balance = abs(float(stereo_width.get("lr_balance_db", 0.0))) if isinstance(stereo_width, dict) else 0.0
    if lr_balance > 4:
        warnings.append({"code": "lr_imbalance", "message": "Bilanciamento L/R sbilanciato: la traccia potrebbe suonare spostata su un lato.", "severity": "warning"})

    if not warnings:
        warnings.append({"code": "analysis_clean", "message": "Audio stabile: pronto per confronto e scoring.", "severity": "info"})

    return warnings


# -----------------------------------------------------------------------------
# Main feature builder
# -----------------------------------------------------------------------------
def build_essentia_features(
    y_mono: np.ndarray,
    sr: int,
    y_stereo: np.ndarray | None,
    sr_stereo: int | None,
) -> Dict[str, Any]:
    stereo_signal = _prepare_stereo_signal(y_stereo, y_mono)
    stereo_sr = sr_stereo if sr_stereo and sr_stereo > 0 else sr

    y_mono_f32 = np.asarray(y_mono, dtype=np.float32)
    pack: Dict[str, Any] = {
        "rhythm": _default_rhythm_block(),
        "tonal": _default_tonal_block(),
        "loudness": _default_loudness_block(),
        "spectral": _default_spectral_block(y_mono_f32),
        "stereo": _build_stereo_width(stereo_signal, int(stereo_sr) if stereo_sr else sr),
    }

    if not _ESSENTIA_AVAILABLE or y_mono_f32.size == 0 or sr <= 0:
        return pack

    signal = y_mono_f32.astype(np.float32, copy=False)

    try:
        pack["rhythm"] = _extract_rhythm_block(signal, sr)
    except Exception as exc:
        _log(f"[PY-ANALYZER] rhythm failed: {exc}")

    try:
        spectral_results = _extract_spectral_block(signal, sr)
        if isinstance(spectral_results, dict) and spectral_results:
            pack["spectral"].update(spectral_results)
    except Exception as exc:
        _log(f"[PY-ANALYZER] spectral failed: {exc}")

    try:
        pack["tonal"] = _extract_tonal_block(signal, sr)
    except Exception as exc:
        _log(f"[PY-ANALYZER] tonal failed: {exc}")

    try:
        pack["loudness"] = _extract_loudness_block(signal, sr, stereo_signal=stereo_signal)
    except Exception as exc:
        _log(f"[PY-ANALYZER] loudness failed: {exc}")

    return pack


# -----------------------------------------------------------------------------
# Public API: analyze_v4_extras
# -----------------------------------------------------------------------------
def analyze_v4_extras(
    y_mono: np.ndarray,
    y_stereo: np.ndarray,
    sr: int,
    loudness_stats: dict[str, float] | None = None,
) -> Dict[str, Any]:
    duration = float(len(y_mono) / sr) if sr > 0 else 0.0

    essentia_features = build_essentia_features(
        y_mono=y_mono,
        sr=sr,
        y_stereo=y_stereo,
        sr_stereo=sr,
    )

    rhythm_block = essentia_features.get("rhythm", {}) or {}
    tonal_block = essentia_features.get("tonal", {}) or {}
    spectral_block = essentia_features.get("spectral", {}) or {}
    loudness_block = essentia_features.get("loudness", {}) or {}
    stereo_width = essentia_features.get("stereo", {}) or {}

    # HARD GUARANTEE: bands_db / band_norm sempre presenti (reference builder v2)
    if spectral_block.get("bands_db") is None or spectral_block.get("band_norm") is None:
        bands_db_v2, band_norm_v2 = _compute_bands_v2_numpy(np.asarray(y_mono, dtype=np.float32), sr)
        spectral_block["bands_db"] = bands_db_v2
        spectral_block["band_norm"] = band_norm_v2

    crest_db = float(spectral_block.get("crest_factor_db") or 0.0)
    spectral_flatness = float(spectral_block.get("flatness") or 0.0)

    warnings = _build_warnings(
        duration=duration,
        y=np.asarray(y_mono, dtype=np.float32),
        spectral_flatness=spectral_flatness,
        crest_db=crest_db,
        stereo_width=stereo_width,
        loudness_block=loudness_block if isinstance(loudness_block, dict) else None,
        loudness_stats=loudness_stats,
    )

    spectral_output = {
        "spectral_centroid_hz": spectral_block.get("centroid_hz"),
        "spectral_rolloff_hz": spectral_block.get("rolloff_hz"),
        "spectral_bandwidth_hz": spectral_block.get("bandwidth_hz"),
        "spectral_flatness": spectral_block.get("flatness"),
        "zero_crossing_rate": spectral_block.get("zero_crossing_rate"),
        "low_db": spectral_block.get("low_db"),
        "lowmid_db": spectral_block.get("lowmid_db"),
        "mid_db": spectral_block.get("mid_db"),
        "high_db": spectral_block.get("high_db"),
        "air_db": spectral_block.get("air_db"),
        "bands_db": spectral_block.get("bands_db"),
        "band_norm": spectral_block.get("band_norm"),
    }

    # loudness compact + arrays
    loudness_out: Dict[str, Any] = {}
    if isinstance(loudness_block, dict):
        loudness_out["integrated_lufs"] = None if loudness_block.get("integrated_lufs") is None else round(float(loudness_block["integrated_lufs"]), 3)
        loudness_out["lra"] = None if loudness_block.get("lra") is None else round(float(loudness_block["lra"]), 3)
        loudness_out["true_peak_db"] = None if loudness_block.get("true_peak_db") is None else round(float(loudness_block["true_peak_db"]), 3)

        loudness_out["momentary_lufs"] = loudness_block.get("momentary_lufs")
        loudness_out["short_term_lufs"] = loudness_block.get("short_term_lufs")

        for stats_key in ("momentary_stats", "short_term_stats"):
            st = loudness_block.get(stats_key)
            if isinstance(st, dict):
                loudness_out[stats_key] = {
                    "mean": None if st.get("mean") is None else round(float(st["mean"]), 3),
                    "min": None if st.get("min") is None else round(float(st["min"]), 3),
                    "max": None if st.get("max") is None else round(float(st["max"]), 3),
                    "std": None if st.get("std") is None else round(float(st["std"]), 3),
                }
            else:
                loudness_out[stats_key] = None

    result: Dict[str, Any] = {
        "duration_seconds": duration,
        "bpm": rhythm_block.get("bpm"),
        "bpm_confidence": rhythm_block.get("bpm_confidence") or rhythm_block.get("bpm_conf"),
        "key": tonal_block.get("key"),
        "key_confidence": tonal_block.get("key_conf"),
        "spectral": spectral_output,

        # legacy fields (keep for current UI/types)
        "spectral_centroid_hz": spectral_output["spectral_centroid_hz"],
        "spectral_rolloff_hz": spectral_output["spectral_rolloff_hz"],
        "spectral_bandwidth_hz": spectral_output["spectral_bandwidth_hz"],
        "spectral_flatness": spectral_output["spectral_flatness"],
        "zero_crossing_rate": spectral_output["zero_crossing_rate"],
        "spectral_low_db": spectral_output["low_db"],
        "spectral_lowmid_db": spectral_output["lowmid_db"],
        "spectral_mid_db": spectral_output["mid_db"],
        "spectral_high_db": spectral_output["high_db"],
        "spectral_air_db": spectral_output["air_db"],

        "stereo_width": stereo_width,
        "dynamics": None,
        "loudness_stats": loudness_out or None,
        "harmonic_balance": None,

        "confidence": {
            "bpm": float(rhythm_block.get("bpm_conf") or 0.0),
            "key": float(tonal_block.get("key_conf") or 0.0),
            "lufs": None,
            "spectral": None,
            "stereo": None,
        },

        "warnings": warnings,
        "essentia_features": essentia_features,
    }

    return result
