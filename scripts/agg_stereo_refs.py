#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import inspect
import json
import math
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


def load_audio_ffmpeg(path: str, sr: int = 44100):
    ffmpeg = os.environ.get("FFMPEG_BIN", "ffmpeg")
    cmd = [
        ffmpeg,
        "-v",
        "error",
        "-i",
        path,
        "-f",
        "f32le",
        "-acodec",
        "pcm_f32le",
        "-ac",
        "2",
        "-ar",
        str(sr),
        "pipe:1",
    ]
    try:
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("ffmpeg decode timeout (60s)")
    if p.returncode != 0 or not p.stdout:
        err = p.stderr.decode("utf-8", errors="ignore")[:500]
        raise RuntimeError(f"ffmpeg decode failed: {err}")

    audio = np.frombuffer(p.stdout, dtype=np.float32)
    if audio.size < 2:
        raise RuntimeError("decoded audio empty")

    if audio.size % 2 != 0:
        audio = audio[: audio.size - 1]

    stereo = audio.reshape(-1, 2).T  # shape [2, n]
    return stereo, sr


def import_core(core_path: Path):
    import importlib.util

    spec = importlib.util.spec_from_file_location("tekkin_analyzer_core", core_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import core from {core_path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod


def p10_p50_p90(x: np.ndarray) -> Dict[str, float]:
    try:
        x = np.asarray(x, dtype=float)
    except Exception:
        return {"p10": math.nan, "p50": math.nan, "p90": math.nan}

    x = x[np.isfinite(x)]
    if x.size == 0:
        return {"p10": math.nan, "p50": math.nan, "p90": math.nan}
    return {
        "p10": float(np.percentile(x, 10)),
        "p50": float(np.percentile(x, 50)),
        "p90": float(np.percentile(x, 90)),
    }


def mean_std(x: np.ndarray) -> Dict[str, float]:
    try:
        x = np.asarray(x, dtype=float)
    except Exception:
        return {"mean": math.nan, "std": math.nan}

    x = x[np.isfinite(x)]
    if x.size == 0:
        return {"mean": math.nan, "std": math.nan}
    return {"mean": float(np.mean(x)), "std": float(np.std(x, ddof=0))}


def to_jsonable(obj: Any) -> Any:
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.float32, np.float64)):
        return float(obj)
    if isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    if isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_jsonable(v) for v in obj]
    return obj


@dataclass
class StereoAgg:
    lr_correlation: List[float]
    lr_balance_db: List[float]
    width_by_band: Dict[str, List[float]]
    correlation_by_band: Dict[str, List[float]]
    dropped_count: int
    total: int
    sound_field_radius_by_bin: Dict[int, List[float]]


def safe_read_jsonl(path: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not path.exists():
        return out
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            out.append(json.loads(line))
    return out


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    tmp.replace(path)


def update_track_row_with_stereo(row: Dict[str, Any], stereo_payload: Any, *, overwrite: bool):
    row2 = copy.deepcopy(row)
    ap = row2.get("analysis_pro")
    if not isinstance(ap, dict):
        ap = {}
        row2["analysis_pro"] = ap
    if not overwrite and isinstance(ap.get("stereo"), dict):
        return row2
    ap["stereo"] = stereo_payload if stereo_payload is not None else None
    return row2


def _stft_lr_np(
    stereo: np.ndarray, sr: int, n_fft: int = 2048, hop: int = 512
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    stereo: shape (2, n_samples)
    returns: (stft_L, stft_R, freqs_hz)
    stft_* shape: (n_bins, n_frames) complex64
    """
    if stereo.ndim != 2 or stereo.shape[0] < 2:
        raise ValueError("stereo deve avere shape (2, n_samples)")

    xL = stereo[0].astype(np.float32, copy=False)
    xR = stereo[1].astype(np.float32, copy=False)

    if xL.size < n_fft or xR.size < n_fft:
        raise ValueError("audio troppo corto per n_fft")

    win = np.hanning(n_fft).astype(np.float32)
    n_frames = 1 + (xL.size - n_fft) // hop
    if n_frames <= 0:
        raise ValueError("n_frames <= 0")

    stftL = np.empty((n_fft // 2 + 1, n_frames), dtype=np.complex64)
    stftR = np.empty((n_fft // 2 + 1, n_frames), dtype=np.complex64)

    for i in range(n_frames):
        a = i * hop
        b = a + n_fft
        fL = xL[a:b] * win
        fR = xR[a:b] * win
        stftL[:, i] = np.fft.rfft(fL).astype(np.complex64)
        stftR[:, i] = np.fft.rfft(fR).astype(np.complex64)

    freqs_hz = np.fft.rfftfreq(n_fft, d=1.0 / float(sr))
    return stftL, stftR, freqs_hz


def compute_sound_field_from_lr(
    xL: np.ndarray,
    xR: np.ndarray,
    sr: int,
    *,
    win: int = 2048,
    hop: int = 1024,
    n_bins: int = 6,
) -> Dict[str, Any]:
    """
    Restituisce un sound field polar:
    - angle_deg: [0, 60, 120, 180, 240, 300, 360]
    - radius:    valore medio per settore

    Definizioni:
    - pan in [-1,1] da differenza RMS L/R
    - width in [0,1] da energia Mid/Side
    """
    xL = xL.astype(np.float32, copy=False)
    xR = xR.astype(np.float32, copy=False)

    n = min(xL.size, xR.size)
    if n < win:
        raise ValueError("audio troppo corto per sound_field")

    xL = xL[:n]
    xR = xR[:n]

    eps = 1e-12

    sums = np.zeros(n_bins, dtype=np.float64)
    counts = np.zeros(n_bins, dtype=np.int64)

    for start in range(0, n - win + 1, hop):
        wL = xL[start : start + win]
        wR = xR[start : start + win]

        rmsL = float(np.sqrt(np.mean(wL * wL) + eps))
        rmsR = float(np.sqrt(np.mean(wR * wR) + eps))

        pan = (rmsR - rmsL) / (rmsR + rmsL + eps)

        mid = 0.5 * (wL + wR)
        side = 0.5 * (wL - wR)
        rmsM = float(np.sqrt(np.mean(mid * mid) + eps))
        rmsS = float(np.sqrt(np.mean(side * side) + eps))
        width = rmsS / (rmsM + rmsS + eps)

        angle = 180.0 * (pan + 1.0)
        b = int(np.floor((angle / 360.0) * n_bins))
        b = max(0, min(n_bins - 1, b))

        sums[b] += width
        counts[b] += 1

    step = 360 // n_bins
    angle_deg = [i * step for i in range(n_bins)] + [360]

    radius_bins = []
    for i in range(n_bins):
        if counts[i] > 0:
            radius_bins.append(float(sums[i] / counts[i]))
        else:
            radius_bins.append(0.0)

    radius = radius_bins + [radius_bins[0] if radius_bins else 0.0]

    return {
        "angle_deg": angle_deg,
        "radius": radius,
        "meta": {"sr": int(sr), "win": int(win), "hop": int(hop), "bins": int(n_bins)},
    }


def compute_stereo_metrics_fallback(
    stereo: np.ndarray,
    sr: int,
    *,
    bands_hz: Optional[List[Tuple[str, float, float]]] = None,
    sound_field_precomputed: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Calcolo stereo indipendente dal core.
    Output compatibile: lr_correlation, lr_balance_db, width_by_band, correlation_by_band, sound_field.
    """
    if stereo.ndim != 2 or stereo.shape[0] < 2:
        raise ValueError("stereo deve essere (2, n_samples)")

    xL = stereo[0].astype(np.float32, copy=False)
    xR = stereo[1].astype(np.float32, copy=False)
    n = min(xL.size, xR.size)
    if n < 2048:
        raise ValueError("audio troppo corto")

    xL = xL[:n]
    xR = xR[:n]
    eps = 1e-12

    L = xL - float(np.mean(xL))
    R = xR - float(np.mean(xR))
    denom = (float(np.std(L)) * float(np.std(R))) + eps
    lr_correlation = float(np.mean(L * R) / denom)
    lr_correlation = max(-1.0, min(1.0, lr_correlation))

    rmsL = float(np.sqrt(np.mean(xL * xL) + eps))
    rmsR = float(np.sqrt(np.mean(xR * xR) + eps))
    lr_balance_db = float(20.0 * np.log10((rmsR + eps) / (rmsL + eps)))
    lr_balance_db = max(-60.0, min(60.0, lr_balance_db))

    stftL, stftR, freqs_hz = _stft_lr_np(stereo, sr=int(sr), n_fft=2048, hop=512)
    SL = (np.abs(stftL) ** 2).astype(np.float64, copy=False)
    SR = (np.abs(stftR) ** 2).astype(np.float64, copy=False)

    mid_power = 0.5 * (SL + SR)
    side_power = np.maximum(0.0, 0.5 * (SL + SR) - np.sqrt(SL * SR))
    width_tf = side_power / (mid_power + side_power + eps)

    corr_tf = (2.0 * np.sqrt(SL * SR)) / (SL + SR + eps)

    if bands_hz is None:
        bands_hz = [
            ("sub", 20.0, 60.0),
            ("low", 60.0, 150.0),
            ("lowmid", 150.0, 500.0),
            ("mid", 500.0, 2000.0),
            ("presence", 2000.0, 6000.0),
            ("high", 6000.0, 12000.0),
            ("air", 12000.0, 20000.0),
        ]

    width_by_band: Dict[str, float] = {}
    correlation_by_band: Dict[str, float] = {}

    for name, f0, f1 in bands_hz:
        idx = np.where((freqs_hz >= f0) & (freqs_hz < f1))[0]
        if idx.size == 0:
            width_by_band[name] = 0.0
            correlation_by_band[name] = 0.0
            continue

        w = float(np.mean(width_tf[idx, :]))
        c = float(np.mean(corr_tf[idx, :]))
        width_by_band[name] = max(0.0, min(1.0, w))
        correlation_by_band[name] = max(0.0, min(1.0, c))

    if sound_field_precomputed is not None:
        sound_field = sound_field_precomputed
    else:
        sound_field = compute_sound_field_from_lr(xL, xR, int(sr))

    return {
        "lr_correlation": lr_correlation,
        "lr_balance_db": lr_balance_db,
        "width_by_band": width_by_band,
        "correlation_by_band": correlation_by_band,
        "sound_field": sound_field,
        "meta": {"sr": int(sr), "n_fft": 2048, "hop": 512},
    }


def compute_stereo_for_track(core_mod, audio_path: Path):
    if not audio_path.exists():
        return None, f"file non trovato: {audio_path}"

    try:
        stereo, sr = load_audio_ffmpeg(str(audio_path), sr=44100)
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"

    if stereo.shape[0] < 2:
        return None, "audio mono"

    stereo = stereo[:2, :].astype(np.float32, copy=False)

    # compute simple sound_field from L/R
    sound_field = None
    try:
        xL = stereo[0]
        xR = stereo[1]
        sound_field = compute_sound_field_from_lr(xL, xR, int(sr))
    except Exception:
        sound_field = None

    # Se nel core esiste già una funzione diretta, usala
    direct = getattr(core_mod, "_analysis_pro_stereo", None)
    if callable(direct):
        try:
            payload = direct(stereo=stereo, sr=int(sr))
        except TypeError:
            # alcuni core potrebbero avere firma diversa
            try:
                payload = direct(stereo, int(sr))
            except Exception as e:
                return None, f"direct stereo failed: {type(e).__name__}: {e}"

        if isinstance(payload, dict):
            if sound_field is not None and not isinstance(payload.get("sound_field"), dict):
                payload["sound_field"] = sound_field
            return to_jsonable(payload), None
        return None, "payload stereo non valido (direct)"

    # Altrimenti usa pipeline core: _ensure_stereo / _as_stereo_n2 + _stereo_metrics_from_stft
    ensure = getattr(core_mod, "_ensure_stereo", None)
    asn2 = getattr(core_mod, "_as_stereo_n2", None)
    metrics_from_stft = getattr(core_mod, "_stereo_metrics_from_stft", None)

    if callable(ensure):
        stereo = ensure(stereo)
    elif callable(asn2):
        stereo = asn2(stereo)

    if not callable(metrics_from_stft):
        # Core non espone _stereo_metrics_from_stft: usa fallback locale
        try:
            payload = compute_stereo_metrics_fallback(
                stereo, int(sr), sound_field_precomputed=sound_field
            )
            if isinstance(payload, dict):
                if sound_field is not None and not isinstance(payload.get("sound_field"), dict):
                    payload["sound_field"] = sound_field
                return to_jsonable(payload), None
        except Exception as e:
            avail = [k for k in dir(core_mod) if "stereo" in k.lower()]
            return None, f"fallback stereo failed: {type(e).__name__}: {e} | core stereo keys: {avail}"

    # STFT
    stftL, stftR, freqs_hz = _stft_lr_np(stereo, sr=int(sr), n_fft=2048, hop=512)

    # Il core probabilmente vuole magnitudini reali (non complessi)
    stftL_mag = np.abs(stftL).astype(np.float32, copy=False)
    stftR_mag = np.abs(stftR).astype(np.float32, copy=False)
    stft_stereo = np.stack([stftL_mag, stftR_mag], axis=0)  # (2, bins, frames)

    call_errors: List[str] = []

    # 1) (stft_stereo, freqs_hz, sr)
    try:
        payload = metrics_from_stft(stft_stereo, freqs_hz, int(sr))
        if isinstance(payload, dict):
            if sound_field is not None and not isinstance(payload.get("sound_field"), dict):
                payload["sound_field"] = sound_field
            return to_jsonable(payload), None
    except TypeError as e:
        call_errors.append(f"positional(stft_stereo, freqs_hz, sr): {e}")

    # 2) (stft_stereo, sr)
    try:
        payload = metrics_from_stft(stft_stereo, int(sr))
        if isinstance(payload, dict):
            if sound_field is not None and not isinstance(payload.get("sound_field"), dict):
                payload["sound_field"] = sound_field
            return to_jsonable(payload), None
    except TypeError as e:
        call_errors.append(f"positional(stft_stereo, sr): {e}")

    # 3) (stftL_mag, stftR_mag, freqs_hz, sr)
    try:
        payload = metrics_from_stft(stftL_mag, stftR_mag, freqs_hz, int(sr))
        if isinstance(payload, dict):
            if sound_field is not None and not isinstance(payload.get("sound_field"), dict):
                payload["sound_field"] = sound_field
            return to_jsonable(payload), None
    except TypeError as e:
        call_errors.append(f"positional(stftL, stftR, freqs_hz, sr): {e}")

    # 4) (stftL_mag, stftR_mag, sr)
    try:
        payload = metrics_from_stft(stftL_mag, stftR_mag, int(sr))
        if isinstance(payload, dict):
            if sound_field is not None and not isinstance(payload.get("sound_field"), dict):
                payload["sound_field"] = sound_field
            return to_jsonable(payload), None
    except TypeError as e:
        call_errors.append(f"positional(stftL, stftR, sr): {e}")

    # 5) fallback kwargs minimale: prova i nomi più comuni
    try:
        sig = inspect.signature(metrics_from_stft)
        params = sig.parameters
        kwargs: Dict[str, Any] = {}

        if "sr" in params:
            kwargs["sr"] = int(sr)
        if "freqs_hz" in params:
            kwargs["freqs_hz"] = freqs_hz
        if "freqs" in params:
            kwargs["freqs"] = freqs_hz

        if "stft" in params:
            kwargs["stft"] = stft_stereo
        if "S" in params:
            kwargs["S"] = stft_stereo
        if "X" in params:
            kwargs["X"] = stft_stereo
        if "stft_stereo" in params:
            kwargs["stft_stereo"] = stft_stereo

        if kwargs:
            payload = metrics_from_stft(**kwargs)
            if isinstance(payload, dict):
                if sound_field is not None and not isinstance(payload.get("sound_field"), dict):
                    payload["sound_field"] = sound_field
                return to_jsonable(payload), None
    except TypeError as e:
        call_errors.append(f"kwargs(fallback): {e}")

    return None, "stereo metrics call failed: " + " | ".join(call_errors[:3])


def build_agg_from_rows(rows: List[Dict[str, Any]]):
    lr_corr: List[float] = []
    lr_bal: List[float] = []
    wbb: Dict[str, List[float]] = {}
    cbb: Dict[str, List[float]] = {}
    sfb: Dict[int, List[float]] = {i: [] for i in range(6)}
    dropped = 0

    def as_float(v):
        if isinstance(v, bool):
            return None
        if isinstance(v, (int, float, np.integer, np.floating)):
            fv = float(v)
            return fv if np.isfinite(fv) else None
        return None

    for r in rows:
        ap = r.get("analysis_pro")
        stereo = ap.get("stereo") if isinstance(ap, dict) else None
        if not isinstance(stereo, dict):
            dropped += 1
            continue

        v1 = as_float(stereo.get("lr_correlation"))
        v2 = as_float(stereo.get("lr_balance_db"))
        if v1 is not None:
            lr_corr.append(v1)
        if v2 is not None:
            lr_bal.append(v2)

        w = stereo.get("width_by_band")
        if isinstance(w, dict):
            for k, v in w.items():
                fv = as_float(v)
                if fv is not None:
                    wbb.setdefault(str(k), []).append(fv)

        c = stereo.get("correlation_by_band")
        if isinstance(c, dict):
            for k, v in c.items():
                fv = as_float(v)
                if fv is not None:
                    cbb.setdefault(str(k), []).append(fv)

        sf = stereo.get("sound_field")
        if isinstance(sf, dict):
            rr = sf.get("radius")
            if isinstance(rr, list):
                for i in range(min(6, len(rr))):
                    try:
                        val = float(rr[i])
                        if math.isfinite(val):
                            sfb.setdefault(i, []).append(val)
                    except Exception:
                        pass

    return StereoAgg(lr_corr, lr_bal, wbb, cbb, dropped, len(rows), sound_field_radius_by_bin=sfb)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", default=".")
    p.add_argument("--reference-models-dir", default="reference_models")
    p.add_argument("--core-path", default="tekkin_analyzer_core.py")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--overwrite-stereo", action="store_true")
    p.add_argument("--error-log", default="")
    args = p.parse_args()

    repo = Path(args.repo).resolve()
    ref_dir = (repo / args.reference_models_dir).resolve()
    core = import_core((repo / args.core_path).resolve())

    jsonl_files = list(ref_dir.glob("*.tracks.jsonl"))
    if not jsonl_files:
        raise SystemExit("Nessun *.tracks.jsonl trovato")

    for jsonl in jsonl_files:
        try:
            base = jsonl.stem.replace(".tracks", "")
            model_path = ref_dir / f"{base}.json"

            rows = safe_read_jsonl(jsonl)
            print(f"[{base}] rows: {len(rows)}", flush=True)
            updated: List[Dict[str, Any]] = []
            errors: List[Dict[str, Any]] = []

            computed = missing = skipped = 0

            for r in rows:
                ap = r.get("analysis_pro")
                if not args.overwrite_stereo and isinstance(ap, dict) and isinstance(ap.get("stereo"), dict):
                    stereo_existing = ap.get("stereo")
                    has_sf = isinstance(stereo_existing, dict) and isinstance(stereo_existing.get("sound_field"), dict)
                    if has_sf:
                        updated.append(copy.deepcopy(r))
                        skipped += 1
                        continue
                    # se manca sound_field, ricalcoliamo (iniettiamo)

                raw = r.get("path")
                print(f"[{base}] -> {raw}", flush=True)
                if not raw:
                    updated.append(update_track_row_with_stereo(r, None, overwrite=bool(args.overwrite_stereo)))
                    missing += 1
                    errors.append({"model": base, "path": None, "reason": "path mancante"})
                    continue

                payload, err = compute_stereo_for_track(core, repo / raw)
                if payload is None:
                    missing += 1
                    try:
                        print(f"[decode-fail] {raw} :: {err}")
                    except Exception:
                        pass
                    errors.append({"model": base, "path": raw, "reason": err})
                    updated.append(update_track_row_with_stereo(r, None, overwrite=bool(args.overwrite_stereo)))
                else:
                    computed += 1
                    updated.append(update_track_row_with_stereo(r, payload, overwrite=bool(args.overwrite_stereo)))

            print(f"[{base}] computed:{computed} missing:{missing} skipped:{skipped}")

            agg = build_agg_from_rows(updated)

            stats = {
                "lr_correlation": mean_std(np.array(agg.lr_correlation)),
                "lr_balance_db": mean_std(np.array(agg.lr_balance_db)),
                "width_by_band": {k: mean_std(np.array(v)) for k, v in agg.width_by_band.items()},
                "correlation_by_band": {k: mean_std(np.array(v)) for k, v in agg.correlation_by_band.items()},
            }

            pcts = {
                "lr_correlation": p10_p50_p90(np.array(agg.lr_correlation)),
                "lr_balance_db": p10_p50_p90(np.array(agg.lr_balance_db)),
                "width_by_band": {k: p10_p50_p90(np.array(v)) for k, v in agg.width_by_band.items()},
                "correlation_by_band": {k: p10_p50_p90(np.array(v)) for k, v in agg.correlation_by_band.items()},
            }

            model: Dict[str, Any] = json.loads(model_path.read_text(encoding="utf-8")) if model_path.exists() else {}
            model["stereo_stats"] = stats
            model["stereo_percentiles"] = pcts
            model["stereo_dropped"] = {
                "stereo": {
                    "count": agg.dropped_count,
                    "coverage": 0 if agg.total == 0 else (agg.total - agg.dropped_count) / agg.total,
                }
            }

            # sound_field reference: media bin per bin, con chiusura a 360
            step = 60
            angle_deg = [i * step for i in range(6)] + [360]
            radius_bins = []
            for i in range(6):
                vals = agg.sound_field_radius_by_bin.get(i) or []
                radius_bins.append(float(np.mean(vals)) if len(vals) else 0.0)
            radius = radius_bins + [radius_bins[0] if radius_bins else 0.0]

            model["sound_field"] = {"angle_deg": angle_deg, "radius": radius}

            if args.error_log and errors:
                ep = Path(args.error_log)
                write_jsonl(ep, safe_read_jsonl(ep) + errors)

            if args.dry_run:
                print(f"[dry-run] {jsonl.name} / {model_path.name}")
                continue

            # backup una volta sola
            jsonl_bak = jsonl.with_suffix(jsonl.suffix + ".bak")
            if not jsonl_bak.exists():
                jsonl_bak.write_text(jsonl.read_text(encoding="utf-8"), encoding="utf-8")

            if model_path.exists():
                model_bak = model_path.with_suffix(model_path.suffix + ".bak")
                if not model_bak.exists():
                    model_bak.write_text(model_path.read_text(encoding="utf-8"), encoding="utf-8")

            write_jsonl(jsonl, updated)
            model_path.write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"[ok] scritto: {jsonl.name}, {model_path.name}")
        except Exception as e:
            print(f"[{jsonl.name}] fatal error: {type(e).__name__}: {e}")
            continue

    print("Done.")


if __name__ == "__main__":
    main()
