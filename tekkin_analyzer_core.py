# tekkin_analyzer_core.py
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import json
import math
import numpy as np

try:
    import essentia.standard as es
except Exception as exc:
    es = None
    _ESSENTIA_IMPORT_ERROR = exc
else:
    _ESSENTIA_IMPORT_ERROR = None


REFERENCE_MODELS_DIR = Path(__file__).resolve().parent / "reference_models"

def _load_reference_model(profile_key: str) -> Optional[dict[str, Any]]:
    if not profile_key:
        return None

    key = str(profile_key).strip()
    if not key:
        return None

    filename = key if key.endswith(".json") else f"{key}.json"
    model_path = REFERENCE_MODELS_DIR / filename

    if not model_path.exists():
        return None

    try:
        with model_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else None
    except Exception:
        return None

def _require_essentia() -> None:
    if es is None:
        raise RuntimeError(f"Essentia non disponibile: {_ESSENTIA_IMPORT_ERROR}")


def _db(x: float, floor: float = 1e-12) -> float:
    x = float(x)
    if not math.isfinite(x) or x <= 0:
        return float("-inf")
    return 20.0 * math.log10(max(floor, x))

def _rms(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=np.float32)
    if x.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(x * x) + 1e-12))

def _crest_db(x: np.ndarray) -> float | None:
    x = np.asarray(x, dtype=np.float32)
    if x.size == 0:
        return None
    peak = float(np.max(np.abs(x)))
    rms = _rms(x)
    if peak <= 0 or rms <= 0:
        return None
    return _db(peak / rms)

def _band_energy_from_stft(
    x: np.ndarray,
    sr: int,
    n_fft: int = 2048,
    hop: int = 512,
) -> tuple[np.ndarray, np.ndarray]:
    x = np.asarray(x, dtype=np.float32)
    if x.ndim != 1:
        x = x.reshape(-1)
    if x.size < n_fft:
        pad = np.zeros(n_fft - x.size, dtype=np.float32)
        x = np.concatenate([x, pad])
    window = np.hanning(n_fft).astype(np.float32)
    frames = 1 + (x.size - n_fft) // hop
    if frames <= 0:
        frames = 1
    spec_acc = None
    for i in range(frames):
        start = i * hop
        frame = x[start:start + n_fft]
        if frame.size < n_fft:
            frame = np.pad(frame, (0, n_fft - frame.size))
        fft = np.fft.rfft(frame * window)
        mag2 = (np.abs(fft) ** 2).astype(np.float64)
        spec_acc = mag2 if spec_acc is None else (spec_acc + mag2)
    spec = spec_acc / float(frames)
    freqs = np.fft.rfftfreq(n_fft, d=1.0 / float(sr))
    return freqs.astype(np.float64), spec.astype(np.float64)

def _spectral_tilt(freqs: np.ndarray, spec: np.ndarray, fmin: float = 40.0, fmax: float = 16000.0) -> float | None:
    freqs = np.asarray(freqs, dtype=np.float64)
    spec = np.asarray(spec, dtype=np.float64)
    m = (freqs >= fmin) & (freqs <= fmax) & (spec > 0)
    if int(np.sum(m)) < 10:
        return None
    x = np.log10(freqs[m])
    y = np.log10(spec[m])
    # simple least squares slope
    x0 = x - np.mean(x)
    y0 = y - np.mean(y)
    denom = float(np.sum(x0 * x0))
    if denom <= 0:
        return None
    slope = float(np.sum(x0 * y0) / denom)
    return slope

def _spectral_flatness(mag: np.ndarray, eps: float = 1e-12) -> float:
    x = np.asarray(mag, dtype=np.float32)
    if x.size == 0:
        return 0.0
    x = np.maximum(x, eps)
    if x.ndim == 2:
        gm = np.exp(np.mean(np.log(x), axis=1))
        am = np.mean(x, axis=1)
        return float(np.mean(gm / np.maximum(am, eps)))
    gm = float(np.exp(np.mean(np.log(x))))
    am = float(np.mean(x))
    return gm / am if am > 0 else 0.0

def _bands_hz() -> list[tuple[str, float, float]]:
    return [
        ("sub", 30.0, 60.0),
        ("low", 60.0, 150.0),
        ("lowmid", 150.0, 400.0),
        ("mid", 400.0, 2000.0),
        ("presence", 2000.0, 5000.0),
        ("high", 5000.0, 10000.0),
        ("air", 10000.0, 16000.0),
    ]

def _band_sums(freqs: np.ndarray, spec: np.ndarray) -> dict[str, float]:
    out: dict[str, float] = {}
    for name, f0, f1 in _bands_hz():
        m = (freqs >= f0) & (freqs < f1)
        out[name] = float(np.sum(spec[m])) if np.any(m) else 0.0
    return out

def _stereo_metrics_from_stft(left: np.ndarray, right: np.ndarray, sr: int) -> dict[str, Any]:
    left = np.asarray(left, dtype=np.float32).reshape(-1)
    right = np.asarray(right, dtype=np.float32).reshape(-1)
    n = min(left.size, right.size)
    if n <= 0:
        return {"lr_correlation": None, "lr_balance_db": None, "width_by_band": None, "correlation_by_band": None}
    l = left[:n]
    r = right[:n]

    # wideband correlation and balance
    lc = l - float(np.mean(l))
    rc = r - float(np.mean(r))
    denom = float(np.sqrt(np.sum(lc * lc) * np.sum(rc * rc)) + 1e-12)
    corr = float(np.sum(lc * rc) / denom) if denom > 0 else None

    l_rms = _rms(l)
    r_rms = _rms(r)
    balance_db = None
    if l_rms > 0 and r_rms > 0:
        balance_db = float(20.0 * math.log10((l_rms + 1e-12) / (r_rms + 1e-12)))

    # per band width proxy from mid/side energy
    mid = (l + r) * 0.5
    side = (l - r) * 0.5
    freqs, mid_spec = _band_energy_from_stft(mid, sr)
    _, side_spec = _band_energy_from_stft(side, sr)

    width_by_band = {}
    for name, f0, f1 in _bands_hz():
        m = (freqs >= f0) & (freqs < f1)
        mid_e = float(np.sum(mid_spec[m])) if np.any(m) else 0.0
        side_e = float(np.sum(side_spec[m])) if np.any(m) else 0.0
        denom2 = mid_e + side_e + 1e-12
        width_by_band[name] = float(side_e / denom2)

    # per band correlation (rough)
    freqs, lspec = _band_energy_from_stft(l, sr)
    _, rspec = _band_energy_from_stft(r, sr)
    corr_by_band = {}
    for name, f0, f1 in _bands_hz():
        m = (freqs >= f0) & (freqs < f1)
        a = lspec[m]
        b = rspec[m]
        if a.size < 4:
            corr_by_band[name] = None
            continue
        a0 = a - np.mean(a)
        b0 = b - np.mean(b)
        d = float(np.sqrt(np.sum(a0 * a0) * np.sum(b0 * b0)) + 1e-12)
        corr_by_band[name] = float(np.sum(a0 * b0) / d) if d > 0 else None

    return {
        "lr_correlation": corr,
        "lr_balance_db": balance_db,
        "width_by_band": width_by_band,
        "correlation_by_band": corr_by_band,
    }

def _mfcc_stats(mono: np.ndarray, sr: int, n_mfcc: int = 13) -> dict[str, Any] | None:
    # Use Essentia MFCC if available, else skip.
    if not hasattr(es, "MFCC") or not hasattr(es, "Spectrum") or not hasattr(es, "Windowing"):
        return None
    mono = np.asarray(mono, dtype=np.float32).reshape(-1)
    if mono.size < sr:  # <1s
        return None

    frame_size = 2048
    hop = 1024
    w = es.Windowing(type="hann")
    spectrum = es.Spectrum()
    mfcc = es.MFCC(numberCoefficients=int(n_mfcc))

    coeffs = []
    for frame in es.FrameGenerator(mono, frameSize=frame_size, hopSize=hop, startFromZero=True):
        spec = spectrum(w(frame))
        _, c = mfcc(spec)
        coeffs.append(np.array(c, dtype=np.float32))
    if not coeffs:
        return None
    M = np.stack(coeffs, axis=0)  # frames x n_mfcc
    mean = np.mean(M, axis=0).astype(np.float32).tolist()
    std = np.std(M, axis=0).astype(np.float32).tolist()
    p10 = np.quantile(M, 0.10, axis=0).astype(np.float32).tolist()
    p90 = np.quantile(M, 0.90, axis=0).astype(np.float32).tolist()
    return {"n_mfcc": int(n_mfcc), "mean": mean, "std": std, "p10": p10, "p90": p90}

def _safe_float(x: Any) -> Optional[float]:
    try:
        v = float(x)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return v

def _fallback_integrated_from_momentary(m: list[float] | np.ndarray) -> Optional[float]:
    arr = np.asarray(m, dtype=np.float32)
    arr = arr[np.isfinite(arr)]
    if arr.size == 0:
        return None
    return float(np.mean(arr))

def _fallback_lra_from_momentary(m: list[float] | np.ndarray) -> Optional[float]:
    arr = np.asarray(m, dtype=np.float32)
    arr = arr[np.isfinite(arr)]
    if arr.size < 10:
        return None
    val = float(np.percentile(arr, 95) - np.percentile(arr, 10))
    return val if np.isfinite(val) else None

def _stats(x: np.ndarray) -> dict[str, Any]:
    a = np.asarray(x, dtype=np.float32)
    a = a[np.isfinite(a)]
    if a.size == 0:
        return {"min": None, "max": None, "mean": None, "p50": None, "p95": None}
    return {
        "min": float(np.min(a)),
        "max": float(np.max(a)),
        "mean": float(np.mean(a)),
        "p50": float(np.percentile(a, 50)),
        "p95": float(np.percentile(a, 95)),
    }

def _get_model_target(model: dict[str, Any], key: str) -> Optional[float]:
    targets = model.get("targets")
    if isinstance(targets, dict):
        t = _safe_float(targets.get(key))
        if t is not None:
            return t

    fps = model.get("features_percentiles")
    if isinstance(fps, dict):
        keys_to_try = [key]
        if key == "integrated_lufs":
            keys_to_try.append("lufs")
        for kk in keys_to_try:
            kobj = fps.get(kk)
            if isinstance(kobj, dict):
                t = _safe_float(kobj.get("p50"))
                if t is not None:
                    return t

    fstats = model.get("features_stats")
    if isinstance(fstats, dict):
        keys_to_try = [key]
        if key == "integrated_lufs":
            keys_to_try.append("lufs")
        for kk in keys_to_try:
            kobj = fstats.get(kk)
            if isinstance(kobj, dict):
                t = _safe_float(kobj.get("mean"))
                if t is not None:
                    return t
    return None

def _get_band_ref_p50(model: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    bnp = model.get("bands_norm_percentiles")
    if isinstance(bnp, dict):
        for bk, obj in bnp.items():
            if isinstance(obj, dict):
                v = _safe_float(obj.get("p50"))
                if v is not None:
                    out[bk] = v
    if out:
        return out
    bns = model.get("bands_norm_stats")
    if isinstance(bns, dict):
        for bk, obj in bns.items():
            if isinstance(obj, dict):
                v = _safe_float(obj.get("mean"))
                if v is not None:
                    out[bk] = v
    return out

def _compute_model_match(metrics: dict[str, Any], model: dict[str, Any]) -> Optional[dict[str, Any]]:
    if not model:
        return None

    picks: list[tuple[str, float]] = []
    for k in ("bpm", "integrated_lufs", "stereo_width", "spectral_centroid_hz"):
        v = _safe_float(metrics.get(k))
        t = _get_model_target(model, k)
        if v is not None and t is not None:
            picks.append((k, v - t))

    bands_ref = _get_band_ref_p50(model)
    bands_cur = metrics.get("band_energy_norm")
    if isinstance(bands_cur, dict) and bands_ref:
        for bk, t in bands_ref.items():
            v = _safe_float(bands_cur.get(bk))
            if v is not None:
                picks.append((f"band_{bk}", v - t))

    if not picks:
        return None

    abs_err = [abs(d) for _, d in picks]
    mean_err = float(np.mean(abs_err))
    match = max(0.0, min(1.0, 1.0 / (1.0 + mean_err)))

    return {
        "match_ratio": match,
        "mean_abs_error": mean_err,
        "deltas": {k: float(d) for k, d in picks},
    }


def _waveform_peaks(mono: np.ndarray, sr: int, points: int = 1200) -> list[float]:
    if mono.size == 0:
        return []
    mono = np.asarray(mono, dtype=np.float32)
    hop = max(1, int(len(mono) / points))
    peaks = []
    for i in range(0, len(mono), hop):
        chunk = mono[i : i + hop]
        if chunk.size == 0:
            continue
        peaks.append(float(np.max(np.abs(chunk))))
    # normalizza
    m = max(peaks) if peaks else 0.0
    if m > 0:
        peaks = [p / m for p in peaks]
    return peaks


def _waveform_bands(stereo: np.ndarray, sr: int, points: int = 900) -> dict[str, Any]:
    # Bande semplici via filtri Essentia (stabile per UI)
    _require_essentia()
    mono = _to_mono(stereo)

    if mono.size == 0:
        return {"sub": [], "mid": [], "high": [], "duration": 0.0}

    duration = float(len(mono) / float(sr))

    # filtri
    sub_f = es.LowPass(cutoffFrequency=150.0, sampleRate=sr)
    mid_bp = es.BandPass(bandwidth=1800.0, cutoffFrequency=900.0, sampleRate=sr)
    high_f = es.HighPass(cutoffFrequency=4000.0, sampleRate=sr)

    sub = np.asarray(sub_f(mono), dtype=np.float32)
    mid = np.asarray(mid_bp(mono), dtype=np.float32)
    high = np.asarray(high_f(mono), dtype=np.float32)

    return {
        "sub": _waveform_peaks(sub, sr, points=points),
        "mid": _waveform_peaks(mid, sr, points=points),
        "high": _waveform_peaks(high, sr, points=points),
        "duration": duration,
    }


def _as_stereo_n2(stereo: np.ndarray) -> np.ndarray:
    s = _ensure_stereo(stereo)  # (2,n)
    return np.ascontiguousarray(s.T, dtype=np.float32)  # (n,2)

def _loudness_stats(stereo: np.ndarray, sr: int) -> dict[str, Any]:
    _require_essentia()

    mono = np.ascontiguousarray(_to_mono(stereo), dtype=np.float32)
    stereo_n2 = _as_stereo_n2(stereo)

    loud = es.LoudnessEBUR128(sampleRate=sr)

    warnings: list[str] = []

    def _call_loud(x: np.ndarray):
        try:
            return loud(x)
        except Exception as exc:
            warnings.append(f"loudness call failed: {exc}")
            return None

    out = _call_loud(stereo_n2)
    if out is None:
        out = _call_loud(mono)

    integrated_lufs = None
    lra = None
    sample_peak_db = None
    if isinstance(out, (list, tuple)) and len(out) >= 1:
        integrated_lufs = _safe_float(out[0])
        if len(out) > 1:
            lra = _safe_float(out[1])
        if len(out) > 2 and isinstance(out[2], (int, float)):
            sample_peak_db = _safe_float(out[2])

    # momentary / short-term
    # molte build di Essentia NON espongono LoudnessEBUR128Momentary / LoudnessEBUR128ShortTerm.
    # se LoudnessEBUR128 ci restituisce già gli array, li usiamo. Altrimenti facciamo fallback con finestre.
    momentary = []
    short_term = []

    try:
        # Se l'algoritmo ci ha già dato gli array (dipende dalla build), li estraiamo qui.
        if isinstance(out, (tuple, list)) and len(out) >= 4:
            if hasattr(out[2], "__len__"):
                momentary = list(out[2])
            if hasattr(out[3], "__len__"):
                short_term = list(out[3])
    except Exception:
        pass

    if not momentary or not short_term:
        # Fallback: stima proxy RMS dB su finestre (NON è LUFS EBU reale).
        # Non posso confermare che equivalga a LUFS, ma è utile per trend e dinamica.
        win_m = int(sr * 0.400)  # 400ms
        hop_m = int(sr * 0.100)  # 100ms
        win_s = int(sr * 3.000)  # 3s
        hop_s = int(sr * 1.000)  # 1s

        def _rms_db_series(x: np.ndarray, win: int, hop: int) -> list[float]:
            x = np.asarray(x, dtype=np.float32)
            if x.size < win:
                return []
            outv: list[float] = []
            for start in range(0, x.size - win + 1, hop):
                seg = x[start:start + win]
                outv.append(float(_db(_rms(seg))))
            return outv

        momentary = _rms_db_series(mono, win_m, hop_m)
        short_term = _rms_db_series(mono, win_s, hop_s)

    integrated_safe = _safe_float(integrated_lufs)
    lra_safe = _safe_float(lra)
    if integrated_safe is None:
        integrated_safe = _fallback_integrated_from_momentary(momentary)
    if lra_safe is None:
        lra_safe = _fallback_lra_from_momentary(momentary)

    return {
        "integrated_lufs": integrated_safe,
        "lra": lra_safe,
        "sample_peak_db": _safe_float(sample_peak_db),
        "momentary_lufs": [float(v) for v in np.asarray(momentary, dtype=np.float32)],
        "short_term_lufs": [float(v) for v in np.asarray(short_term, dtype=np.float32)],
        "momentary_stats": _stats(momentary),
        "short_term_stats": _stats(short_term),
        "warnings": warnings,
    }


def _safe_key_extract(mono: np.ndarray) -> dict[str, Any]:
    out: dict[str, Any] = {"key": None, "scale": None, "strength": None, "warnings": []}

    try:
        key_ex = es.KeyExtractor()
        # prova a configurare solo parametri che esistono nella build corrente
        param_names = None
        for attr in ("paramNames", "parameterNames", "parameterNames"):
            if hasattr(key_ex, attr):
                try:
                    param_names = set(getattr(key_ex, attr)())
                    break
                except Exception:
                    param_names = None

        cfg = {}
        if param_names and "pcpSize" in param_names:
            cfg["pcpSize"] = 36
        # numHarmonics non è sempre supportato: non forzarlo
        if cfg and hasattr(key_ex, "configure"):
            key_ex.configure(**cfg)

        k, s, st = key_ex(mono)
        out["key"], out["scale"], out["strength"] = k, s, float(st)
        return out
    except Exception as e:
        out["warnings"].append(f"keyextractor failed: {e}")

    return out

def analyze_track(
    *,
    project_id: str,
    version_id: str,
    profile_key: str,
    mode: str,
    sr: int,
    audio_stereo: np.ndarray,
) -> dict[str, Any]:
    _require_essentia()

    stereo = _ensure_stereo(audio_stereo)
    mono = _to_mono(stereo)
    duration_seconds = float(len(mono) / float(sr)) if mono.size else 0.0

    # BPM
    rhythm = es.RhythmExtractor2013(method="multifeature")

    rhythm_out = rhythm(mono)

    # Essentia può restituire 3 o 5 valori a seconda della versione
    if isinstance(rhythm_out, (list, tuple)):
        bpm = _safe_float(rhythm_out[0])
        beats = rhythm_out[1] if len(rhythm_out) > 1 else []
        beat_conf = _safe_float(rhythm_out[2]) if len(rhythm_out) > 2 else None
    else:
        bpm = None
        beats = []
        beat_conf = None

    warnings: list[str] = []

    # Key (robusto alle differenze di versione)
    key_r = _safe_key_extract(mono)
    key = key_r["key"]
    scale = key_r["scale"]
    key_strength = key_r["strength"]
    warnings.extend(key_r["warnings"])
    key_str = f"{key} {scale}".strip() if key or scale else None

    # Spectral summary (semplice ma utile per grafici)
    spec = es.Spectrum()
    w = es.Windowing(type="hann")
    centroid = es.Centroid(range=sr / 2.0)
    rolloff = es.RollOff(cutoff=0.85)
    frame_size = 2048
    hop = 1024
    cents = []
    rolls = []
    flats = []

    for i in range(0, max(0, len(mono) - frame_size), hop):
        frame = mono[i : i + frame_size]
        sp = spec(w(frame))
        cents.append(float(centroid(sp)))
        rolls.append(float(rolloff(sp)))
        flats.append(_spectral_flatness(sp))

    spectral = {
        "spectral_centroid_hz": float(np.mean(cents)) if cents else 0.0,
        "spectral_rolloff_hz": float(np.mean(rolls)) if rolls else 0.0,
        "spectral_flatness": float(np.mean(flats)) if flats else 0.0,
    }

    # Stereo width (mid/side energy ratio)
    left, right = stereo[0], stereo[1]
    mid = (left + right) * 0.5
    side = (left - right) * 0.5
    mid_e = float(np.mean(mid * mid)) if mid.size else 0.0
    side_e = float(np.mean(side * side)) if side.size else 0.0
    stereo_width = float(side_e / (mid_e + 1e-9))

    loudness = _loudness_stats(stereo, sr)
    warnings.extend(loudness.get("warnings", []))

    # B) Spettro pro (serve anche per model_match)
    freqs, spec = _band_energy_from_stft(mono, sr)
    tilt = _spectral_tilt(freqs, spec)
    band_energy = _band_sums(freqs, spec)
    total_e = float(sum(band_energy.values())) + 1e-12
    band_energy_norm = {k: float(v / total_e) for k, v in band_energy.items()}

    # Payload base metric map per model match
    metric_map = {
        "bpm": bpm,
        "integrated_lufs": _safe_float(loudness.get("integrated_lufs")),
        "stereo_width": _safe_float(stereo_width),
        "spectral_centroid_hz": _safe_float(spectral.get("spectral_centroid_hz")),
        "band_energy_norm": band_energy_norm,
    }

    model = _load_reference_model(profile_key)
    model_match = _compute_model_match(metric_map, model) if model else None

    waveform_peaks = _waveform_peaks(mono, sr, points=1200)
    waveform_bands = _waveform_bands(stereo, sr, points=900)

    # Arrays blob: roba “pesante” per storage, non DB
    arrays_blob = {
        "loudness_stats": {
            "momentary_lufs": loudness["momentary_lufs"],
            "short_term_lufs": loudness["short_term_lufs"],
        },
        "analysis_pro": {
            "rhythm": {
                "beats": [float(x) for x in beats] if beats is not None else [],
                "tempo_curve": [],
            }
        },
    }

    # -----------------------------
    # PRO METRICS (A, B, C, D, E)
    # -----------------------------
    # A) Loudness & dinamica
    crest_db = _crest_db(mono)
    dyn_proxy_db = None
    try:
        st = loudness.get("short_term_lufs") or []
        if st:
            p95 = float(np.quantile(np.asarray(st, dtype=np.float32), 0.95))
            p10 = float(np.quantile(np.asarray(st, dtype=np.float32), 0.10))
            if math.isfinite(p95) and math.isfinite(p10):
                dyn_proxy_db = p95 - p10
    except Exception:
        dyn_proxy_db = None

    # B) Spettro pro (tilt + energy per banda) già calcolato sopra

    # C) Stereo pro
    y_stereo = stereo  # stereo è già (2, N) quando esiste
    stereo_pro = (
        _stereo_metrics_from_stft(y_stereo[0], y_stereo[1], sr)
        if getattr(y_stereo, "shape", (0,))[0] >= 2
        else {
            "lr_correlation": None,
            "lr_balance_db": None,
            "width_by_band": None,
            "correlation_by_band": None,
        }
    )

    # D) Ritmica pro (beat histogram semplice)
    beat_hist = None
    try:
        beats_arr = np.asarray(beats, dtype=np.float32)
        if beats_arr.size >= 8:
            ibi = np.diff(beats_arr)
            ibi = ibi[(ibi > 0.15) & (ibi < 2.0)]
            if ibi.size >= 8:
                bins = np.linspace(0.15, 1.0, 18)  # 17 bins
                hist, edges = np.histogram(ibi, bins=bins)
                beat_hist = {
                    "bins_seconds": edges.astype(np.float32).tolist(),
                    "counts": hist.astype(int).tolist(),
                }
    except Exception:
        beat_hist = None

    # E) Timbre / MFCC
    mfcc_stats = _mfcc_stats(mono, sr, n_mfcc=13)

    analysis_pro = {
        "dynamics": {
            "crest_db": crest_db,
            "dynamic_range_proxy_db": dyn_proxy_db,
            "note": "Se short_term_lufs è vuoto, dynamic_range_proxy può risultare nullo.",
        },
        "spectral": {
            "spectral_tilt": tilt,
            "band_energy": band_energy,
            "band_energy_norm": band_energy_norm,
        },
        "stereo": stereo_pro,
        "rhythm": {
            "beats": beats,
            "beat_histogram": beat_hist,
        },
        "timbre": {
            "mfcc_stats": mfcc_stats,
        },
    }

    return {
        "version_id": version_id,
        "project_id": project_id,
        "profile_key": profile_key,
        "mode": mode,
        "duration_seconds": duration_seconds,
        "bpm": bpm,
        "key": key_str,
        "spectral": spectral,
        "stereo_width": stereo_width,
        "confidence": {
            "bpm": beat_conf,
            "key": key_strength,
        },
        "warnings": warnings,
        "essentia_features": {
            "rhythm": {"bpm": bpm, "confidence": beat_conf},
            "tonal": {"key": key_str, "strength": key_strength},
        },
        "loudness_stats": loudness,
        "model_match": model_match,
        "waveform_peaks": waveform_peaks,
        "waveform_duration": duration_seconds,
        "waveform_bands": waveform_bands,
        "arrays_blob": arrays_blob,
        "analysis_pro": analysis_pro,
        "band_energy_norm": band_energy_norm,
    }

def _ensure_stereo(audio: np.ndarray) -> np.ndarray:
    """
    Ritorna audio in forma (2, N) float32.
    Accetta (N,), (N,1), (N,2), (C,N), (N,C).
    """
    x = np.asarray(audio)
    if x.size == 0:
        return np.zeros((2, 0), dtype=np.float32)

    # 1D -> mono
    if x.ndim == 1:
        mono = x.astype(np.float32, copy=False)
        return np.vstack([mono, mono])

    # 2D
    if x.ndim == 2:
        a, b = x.shape
        if a >= b and b in (1, 2):
            x = x.astype(np.float32, copy=False).T  # -> (C, N)
        else:
            x = x.astype(np.float32, copy=False)    # presume già (C, N)

        if x.shape[0] == 1:
            return np.vstack([x[0], x[0]])
        if x.shape[0] >= 2:
            return x[:2]

    # fallback: mono
    mono = np.asarray(x, dtype=np.float32).reshape(-1)
    return np.vstack([mono, mono])

def _to_mono(stereo: np.ndarray) -> np.ndarray:
    """
    Converte (2, N) o (C, N) in mono (N,) float32.
    Se arriva già (N,), lo ritorna.
    """
    x = np.asarray(stereo)
    if x.size == 0:
        return np.zeros((0,), dtype=np.float32)

    if x.ndim == 1:
        return x.astype(np.float32, copy=False)

    if x.ndim == 2 and x.shape[0] > x.shape[1] and x.shape[1] in (1, 2):
        x = x.T

    if x.ndim == 2:
        if x.shape[0] == 1:
            return x[0].astype(np.float32, copy=False)
        return np.mean(x, axis=0, dtype=np.float32)

    return x.reshape(-1).astype(np.float32, copy=False)