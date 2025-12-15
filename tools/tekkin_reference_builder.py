# tekkin_reference_builder.py

from __future__ import annotations

import json
import math
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import librosa
import numpy as np

import argparse
import json
from pathlib import Path

from tools.analyze_master_web import analyze_to_text, extract_metrics_from_report, PROFILES
from tools.tekkin_analyzer_v4_extras import analyze_v4_extras  # type: ignore


AUDIO_EXTENSIONS = {".wav", ".aiff", ".aif", ".mp3", ".flac", ".ogg"}


@dataclass
class TrackFeatures:
    """Feature set per singola traccia usato per costruire il modello di genere."""
    band_norm: Optional[Dict[str, float]]
    lufs: Optional[float]
    bpm: Optional[float]
    key_confidence: Optional[float]
    spectral_centroid_hz: Optional[float]
    spectral_rolloff_hz: Optional[float]
    spectral_bandwidth_hz: Optional[float]
    spectral_flatness: Optional[float]
    zero_crossing_rate: Optional[float]


def load_audio_for_analyzer(path: Path, sr: int = 44100) -> Tuple[np.ndarray, np.ndarray, int]:
    """Carica l'audio in modo coerente con l'API analyzer: stereo + mono."""
    y, sr_out = librosa.load(str(path), sr=sr, mono=False)
    if y.ndim == 1:
        # mono -> duplichiamo su 2 canali per avere sempre shape (2, n)
        y_stereo = np.vstack([y, y])
        y_mono = y
    else:
        y_stereo = y
        y_mono = np.mean(y_stereo, axis=0)
    return y_mono, y_stereo, sr_out


def analyze_file_for_model(profile_key: str, path: Path) -> Optional[TrackFeatures]:
    """Esegue l'engine Tekkin su un file locale e ritorna le feature rilevanti."""
    try:
        y_mono, y_stereo, sr = load_audio_for_analyzer(path)
    except Exception as e:
        print(f"[ref-builder] Errore caricando {path}: {e!r}")
        return None

    try:
        analysis = analyze_to_text(
            lang="it",
            profile_key=profile_key,
            mode="master",
            file_path=str(path),
            enable_plots=False,
            plots_dir="plots",
            emoji=False,
            return_struct=True,
            preloaded_audio=y_stereo.T,
            preloaded_sr=sr,
        )
    except Exception as e:
        print(f"[ref-builder] Errore in analyze_to_text per {path}: {e!r}")
        return None

    report = analysis.get("report", "") or ""
    band_norm = analysis.get("band_norm")

    lufs, _overall = extract_metrics_from_report(report, "it")

    try:
        extras = analyze_v4_extras(y_mono, y_stereo, sr)
    except Exception as e:
        print(f"[ref-builder] Errore in analyze_v4_extras per {path}: {e!r}")
        return None

    return TrackFeatures(
        band_norm=band_norm if isinstance(band_norm, dict) else None,
        lufs=lufs,
        bpm=extras.get("bpm"),
        key_confidence=extras.get("key_confidence"),
        spectral_centroid_hz=extras.get("spectral_centroid_hz"),
        spectral_rolloff_hz=extras.get("spectral_rolloff_hz"),
        spectral_bandwidth_hz=extras.get("spectral_bandwidth_hz"),
        spectral_flatness=extras.get("spectral_flatness"),
        zero_crossing_rate=extras.get("zero_crossing_rate"),
    )


def _mean_std(values: List[Optional[float]]) -> Tuple[Optional[float], Optional[float]]:
    """Calcola media e dev std scartando None. Ritorna (None, None) se lista vuota."""
    arr = np.array([v for v in values if v is not None], dtype=float)
    if arr.size == 0:
        return None, None
    mean = float(arr.mean())
    if arr.size == 1:
        std = 0.0
    else:
        std = float(arr.std(ddof=1))
    return mean, std


def build_model_for_profile(profile_key: str, features_list: List[TrackFeatures]) -> Dict[str, Any]:
    """Costruisce il modello statistico per un singolo profile_key."""

    # 1) Bande normalizzate
    bands_values: Dict[str, List[float]] = defaultdict(list)
    for tf in features_list:
        if tf.band_norm:
            for band, val in tf.band_norm.items():
                if val is not None:
                    bands_values[band].append(float(val))

    bands_stats: Dict[str, Dict[str, Optional[float]]] = {}
    for band, vals in bands_values.items():
        mean, std = _mean_std(vals)
        bands_stats[band] = {"mean": mean, "std": std}

    # 2) Feature scalari
    lufs_mean, lufs_std = _mean_std([tf.lufs for tf in features_list])
    bpm_mean, bpm_std = _mean_std([tf.bpm for tf in features_list])
    key_conf_mean, key_conf_std = _mean_std([tf.key_confidence for tf in features_list])
    sc_mean, sc_std = _mean_std([tf.spectral_centroid_hz for tf in features_list])
    sr_mean, sr_std = _mean_std([tf.spectral_rolloff_hz for tf in features_list])
    sb_mean, sb_std = _mean_std([tf.spectral_bandwidth_hz for tf in features_list])
    sf_mean, sf_std = _mean_std([tf.spectral_flatness for tf in features_list])
    zc_mean, zc_std = _mean_std([tf.zero_crossing_rate for tf in features_list])

    model: Dict[str, Any] = {
        "profile_key": profile_key,
        "samples_count": len(features_list),
        "bands_norm_stats": bands_stats,
        "features_stats": {
            "lufs": {"mean": lufs_mean, "std": lufs_std},
            "bpm": {"mean": bpm_mean, "std": bpm_std},
            "key_confidence": {"mean": key_conf_mean, "std": key_conf_std},
            "spectral_centroid_hz": {"mean": sc_mean, "std": sc_std},
            "spectral_rolloff_hz": {"mean": sr_mean, "std": sr_std},
            "spectral_bandwidth_hz": {"mean": sb_mean, "std": sb_std},
            "spectral_flatness": {"mean": sf_mean, "std": sf_std},
            "zero_crossing_rate": {"mean": zc_mean, "std": zc_std},
        },
    }
    return model


def collect_features_from_root(root: Path, out_dir: Path, force: bool) -> Dict[str, List[TrackFeatures]]:
    """Scansiona la root refs_audio/ e raccoglie tutte le feature per profilo.

    Se il JSON del modello esiste già in out_dir e force=False, il profilo viene skippato.
    """
    per_profile: Dict[str, List[TrackFeatures]] = defaultdict(list)

    for profile_dir in root.iterdir():
        if not profile_dir.is_dir():
            continue

        profile_key = profile_dir.name
        if profile_key not in PROFILES:
            print(f"[ref-builder] Skip {profile_dir} perché profile_key '{profile_key}' non è in PROFILES.")
            continue

        out_json = out_dir / f"{profile_key}.json"
        if out_json.exists() and not force:
            print(
                f"[ref-builder] Profilo {profile_key}: modello {out_json} esiste già, "
                "skip (usa --force per rigenerare)."
            )
            continue

        print(f"[ref-builder] Profilo {profile_key}: scansione di {profile_dir}")
        for path in profile_dir.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in AUDIO_EXTENSIONS:
                continue

            print(f"[ref-builder]  -> analizzo {path.name}")
            tf = analyze_file_for_model(profile_key, path)
            if tf is not None:
                per_profile[profile_key].append(tf)

    return per_profile



def save_models_to_json(models: Dict[str, Dict[str, Any]], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for profile_key, model in models.items():
        out_path = out_dir / f"{profile_key}.json"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(model, f, indent=2, ensure_ascii=False)
        print(f"[ref-builder] Salvato modello {profile_key} -> {out_path}")


def main_cli() -> None:
    parser = argparse.ArgumentParser(
        description="Costruisce i modelli Tekkin di riferimento per genere."
    )
    parser.add_argument(
        "--root",
        type=str,
        required=True,
        help="Cartella root con le sottocartelle per profilo (es. refs_audio/)",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="reference_models",
        help="Cartella di output per i JSON dei modelli.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ricalcola anche se il modello JSON esiste già.",
    )

    args = parser.parse_args()

    root = Path(args.root).resolve()
    out_dir = Path(args.out).resolve()

    if not root.exists() or not root.is_dir():
        print(f"[ref-builder] Root {root} non esiste o non è una directory.")
        return

    # passa out_dir + flag force
    per_profile = collect_features_from_root(root, out_dir, args.force)
    if not per_profile:
        print("[ref-builder] Nessuna feature raccolta. Controlla la struttura delle cartelle.")
        return

    models: Dict[str, Dict[str, Any]] = {}
    for profile_key, feats in per_profile.items():
        if not feats:
            continue
        model = build_model_for_profile(profile_key, feats)
        models[profile_key] = model
        print(
            f"[ref-builder] Profilo {profile_key}: {len(feats)} tracce, "
            f"LUFS mean={model['features_stats']['lufs']['mean']}, "
            f"BPM mean={model['features_stats']['bpm']['mean']}"
        )

    save_models_to_json(models, out_dir)



if __name__ == "__main__":
    main_cli()
