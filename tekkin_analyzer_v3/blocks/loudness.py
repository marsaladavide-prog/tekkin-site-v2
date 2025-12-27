from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import math
import numpy as np


def _lin_to_dbfs(x: float) -> Optional[float]:
    if x <= 0:
        return None
    return float(20.0 * np.log10(x))


def _as_list(x) -> list[float]:
    if x is None:
        return []
    a = np.asarray(x).reshape(-1)
    return [float(v) for v in a]


def _downsample_to(xs: list[float], max_points: int) -> list[float]:
    if not xs:
        return []
    n = len(xs)
    if n <= max_points:
        return xs
    step = int(np.ceil(n / max_points))
    return xs[::step]


def _dbfs_from_linear_peak(x: float) -> Optional[float]:
    eps = 1e-12
    if x <= eps:
        return None
    return float(20.0 * math.log10(max(x, eps)))


def _true_peak_approx_4x_linear(audio: np.ndarray) -> Optional[float]:
    """
    True Peak approssimato via oversampling 4x con interpolazione lineare.
    Non e' un true peak certificato ITU, ma e' molto meglio del sample peak.

    Ritorna dBTP approssimato.
    """
    if audio.size == 0:
        return None

    x = audio.astype(np.float32, copy=False)
    if x.ndim == 1:
        x = x.reshape(-1, 1)
    elif x.ndim == 2:
        pass
    else:
        x = x.reshape(-1, 1)

    n = x.shape[0]
    if n < 2:
        return _dbfs_from_linear_peak(float(np.max(np.abs(x))))

    # oversample 4x: tra ogni coppia inseriamo 3 punti lineari
    # shape target: (n-1)*4 + 1
    t = np.linspace(0.0, 1.0, 4, endpoint=False, dtype=np.float32)  # 0, .25, .5, .75
    max_abs = 0.0

    for ch in range(x.shape[1]):
        a = x[:-1, ch]
        b = x[1:, ch]
        # (n-1, 4) points for each segment, last sample handled after
        seg = (a[:, None] * (1.0 - t[None, :])) + (b[:, None] * t[None, :])
        max_abs = max(max_abs, float(np.max(np.abs(seg))))
        max_abs = max(max_abs, float(abs(x[-1, ch])))

    return _dbfs_from_linear_peak(max_abs)


def _percentiles(xs: List[float]) -> Optional[Dict[str, float]]:
    if not xs:
        return None
    arr = np.asarray(xs, dtype=np.float64)
    return {
        "p10": float(np.percentile(arr, 10)),
        "p50": float(np.percentile(arr, 50)),
        "p90": float(np.percentile(arr, 90)),
    }


def _sections_from_short_term(short_term_lufs: List[float], duration_sec: float) -> Optional[Dict[str, Any]]:
    """
    Heuristica Tekkin: usa short-term LUFS per stimare intro/drop/break/outro.
    - drop: short-term >= p70
    - break: short-term <= p30
    - intro: da 0 al primo drop (max 90s)
    - outro: dall'ultimo drop a fine (max 90s)
    """
    if not short_term_lufs or duration_sec <= 0:
        return None

    st = np.asarray(short_term_lufs, dtype=np.float64)
    n = st.size
    if n < 10:
        return None

    t = np.linspace(0.0, float(duration_sec), num=n, dtype=np.float64)

    p30 = float(np.percentile(st, 30))
    p70 = float(np.percentile(st, 70))

    is_drop = st >= p70
    is_break = st <= p30

    drop_idx = np.where(is_drop)[0]
    intro_end = float(min(90.0, t[int(drop_idx[0])] if drop_idx.size > 0 else min(duration_sec, 60.0)))

    # outro start: ultimo drop
    outro_start = float(max(0.0, duration_sec - 90.0))
    if drop_idx.size > 0:
        outro_start = float(max(outro_start, t[int(drop_idx[-1])]))

    def _slice_stats(mask: np.ndarray) -> Optional[Dict[str, Any]]:
        idx = np.where(mask)[0]
        if idx.size == 0:
            return None
        vals = st[idx]
        seconds = float((idx.size / n) * duration_sec)
        return {
            "mean_short_term_lufs": float(np.mean(vals)),
            "min_short_term_lufs": float(np.min(vals)),
            "max_short_term_lufs": float(np.max(vals)),
            "seconds": seconds,
        }

    intro_mask = t <= intro_end
    outro_mask = t >= outro_start

    # main_mask: quello che non e' intro/outro
    main_mask = (~intro_mask) & (~outro_mask)

    return {
        "thresholds": {"p30": p30, "p70": p70},
        "intro": _slice_stats(intro_mask),
        "drop": _slice_stats(is_drop & main_mask),
        "break": _slice_stats(is_break & main_mask),
        "outro": _slice_stats(outro_mask),
    }


def analyze_loudness(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    if audio is None or audio.size == 0:
        raise ValueError("audio buffer vuoto")

    # stereo richiesto da questa build di Essentia per LoudnessEBUR128
    if audio.ndim == 2 and audio.shape[1] >= 2:
        stereo = audio[:, :2].astype(np.float32, copy=False)
    elif audio.ndim == 1:
        mono = audio.astype(np.float32, copy=False)
        stereo = np.stack([mono, mono], axis=-1).astype(np.float32, copy=False)
    else:
        mono = audio.reshape(-1).astype(np.float32, copy=False)
        stereo = np.stack([mono, mono], axis=-1).astype(np.float32, copy=False)

    # sample peak dBFS
    sample_peak = float(np.max(np.abs(stereo)))
    sample_peak_db = _lin_to_dbfs(sample_peak)

    import essentia.standard as es

    loud = es.LoudnessEBUR128(sampleRate=sr)
    y = loud(stereo)

    # questa build ritorna 4 elementi: 2 ndarray + 2 float
    if not isinstance(y, (tuple, list)) or len(y) != 4:
        raise RuntimeError(
            f"LoudnessEBUR128 returned unexpected type/len: {type(y)} len={getattr(y,'__len__',None)}"
        )

    arr0, arr1, integrated, lra = y[0], y[1], y[2], y[3]
    integrated_lufs = float(integrated)
    lra_val = float(lra)

    curve0 = _as_list(arr0)
    curve1 = _as_list(arr1)

    # Scelta robusta: momentary oscilla di più, short-term è più smooth
    c0 = np.asarray(curve0, dtype=np.float64)
    c1 = np.asarray(curve1, dtype=np.float64)
    std0 = float(np.std(c0)) if c0.size else 0.0
    std1 = float(np.std(c1)) if c1.size else 0.0

    if std0 >= std1:
        momentary_raw, short_raw = curve0, curve1
    else:
        momentary_raw, short_raw = curve1, curve0

    # VIEW: limiti fissi per non spammare e per UI fluida
    momentary_view = _downsample_to(momentary_raw, max_points=512)
    short_view = _downsample_to(short_raw, max_points=256)

    duration_sec = float(audio.shape[0] / sr) if audio.ndim >= 1 and sr > 0 else 0.0

    true_peak_db = _true_peak_approx_4x_linear(audio)  # audio stereo ok
    true_peak_method = "approx_4x_linear"

    momentary_p = _percentiles(momentary_view)  # la lista view che già stai salvando
    short_term_p = _percentiles(short_view)

    sections = _sections_from_short_term(short_view, duration_sec)

    return {
        "integrated_lufs": integrated_lufs,
        "lra": lra_val,
        "sample_peak_db": sample_peak_db,
        "true_peak_db": true_peak_db,
        "true_peak_method": true_peak_method,

        # RAW: completo per blob/UI grafici seri
        "momentary_lufs_raw": momentary_raw,
        "short_term_lufs_raw": short_raw,

        # VIEW: leggero per JSON/UI default
        "momentary_lufs": momentary_view if momentary_view else None,
        "short_term_lufs": short_view if short_view else None,

        "momentary_percentiles": momentary_p,
        "short_term_percentiles": short_term_p,
        "sections": sections,

        "lufs_curve_mode": "essentia_ebu_r128_stereo_beta6dev",
        "lufs_curve_meta": {
            "std_curve0": std0,
            "std_curve1": std1,
            "momentary_raw_len": len(momentary_raw),
            "short_term_raw_len": len(short_raw),
            "momentary_view_len": len(momentary_view),
            "short_term_view_len": len(short_view),
        },
    }
