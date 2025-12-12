import os
import tempfile
import math
from typing import Any, Tuple

import httpx
import librosa
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from reference_models import fetch_genre_model
from model_math import compute_model_match
from reference_ai import evaluate_track_with_reference, load_reference_db

# motore v3.6
from analyze_master_web import analyze_to_text, extract_metrics_from_report
from tekkin_analyzer_v4_extras import analyze_v4_extras

# nuovo motore V1 mix metrics
from tekkin_analyzer_v1 import analyze_mix_v1

ANALYZER_SECRET = os.environ.get("TEKKIN_ANALYZER_SECRET")

if not ANALYZER_SECRET:
    raise RuntimeError("TEKKIN_ANALYZER_SECRET non impostata nell'ambiente")

app = FastAPI()

reference_db: dict[str, Any] | None = None
try:
    reference_db = load_reference_db("reference_db.json")
except Exception as exc:
    print("[reference_ai] reference_db not available:", exc)
    reference_db = None


def debug_non_finite(obj, path: str = "root"):
    """Logga dove trovi NaN / inf / -inf in un oggetto annidato."""
    if isinstance(obj, float):
        if not math.isfinite(obj):
            print(f"[DEBUG] non-finite value {obj} at {path}")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            debug_non_finite(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            debug_non_finite(v, f"{path}[{i}]")


def sanitize_non_finite(obj):
    """Ritorna una copia di obj dove NaN/inf/-inf vengono sostituiti con None."""
    if isinstance(obj, float):
        if math.isfinite(obj):
            return obj
        print(f"[SANITIZE] replacing non-finite float {obj} with None")
        return None
    elif isinstance(obj, dict):
        return {k: sanitize_non_finite(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_non_finite(v) for v in obj]
    else:
        return obj


def load_audio_for_analyzer(path: str, target_sr: int = 44100) -> Tuple[np.ndarray, np.ndarray, int]:
    """
    Load audio with soundfile and return mono/stereo versions at the target sample rate.
    """
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    if data.ndim == 1:
        data = data[:, None]
    data = data.T  # shape: (channels, frames)

    if sr != target_sr:
        resampled = []
        for channel in data:
            resampled.append(
                librosa.resample(
                    channel.astype(np.float32, copy=False),
                    orig_sr=sr,
                    target_sr=target_sr,
                )
            )
        data = np.stack(resampled, axis=0).astype(np.float32)
        sr = target_sr

    if data.ndim == 1:
        data = data[None, :]

    if data.shape[0] >= 2:
        y_stereo = data[:2]
        y_mono = np.mean(y_stereo, axis=0)
    else:
        y_stereo = data
        y_mono = data[0]

    return y_mono.astype(np.float32), y_stereo.astype(np.float32), sr


def compute_mix_health_score(
    lufs: float | None,
    extras: dict[str, Any],
    loudness_stats: dict[str, float] | None = None,
) -> tuple[int | None, float]:
    if lufs is None:
        return None, 0.0

    def clamp01(value: float) -> float:
        return float(max(0.0, min(1.0, value)))

    spectral = extras.get("spectral", {})
    stereo = extras.get("stereo_width", {})
    key_confidence = extras.get(
        "key_confidence",
        extras.get("confidence", {}).get("key", 0.5),
    )
    target_lufs = -8.5
    lufs_score = clamp01(1.0 - min(1.0, abs(lufs - target_lufs) / 6.0))
    tonal_score = clamp01(float(key_confidence))

    lowmid = spectral.get("lowmid_db")
    high = spectral.get("high_db")
    spectral_score = 0.5
    if lowmid is not None and high is not None:
        spectral_score = clamp01(1.0 - min(1.0, abs(lowmid - high) / 12.0))

    widths = stereo.get("band_widths_db", {})
    stereo_score = 0.5
    if widths:
        avg_width = sum(abs(v) for v in widths.values()) / len(widths)
        stereo_score = clamp01(1.0 - min(1.0, avg_width / 12.0))

    dynamics_score = 0.5
    if loudness_stats:
        short_min = loudness_stats.get("short_lufs_min")
        short_max = loudness_stats.get("short_lufs_max")
        short_std = loudness_stats.get("short_lufs_std")
        if short_min is not None and short_max is not None:
            lra = max(0.0, short_max - short_min)
            target_lra = 7.5
            dynamics_score = clamp01(1.0 - min(1.0, abs(lra - target_lra) / 8.0))
        if short_std is not None and short_std < 0.25:
            dynamics_score *= clamp01(short_std / 0.25)

    components = [
        (lufs_score, 2),
        (tonal_score, 1),
        (spectral_score, 1),
        (stereo_score, 1),
        (dynamics_score, 1),
    ]

    total_weight = sum(weight for _, weight in components)
    if total_weight == 0:
        return None, 0.0

    score_sum = sum(value * weight for value, weight in components)
    normalized = score_sum / total_weight
    mix_health_score = int(round(clamp01(normalized) * 100))
    mix_health_confidence = clamp01(
        sum(value for value, _ in components) / len(components)
    )

    return mix_health_score, mix_health_confidence


class AnalyzePayload(BaseModel):
    version_id: str
    project_id: str
    audio_url: str

    # opzionali, con default coerenti con il tuo uso attuale
    lang: str = "it"
    profile_key: str = "minimal_deep_tech"
    mode: str = "master"


@app.post("/analyze")
async def analyze(request: Request, payload: AnalyzePayload):
    # 1. controllo secret
    header_secret = request.headers.get("x-analyzer-secret")
    if header_secret != ANALYZER_SECRET:
        raise HTTPException(status_code=401, detail="Analyzer unauthorized")

    # 2. scarico il file audio dalla signed URL
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(payload.audio_url)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Impossibile scaricare audio: HTTP {resp.status_code}",
            )
    except Exception as e:
        print("[analyzer] Errore scaricando audio:", repr(e))
        raise HTTPException(status_code=400, detail="Errore scaricando il file audio")

    tmp_path = None
    try:
        # salvo in file temporaneo
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        print(
            "Analisi v2 per versione",
            payload.version_id,
            "file temporaneo:",
            tmp_path,
        )

        # 3. carico l'audio una sola volta, in mono e stereo, per tutte le metriche
        y_mono, y_stereo, sr = load_audio_for_analyzer(tmp_path)
        audio_for_report = y_stereo.T

        # 4. uso il motore v3.6 per generare il report testuale + struttura
        analysis = analyze_to_text(
            lang=payload.lang,
            profile_key=payload.profile_key,
            mode=payload.mode,
            file_path=tmp_path,
            enable_plots=False,
            plots_dir="plots",
            emoji=False,
            return_struct=True,
            preloaded_audio=audio_for_report,
            preloaded_sr=sr,
        )

        report = analysis["report"]
        fix_suggestions = analysis.get("fix_suggestions", [])
        reference_ai = analysis.get("reference_ai") or {}
        meters = analysis.get("meters", {})

        # 5. estraggo i numeri principali dal report
        lufs, overall = extract_metrics_from_report(report, payload.lang)

        if lufs is None or overall is None:
            print("[analyzer] Impossibile estrarre LUFS / overall dal report")
            raise HTTPException(status_code=500, detail="Report non parsabile")

        loudness_stats = {
            "integrated_lufs": lufs,
            "short_lufs_min": meters.get("short_lufs_min"),
            "short_lufs_max": meters.get("short_lufs_max"),
            "short_lufs_std": meters.get("short_lufs_std"),
            "short_lufs_mean": meters.get("short_lufs_mean"),
        }

        # 6. analisi v4 extras
        extras = analyze_v4_extras(y_mono, y_stereo, sr, loudness_stats=loudness_stats)
        safe_extras = sanitize_non_finite(extras)
        print("[analyzer] v4 extras:", safe_extras)

        reference_ai_pack = safe_extras.get("essentia_features") or {}
        reference_ai_rhythm = reference_ai_pack.get("rhythm") or {}
        reference_ai_tonal = reference_ai_pack.get("tonal") or {}
        reference_ai_loudness = reference_ai_pack.get("loudness") or {}
        reference_ai_spectral = reference_ai_pack.get("spectral") or {}
        reference_ai_stereo = reference_ai_pack.get("stereo") or {}
        reference_ai_debug_values = {
            "bpm": reference_ai_rhythm.get("bpm"),
            "key": reference_ai_tonal.get("key"),
            "integrated_lufs": reference_ai_loudness.get("integrated_lufs"),
            "spectral_centroid_hz": reference_ai_spectral.get("centroid_hz"),
            "spectral_flatness": reference_ai_spectral.get("flatness"),
            "stereo_global_correlation": reference_ai_stereo.get("global_correlation"),
        }
        reference_ai_metrics = {
            "lufs_integrated": reference_ai_loudness.get("integrated_lufs"),
            "crest_factor": reference_ai_spectral.get("crest_factor_db"),
            "tonal_balance": {},
        }
        reference_ai_extras = {
            "bpm": reference_ai_rhythm.get("bpm"),
            "key": reference_ai_tonal.get("key"),
            "spectral_centroid_hz": reference_ai_spectral.get("centroid_hz"),
            "spectral_rolloff_hz": reference_ai_spectral.get("rolloff_hz"),
            "spectral_bandwidth_hz": reference_ai_spectral.get("bandwidth_hz"),
            "spectral_flatness": reference_ai_spectral.get("flatness"),
            "zero_crossing_rate": reference_ai_spectral.get("zero_crossing_rate"),
            "low_db": reference_ai_spectral.get("low_db"),
            "lowmid_db": reference_ai_spectral.get("lowmid_db"),
            "mid_db": reference_ai_spectral.get("mid_db"),
            "high_db": reference_ai_spectral.get("high_db"),
            "air_db": reference_ai_spectral.get("air_db"),
            "stereo_global_correlation": reference_ai_stereo.get("global_correlation"),
            "stereo_lr_balance_db": reference_ai_stereo.get("lr_balance_db"),
            "stereo_band_widths_db": reference_ai_stereo.get("band_widths_db"),
        }

        # 7. Tekkin Analyzer V1: mix, bilanci, stereo, struttura
        mix_v1_result = None
        try:
            mix_v1_result = analyze_mix_v1(
                y_mono=y_mono,
                y_stereo=y_stereo,
                sr=sr,
                profile=payload.profile_key,
                integrated_lufs=lufs,
                loudness_stats=meters,
            )
        except Exception as e:
            print("[analyzer-v1] errore in analyze_mix_v1:", repr(e))
            mix_v1_result = None

        # 8. AI MODEL v1: confronto con il modello statistico dal DB
        model_match = None
        try:
            model = fetch_genre_model(payload.profile_key)
        except Exception as e:
            print("[analyzer-ai] errore caricando il modello dal DB:", repr(e))
            model = None

        if model is not None and analysis.get("band_norm") is not None:
            try:
                model_match = compute_model_match(
                    band_norm=analysis["band_norm"],
                    extras={
                        "spectral_centroid_hz": safe_extras.get("spectral_centroid_hz"),
                        "spectral_rolloff_hz": safe_extras.get("spectral_rolloff_hz"),
                        "spectral_bandwidth_hz": safe_extras.get("spectral_bandwidth_hz"),
                        "spectral_flatness": safe_extras.get("spectral_flatness"),
                        "zero_crossing_rate": safe_extras.get("zero_crossing_rate"),
                        "bpm": safe_extras.get("bpm"),
                    },
                    model=model,
                    lufs=lufs,
                )
            except Exception as e:
                print("[analyzer-ai] errore calcolo model_match:", repr(e))
                model_match = None

        print("[PY-ANALYZER] reference_ai Essentia values:", reference_ai_debug_values)
        reference_ai_eval = None
        if reference_db is not None:
            try:
                reference_ai_eval = evaluate_track_with_reference(
                    db=reference_db,
                    metrics=reference_ai_metrics,
                    extras=reference_ai_extras,
                    genre_model=model,
                    public_output=True,
                )
            except Exception as e:
                print("[reference_ai] evaluation failed:", repr(e))

        reference_ai_public: dict[str, Any] | None = None
        if reference_ai:
            sanitized = {
                key: value
                for key, value in reference_ai.items()
                if key
                not in {
                    "reference_db",
                    "similar_tracks",
                    "guessed_genre",
                    "genre_confidence",
                    "model_match",
                }
            }
            adjustments_payload = (
                reference_ai_eval.get("adjustments") if reference_ai_eval else None
            )
            sanitized["adjustments"] = adjustments_payload
            warnings_payload = reference_ai.get("warnings")
            if warnings_payload is not None:
                sanitized["warnings"] = warnings_payload
            sanitized["debug"] = {"essentia_values": reference_ai_debug_values}
            sanitized["model_match"] = None
            reference_ai_public = sanitized

        reference_ai = reference_ai_public
        print("[analyzer-api] reference_ai debug:", reference_ai)

        analysis_pro = {
            "rhythm": {
                "bpm": reference_ai_rhythm.get("bpm"),
                "confidence": reference_ai_rhythm.get("bpm_conf"),
                "beats": reference_ai_rhythm.get("beats"),
                "tempo_curve": reference_ai_rhythm.get("tempo_curve"),
            },
            "tonal": {
                "key": reference_ai_tonal.get("key"),
                "scale": reference_ai_tonal.get("scale"),
                "key_confidence": reference_ai_tonal.get("key_conf"),
                "tonal_strength": reference_ai_tonal.get("tonal_strength"),
            },
            "loudness": {
                "integrated_lufs": reference_ai_loudness.get("integrated_lufs"),
                "lra": reference_ai_loudness.get("lra"),
                "momentary_loudness": reference_ai_loudness.get("momentary_loudness"),
                "short_term_loudness": reference_ai_loudness.get("short_term_loudness"),
                "true_peak_db": reference_ai_loudness.get("true_peak_db"),
            },
            "spectral": {
                "centroid_hz": reference_ai_spectral.get("centroid_hz"),
                "rolloff_hz": reference_ai_spectral.get("rolloff_hz"),
                "bandwidth_hz": reference_ai_spectral.get("bandwidth_hz"),
                "flatness": reference_ai_spectral.get("flatness"),
                "mfcc_mean": reference_ai_spectral.get("mfcc_mean"),
                "mfcc_std": reference_ai_spectral.get("mfcc_std"),
                "low_db": reference_ai_spectral.get("low_db"),
                "lowmid_db": reference_ai_spectral.get("lowmid_db"),
                "mid_db": reference_ai_spectral.get("mid_db"),
                "high_db": reference_ai_spectral.get("high_db"),
                "air_db": reference_ai_spectral.get("air_db"),
                "zero_crossing_rate": reference_ai_spectral.get("zero_crossing_rate"),
            },
            "stereo": {
                "global_correlation": reference_ai_stereo.get("global_correlation"),
                "lr_balance_db": reference_ai_stereo.get("lr_balance_db"),
                "is_mono": reference_ai_stereo.get("is_mono"),
                "band_widths_db": reference_ai_stereo.get("band_widths_db"),
            },
            "confidence": safe_extras.get("confidence"),
        }

        # 9. Mix health score + confidence mix_health
        loudness_stats_safe = safe_extras.get("loudness_stats")
        mix_health_score, mix_health_confidence = compute_mix_health_score(
            lufs, safe_extras, loudness_stats=loudness_stats_safe
        )
        confidence_data = dict(safe_extras.get("confidence") or {})
        confidence_data["mix_health"] = mix_health_confidence

        # 10. costruisco il risultato grezzo
        result = {
            "version_id": payload.version_id,
            "project_id": payload.project_id,
            "lufs": lufs,
            "sub_clarity": None,
            "hi_end": None,
            "dynamics": safe_extras.get("dynamics", {}).get("score"),
            "stereo_image": None,
            "tonality": None,
            "overall_score": overall,
            "feedback": report,
            "fix_suggestions": fix_suggestions,
        "reference_ai": reference_ai,
        "bpm": safe_extras.get("bpm"),
        "spectral_centroid_hz": safe_extras.get("spectral_centroid_hz"),
        "spectral_rolloff_hz": safe_extras.get("spectral_rolloff_hz"),
        "spectral_bandwidth_hz": safe_extras.get("spectral_bandwidth_hz"),
        "spectral_flatness": safe_extras.get("spectral_flatness"),
        "zero_crossing_rate": safe_extras.get("zero_crossing_rate"),
        "spectral": safe_extras.get("spectral"),
          "key": safe_extras.get("key"),
          "confidence": confidence_data,
          "warnings": safe_extras.get("warnings"),
          "harmonic_balance": safe_extras.get("harmonic_balance"),
          "stereo_width": safe_extras.get("stereo_width"),
          "essentia_features": safe_extras.get("essentia_features"),
          "analysis_pro": analysis_pro,
          "mix_health_score": mix_health_score,
        # nuovo blocco: Tekkin Analyzer Mix V1
        "mix_v1": mix_v1_result.model_dump() if mix_v1_result is not None else None,
        }

        # 11. debug per capire eventuali NaN / inf
        debug_non_finite(result)

        # 12. sanifico prima di restituire
        safe_result = sanitize_non_finite(result)

        return JSONResponse(content=safe_result)

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
