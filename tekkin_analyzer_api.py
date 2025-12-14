from __future__ import annotations

import json
import logging
import math
import os
import tempfile
from datetime import datetime
from typing import Any, Dict, Tuple

import httpx
import librosa
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from analyze_master_web import analyze_to_text, extract_metrics_from_report
from model_math import compute_model_match
from reference_models import fetch_genre_model
from tekkin_analyzer_v4_extras import analyze_v4_extras

try:
    import essentia.standard as es  # type: ignore

    _ESSENTIA_AVAILABLE = True
except Exception:
    es = None  # type: ignore
    _ESSENTIA_AVAILABLE = False

ANALYZER_SECRET = os.environ.get("TEKKIN_ANALYZER_SECRET")
if not ANALYZER_SECRET:
    raise RuntimeError("TEKKIN_ANALYZER_SECRET non impostata nell'ambiente")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BASE = (
    f"{SUPABASE_URL.rstrip('/')}/storage/v1"
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    else None
)

LOG_LEVEL = logging.DEBUG if os.environ.get("TEKKIN_ANALYZER_DEBUG") == "1" else logging.INFO

logging.basicConfig(level=LOG_LEVEL, format="[%(levelname)s][%(name)s] %(message)s")
logger = logging.getLogger("tekkin-analyzer")

app = FastAPI()


def log_info(message: str) -> None:
    logger.info(message)


def _truncate(value: Any, max_len: int = 900, max_list: int = 10) -> str:
    try:
        if value is None:
            return ""
        if isinstance(value, (str, int, float, bool)):
            s = str(value)
            return s if len(s) <= max_len else s[: max_len - 3] + "..."
        if isinstance(value, dict):
            keys = list(value.keys())
            head = {k: value[k] for k in keys[:max_list]}
            s = str(head)
            return s if len(s) <= max_len else s[: max_len - 3] + "..."
        if isinstance(value, (list, tuple)):
            head = list(value[:max_list])
            s = str(head)
            return s if len(s) <= max_len else s[: max_len - 3] + "..."
        s = str(value)
        return s if len(s) <= max_len else s[: max_len - 3] + "..."
    except Exception:
        return "<unprintable>"


def _safe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        v = float(value)
        return v if math.isfinite(v) else None
    except Exception:
        return None


def _to_float_list(x: Any) -> list[float]:
    if x is None:
        return []
    if isinstance(x, (float, int, np.floating, np.integer)):
        v = float(x)
        return [v] if math.isfinite(v) else []

    if isinstance(x, (list, tuple)):
        out: list[float] = []
        for item in x:
            try:
                fv = float(item)
                if math.isfinite(fv):
                    out.append(fv)
            except Exception:
                continue
        return out

    try:
        arr = np.asarray(x, dtype=np.float32)
        flat = arr.reshape(-1)
        out: list[float] = []
        for item in flat:
            fv = float(item)
            if math.isfinite(fv):
                out.append(fv)
        return out
    except Exception:
        return []


def _stats(arr: Any) -> dict[str, float | None]:
    try:
        a = np.asarray(arr, dtype=np.float32)
        if a.size == 0:
            return {"min": None, "max": None, "mean": None, "std": None}
        return {
            "min": _safe_float(np.min(a)),
            "max": _safe_float(np.max(a)),
            "mean": _safe_float(np.mean(a)),
            "std": _safe_float(np.std(a)),
        }
    except Exception:
        return {"min": None, "max": None, "mean": None, "std": None}


def _is_arraylike(value: Any) -> bool:
    try:
        arr = np.asarray(value)
        return arr.ndim >= 1 and arr.size > 1
    except Exception:
        return False


def _is_scalar_number(value: Any) -> bool:
    return isinstance(value, (float, int, np.floating, np.integer))


def compute_loudness_ebu_r128_full_track(y_stereo: np.ndarray, sr: int) -> dict[str, Any]:
    if not _ESSENTIA_AVAILABLE or not sr or y_stereo.size == 0:
        return {
            "integrated_lufs": None,
            "lra": None,
            "true_peak_db": None,
            "momentary_lufs": None,
            "short_term_lufs": None,
            "momentary_stats": {"min": None, "max": None, "mean": None, "std": None},
            "short_term_stats": {"min": None, "max": None, "mean": None, "std": None},
            "short_lufs_min": None,
            "short_lufs_max": None,
            "short_lufs_mean": None,
            "short_lufs_std": None,
        }

    stereo_nx2 = np.ascontiguousarray(y_stereo, dtype=np.float32)
    if stereo_nx2.ndim == 1:
        stereo_nx2 = np.stack([stereo_nx2, stereo_nx2], axis=1)
    elif stereo_nx2.ndim == 2 and stereo_nx2.shape[0] == 2:
        stereo_nx2 = stereo_nx2.T

    integrated_lufs: float | None = None
    lra: float | None = None
    momentary: list[Any] = []
    short_term: list[Any] = []

    try:
        ebu = es.LoudnessEBUR128(sampleRate=sr)
        a, b, c, d = ebu(stereo_nx2)
        if _is_arraylike(a) and _is_arraylike(b) and _is_scalar_number(c) and _is_scalar_number(d):
            momentary = a
            short_term = b
            integrated_lufs = c
            lra = d
        else:
            integrated_lufs, lra, momentary, short_term = a, b, c, d
    except Exception as exc:
        logger.warning("[loudness] LoudnessEBUR128 error: %s", exc)
        integrated_lufs, lra, momentary, short_term = None, None, [], []

    true_peak_db: float | None = None
    try:
        mid = np.ascontiguousarray((stereo_nx2[:, 0] + stereo_nx2[:, 1]) * 0.5, dtype=np.float32)
        tp = es.TruePeakDetector(sampleRate=sr)
        true_peak_db = _safe_float(tp(mid))
    except Exception as exc:
        logger.warning("[loudness] TruePeakDetector error: %s", exc)

    momentary_list = _to_float_list(momentary)
    short_term_list = _to_float_list(short_term)

    momentary_stats = _stats(momentary_list)
    short_term_stats = _stats(short_term_list)

    return {
        "integrated_lufs": _safe_float(integrated_lufs),
        "lra": _safe_float(lra),
        "true_peak_db": true_peak_db,
        "momentary_lufs": momentary_list or None,
        "short_term_lufs": short_term_list or None,
        "momentary_stats": momentary_stats,
        "short_term_stats": short_term_stats,
        "short_lufs_min": short_term_stats.get("min"),
        "short_lufs_max": short_term_stats.get("max"),
        "short_lufs_mean": short_term_stats.get("mean"),
        "short_lufs_std": short_term_stats.get("std"),
    }


def _collect_array(
    container: Any,
    namespace: str,
    keys: list[str],
    collected: dict[str, dict[str, Any]],
) -> None:
    if not isinstance(container, dict):
        return
    for key in keys:
        value = container.get(key)
        normalized = _to_float_list(value)
        if normalized:
            collected.setdefault(namespace, {})[key] = normalized
            container[key] = None


def _extract_arrays_blob(result: dict[str, Any], project_id: str, version_id: str) -> dict[str, Any] | None:
    collected: dict[str, dict[str, Any]] = {}
    _collect_array(result.get("loudness_stats"), "loudness_stats", ["momentary_lufs", "short_term_lufs"], collected)
    _collect_array((result.get("analysis_pro") or {}).get("rhythm"), "analysis_pro.rhythm", ["beats", "tempo_curve"], collected)
    _collect_array((result.get("essentia_features") or {}).get("rhythm"), "essentia_features.rhythm", ["beats", "tempo_curve"], collected)

    if not collected:
        return None

    return {
        "project_id": project_id,
        "version_id": version_id,
        "collected_at": datetime.utcnow().isoformat() + "Z",
        "arrays": collected,
    }


def _upload_arrays_blob(relative_path: str, data: bytes) -> str | None:
    if not SUPABASE_STORAGE_BASE or not SUPABASE_SERVICE_ROLE_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "content-type": "application/json",
        "cache-control": "max-age=3600",
        "x-upsert": "true",
    }
    bucket = "tracks"

    try:
        url = f"{SUPABASE_STORAGE_BASE}/object/{bucket}/{relative_path}"
        resp = httpx.post(url, content=data, headers=headers, timeout=30.0)
        if resp.status_code in (200, 201):
            return f"{bucket}/{relative_path}"
        logger.warning("[analyzer][storage] upload %s failed: %s %s", bucket, resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("[analyzer][storage] upload %s exception: %s", bucket, exc)

    return None


def sanitize_non_finite(obj: Any) -> Any:
    if isinstance(obj, (float, np.floating, np.integer)):
        value = float(obj)
        return value if math.isfinite(value) else None
    if isinstance(obj, dict):
        return {k: sanitize_non_finite(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_non_finite(v) for v in obj]
    return obj


def load_audio_for_analyzer(path: str, target_sr: int = 44100) -> Tuple[np.ndarray, np.ndarray, int]:
    """
    Load audio with soundfile and return mono/stereo versions at the target sample rate.
    """
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    if data.ndim == 1:
        data = data[:, None]
    data = data.T

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

    lang: str = "it"
    profile_key: str = "minimal_deep_tech"
    mode: str = "master"


@app.post("/analyze")
async def analyze(request: Request, payload: AnalyzePayload):
    if request.headers.get("x-analyzer-secret") != ANALYZER_SECRET:
        raise HTTPException(status_code=401, detail="Analyzer unauthorized")

    log_info("ANALYZER PIPELINE v5 START")

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.get(payload.audio_url)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("[analyzer] audio download failed: %s", exc)
        raise HTTPException(status_code=400, detail="Errore scaricando il file audio")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        y_mono, y_stereo, sr = load_audio_for_analyzer(tmp_path)

        log_info("RUN loudness")
        loudness_stats = compute_loudness_ebu_r128_full_track(y_stereo=y_stereo, sr=sr)

        log_info("RUN v4_extras")
        extras = analyze_v4_extras(
            y_mono=y_mono,
            y_stereo=y_stereo,
            sr=sr,
            loudness_stats=loudness_stats,
        )
        safe_extras = sanitize_non_finite(extras)

        try:
            analysis = analyze_to_text(
                lang=payload.lang,
                profile_key=payload.profile_key,
                mode=payload.mode,
                file_path=tmp_path,
                enable_plots=False,
                plots_dir="plots",
                emoji=False,
                return_struct=True,
                preloaded_audio=y_stereo.T,
                preloaded_sr=sr,
            )
        except Exception as exc:
            logger.warning("[analyzer] analyze_to_text failed: %s", exc)
            raise HTTPException(status_code=500, detail="Analisi tecnica fallita")

        if not analysis:
            raise HTTPException(status_code=500, detail="Report non disponibile")

        report = analysis.get("report") or ""
        fix_suggestions = analysis.get("fix_suggestions") or []
        reference_ai = analysis.get("reference_ai")
        reference_ai = sanitize_non_finite(reference_ai) if reference_ai else None
        analysis_scope_raw = analysis.get("analysis_scope")
        analysis_scope = analysis_scope_raw.strip() if isinstance(analysis_scope_raw, str) else None
        analysis_pro_raw = analysis.get("analysis_pro")
        analysis_pro = sanitize_non_finite(analysis_pro_raw) if analysis_pro_raw else None

        lufs, overall = extract_metrics_from_report(report, payload.lang)
        if lufs is None or overall is None:
            logger.warning("[analyzer] Impossibile estrarre LUFS / overall dal report")
            raise HTTPException(status_code=500, detail="Report non parsabile")

        band_norm = analysis.get("band_norm")
        log_info("RUN model_match")
        model_match = None
        model = None
        try:
            model = fetch_genre_model(payload.profile_key)
        except Exception as exc:
            logger.warning("[model] errore fetch_genre_model: %s", exc)

        if model is not None and band_norm is not None:
            try:
                model_match = compute_model_match(
                    band_norm=band_norm,
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
            except Exception as exc:
                logger.warning("[model] compute_model_match failed: %s", exc)
                model_match = None

        if reference_ai is not None and model_match is not None:
            reference_ai["model_match"] = model_match

        mix_health_score, mix_health_confidence = compute_mix_health_score(
            lufs, safe_extras, loudness_stats=safe_extras.get("loudness_stats")
        )

        confidence_data = dict(safe_extras.get("confidence") or {})
        confidence_data["mix_health"] = mix_health_confidence

        result: dict[str, Any] = {
            "version_id": payload.version_id,
            "project_id": payload.project_id,
            "lufs": lufs,
            "overall_score": overall,
            "feedback": report,
            "fix_suggestions": fix_suggestions,
            "reference_ai": reference_ai,
            "bpm": safe_extras.get("bpm"),
            "key": safe_extras.get("key"),
            "spectral_centroid_hz": safe_extras.get("spectral_centroid_hz"),
            "spectral_rolloff_hz": safe_extras.get("spectral_rolloff_hz"),
            "spectral_bandwidth_hz": safe_extras.get("spectral_bandwidth_hz"),
            "spectral_flatness": safe_extras.get("spectral_flatness"),
            "zero_crossing_rate": safe_extras.get("zero_crossing_rate"),
            "spectral": safe_extras.get("spectral"),
            "confidence": confidence_data,
            "warnings": safe_extras.get("warnings"),
            "harmonic_balance": safe_extras.get("harmonic_balance"),
            "stereo_width": safe_extras.get("stereo_width"),
            "loudness_stats": loudness_stats,
            "duration_seconds": safe_extras.get("duration_seconds"),
            "essentia_features": safe_extras.get("essentia_features"),
            "analysis_scope": analysis_scope,
            "analysis_pro": analysis_pro,
            "mix_health_score": mix_health_score,
            "arrays_blob_path": None,
            "arrays_blob_size_bytes": None,
        }

        arrays_blob = _extract_arrays_blob(result, payload.project_id, payload.version_id)
        arrays_blob_path = None
        arrays_blob_size_bytes = None
        if arrays_blob:
            try:
                blob_bytes = json.dumps(arrays_blob, ensure_ascii=False).encode("utf-8")
                relative_path = f"analyzer/{payload.project_id}/{payload.version_id}/arrays.json"
                uploaded_path = _upload_arrays_blob(relative_path, blob_bytes)
                if uploaded_path:
                    arrays_blob_path = uploaded_path
                    arrays_blob_size_bytes = len(blob_bytes)
                else:
                    logger.warning(
                        "[analyzer][storage] arrays blob upload failed for %s/%s",
                        payload.project_id,
                        payload.version_id,
                    )
            except Exception as exc:
                logger.warning("[analyzer][storage] arrays blob serialization failed: %s", exc)

        result["arrays_blob_path"] = arrays_blob_path
        result["arrays_blob_size_bytes"] = arrays_blob_size_bytes

        safe_result = sanitize_non_finite(result)
        return JSONResponse(content=safe_result)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
