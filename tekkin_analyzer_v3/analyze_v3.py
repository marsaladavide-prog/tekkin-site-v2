#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = str(Path(__file__).resolve().parent.parent)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import argparse
import json
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import numpy as np

from tekkin_analyzer_v3.utils.audio_loader import load_audio_ffmpeg
from tekkin_analyzer_v3.blocks.loudness import analyze_loudness
from tekkin_analyzer_v3.blocks.timbre_spectrum import analyze_timbre_spectrum
from tekkin_analyzer_v3.blocks.stereo import analyze_stereo
from tekkin_analyzer_v3.blocks.transients import analyze_transients
from tekkin_analyzer_v3.blocks.rhythm import analyze_rhythm
from tekkin_analyzer_v3.blocks.extra import analyze_extra


BAND_KEYS = ["sub", "low", "lowmid", "mid", "presence", "high", "air"]


@dataclass(frozen=True)
class AnalyzerV3Config:
    sr: int = 44100
    max_seconds: Optional[float] = None  # None = full
    ffmpeg_bin: str = "ffmpeg"


def _safe_block(name: str, fn, audio: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Esegue un blocco e non rompe mai l'analisi completa.
    In caso di errore, torna { ok:false, error:"...", data:null }.
    """
    t0 = time.time()
    try:
        data = fn(audio=audio, sr=sr)
        return {
            "ok": True,
            "took_ms": int((time.time() - t0) * 1000),
            "data": data,
        }
    except Exception as e:
        return {
            "ok": False,
            "took_ms": int((time.time() - t0) * 1000),
            "error": f"{type(e).__name__}: {e}",
            "data": None,
        }


def analyze_v3(
    audio_path: str,
    profile_key: Optional[str] = None,
    config: Optional[AnalyzerV3Config] = None,
) -> Dict[str, Any]:
    """
    Analisi V3: orchestratore unico.
    Output stabile a blocchi:
      loudness, timbre_spectrum, stereo, transients, rhythm, extra
    """
    cfg = config or AnalyzerV3Config()

    t0 = time.time()
    audio, sr = load_audio_ffmpeg(
        path=audio_path,
        sr=cfg.sr,
        max_seconds=cfg.max_seconds,
        ffmpeg_bin=cfg.ffmpeg_bin,
    )

    # audio shape: (n, 2) float32, stereo
    # Se per qualsiasi motivo arriva mono, lo portiamo a 2 canali.
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=-1)
    if audio.ndim == 2 and audio.shape[1] == 1:
        audio = np.concatenate([audio, audio], axis=1)

    blocks: Dict[str, Any] = {}
    blocks["loudness"] = _safe_block("loudness", analyze_loudness, audio, sr)
    blocks["timbre_spectrum"] = _safe_block("timbre_spectrum", analyze_timbre_spectrum, audio, sr)
    blocks["stereo"] = _safe_block("stereo", analyze_stereo, audio, sr)
    blocks["transients"] = _safe_block("transients", analyze_transients, audio, sr)
    blocks["rhythm"] = _safe_block("rhythm", analyze_rhythm, audio, sr)
    blocks["extra"] = _safe_block("extra", analyze_extra, audio, sr)

    # --- COMPAT ALIAS PER UI V2 ---
    ts = blocks.get("timbre_spectrum", {})
    if ts.get("ok") and isinstance(ts.get("data"), dict):
        tsd = ts["data"]

        # 1) Tonal Balance compat: band_energy_norm
        bn = tsd.get("bands_norm")
        if isinstance(bn, dict):
            blocks["tonal_balance"] = {
                "ok": True,
                "took_ms": 0,
                "data": {
                    "band_energy_norm": bn
                },
            }

        # 2) Spectral compat: blocco spectral separato
        sp = tsd.get("spectral")
        if isinstance(sp, dict):
            blocks["spectral"] = {
                "ok": True,
                "took_ms": 0,
                "data": sp,
            }
    else:
        # se timbre_spectrum fallisce, rendi espliciti i blocchi compat
        blocks["tonal_balance"] = {"ok": False, "took_ms": 0, "error": "timbre_spectrum not available", "data": None}
        blocks["spectral"] = {"ok": False, "took_ms": 0, "error": "timbre_spectrum not available", "data": None}

    out: Dict[str, Any] = {
        "version": "v3",
        "profile_key": profile_key,
        "meta": {
            "sr": sr,
            "channels": int(audio.shape[1]) if audio.ndim == 2 else 2,
            "samples": int(audio.shape[0]) if audio.ndim >= 1 else 0,
            "duration_sec": float(audio.shape[0] / sr) if sr > 0 else None,
            "took_ms_total": int((time.time() - t0) * 1000),
        },
        "blocks": blocks,
    }
    return out


def strip_raw_fields(obj):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k.endswith("_raw") or k.endswith("_db_raw") or k.endswith("_lufs_raw"):
                continue
            out[k] = strip_raw_fields(v)
        return out
    if isinstance(obj, list):
        return [strip_raw_fields(x) for x in obj]
    return obj


ARRAY_KEYS = {
    "hz",
    "track_db",
    "ref_db",
    "momentary_lufs",
    "short_term_lufs",
    "sound_field",
    "width_by_band",
    "mfcc",
    "spectral_peaks",
}


def strip_arrays(obj):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in ARRAY_KEYS:
                continue
            out[k] = strip_arrays(v)
        return out
    if isinstance(obj, list):
        return []  # non serve mantenere liste se stai strip-arrays
    return obj


def print_summary(res: dict):
    blocks = res.get("blocks", {})

    loud = blocks.get("loudness", {}).get("data") or {}
    timbre = blocks.get("timbre_spectrum", {}).get("data") or {}
    stereo = blocks.get("stereo", {}).get("data") or {}

    print("== Tekkin Analyzer V3 Summary ==")
    print(f"profile_key: {res.get('profile_key')}")
    print(f"duration_sec: {res.get('meta', {}).get('duration_sec')}")

    # Loudness
    ld = blocks.get("loudness", {})
    if ld.get("ok") and isinstance(ld.get("data"), dict):
        l = ld["data"]
        print("loudness.ok: True")
        print("LUFS integrated:", l.get("integrated_lufs"))
        print("LRA:", l.get("lra"))
        print("Sample peak dB:", l.get("sample_peak_db"))

        # NEW: True Peak
        if "true_peak_db" in l:
            print("True peak dB:", l.get("true_peak_db"))
        if "true_peak_method" in l:
            print("True peak method:", l.get("true_peak_method"))

        # arrays info (se presenti)
        m = l.get("momentary_lufs") or []
        s = l.get("short_term_lufs") or []
        if isinstance(m, list):
            print("momentary(view) len:", len(m))
        if isinstance(s, list):
            print("short-term(view) len:", len(s))

        # NEW: percentiles
        mp = l.get("momentary_percentiles")
        if isinstance(mp, dict):
            print("momentary.percentiles:", mp)

        sp = l.get("short_term_percentiles")
        if isinstance(sp, dict):
            print("short_term.percentiles:", sp)

        # NEW: sections
        sec = l.get("sections")
        if isinstance(sec, dict):
            print("sections.thresholds:", sec.get("thresholds"))
            for k in ["intro", "drop", "break", "outro"]:
                v = sec.get(k)
                if isinstance(v, dict):
                    print(f"section.{k}:", v)
    else:
        print("loudness.ok: False")
        if ld.get("error"):
            print("loudness.error:", ld.get("error"))

    # Timbre
    if timbre:
        print("bands_norm:", timbre.get("bands_norm"))
        spec = timbre.get("spectrum_db") or {}
        print(f"spectrum(view) len: {len(spec.get('hz') or [])}")

        spectral = timbre.get("spectral") or {}
        print("spectral:", spectral)

    # Stereo
    if stereo:
        print("stereo_width:", stereo.get("stereo_width"))
        print("width_by_band:", stereo.get("width_by_band"))

        corr = stereo.get("correlation") or []
        print(f"correlation(view) len: {len(corr)}")

        st_sum = stereo.get("summary") or {}
        print("stereo.summary:", st_sum)

    # --- Transients summary ---
    tr = res.get("blocks", {}).get("transients", {})
    print("transients.ok:", tr.get("ok"))

    trd = (tr.get("data") or {}) if tr.get("ok") else {}
    if tr.get("ok"):
        print("crest_factor_db:", trd.get("crest_factor_db"))
        print("transient_strength:", trd.get("strength"))
        print("transient_density:", trd.get("density"))
        print("log_attack_time:", trd.get("log_attack_time"))
    else:
        print("transients.error:", tr.get("error"))

    # Rhythm
    rh = blocks.get("rhythm", {})
    if rh.get("ok") and isinstance(rh.get("data"), dict):
        r = rh["data"]
        print("rhythm.ok: True")
        print("BPM:", r.get("bpm"))
        print("Key:", r.get("key"))

        desc = r.get("descriptors") or {}
        if desc.get("key_error"):
            print("key_error:", desc.get("key_error"))

        print("Relative key:", desc.get("relative_key"))

        # NEW: confidence raw (campo principale V3)
        if "bpm_confidence_raw" in r:
            print("BPM confidence(raw):", r.get("bpm_confidence_raw"))

        # compat: se per qualche motivo ti arriva ancora in descriptors
        desc = r.get("descriptors") or {}
        if isinstance(desc, dict) and "bpm_confidence" in desc and r.get("bpm_confidence_raw") is None:
            print("BPM confidence(raw):", desc.get("bpm_confidence"))

        # danceability
        if "danceability" in r:
            print("danceability:", r.get("danceability"))

        # beat times
        bt = r.get("beat_times") or []
        if isinstance(bt, list):
            print("beat_times(view) len:", len(bt))

        # stampo anche descriptors completi se vuoi (utile per debug)
        if isinstance(desc, dict) and desc:
            print("rhythm.descriptors:", desc)
    else:
        print("rhythm.ok: False")
        if rh.get("error"):
            print("rhythm.error:", rh.get("error"))

    # Extra
    ex = res.get("blocks", {}).get("extra", {})
    print("extra.ok:", ex.get("ok"))
    exd = (ex.get("data") or {}) if ex.get("ok") else {}
    if ex.get("ok"):
        mf = exd.get("mfcc") or {}
        mm = mf.get("mean") or []
        print("mfcc.mean len:", len(mm))
        print("hfc:", exd.get("hfc"))
        pk = exd.get("spectral_peaks") or []
        print("spectral_peaks count:", len(pk))
        print("spectral_peaks_energy:", exd.get("spectral_peaks_energy"))
    else:
        print("extra.error:", ex.get("error"))

    print("================================")


def analyze_v3_blocks(*, audio_path: str, profile_key: str):
    """
    Wrapper stabile per l'API FastAPI.
    Ritorna lo stesso dict di analyze_v3().
    """
    return analyze_v3(audio_path=audio_path, profile_key=profile_key)


def main():
    p = argparse.ArgumentParser(description="Tekkin Analyzer V3 (orchestrator)")
    p.add_argument("audio_path", help="Path file audio (mp3/wav/etc)")
    p.add_argument("--profile-key", default=None)
    p.add_argument("--sr", type=int, default=44100)
    p.add_argument("--max-seconds", type=float, default=None)
    p.add_argument("--ffmpeg-bin", default="ffmpeg")
    p.add_argument("--out", default=None, help="Output JSON path (optional)")
    p.add_argument("--summary", action="store_true", help="Stampa solo summary leggibile")
    p.add_argument("--strip-raw", action="store_true", help="Rimuove i campi *_raw dall'output JSON")
    p.add_argument("--strip-arrays", action="store_true", help="Rimuove anche i campi array view dall'output JSON (hz/track_db/momentary/short_term/sound_field ecc.)")
    args = p.parse_args()

    cfg = AnalyzerV3Config(sr=args.sr, max_seconds=args.max_seconds, ffmpeg_bin=args.ffmpeg_bin)
    res = analyze_v3(args.audio_path, profile_key=args.profile_key, config=cfg)

    if args.summary:
        print_summary(res)
    else:
        res_to_print = res
        if args.strip_raw:
            res_to_print = strip_raw_fields(res_to_print)
        if args.strip_arrays:
            res_to_print = strip_arrays(res_to_print)
        text = json.dumps(res_to_print, indent=2, ensure_ascii=False)
        if args.out:
            with open(args.out, "w", encoding="utf-8") as f:
                f.write(text)
        else:
            print(text)


if __name__ == "__main__":
    main()
