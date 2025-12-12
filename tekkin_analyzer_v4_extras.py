from __future__ import annotations

import math
from typing import Any, Callable, Dict, List, Union

import numpy as np

try:
    import essentia
    import essentia.standard as es
    _ESSENTIA_AVAILABLE: bool = True
    print(f"[PY-ANALYZER] Essentia IMPORTED: {essentia.__version__}")
except Exception as exc:  # pragma: no cover - guard when Essentia missing
    essentia = None
    es = None
    _ESSENTIA_AVAILABLE: bool = False
    print(f"[PY-ANALYZER] Essentia NOT AVAILABLE: {exc}")

N_FFT = 4096
HOP_LENGTH = 1024
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
MAX_BPM_ANALYSIS_SECONDS = 240.0


def _bounded_confidence(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def _db_from_power(value: float) -> float:
    return 10.0 * math.log10(max(value, 1e-12))


def _trim_to_max_duration(
    signal: np.ndarray, sr: int, max_seconds: float
) -> np.ndarray:
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


def _pad_frame(frame: Any, target_size: int) -> np.ndarray:
    arr = np.asarray(frame, dtype=np.float32)
    if arr.size >= target_size:
        return arr[:target_size]
    return np.pad(arr, (0, target_size - arr.size))


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


def _safe_float(
    value: Any, guard: Callable[[float], bool] | None = None
) -> float | None:
    try:
        candidate = float(value)
    except (TypeError, ValueError):
        return None
    if guard and not guard(candidate):
        return None
    return candidate


def _compute_band_rms_numpy(
    signal: np.ndarray, sr: int, fmin: float, fmax: float, n_fft: int
) -> float:
    if signal.size == 0 or sr <= 0 or n_fft <= 0:
        return 0.0
    fft_size = max(4, min(len(signal), n_fft))
    window = np.hanning(fft_size)
    padded = signal if signal.size >= fft_size else np.pad(signal, (0, fft_size - signal.size))
    spectrum = np.fft.rfft(padded * window)
    freqs = np.fft.rfftfreq(fft_size, 1.0 / sr)
    mask = (freqs >= fmin) & (freqs < fmax)
    if not np.any(mask):
        return 0.0
    power = np.mean(np.abs(spectrum[mask]) ** 2)
    return math.sqrt(max(power, 1e-18))


def _compute_band_rms_essentia(
    signal: np.ndarray, sr: int, fmin: float, fmax: float, n_fft: int, hop_length: int
) -> float:
    if es is None:
        raise RuntimeError("Essentia not initialized")
    windowing = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=n_fft)
    freq_bins = np.linspace(0, sr / 2, n_fft // 2 + 1)
    mask = (freq_bins >= fmin) & (freq_bins < fmax)
    if not np.any(mask):
        return 0.0
    total_power = 0.0
    frames = 0
    for frame in es.FrameGenerator(signal, frameSize=n_fft, hopSize=hop_length):
        windowed = windowing(_pad_frame(frame, n_fft))
        mag = np.array(spectrum(windowed))
        selected = mag[mask]
        if selected.size == 0:
            continue
        total_power += float(np.mean(selected**2))
        frames += 1
    if frames == 0:
        return 0.0
    return math.sqrt(total_power / frames)


def _compute_band_rms(
    signal: np.ndarray,
    sr: int,
    fmin: float,
    fmax: float,
    n_fft: int = N_FFT,
    hop_length: int = HOP_LENGTH,
) -> float:
    if _ESSENTIA_AVAILABLE:
        try:
            return _compute_band_rms_essentia(signal, sr, fmin, fmax, n_fft, hop_length)
        except Exception:
            pass
    return _compute_band_rms_numpy(signal, sr, fmin, fmax, n_fft)


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
    loudness_stats: Dict[str, float] | None = None,
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


def _default_rhythm_block() -> Dict[str, Any]:
    return {"bpm": None, "bpm_conf": None, "beats": None, "tempo_curve": None}


def _default_tonal_block() -> Dict[str, Any]:
    return {"key": None, "scale": None, "key_conf": None, "tonal_strength": None, "hpcp_stats": None}


def _default_loudness_block() -> Dict[str, Any]:
    return {
        "integrated_lufs": None,
        "lra": None,
        "momentary_loudness": None,
        "short_term_loudness": None,
        "true_peak_db": None,
    }


def _default_spectral_block(signal: np.ndarray) -> Dict[str, Any]:
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
    }


def _collect_hpcp_stats(signal: np.ndarray, sr: int) -> dict[str, list[float]] | None:
    if es is None or signal.size == 0 or sr <= 0:
        return None
    freq_bins = np.linspace(0, sr / 2, N_FFT // 2 + 1)
    hpcp_algo = es.HPCP(sampleRate=sr, size=12)
    windowing = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=N_FFT)
    collected: List[np.ndarray] = []
    for frame in es.FrameGenerator(signal, frameSize=N_FFT, hopSize=HOP_LENGTH):
        windowed = windowing(_pad_frame(frame, N_FFT))
        mag = np.array(spectrum(windowed))
        if mag.size != freq_bins.size:
            continue
        raw = hpcp_algo(mag, freq_bins)
        arr = np.asarray(raw, dtype=float)
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


def _extract_rhythm_block(signal: np.ndarray, sr: int) -> Dict[str, Any]:
    block = _default_rhythm_block()
    if es is None or signal.size == 0 or sr <= 0:
        return block
    trimmed = _trim_to_max_duration(signal, sr, MAX_BPM_ANALYSIS_SECONDS)
    rhythm_extractor = es.RhythmExtractor2013(method="multifeature")
    result = rhythm_extractor(trimmed)
    bpm_value = _safe_float(result[0], lambda v: v > 0) if len(result) > 0 else None
    if bpm_value is not None:
        block["bpm"] = float(bpm_value)
    conf_raw = _safe_float(result[2]) if len(result) > 2 else None
    block["bpm_conf"] = (
        _bounded_confidence(conf_raw / 5.0) if conf_raw is not None else 0.0
    )
    block["beats"] = _sequence_to_float_list(result[1]) if len(result) > 1 else None
    block["tempo_curve"] = _sequence_to_float_list(result[3]) if len(result) > 3 else None
    print(
        "[PY-ANALYZER] build_essentia_features: rhythm block computed, "
        f"bpm={block['bpm']}, conf={block['bpm_conf']}"
    )
    return block


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
    key_value = f"{key}{key_suffix}"
    block["key"] = key_value
    block["scale"] = scale
    if strength is not None:
        confidence = _bounded_confidence(float(strength))
        block["key_conf"] = confidence
        block["tonal_strength"] = float(strength)
    block["hpcp_stats"] = _collect_hpcp_stats(signal, sr)
    print(
        "[PY-ANALYZER] build_essentia_features: tonal block computed, "
        f"key={block['key']}, conf={block['key_conf']}"
    )
    return block


def _extract_loudness_block(signal: np.ndarray, sr: int) -> Dict[str, Any]:
    block = _default_loudness_block()
    if es is None or signal.size == 0 or sr <= 0:
        return block
    loudness_meter = es.LoudnessEBUR128(sampleRate=sr)
    trimmed = _trim_to_max_duration(signal, sr, MAX_BPM_ANALYSIS_SECONDS)
    result = loudness_meter(trimmed)
    values = [float(v) for v in result if isinstance(v, (int, float))]
    if values:
        block["integrated_lufs"] = values[0]
    if len(values) > 1:
        block["lra"] = values[1]
    if len(values) > 2:
        block["momentary_loudness"] = values[2]
    if len(values) > 3:
        block["short_term_loudness"] = values[3]
    if len(values) > 4:
        block["true_peak_db"] = values[4]
    print(
        "[PY-ANALYZER] build_essentia_features: loudness block computed, "
        f"integrated={block['integrated_lufs']}"
    )
    return block


def _extract_spectral_block(signal: np.ndarray, sr: int) -> Dict[str, Any]:
    if es is None or signal.size == 0 or sr <= 0:
        return {}
    crest_value = round(_compute_crest_factor(signal), 2)
    frame_size = N_FFT
    hop_size = HOP_LENGTH
    bins = frame_size // 2 + 1
    freq_bins = np.linspace(0, sr / 2, bins)
    windowing = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=frame_size)
    melbands = es.MelBands(
        sampleRate=sr,
        inputSize=bins,
        numberBands=40,
        lowFrequencyBound=20.0,
        highFrequencyBound=max(20000.0, sr / 2),
    )
    mfcc_algo = es.MFCC(numberCoefficients=13, inputSize=bins)
    centroids = 0.0
    rolloff_total = 0.0
    bandwidth_total = 0.0
    flatness_total = 0.0
    power_accum = np.zeros(bins)
    mfcc_frames: List[np.ndarray] = []
    processed = 0
    for frame in es.FrameGenerator(signal, frameSize=frame_size, hopSize=hop_size):
        windowed = windowing(_pad_frame(frame, frame_size))
        mag = np.array(spectrum(windowed))
        if mag.size != bins:
            continue
        processed += 1
        power = mag**2
        power_accum += power
        mag_sum = float(np.sum(mag))
        centroid = float(np.sum(freq_bins * mag) / mag_sum) if mag_sum > 0 else 0.0
        centroids += centroid
        cumsum = np.cumsum(mag)
        threshold = 0.95 * mag_sum
        idx = np.searchsorted(cumsum, threshold)
        idx = min(idx, bins - 1)
        rolloff = float(freq_bins[idx]) if bins > 0 else 0.0
        rolloff_total += rolloff
        if mag_sum > 0:
            bandwidth = float(
                math.sqrt(np.sum(((freq_bins - centroid) ** 2) * mag) / mag_sum)
            )
        else:
            bandwidth = 0.0
        bandwidth_total += bandwidth
        log_mag = np.log(mag + 1e-12)
        g_mean = float(np.exp(np.mean(log_mag)))
        a_mean = float(np.mean(mag))
        flatness_total += float(g_mean / (a_mean + 1e-12))
        try:
            mel = melbands(mag)
            mfcc_result = mfcc_algo(mel)
        except Exception:
            continue
        coeffs = (
            mfcc_result[0]
            if isinstance(mfcc_result, tuple) and len(mfcc_result) > 0
            else mfcc_result
        )
        coeffs_array = np.asarray(coeffs, dtype=float)
        if coeffs_array.size == 13:
            mfcc_frames.append(coeffs_array)
    if processed == 0:
        return {}
    centroid_avg = centroids / processed
    rolloff_avg = rolloff_total / processed
    bandwidth_avg = bandwidth_total / processed
    flatness_avg = flatness_total / processed
    power_avg = power_accum / processed
    power_db = 10.0 * np.log10(power_avg + 1e-12)
    band_values: Dict[str, float] = {}
    for label, fmin, fmax in SPECTRAL_BANDS:
        mask = (freq_bins >= fmin) & (freq_bins < fmax)
        if not np.any(mask):
            band_values[label] = -120.0
        else:
            band_values[label] = float(np.mean(power_db[mask]))
    if mfcc_frames:
        stack = np.vstack(mfcc_frames)
        mfcc_mean = [float(value) for value in stack.mean(axis=0)]
        mfcc_std = [float(value) for value in stack.std(axis=0)]
    else:
        mfcc_mean = [0.0] * 13
        mfcc_std = [0.0] * 13
    block = {
        "centroid_hz": round(centroid_avg, 2),
        "rolloff_hz": round(rolloff_avg, 2),
        "bandwidth_hz": round(bandwidth_avg, 2),
        "flatness": round(flatness_avg, 4),
        "mfcc_mean": [round(value, 3) for value in mfcc_mean],
        "mfcc_std": [round(value, 3) for value in mfcc_std],
        "low_db": round(band_values["low"], 2),
        "lowmid_db": round(band_values["lowmid"], 2),
        "mid_db": round(band_values["mid"], 2),
        "high_db": round(band_values["high"], 2),
        "air_db": round(band_values["air"], 2),
        "zero_crossing_rate": _zero_crossing_rate(signal),
        "crest_factor_db": crest_value,
    }
    print(
        "[PY-ANALYZER] build_essentia_features: spectral block computed, "
        f"centroid={block['centroid_hz']}, rolloff={block['rolloff_hz']}"
    )
    return block


def _prepare_stereo_signal(
    y_stereo: np.ndarray | None, y_mono: np.ndarray
) -> np.ndarray:
    if y_stereo is None:
        return np.stack([y_mono, y_mono])
    arr = np.asarray(y_stereo, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr[np.newaxis, :]
    if arr.shape[0] == 1:
        arr = np.vstack([arr[0], arr[0]])
    elif arr.shape[0] > 2:
        arr = arr[:2]
    left, right = arr[0], arr[1]
    min_len = min(len(left), len(right))
    return np.stack([left[:min_len], right[:min_len]])


def build_essentia_features(
    y_mono: np.ndarray,
    sr: int,
    y_stereo: np.ndarray | None,
    sr_stereo: int | None,
) -> Dict[str, Any]:
    stereo_signal = _prepare_stereo_signal(y_stereo, y_mono)
    stereo_sr = sr_stereo if sr_stereo and sr_stereo > 0 else sr
    pack: Dict[str, Any] = {
        "rhythm": _default_rhythm_block(),
        "tonal": _default_tonal_block(),
        "loudness": _default_loudness_block(),
        "spectral": _default_spectral_block(y_mono),
        "stereo": _build_stereo_width(stereo_signal, stereo_sr),
    }
    if not _ESSENTIA_AVAILABLE or y_mono.size == 0 or sr <= 0:
        print("[PY-ANALYZER] build_essentia_features: Essentia unavailable, using defaults")
        return pack
    signal = y_mono.astype(np.float32, copy=False)
    try:
        pack["rhythm"] = _extract_rhythm_block(signal, sr)
    except Exception as exc:
        print(f"[PY-ANALYZER] build_essentia_features: rhythm block failed ({exc})")
    try:
        pack["loudness"] = _extract_loudness_block(signal, sr)
    except Exception as exc:
        print(f"[PY-ANALYZER] build_essentia_features: loudness block failed ({exc})")
    try:
        spectral_results = _extract_spectral_block(signal, sr)
        if spectral_results:
            pack["spectral"].update(spectral_results)
    except Exception as exc:
        print(f"[PY-ANALYZER] build_essentia_features: spectral block failed ({exc})")
    try:
        pack["tonal"] = _extract_tonal_block(signal, sr)
    except Exception as exc:
        print(f"[PY-ANALYZER] build_essentia_features: tonal block failed ({exc})")
    return pack


def analyze_v4_extras(
    y_mono: np.ndarray,
    y_stereo: np.ndarray,
    sr: int,
    loudness_stats: dict[str, float] | None = None,
) -> Dict[str, Any]:
    duration = float(len(y_mono) / sr) if sr > 0 else 0.0
    essentia_features = build_essentia_features(
        y_mono=y_mono, sr=sr, y_stereo=y_stereo, sr_stereo=sr
    )
    print("[PY-ANALYZER] analyze_v4_extras: mapping essentia_features -> legacy fields")
    rhythm_block = essentia_features.get("rhythm", {})
    tonal_block = essentia_features.get("tonal", {})
    spectral_block = essentia_features.get("spectral", {})
    loudness_block = essentia_features.get("loudness", {})
    stereo_width = essentia_features.get("stereo", {})

    crest_db = float(spectral_block.get("crest_factor_db") or 0.0)
    spectral_flatness = float(spectral_block.get("flatness") or 0.0)
    spectral_confidence = None
    stereo_confidence = None
    loudness_confidence = None

    warnings = _build_warnings(
        duration=duration,
        y=y_mono,
        spectral_flatness=spectral_flatness,
        crest_db=crest_db,
        stereo_width=stereo_width,
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
    }

    loudness_stats_output: Dict[str, Union[float, None]] = {}
    for key, value in loudness_block.items():
        loudness_stats_output[key] = None if value is None else round(float(value), 3)

    result = {
        "duration_seconds": duration,
        "bpm": rhythm_block.get("bpm"),
        "bpm_confidence": rhythm_block.get("bpm_conf"),
        "key": tonal_block.get("key"),
        "key_confidence": tonal_block.get("key_conf"),
        "spectral": spectral_output,
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
        "loudness_stats": loudness_stats_output or None,
        "harmonic_balance": None,
        "confidence": {
            "bpm": rhythm_block.get("bpm_conf") or 0.0,
            "key": tonal_block.get("key_conf") or 0.0,
            "lufs": loudness_confidence,
            "spectral": spectral_confidence,
            "stereo": stereo_confidence,
        },
        "warnings": warnings,
        "essentia_features": essentia_features,
    }

    return result
