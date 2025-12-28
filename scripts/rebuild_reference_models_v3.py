#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

PCTS = (10, 50, 90)

BAND_KEYS = ("sub", "low", "lowmid", "mid", "presence", "high", "air")

SECTION_KEYS = ("intro", "drop", "break", "outro")
SECTION_METRICS = ("seconds", "mean_short_term_lufs", "min_short_term_lufs", "max_short_term_lufs")

# Sound field reference grid (degrees)
SOUND_FIELD_DEG_MAX = 180
SOUND_FIELD_STEP = 5
SOUND_FIELD_BINS = list(range(0, SOUND_FIELD_DEG_MAX + 1, SOUND_FIELD_STEP))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def is_finite_number(x: Any) -> bool:
    return isinstance(x, (int, float)) and math.isfinite(float(x))


def safe_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        v = float(x)
        if not math.isfinite(v):
            return None
        return v
    except Exception:
        return None


def get_in(d: Any, path: str) -> Any:
    cur = d
    for part in path.split("."):
        if cur is None:
            return None
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def pick_first(result: Dict[str, Any], paths: Sequence[str]) -> Any:
    for p in paths:
        v = get_in(result, p)
        if v is not None:
            return v
    return None


def pct_dict(values: Sequence[float]) -> Optional[Dict[str, float]]:
    xs = [float(v) for v in values if is_finite_number(v)]
    if not xs:
        return None
    arr = np.asarray(xs, dtype=np.float64)
    out: Dict[str, float] = {}
    for p in PCTS:
        out[f"p{p}"] = float(np.percentile(arr, p))
    return out


def pct_scalar(values: Sequence[Optional[float]]) -> Optional[Dict[str, float]]:
    xs: List[float] = []
    for v in values:
        if v is None:
            continue
        fv = float(v)
        if not math.isfinite(fv):
            continue
        xs.append(fv)
    return pct_dict(xs) if xs else None


def mean_std_vector(vectors: Sequence[Sequence[float]]) -> Optional[Dict[str, List[float]]]:
    mats: List[np.ndarray] = []
    for v in vectors:
        if not isinstance(v, (list, tuple)) or len(v) == 0:
            continue
        try:
            arr = np.asarray(v, dtype=np.float64).reshape(-1)
            if arr.ndim != 1:
                continue
            if np.any(~np.isfinite(arr)):
                continue
            mats.append(arr)
        except Exception:
            continue
    if not mats:
        return None
    mat = np.stack(mats, axis=0)
    mean = np.mean(mat, axis=0)
    std = np.std(mat, axis=0)
    return {"mean": [float(x) for x in mean.tolist()], "std": [float(x) for x in std.tolist()]}


def avg_curve(curves: Sequence[Tuple[List[float], List[float]]]) -> Optional[Dict[str, List[float]]]:
    good: List[Tuple[np.ndarray, np.ndarray]] = []
    for hz, db in curves:
        try:
            hz_a = np.asarray(hz, dtype=np.float64)
            db_a = np.asarray(db, dtype=np.float64)
            if hz_a.ndim != 1 or db_a.ndim != 1:
                continue
            if hz_a.size != db_a.size:
                continue
            if hz_a.size < 8:
                continue
            if np.any(~np.isfinite(hz_a)) or np.any(~np.isfinite(db_a)):
                continue
            good.append((hz_a, db_a))
        except Exception:
            continue

    if not good:
        return None

    hz0 = good[0][0]
    aligned = [db for (hz, db) in good if hz.size == hz0.size and np.allclose(hz, hz0, atol=1e-9)]
    if not aligned:
        return None

    mat = np.stack(aligned, axis=0)
    ref_db = np.mean(mat, axis=0)
    return {"hz": [float(x) for x in hz0.tolist()], "ref_db": [float(x) for x in ref_db.tolist()]}


def call_analyze_v3_subprocess(
    audio_path: Path,
    profile_key: str,
    python_exe: str,
    cwd: Path,
    timeout_sec: int = 900,
) -> Dict[str, Any]:
    env = os.environ.copy()
    cmd = [
        python_exe,
        "-m",
        "tekkin_analyzer_v3.analyze_v3",
        str(audio_path),
        "--profile-key",
        profile_key,
    ]
    p = subprocess.run(
        cmd,
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout_sec,
    )
    if p.returncode != 0:
        raise RuntimeError(f"analyze_v3 failed rc={p.returncode} stderr={p.stderr.strip()[:800]}")
    try:
        return json.loads(p.stdout)
    except Exception as e:
        head = p.stdout.strip()[:800]
        raise RuntimeError(f"failed to parse analyzer stdout as json: {e}; head={head}") from e


def add_band_values(dst: Dict[str, List[float]], maybe: Any) -> None:
    if not isinstance(maybe, dict):
        return
    for k, v in maybe.items():
        fv = safe_float(v)
        if fv is None:
            continue
        dst.setdefault(str(k), []).append(fv)


def add_sound_field_track(dst_tracks: List[Dict[int, float]], points: Any) -> None:
    """
    points expected: list of {"angle_deg": float, "radius": float}
    Binning to SOUND_FIELD_STEP, mean radius per bin per track.
    """
    if not isinstance(points, list) or not points:
        return

    acc: Dict[int, List[float]] = {}
    for it in points:
        if not isinstance(it, dict):
            continue
        a = safe_float(it.get("angle_deg"))
        r = safe_float(it.get("radius"))
        if a is None or r is None:
            continue
        if a < 0 or a > SOUND_FIELD_DEG_MAX:
            continue
        b = int(round(a / SOUND_FIELD_STEP) * SOUND_FIELD_STEP)
        b = max(0, min(SOUND_FIELD_DEG_MAX, b))
        acc.setdefault(b, []).append(float(r))

    if not acc:
        return

    track_bins: Dict[int, float] = {}
    for b, rs in acc.items():
        if not rs:
            continue
        track_bins[b] = float(np.mean(np.asarray(rs, dtype=np.float64)))
    if track_bins:
        dst_tracks.append(track_bins)


def add_sound_field_xy_track(dst_tracks: List[List[Tuple[float, float]]], points: Any) -> None:
    if not isinstance(points, list) or not points:
        return
    out: List[Tuple[float, float]] = []
    for it in points:
        if not isinstance(it, dict):
            continue
        x = safe_float(it.get("x"))
        y = safe_float(it.get("y"))
        if x is None or y is None:
            continue
        x = max(-1.0, min(1.0, float(x)))
        y = max(-1.0, min(1.0, float(y)))
        out.append((x, y))
    if not out:
        return
    if len(out) > 300:
        idx = np.linspace(0, len(out) - 1, num=300).astype(int)
        out = [out[i] for i in idx]
    dst_tracks.append(out)


def aggregate_sound_field(tracks_bins: Sequence[Dict[int, float]]) -> Optional[Dict[str, Any]]:
    """
    Returns:
      {
        "angle_deg": [0,5,...,180],
        "p10_radius": [...],
        "p50_radius": [...],
        "p90_radius": [...],
        "bin_step_deg": 5,
        "deg_max": 180
      }
    Only bins with >=3 tracks.
    """
    if not tracks_bins:
        return None

    out_angles: List[int] = []
    out_p10: List[Optional[float]] = []
    out_p50: List[Optional[float]] = []
    out_p90: List[Optional[float]] = []

    for b in SOUND_FIELD_BINS:
        xs: List[float] = []
        for tb in tracks_bins:
            v = tb.get(b)
            if v is None:
                continue
            if not math.isfinite(float(v)):
                continue
            xs.append(float(v))

        out_angles.append(b)
        if len(xs) < 3:
            out_p10.append(None)
            out_p50.append(None)
            out_p90.append(None)
            continue

        arr = np.asarray(xs, dtype=np.float64)
        out_p10.append(float(np.percentile(arr, 10)))
        out_p50.append(float(np.percentile(arr, 50)))
        out_p90.append(float(np.percentile(arr, 90)))

    if all(v is None for v in out_p50):
        return None

    return {
        "angle_deg": out_angles,
        "p10_radius": out_p10,
        "p50_radius": out_p50,
        "p90_radius": out_p90,
        "bin_step_deg": SOUND_FIELD_STEP,
        "deg_max": SOUND_FIELD_DEG_MAX,
    }


def aggregate_sound_field_xy(tracks_points: Sequence[List[Tuple[float, float]]], max_points: int = 1200) -> Optional[List[Dict[str, float]]]:
    if not tracks_points:
        return None
    grid = 40
    counts = np.zeros((grid, grid), dtype=np.int32)
    for track in tracks_points:
        for x, y in track:
            ix = int(round(((x + 1.0) / 2.0) * (grid - 1)))
            iy = int(round(((y + 1.0) / 2.0) * (grid - 1)))
            ix = max(0, min(grid - 1, ix))
            iy = max(0, min(grid - 1, iy))
            counts[iy, ix] += 1
    if not np.any(counts):
        return None
    max_count = int(np.max(counts))
    cells: List[Tuple[int, int, int]] = []
    for iy in range(grid):
        for ix in range(grid):
            c = int(counts[iy, ix])
            if c > 0:
                cells.append((c, ix, iy))
    cells.sort(reverse=True)
    out: List[Dict[str, float]] = []
    cell_size = 2.0 / float(grid - 1)
    for c, ix, iy in cells:
        if len(out) >= max_points:
            break
        weight = max(1, int(round((c / max_count) * 4)))
        for j in range(weight):
            if len(out) >= max_points:
                break
            jitter_x = ((j + 1) / (weight + 1) - 0.5) * cell_size * 0.6
            jitter_y = ((j + 1) / (weight + 1) - 0.5) * cell_size * 0.6
            x = -1.0 + ix * cell_size + jitter_x
            y = -1.0 + iy * cell_size + jitter_y
            out.append({"x": round(float(x), 4), "y": round(float(y), 4)})
    return out or None


def mean_std_scalar(values: Sequence[float]) -> Optional[Dict[str, float]]:
    xs = [float(v) for v in values if is_finite_number(v)]
    if not xs:
        return None
    arr = np.asarray(xs, dtype=np.float64)
    return {"mean": float(np.mean(arr)), "std": float(np.std(arr))}


@dataclass
class TrackAgg:
    # Timbre
    bands_norm: Dict[str, List[float]] = field(default_factory=dict)
    spectrum_curves: List[Tuple[List[float], List[float]]] = field(default_factory=list)

    # Spectral stats
    spectral_centroid_hz: List[Optional[float]] = field(default_factory=list)
    spectral_bandwidth_hz: List[Optional[float]] = field(default_factory=list)
    zero_crossing_rate: List[Optional[float]] = field(default_factory=list)

    # Loudness scalars
    integrated_lufs: List[Optional[float]] = field(default_factory=list)
    lra: List[Optional[float]] = field(default_factory=list)
    sample_peak_db: List[Optional[float]] = field(default_factory=list)
    true_peak_db: List[Optional[float]] = field(default_factory=list)

    # Loudness views percentiles (per-track)
    momentary_p10: List[Optional[float]] = field(default_factory=list)
    momentary_p50: List[Optional[float]] = field(default_factory=list)
    momentary_p90: List[Optional[float]] = field(default_factory=list)

    short_term_p10: List[Optional[float]] = field(default_factory=list)
    short_term_p50: List[Optional[float]] = field(default_factory=list)
    short_term_p90: List[Optional[float]] = field(default_factory=list)

    # Loudness sections
    section_values: Dict[str, Dict[str, List[Optional[float]]]] = field(
        default_factory=lambda: {s: {m: [] for m in SECTION_METRICS} for s in SECTION_KEYS}
    )

    # Stereo
    stereo_width: List[Optional[float]] = field(default_factory=list)
    width_by_band: Dict[str, List[float]] = field(default_factory=dict)

    corr_avg: List[Optional[float]] = field(default_factory=list)
    corr_p05: List[Optional[float]] = field(default_factory=list)
    corr_min: List[Optional[float]] = field(default_factory=list)

    # Sound field
    sound_field_tracks: List[Dict[int, float]] = field(default_factory=list)
    sound_field_xy_tracks: List[List[Tuple[float, float]]] = field(default_factory=list)

    # Transients
    crest_factor_db: List[Optional[float]] = field(default_factory=list)
    transient_strength: List[Optional[float]] = field(default_factory=list)
    transient_density: List[Optional[float]] = field(default_factory=list)
    log_attack_time: List[Optional[float]] = field(default_factory=list)

    # Rhythm
    bpm: List[Optional[float]] = field(default_factory=list)
    stability: List[Optional[float]] = field(default_factory=list)
    danceability: List[Optional[float]] = field(default_factory=list)
    key_counts: Dict[str, int] = field(default_factory=dict)
    relative_key_counts: Dict[str, int] = field(default_factory=dict)

    # Rhythm descriptors
    desc_ibi_mean: List[Optional[float]] = field(default_factory=list)
    desc_ibi_std: List[Optional[float]] = field(default_factory=list)
    desc_beats_count: List[Optional[float]] = field(default_factory=list)
    desc_key_strength: List[Optional[float]] = field(default_factory=list)

    # Extra
    hfc: List[Optional[float]] = field(default_factory=list)
    spectral_peaks_energy: List[Optional[float]] = field(default_factory=list)
    mfcc_means: List[List[float]] = field(default_factory=list)

    # Tracking
    ok_files: List[str] = field(default_factory=list)
    failed_files: List[Dict[str, str]] = field(default_factory=list)


def extract_metrics_v3(result: Dict[str, Any], agg: TrackAgg) -> None:
    # Loudness scalars
    agg.integrated_lufs.append(safe_float(get_in(result, "blocks.loudness.data.integrated_lufs")))
    agg.lra.append(safe_float(get_in(result, "blocks.loudness.data.lra")))
    agg.sample_peak_db.append(safe_float(get_in(result, "blocks.loudness.data.sample_peak_db")))
    agg.true_peak_db.append(safe_float(get_in(result, "blocks.loudness.data.true_peak_db")))

    # Loudness view percentiles
    mp = get_in(result, "blocks.loudness.data.momentary_percentiles")
    if isinstance(mp, dict):
        agg.momentary_p10.append(safe_float(mp.get("p10")))
        agg.momentary_p50.append(safe_float(mp.get("p50")))
        agg.momentary_p90.append(safe_float(mp.get("p90")))

    sp = get_in(result, "blocks.loudness.data.short_term_percentiles")
    if isinstance(sp, dict):
        agg.short_term_p10.append(safe_float(sp.get("p10")))
        agg.short_term_p50.append(safe_float(sp.get("p50")))
        agg.short_term_p90.append(safe_float(sp.get("p90")))

    # Loudness sections
    sections = get_in(result, "blocks.loudness.data.sections")
    if isinstance(sections, dict):
        for s in SECTION_KEYS:
            sv = sections.get(s)
            if not isinstance(sv, dict):
                continue
            for m in SECTION_METRICS:
                agg.section_values[s][m].append(safe_float(sv.get(m)))

    # Timbre
    add_band_values(agg.bands_norm, get_in(result, "blocks.timbre_spectrum.data.bands_norm"))

    spec = get_in(result, "blocks.timbre_spectrum.data.spectrum_db")
    if isinstance(spec, dict):
        hz = spec.get("hz")
        db = spec.get("track_db") if "track_db" in spec else spec.get("db")
        if isinstance(hz, list) and isinstance(db, list) and len(hz) == len(db) and len(hz) > 0:
            agg.spectrum_curves.append((hz, db))

    spc = get_in(result, "blocks.timbre_spectrum.data.spectral")
    if isinstance(spc, dict):
        agg.spectral_centroid_hz.append(safe_float(spc.get("spectral_centroid_hz")))
        agg.spectral_bandwidth_hz.append(safe_float(spc.get("spectral_bandwidth_hz")))
        agg.zero_crossing_rate.append(safe_float(spc.get("zero_crossing_rate")))
    else:
        agg.spectral_centroid_hz.append(safe_float(get_in(result, "blocks.spectral.data.spectral_centroid_hz")))
        agg.spectral_bandwidth_hz.append(safe_float(get_in(result, "blocks.spectral.data.spectral_bandwidth_hz")))
        agg.zero_crossing_rate.append(safe_float(get_in(result, "blocks.spectral.data.zero_crossing_rate")))

    # Stereo
    agg.stereo_width.append(
        safe_float(
            pick_first(
                result,
                ["blocks.stereo.data.stereo_width", "blocks.stereo.data.stereoWidth"],
            )
        )
    )

    add_band_values(
        agg.width_by_band,
        pick_first(
            result,
            ["blocks.stereo.data.width_by_band", "blocks.stereo.data.widthByBand"],
        ),
    )

    ss = pick_first(
        result,
        ["blocks.stereo.data.stereo_summary", "blocks.stereo.data.summary", "blocks.stereo.data.stereoSummary"],
    )
    if isinstance(ss, dict):
        agg.corr_avg.append(safe_float(ss.get("correlation_avg")))
        agg.corr_p05.append(safe_float(ss.get("correlation_p05")))
        agg.corr_min.append(safe_float(ss.get("correlation_min")))
    else:
        agg.corr_avg.append(safe_float(get_in(result, "blocks.stereo.data.correlation_avg")))
        agg.corr_p05.append(safe_float(get_in(result, "blocks.stereo.data.correlation_p05")))
        agg.corr_min.append(safe_float(get_in(result, "blocks.stereo.data.correlation_min")))

    sf = pick_first(result, ["blocks.stereo.data.sound_field", "blocks.stereo.data.soundField", "sound_field"])
    add_sound_field_track(agg.sound_field_tracks, sf)
    sf_xy = pick_first(result, ["blocks.stereo.data.sound_field_xy", "blocks.stereo.data.soundFieldXY", "sound_field_xy"])
    add_sound_field_xy_track(agg.sound_field_xy_tracks, sf_xy)

    # Transients (robusto)
    agg.crest_factor_db.append(
        safe_float(
            pick_first(
                result,
                [
                    "blocks.transients.data.crest_factor_db",
                    "blocks.transients.data.crestFactorDb",
                    "blocks.transients.data.crest_factor",
                    "blocks.transients.data.crestFactor",
                ],
            )
        )
    )
    agg.transient_strength.append(
        safe_float(pick_first(result, ["blocks.transients.data.strength", "blocks.transients.data.transient_strength"]))
    )
    agg.transient_density.append(
        safe_float(pick_first(result, ["blocks.transients.data.density", "blocks.transients.data.transient_density"]))
    )
    agg.log_attack_time.append(
        safe_float(pick_first(result, ["blocks.transients.data.log_attack_time", "blocks.transients.data.logAttackTime"]))
    )

    # Rhythm
    agg.bpm.append(safe_float(get_in(result, "blocks.rhythm.data.bpm")))
    agg.stability.append(safe_float(get_in(result, "blocks.rhythm.data.stability")))
    agg.danceability.append(safe_float(get_in(result, "blocks.rhythm.data.danceability")))

    key_str = get_in(result, "blocks.rhythm.data.key")
    if isinstance(key_str, str) and key_str.strip():
        k = key_str.strip()
        agg.key_counts[k] = agg.key_counts.get(k, 0) + 1

    rk = pick_first(result, ["blocks.rhythm.data.relative_key", "blocks.rhythm.data.descriptors.relative_key"])
    if isinstance(rk, str) and rk.strip():
        rks = rk.strip()
        agg.relative_key_counts[rks] = agg.relative_key_counts.get(rks, 0) + 1

    desc = get_in(result, "blocks.rhythm.data.descriptors")
    if isinstance(desc, dict):
        agg.desc_ibi_mean.append(safe_float(desc.get("ibi_mean")))
        agg.desc_ibi_std.append(safe_float(desc.get("ibi_std")))
        agg.desc_beats_count.append(safe_float(desc.get("beats_count")))
        agg.desc_key_strength.append(safe_float(desc.get("key_strength")))

    # Extra
    agg.hfc.append(safe_float(get_in(result, "blocks.extra.data.hfc")))
    agg.spectral_peaks_energy.append(safe_float(get_in(result, "blocks.extra.data.spectral_peaks_energy")))

    mfcc = get_in(result, "blocks.extra.data.mfcc")
    if isinstance(mfcc, dict):
        m = mfcc.get("mean")
        if isinstance(m, list) and len(m) > 0:
            try:
                arr = np.asarray(m, dtype=np.float64)
                if arr.ndim == 1 and np.all(np.isfinite(arr)):
                    agg.mfcc_means.append([float(x) for x in arr.tolist()])
            except Exception:
                pass


def iter_audio_files(folder: Path) -> List[Path]:
    exts = {".mp3", ".wav", ".aiff", ".aif", ".flac", ".m4a"}
    files: List[Path] = []
    for p in sorted(folder.rglob("*")):
        if p.is_file() and p.suffix.lower() in exts:
            files.append(p)
    return files


def pct_by_band(d: Dict[str, List[float]]) -> Optional[Dict[str, Dict[str, float]]]:
    out: Dict[str, Dict[str, float]] = {}
    for k, values in d.items():
        p = pct_dict(values)
        if p:
            out[k] = p
    return out or None


def build_sections_percentiles(agg: TrackAgg) -> Optional[Dict[str, Any]]:
    out: Dict[str, Any] = {}
    for s in SECTION_KEYS:
        s_out: Dict[str, Any] = {}
        for m in SECTION_METRICS:
            p = pct_scalar(agg.section_values[s][m])
            if p:
                s_out[m] = p
        if s_out:
            out[s] = s_out
    return out or None


def build_genre_model(profile_key: str, agg: TrackAgg) -> Dict[str, Any]:
    # Bands percentiles
    bands_norm_percentiles = pct_by_band(agg.bands_norm)

    # Legacy: bands_norm (median) + bands_norm_stats (mean/std)
    bands_norm = None
    bands_norm_stats = None
    if bands_norm_percentiles:
        bands_norm = {
            k: float(v["p50"])
            for k, v in bands_norm_percentiles.items()
            if isinstance(v, dict) and "p50" in v
        }

    stats_out: Dict[str, Any] = {}
    for k, values in agg.bands_norm.items():
        ms = mean_std_scalar(values)
        if ms:
            stats_out[k] = ms
    bands_norm_stats = stats_out or None

    # Spectrum
    spectrum_ref = avg_curve(agg.spectrum_curves)

    # Legacy alias for UI V2
    spectrum_db = None
    if isinstance(spectrum_ref, dict) and "hz" in spectrum_ref and "ref_db" in spectrum_ref:
        spectrum_db = {"hz": spectrum_ref["hz"], "ref_db": spectrum_ref["ref_db"]}

    # Spectral percentiles
    spectral_percentiles: Dict[str, Any] = {}
    v = pct_scalar(agg.spectral_centroid_hz)
    if v:
        spectral_percentiles["spectral_centroid_hz"] = v
    v = pct_scalar(agg.spectral_bandwidth_hz)
    if v:
        spectral_percentiles["spectral_bandwidth_hz"] = v
    v = pct_scalar(agg.zero_crossing_rate)
    if v:
        spectral_percentiles["zero_crossing_rate"] = v
    spectral_percentiles = spectral_percentiles or None

    # Loudness percentiles
    loudness_percentiles: Dict[str, Any] = {}
    for name, values in [
        ("integrated_lufs", agg.integrated_lufs),
        ("lra", agg.lra),
        ("sample_peak_db", agg.sample_peak_db),
        ("true_peak_db", agg.true_peak_db),
    ]:
        p = pct_scalar(values)
        if p:
            loudness_percentiles[name] = p
    loudness_percentiles = loudness_percentiles or None

    # Legacy alias expected by UI V2 compare model extractor
    features_percentiles = None
    if loudness_percentiles:
        fp: Dict[str, Any] = {}
        if "integrated_lufs" in loudness_percentiles:
            fp["lufs"] = loudness_percentiles["integrated_lufs"]
        if "lra" in loudness_percentiles:
            fp["lra"] = loudness_percentiles["lra"]
        if "true_peak_db" in loudness_percentiles:
            fp["true_peak_db"] = loudness_percentiles["true_peak_db"]
        if "sample_peak_db" in loudness_percentiles:
            fp["sample_peak_db"] = loudness_percentiles["sample_peak_db"]
        features_percentiles = fp or None

    # Loudness views percentiles (percentile-of-percentiles)
    loudness_views_percentiles: Dict[str, Any] = {}
    mp10 = pct_scalar(agg.momentary_p10)
    mp50 = pct_scalar(agg.momentary_p50)
    mp90 = pct_scalar(agg.momentary_p90)
    if mp10 and mp50 and mp90:
        loudness_views_percentiles["momentary_percentiles"] = {"p10": mp10, "p50": mp50, "p90": mp90}

    sp10 = pct_scalar(agg.short_term_p10)
    sp50 = pct_scalar(agg.short_term_p50)
    sp90 = pct_scalar(agg.short_term_p90)
    if sp10 and sp50 and sp90:
        loudness_views_percentiles["short_term_percentiles"] = {"p10": sp10, "p50": sp50, "p90": sp90}

    loudness_views_percentiles = loudness_views_percentiles or None

    sections_percentiles = build_sections_percentiles(agg)

    # Transients percentiles
    transients_percentiles: Dict[str, Any] = {}
    for name, values in [
        ("crest_factor_db", agg.crest_factor_db),
        ("strength", agg.transient_strength),
        ("density", agg.transient_density),
        ("log_attack_time", agg.log_attack_time),
    ]:
        p = pct_scalar(values)
        if p:
            transients_percentiles[name] = p
    transients_percentiles = transients_percentiles or None

    # Rhythm percentiles
    rhythm_percentiles: Dict[str, Any] = {}
    for name, values in [("bpm", agg.bpm), ("stability", agg.stability), ("danceability", agg.danceability)]:
        p = pct_scalar(values)
        if p:
            rhythm_percentiles[name] = p
    rhythm_percentiles = rhythm_percentiles or None

    rhythm_descriptors_percentiles: Dict[str, Any] = {}
    for name, values in [
        ("ibi_mean", agg.desc_ibi_mean),
        ("ibi_std", agg.desc_ibi_std),
        ("beats_count", agg.desc_beats_count),
        ("key_strength", agg.desc_key_strength),
    ]:
        p = pct_scalar(values)
        if p:
            rhythm_descriptors_percentiles[name] = p
    rhythm_descriptors_percentiles = rhythm_descriptors_percentiles or None

    # Stereo percentiles
    stereo_percentiles: Dict[str, Any] = {}

    p = pct_scalar(agg.stereo_width)
    if p:
        stereo_percentiles["stereo_width"] = p

    wb = pct_by_band(agg.width_by_band)
    if wb:
        # New shape you already use
        stereo_percentiles["width_by_band"] = wb
        # Legacy key expected by extractor in mapVersionToAnalyzerCompareModel.ts
        stereo_percentiles["width_by_band_percentiles"] = wb

    # Correlation: keep your shape + add alias for extractor
    corr: Dict[str, Any] = {}
    p = pct_scalar(agg.corr_avg)
    if p:
        corr["avg"] = p
        # Legacy-ish alias: extractor expects stereo.lr_correlation
        stereo_percentiles["lr_correlation"] = p

    p = pct_scalar(agg.corr_p05)
    if p:
        corr["p05"] = p
    p = pct_scalar(agg.corr_min)
    if p:
        corr["min"] = p
    if corr:
        stereo_percentiles["correlation"] = corr

    stereo_percentiles = stereo_percentiles or None

    sound_field_ref = aggregate_sound_field(agg.sound_field_tracks)
    sound_field_xy_ref = aggregate_sound_field_xy(agg.sound_field_xy_tracks)

    # Extra percentiles
    extra_percentiles: Dict[str, Any] = {}
    for name, values in [("hfc", agg.hfc), ("spectral_peaks_energy", agg.spectral_peaks_energy)]:
        p = pct_scalar(values)
        if p:
            extra_percentiles[name] = p
    extra_percentiles = extra_percentiles or None

    mfcc_profile = mean_std_vector(agg.mfcc_means)

    model: Dict[str, Any] = {
        "profile_key": profile_key,
        "meta": {
            "tracks_count": len(agg.ok_files),
            "built_at": utc_now_iso(),
            "analyzer_version": "v3",
        },
        # Timbre new
        "bands_norm_percentiles": bands_norm_percentiles,
        "spectrum_ref": spectrum_ref,
        "spectral_percentiles": spectral_percentiles,
        # Timbre legacy for UI V2
        "bands_norm": bands_norm,
        "bands_norm_stats": bands_norm_stats,
        "spectrum_db": spectrum_db,
        # Loudness new
        "loudness_percentiles": loudness_percentiles,
        "loudness_views_percentiles": loudness_views_percentiles,
        "sections_percentiles": sections_percentiles,
        # Loudness legacy for UI V2 extractor
        "features_percentiles": features_percentiles,
        # Stereo
        "stereo_percentiles": stereo_percentiles,
        "sound_field_ref": sound_field_ref,
        "sound_field_xy_ref": sound_field_xy_ref,
        # Transients
        "transients_percentiles": transients_percentiles,
        # Rhythm
        "rhythm_percentiles": rhythm_percentiles,
        "rhythm_descriptors_percentiles": rhythm_descriptors_percentiles,
        "key_counts": agg.key_counts or None,
        "relative_key_counts": agg.relative_key_counts or None,
        # Extra
        "extra_percentiles": extra_percentiles,
        "mfcc_profile": mfcc_profile,
        # Debug
        "debug": {
            "ok_files": agg.ok_files,
            "failed_files": agg.failed_files,
        },
    }

    # prune Nones (do not remove None inside lists)
    def prune(x: Any) -> Any:
        if isinstance(x, dict):
            out = {}
            for k, v in x.items():
                pv = prune(v)
                if pv is None:
                    continue
                out[k] = pv
            return out or None

        if isinstance(x, list):
            out = [prune(v) for v in x]
            if all(v is None for v in out):
                return None
            return out

        return x

    pruned = prune(model)
    return pruned or model


def main() -> int:
    ap = argparse.ArgumentParser(description="Rebuild reference models V3 from references/<genre> using analyze_v3.")
    ap.add_argument("--repo", default=".", help="Repo root. In container usually /app.")
    ap.add_argument("--references-dir", default="references", help="Folder with references/<genre>.")
    ap.add_argument("--out-dir", default="reference_models_v3", help="Output folder for v3 models.")
    ap.add_argument("--genres", nargs="*", default=None, help="List of genres to build. If omitted, scans references-dir.")
    ap.add_argument("--python", default=sys.executable, help="Python executable to call analyze_v3 (default: current).")
    ap.add_argument("--max-tracks", type=int, default=0, help="Limit tracks per genre (0 = all).")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing genre json.")
    ap.add_argument("--dry-run", action="store_true", help="Do not write files, only print summary.")
    args = ap.parse_args()

    repo = Path(args.repo).resolve()
    refs_root = (repo / args.references_dir).resolve()
    out_root = (repo / args.out_dir).resolve()

    if not refs_root.exists():
        print(f"[ERR] references dir not found: {refs_root}", file=sys.stderr)
        return 2

    if args.genres:
        genres = [g.strip() for g in args.genres if g.strip()]
    else:
        genres = [p.name for p in sorted(refs_root.iterdir()) if p.is_dir()]

    if not genres:
        print("[ERR] no genres found", file=sys.stderr)
        return 2

    if not args.dry_run:
        out_root.mkdir(parents=True, exist_ok=True)

    built_genres_meta: List[Dict[str, Any]] = []
    built_at = utc_now_iso()

    print(f"[INFO] repo: {repo}")
    print(f"[INFO] references: {refs_root}")
    print(f"[INFO] out: {out_root}")
    print(f"[INFO] genres: {genres}")

    for g in genres:
        genre_dir = refs_root / g
        if not genre_dir.exists():
            print(f"[WARN] missing genre folder: {genre_dir}")
            continue

        out_path = out_root / f"{g}.json"
        if out_path.exists() and not args.overwrite and not args.dry_run:
            print(f"[SKIP] exists (use --overwrite): {out_path}")
            continue

        files = iter_audio_files(genre_dir)
        if args.max_tracks and args.max_tracks > 0:
            files = files[: args.max_tracks]

        print(f"[INFO] {g}: {len(files)} tracks")

        agg = TrackAgg()

        for i, f in enumerate(files, start=1):
            rel = str(f.relative_to(repo)) if f.is_absolute() and repo in f.parents else str(f)
            try:
                res = call_analyze_v3_subprocess(
                    audio_path=f,
                    profile_key=g,
                    python_exe=args.python,
                    cwd=repo,
                )
                extract_metrics_v3(res, agg)
                agg.ok_files.append(rel)
                print(f"  [OK] {i}/{len(files)} {rel}")
            except Exception as e:
                agg.failed_files.append({"file": rel, "error": str(e)})
                print(f"  [FAIL] {i}/{len(files)} {rel} -> {e}")

        model = build_genre_model(g, agg)

        if args.dry_run:
            print(f"[DRY] would write: {out_path} (tracks_ok={len(agg.ok_files)} failed={len(agg.failed_files)})")
        else:
            with out_path.open("w", encoding="utf-8") as fp:
                json.dump(model, fp, ensure_ascii=False, indent=2)
            print(f"[WRITE] {out_path} (tracks_ok={len(agg.ok_files)} failed={len(agg.failed_files)})")

        built_genres_meta.append(
            {
                "profile_key": g,
                "tracks_count": len(agg.ok_files),
                "failed_count": len(agg.failed_files),
            }
        )

    index = {
        "analyzer_version": "v3",
        "built_at": built_at,
        "genres": built_genres_meta,
    }

    index_path = out_root / "index.json"
    if args.dry_run:
        print(f"[DRY] would write: {index_path}")
    else:
        with index_path.open("w", encoding="utf-8") as fp:
            json.dump(index, fp, ensure_ascii=False, indent=2)
        print(f"[WRITE] {index_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
