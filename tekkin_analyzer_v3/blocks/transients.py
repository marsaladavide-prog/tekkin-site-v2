from __future__ import annotations

from typing import Any, Dict, List, Optional
import math
import numpy as np


def _to_mono(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 2 and audio.shape[1] >= 2:
        return ((audio[:, 0] + audio[:, 1]) * 0.5).astype(np.float32, copy=False)
    if audio.ndim == 1:
        return audio.astype(np.float32, copy=False)
    return audio.reshape(-1).astype(np.float32, copy=False)


def _crest_factor_db(x: np.ndarray) -> Optional[float]:
    eps = 1e-12
    peak = float(np.max(np.abs(x)))
    rms = float(np.sqrt(np.mean(x * x) + eps))
    if rms <= 0:
        return None
    return float(20.0 * np.log10((peak + eps) / (rms + eps)))


def _median(xs: List[float]) -> Optional[float]:
    if not xs:
        return None
    return float(np.median(np.asarray(xs, dtype=np.float64)))


def _peak_pick(x: np.ndarray, threshold: float, refractory: int) -> np.ndarray:
    if x.size < 3:
        return np.asarray([], dtype=np.int32)
    peaks: List[int] = []
    i = 1
    n = int(x.size)
    while i < n - 1:
        if x[i] >= threshold and x[i] >= x[i - 1] and x[i] >= x[i + 1]:
            peaks.append(i)
            i += refractory
        else:
            i += 1
    return np.asarray(peaks, dtype=np.int32)


def analyze_transients(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    mono = _to_mono(audio)
    if mono.size == 0:
        raise ValueError("audio buffer vuoto")

    out: Dict[str, Any] = {
        "crest_factor_db": _crest_factor_db(mono),
        "strength": None,
        "density": None,
        "log_attack_time": None,
    }

    # Envelope RMS frame-based (robusta)
    frame_size = 2048
    hop_size = 512
    eps = 1e-12

    n = int(mono.size)
    if n < frame_size + 2:
        out["warning"] = "audio_too_short"
        return out

    env: List[float] = []
    for start in range(0, n - frame_size + 1, hop_size):
        frame = mono[start : start + frame_size]
        rms = float(np.sqrt(np.mean(frame * frame) + eps))
        env.append(rms)

    e = np.asarray(env, dtype=np.float32)
    if e.size < 5:
        out["warning"] = "env_too_short"
        return out

    # Transient proxy: derivata positiva dell’envelope
    de = np.diff(e)
    de = np.maximum(de, 0.0)

    # z-score per soglia stabile
    mu = float(np.mean(de))
    sd = float(np.std(de))
    if sd <= 1e-12:
        out["warning"] = "env_derivative_flat"
        return out

    z = (de - mu) / (sd + 1e-12)

    # threshold e refractory
    # threshold 2.0: abbastanza selettivo
    # refractory 90ms: evita doppioni
    refractory = max(1, int((0.09 * sr) / hop_size))
    peaks = _peak_pick(z, threshold=2.0, refractory=refractory)

    duration_sec = float(mono.size / sr)
    if duration_sec > 0:
        out["density"] = float(peaks.size / duration_sec)

    if peaks.size == 0:
        out["warning"] = "no_transient_peaks"
        return out

    # strength: mediana della derivata RMS ai picchi (scala lineare)
    strengths = [float(de[i]) for i in peaks if 0 <= i < de.size]
    out["strength"] = _median(strengths)

    # log_attack_time: per ogni picco, quanto ci mette l’env a raggiungere 90% del max locale
    lookahead_frames = max(1, int((0.08 * sr) / hop_size))  # 80ms
    target_ratio = 0.9
    log_attacks: List[float] = []

    for p in peaks:
        p = int(p)
        start = max(0, p)
        end = min(e.size, p + lookahead_frames)
        seg = e[start:end]
        if seg.size < 2:
            continue
        peak_local = float(np.max(seg))
        if peak_local <= eps:
            continue
        thr = peak_local * target_ratio

        k = None
        for j in range(seg.size):
            if float(seg[j]) >= thr:
                k = j
                break
        if k is None:
            continue

        attack_sec = (k * hop_size) / float(sr)
        if attack_sec > 0:
            log_attacks.append(math.log10(attack_sec))

    out["log_attack_time"] = _median(log_attacks)
    return out
