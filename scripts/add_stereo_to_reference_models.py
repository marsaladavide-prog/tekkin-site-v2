#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Reuse your exact stereo logic from tekkin_analyzer_core.py
# Assumption: you run this from the repo root and the file exists at repo root or in a known path.
# If your file is elsewhere, pass --core-path.
def import_core(core_path: Path):
    import importlib.util

    spec = importlib.util.spec_from_file_location("tekkin_analyzer_core", core_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import core from {core_path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return mod


def p10_p50_p90(x: np.ndarray) -> Dict[str, float]:
    x = x[np.isfinite(x)]
    if x.size == 0:
        return {"p10": math.nan, "p50": math.nan, "p90": math.nan}
    return {
        "p10": float(np.percentile(x, 10)),
        "p50": float(np.percentile(x, 50)),
        "p90": float(np.percentile(x, 90)),
    }


def mean_std(x: np.ndarray) -> Dict[str, float]:
    x = x[np.isfinite(x)]
    if x.size == 0:
        return {"mean": math.nan, "std": math.nan}
    return {"mean": float(np.mean(x)), "std": float(np.std(x, ddof=0))}


def to_jsonable(obj: Any) -> Any:
    # Convert numpy types to Python types
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


def update_track_row_with_stereo(row: Dict[str, Any], stereo_payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    # Ensure analysis_pro exists
    ap = row.get("analysis_pro")
    if not isinstance(ap, dict):
        ap = {}
    row["analysis_pro"] = ap

    # Set stereo (or null if missing)
    ap["stereo"] = stereo_payload if stereo_payload is not None else None
    return row


def compute_stereo_for_track(core_mod, audio_path: Path, sr_expected: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Returns dict with:
      lr_correlation, lr_balance_db, width_by_band, correlation_by_band
    or None if cannot compute.
    """
    # core uses soundfile inside, but we can reuse its loader helpers if present
    try:
        import soundfile as sf
    except Exception:
        raise RuntimeError("soundfile non installato. Installa 'soundfile' (pip install soundfile).")

    if not audio_path.exists():
        return None

    try:
        audio, sr = sf.read(str(audio_path), always_2d=True)
        # audio shape: (n_samples, n_channels)
        audio = audio.T  # -> (channels, samples)
        # Keep only first 2 channels if more
        if audio.shape[0] >= 2:
            stereo = audio[:2, :]
        elif audio.shape[0] == 1:
            # mono: cannot compute stereo metrics properly
            return None
        else:
            return None

        if sr_expected is not None and sr != sr_expected:
            # We do NOT resample here to avoid drifting from your pipeline.
            # If SR differs, we still compute, but it will affect band splits if any depended on SR.
            pass

        # Use your exact function
        stereo_fn = getattr(core_mod, "_analysis_pro_stereo", None)
        if stereo_fn is None:
            raise RuntimeError("Nel core non esiste _analysis_pro_stereo")

        payload = stereo_fn(stereo=stereo, sr=int(sr))
        if not isinstance(payload, dict):
            return None

        # Make JSON-safe
        return to_jsonable(payload)
    except Exception:
        return None


def build_agg_from_rows(rows: List[Dict[str, Any]]) -> StereoAgg:
    lr_corr: List[float] = []
    lr_bal: List[float] = []
    width_by_band: Dict[str, List[float]] = {}
    corr_by_band: Dict[str, List[float]] = {}

    dropped = 0
    total = len(rows)

    for r in rows:
        ap = r.get("analysis_pro")
        stereo = ap.get("stereo") if isinstance(ap, dict) else None
        if not isinstance(stereo, dict):
            dropped += 1
            continue

        v1 = stereo.get("lr_correlation")
        v2 = stereo.get("lr_balance_db")
        if isinstance(v1, (int, float)) and np.isfinite(v1):
            lr_corr.append(float(v1))
        if isinstance(v2, (int, float)) and np.isfinite(v2):
            lr_bal.append(float(v2))

        wbb = stereo.get("width_by_band")
        cbb = stereo.get("correlation_by_band")

        if isinstance(wbb, dict):
            for k, v in wbb.items():
                if isinstance(v, (int, float)) and np.isfinite(v):
                    width_by_band.setdefault(str(k), []).append(float(v))

        if isinstance(cbb, dict):
            for k, v in cbb.items():
                if isinstance(v, (int, float)) and np.isfinite(v):
                    corr_by_band.setdefault(str(k), []).append(float(v))

    return StereoAgg(
        lr_correlation=lr_corr,
        lr_balance_db=lr_bal,
        width_by_band=width_by_band,
        correlation_by_band=corr_by_band,
        dropped_count=dropped,
        total=total,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=str, default=".", help="Repo root")
    parser.add_argument("--reference-models-dir", type=str, default="reference_models", help="Dir with *.json and *.tracks.jsonl")
    parser.add_argument("--core-path", type=str, default="tekkin_analyzer_core.py", help="Path to tekkin_analyzer_core.py")
    parser.add_argument("--dry-run", action="store_true", help="Do not write changes")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    ref_dir = (repo / args.reference_models_dir).resolve()
    core_path = (repo / args.core_path).resolve()

    if not ref_dir.exists():
        raise SystemExit(f"reference_models dir non trovata: {ref_dir}")
    if not core_path.exists():
        raise SystemExit(f"core non trovato: {core_path}")

    core_mod = import_core(core_path)

    jsonl_files = sorted(ref_dir.glob("*.tracks.jsonl"))
    if not jsonl_files:
        raise SystemExit(f"Nessun *.tracks.jsonl in {ref_dir}")

    for jsonl_path in jsonl_files:
        base = jsonl_path.name.replace(".tracks.jsonl", "")
        model_path = ref_dir / f"{base}.json"

        rows = safe_read_jsonl(jsonl_path)
        if not rows:
            print(f"[skip] {jsonl_path.name}: vuoto")
            continue

        # 1) Update each row with stereo metrics
        updated_rows: List[Dict[str, Any]] = []
        computed = 0
        missing = 0

        for row in rows:
            raw_path = row.get("path")
            if not isinstance(raw_path, str) or not raw_path.strip():
                updated_rows.append(update_track_row_with_stereo(row, None))
                missing += 1
                continue

            audio_path = (repo / raw_path).resolve()
            stereo_payload = compute_stereo_for_track(core_mod, audio_path)
            if stereo_payload is None:
                missing += 1
            else:
                computed += 1

            updated_rows.append(update_track_row_with_stereo(row, stereo_payload))

        print(f"[{base}] stereo computed: {computed} / {len(rows)} (missing:{missing})")

        # 2) Aggregate stats into model json
        agg = build_agg_from_rows(updated_rows)

        # Convert lists to arrays for stats
        lr_corr_arr = np.array(agg.lr_correlation, dtype=float)
        lr_bal_arr = np.array(agg.lr_balance_db, dtype=float)

        stereo_stats: Dict[str, Any] = {
            "lr_correlation": mean_std(lr_corr_arr),
            "lr_balance_db": mean_std(lr_bal_arr),
            "width_by_band": {},
            "correlation_by_band": {},
        }
        stereo_percentiles: Dict[str, Any] = {
            "lr_correlation": p10_p50_p90(lr_corr_arr),
            "lr_balance_db": p10_p50_p90(lr_bal_arr),
            "width_by_band": {},
            "correlation_by_band": {},
        }

        # width_by_band
        for k in sorted(agg.width_by_band.keys()):
            arr = np.array(agg.width_by_band[k], dtype=float)
            stereo_stats["width_by_band"][k] = mean_std(arr)
            stereo_percentiles["width_by_band"][k] = p10_p50_p90(arr)

        # correlation_by_band
        for k in sorted(agg.correlation_by_band.keys()):
            arr = np.array(agg.correlation_by_band[k], dtype=float)
            stereo_stats["correlation_by_band"][k] = mean_std(arr)
            stereo_percentiles["correlation_by_band"][k] = p10_p50_p90(arr)

        stereo_dropped = {
            "stereo": {
                "count": int(agg.dropped_count),
                "coverage": float(0.0 if agg.total == 0 else (agg.total - agg.dropped_count) / agg.total),
            }
        }

        model_json: Dict[str, Any] = {}
        if model_path.exists():
            model_json = json.loads(model_path.read_text(encoding="utf-8"))

        # Patch model json
        model_json["stereo_stats"] = stereo_stats
        model_json["stereo_percentiles"] = stereo_percentiles
        model_json["stereo_dropped"] = stereo_dropped

        if args.dry_run:
            print(f"[dry-run] non scrivo {jsonl_path.name} e {model_path.name}")
            continue

        # Backup
        jsonl_bak = jsonl_path.with_suffix(jsonl_path.suffix + ".bak")
        if not jsonl_bak.exists():
            jsonl_bak.write_text(jsonl_path.read_text(encoding="utf-8"), encoding="utf-8")

        if model_path.exists():
            model_bak = model_path.with_suffix(model_path.suffix + ".bak")
            if not model_bak.exists():
                model_bak.write_text(model_path.read_text(encoding="utf-8"), encoding="utf-8")

        # Write
        write_jsonl(jsonl_path, updated_rows)
        model_path.write_text(json.dumps(model_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        print(f"[ok] scritto: {jsonl_path.name}, {model_path.name}")

    print("Done.")


if __name__ == "__main__":
    main()
