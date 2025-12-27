from __future__ import annotations

from typing import Any, Dict, List
import numpy as np


def _to_mono(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 2 and audio.shape[1] >= 2:
        return ((audio[:, 0] + audio[:, 1]) * 0.5).astype(np.float32, copy=False)
    if audio.ndim == 1:
        return audio.astype(np.float32, copy=False)
    return audio.reshape(-1).astype(np.float32, copy=False)


def _downsample_list(xs: List[float], max_points: int = 256, round_ndigits: int = 3) -> List[float]:
    n = len(xs)
    if n == 0:
        return []
    if n <= max_points:
        return [round(float(v), round_ndigits) for v in xs]
    idx = np.linspace(0, n - 1, num=max_points).astype(int)
    return [round(float(xs[i]), round_ndigits) for i in idx]


def analyze_rhythm(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    mono = _to_mono(audio)
    if mono.size == 0:
        raise ValueError("audio buffer vuoto")

    try:
        import essentia.standard as es
    except Exception as e:
        raise RuntimeError("Essentia non disponibile nell'ambiente Python corrente.") from e

    out: Dict[str, Any] = {
        "bpm": None,
        "bpm_confidence": None,  # raw, non 0-1
        "beat_times": None,
        "beat_times_raw": None,
        "stability": None,
        "danceability": None,  # raw
        "key": None,
        "descriptors": None,
    }

    # Rhythm extractor (ret variabile tra build)
    rex = es.RhythmExtractor2013(method="multifeature")
    ret = rex(mono)

    bpm = ret[0] if len(ret) > 0 else None
    ticks = ret[1] if len(ret) > 1 else []
    confidence = ret[2] if len(ret) > 2 else None

    out["bpm"] = None if bpm is None else float(bpm)
    out["bpm_confidence"] = None if confidence is None else float(confidence)

    ticks = np.asarray(ticks, dtype=np.float64).reshape(-1)
    ticks_list = [float(t) for t in ticks]
    out["beat_times_raw"] = ticks_list
    out["beat_times"] = _downsample_list(ticks_list, max_points=256, round_ndigits=3)

    # Stabilità (ibi std)
    if ticks.size >= 3:
        ibi = np.diff(ticks)
        out["stability"] = float(np.std(ibi))
        out["descriptors"] = {
            "ibi_mean": float(np.mean(ibi)),
            "ibi_std": float(np.std(ibi)),
            "beats_count": int(ticks.size),
        }
    elif ticks.size > 0:
        out["descriptors"] = {"beats_count": int(ticks.size)}

    # Danceability: Essentia ritorna (value, curve) oppure value
    try:
        d_alg = es.Danceability()
        val = d_alg(mono)
        if isinstance(val, (tuple, list)) and len(val) > 0:
            out["danceability"] = float(val[0])
        else:
            out["danceability"] = float(val)
    except Exception:
        out["danceability"] = None

    # KEY (formato Tekkin "Ab minor")
    try:
        # tentativo 1: profile temperley (senza parametri non supportati)
        try:
            kex = es.KeyExtractor(profileType="temperley")
            key, scale, strength = kex(mono)
            if key is not None and scale is not None:
                out["key"] = f"{str(key)} {str(scale)}"
            out["descriptors"] = out.get("descriptors") or {}
            out["descriptors"]["key_strength"] = float(strength) if strength is not None else None
            out["descriptors"]["key_profile"] = "temperley"
        except Exception as e1:
            # fallback 2: default constructor (massima compatibilità)
            kex2 = es.KeyExtractor()
            key2, scale2, strength2 = kex2(mono)
            if key2 is not None and scale2 is not None:
                out["key"] = f"{str(key2)} {str(scale2)}"
            out["descriptors"] = out.get("descriptors") or {}
            out["descriptors"]["key_strength"] = float(strength2) if strength2 is not None else None
            out["descriptors"]["key_profile"] = "default"
            out["descriptors"]["key_fallback_from"] = f"{type(e1).__name__}"
    except Exception as e:
        out["descriptors"] = out.get("descriptors") or {}
        out["descriptors"]["key_error"] = f"{type(e).__name__}: {e}"

    RELATIVE_MINOR = {
        "C": "A", "C#": "A#", "Db": "Bb",
        "D": "B", "D#": "C", "Eb": "C",
        "E": "C#", "F": "D", "F#": "D#", "Gb": "Eb",
        "G": "E", "G#": "F", "Ab": "F",
        "A": "F#", "A#": "G", "Bb": "G",
        "B": "G#",
    }

    RELATIVE_MAJOR = {
        "A": "C", "A#": "C#", "Bb": "Db",
        "B": "D",
        "C": "Eb", "C#": "E", "Db": "E",
        "D": "F", "D#": "F#", "Eb": "Gb",
        "E": "G",
        "F": "Ab", "F#": "A", "Gb": "A",
        "G": "Bb", "G#": "B", "Ab": "B",
    }

    def _split_key(s: str):
        parts = (s or "").strip().split()
        if len(parts) >= 2:
            return parts[0], parts[1].lower()
        return None, None

    k, sc = _split_key(out.get("key") or "")
    if k and sc == "major":
        rel = RELATIVE_MINOR.get(k)
        if rel:
            out["descriptors"] = out.get("descriptors") or {}
            out["descriptors"]["relative_key"] = f"{rel} minor"
    elif k and sc == "minor":
        rel = RELATIVE_MAJOR.get(k)
        if rel:
            out["descriptors"] = out.get("descriptors") or {}
            out["descriptors"]["relative_key"] = f"{rel} major"

    return out
