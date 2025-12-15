from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from glob import glob
from typing import Any, Dict, List, Tuple

import numpy as np

try:
    import essentia.standard as es  # type: ignore
    _ESSENTIA = True
except Exception:
    es = None
    _ESSENTIA = False

from tools.tekkin_analyzer_v4_extras import analyze_v4_extras, BAND_DEFS_V2


AUDIO_EXTS = (".wav", ".aif", ".aiff", ".flac", ".mp3", ".m4a")


def list_audio_files(folder: str) -> List[str]:
    files: List[str] = []
    for ext in AUDIO_EXTS:
        files.extend(glob(os.path.join(folder, f"*{ext}")))
        files.extend(glob(os.path.join(folder, f"*{ext.upper()}")))
    # unique + sorted
    return sorted(list(set(files)))


def _resample_if_needed(audio_nc: np.ndarray, sr: int, target_sr: int) -> Tuple[np.ndarray, int]:
    """
    audio_nc: shape (n, ch) float32
    """
    if sr == target_sr:
        return audio_nc, sr
    if not _ESSENTIA or es is None:
        raise RuntimeError("Essentia non disponibile per resample")

    # Essentia Resample lavora su mono vector, quindi resamplamo per canale
    n, ch = audio_nc.shape
    out_ch: List[np.ndarray] = []
    resampler = es.Resample(inputSampleRate=float(sr), outputSampleRate=float(target_sr), quality=4)

    for c in range(ch):
        y = np.ascontiguousarray(audio_nc[:, c], dtype=np.float32)
        y_rs = resampler(y)
        out_ch.append(np.asarray(y_rs, dtype=np.float32))

    # riallinea lunghezze canali (prendi min)
    min_len = min(x.shape[0] for x in out_ch) if out_ch else 0
    if min_len <= 0:
        raise RuntimeError("Resample fallito: output vuoto")

    stacked = np.stack([x[:min_len] for x in out_ch], axis=1)  # (n, ch)
    return stacked, target_sr


def load_audio(path: str, target_sr: int = 44100) -> Tuple[np.ndarray, np.ndarray, int]:
    """
    Loader robusto per references: usa Essentia AudioLoader, quindi MP3 ok.
    Ritorna:
      y_mono: (n,)
      y_stereo: (2,n) se stereo, altrimenti (1,n)
      sr: sample rate finale
    """
    if not _ESSENTIA or es is None:
        raise RuntimeError("Essentia non disponibile: non posso leggere MP3/M4A in modo affidabile")

    # AudioLoader -> audio shape (n, ch)
    # Nota: non forziamo sampleRate qui per evitare mismatch strani, facciamo resample noi.
    loader = es.AudioLoader(filename=path)
    audio, sr, num_channels = loader()[:3]

    audio_nc = np.asarray(audio, dtype=np.float32)

    if audio_nc.ndim == 1:
        audio_nc = audio_nc.reshape(-1, 1)

    # safety
    if audio_nc.shape[0] < 32:
        raise RuntimeError(f"Audio troppo corto o non valido: {path}")

    audio_nc, sr = _resample_if_needed(audio_nc, int(sr), int(target_sr))

    # (n, ch) -> (ch, n)
    data = audio_nc.T

    if data.shape[0] >= 2:
        y_stereo = data[:2]
        y_mono = (y_stereo[0] + y_stereo[1]) * 0.5
    else:
        y_stereo = data  # (1,n)
        y_mono = data[0]

    return (
        np.asarray(y_mono, dtype=np.float32),
        np.asarray(y_stereo, dtype=np.float32),
        int(sr),
    )


def loudness_ebu(y_stereo: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Loudness e True Peak calcolati su MID (mono) per stabilità.
    """
    if not _ESSENTIA or es is None:
        return {"integrated_lufs": None, "lra": None, "true_peak_db": None}

    # y_stereo: (ch,n) con ch=1 o 2
    if y_stereo.ndim != 2 or y_stereo.shape[1] < 32:
        return {"integrated_lufs": None, "lra": None, "true_peak_db": None}

    if y_stereo.shape[0] >= 2:
        mid = np.ascontiguousarray((y_stereo[0] + y_stereo[1]) * 0.5, dtype=np.float32)
    else:
        mid = np.ascontiguousarray(y_stereo[0], dtype=np.float32)

    integrated_lufs = None
    lra_v = None
    try:
        ebu = es.LoudnessEBUR128(sampleRate=int(sr))
        integrated, lra, momentary, short_term = ebu(mid)  # ordine corretto
        if integrated is not None and np.isfinite(integrated):
            integrated_lufs = float(integrated)
        if lra is not None and np.isfinite(lra):
            lra_v = float(lra)
    except Exception:
        pass

    true_peak_db = None
    try:
        tp = es.TruePeakDetector(sampleRate=int(sr))
        tp_db = float(tp(mid))
        if np.isfinite(tp_db):
            true_peak_db = tp_db
    except Exception:
        pass

    return {"integrated_lufs": integrated_lufs, "lra": lra_v, "true_peak_db": true_peak_db}


def mean_std(values: List[float]) -> Dict[str, float | None]:
    if not values:
        return {"mean": None, "std": None}
    a = np.asarray(values, dtype=np.float64)
    return {"mean": float(np.mean(a)), "std": float(np.std(a))}


def percentiles(values: List[float]) -> Dict[str, float | None]:
    if not values:
        return {"p10": None, "p50": None, "p90": None}
    a = np.asarray(values, dtype=np.float64)
    return {
        "p10": float(np.percentile(a, 10)),
        "p50": float(np.percentile(a, 50)),
        "p90": float(np.percentile(a, 90)),
    }


def build_genre(genre: str, in_dir: str, out_dir: str, sr: int) -> None:
    genre_dir = os.path.join(in_dir, genre)
    files = list_audio_files(genre_dir)
    if not files:
        print(f"[SKIP] {genre}: nessun file in {genre_dir}")
        return

    os.makedirs(out_dir, exist_ok=True)
    tracks_jsonl = os.path.join(out_dir, f"{genre}.tracks.jsonl")
    model_json = os.path.join(out_dir, f"{genre}.json")

    band_series: Dict[str, List[float]] = {k: [] for k, _, _ in BAND_DEFS_V2}
    feat_series: Dict[str, List[float]] = {
        "lufs": [],
        "bpm": [],
        "key_confidence": [],
        "spectral_centroid_hz": [],
        "spectral_rolloff_hz": [],
        "spectral_bandwidth_hz": [],
        "spectral_flatness": [],
        "zero_crossing_rate": [],
    }

    used = 0
    skipped = 0

    with open(tracks_jsonl, "w", encoding="utf-8") as f:
        for path in files:
            try:
                y_mono, y_stereo, _sr = load_audio(path, target_sr=sr)
            except Exception as exc:
                skipped += 1
                print(f"[SKIP] load failed: {path} | {exc}")
                continue

            loud = loudness_ebu(y_stereo=y_stereo, sr=_sr)

            try:
                extras = analyze_v4_extras(
                    y_mono=y_mono,
                    y_stereo=y_stereo,
                    sr=_sr,
                    loudness_stats=None,
                )
            except Exception as exc:
                skipped += 1
                print(f"[SKIP] analyze failed: {path} | {exc}")
                continue

            spectral = extras.get("spectral") or {}
            bands_db = spectral.get("bands_db")
            band_norm = spectral.get("band_norm")

            if not isinstance(bands_db, dict) or not isinstance(band_norm, dict):
                skipped += 1
                print(f"[SKIP] spectral bands missing for: {path}")
                continue

            # bands
            for k, _, _ in BAND_DEFS_V2:
                v = band_norm.get(k)
                if v is not None and np.isfinite(v):
                    band_series[k].append(float(v))

            # features
            lufs = loud.get("integrated_lufs")
            if lufs is not None and np.isfinite(lufs):
                feat_series["lufs"].append(float(lufs))

            bpm = extras.get("bpm")
            if bpm is not None and np.isfinite(bpm):
                feat_series["bpm"].append(float(bpm))

            kc = extras.get("key_confidence")
            if kc is not None and np.isfinite(kc):
                feat_series["key_confidence"].append(float(kc))

            for key in [
                "spectral_centroid_hz",
                "spectral_rolloff_hz",
                "spectral_bandwidth_hz",
                "spectral_flatness",
                "zero_crossing_rate",
            ]:
                v = extras.get(key)
                if v is not None and np.isfinite(v):
                    feat_series[key].append(float(v))

            rec = {
                "genre": genre,
                "path": path,
                "sr": _sr,
                "engine": "essentia",
                "loudness": loud,
                "bpm": extras.get("bpm"),
                "bpm_confidence": extras.get("bpm_confidence"),
                "key": extras.get("key"),
                "key_confidence": extras.get("key_confidence"),
                "spectral": {
                    "bands_db": {k: bands_db.get(k) for k, _, _ in BAND_DEFS_V2},
                    "band_norm": {k: band_norm.get(k) for k, _, _ in BAND_DEFS_V2},
                },
                "features": {
                    "spectral_centroid_hz": extras.get("spectral_centroid_hz"),
                    "spectral_rolloff_hz": extras.get("spectral_rolloff_hz"),
                    "spectral_bandwidth_hz": extras.get("spectral_bandwidth_hz"),
                    "spectral_flatness": extras.get("spectral_flatness"),
                    "zero_crossing_rate": extras.get("zero_crossing_rate"),
                },
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            used += 1

    model = {
        "profile_key": genre,
        "samples_count": used,
        "files_total": len(files),
        "skipped": skipped,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "engine": "essentia",
        "sr": sr,
        "bands_schema": [{"key": k, "fmin": fmin, "fmax": fmax} for k, fmin, fmax in BAND_DEFS_V2],
        "bands_norm_stats": {k: mean_std(v) for k, v in band_series.items()},
        "bands_norm_percentiles": {k: percentiles(v) for k, v in band_series.items()},
        "features_stats": {k: mean_std(v) for k, v in feat_series.items()},
        "features_percentiles": {k: percentiles(v) for k, v in feat_series.items()},
        "tracks_jsonl": os.path.basename(tracks_jsonl),
    }

    with open(model_json, "w", encoding="utf-8") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)

    print(f"[OK] {genre}: used={used} total={len(files)} skipped={skipped} -> {model_json}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="in_dir", default="references")
    p.add_argument("--out", dest="out_dir", default="reference_models")
    p.add_argument("--sr", dest="sr", type=int, default=44100)
    p.add_argument("--genres", nargs="+", required=True)
    args = p.parse_args()

    if not _ESSENTIA or es is None:
        raise RuntimeError("Essentia non disponibile. Non posso confermare build pro senza Essentia.")

    for g in args.genres:
        build_genre(g, args.in_dir, args.out_dir, args.sr)


if __name__ == "__main__":
    main()
