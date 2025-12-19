"""
Tekkin Analyzer API (minimal)

Goals:
- Expose a single /analyze endpoint for Tekkin Site v2.
- Compute only "stable, front-end useful" metrics:
  - Essentia: BPM, key, loudness (EBU R128), basic spectral descriptors, stereo width.
  - Waveform peaks + spectrum-aware bands (sub/mid/high envelopes).
  - Model match vs genre reference model (reference_models/<profile_key>.json).

No Librosa. No legacy analyze_master_web. Keep it fast and predictable.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import tempfile
from typing import Any, Optional

import httpx
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from tekkin_analyzer_core import analyze_track

# Silence noisy deps (numba can be extremely verbose if its logger is set to DEBUG elsewhere)
logging.getLogger("numba").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.INFO)

ANALYZER_SECRET = os.environ.get("TEKKIN_ANALYZER_SECRET")
if not ANALYZER_SECRET:
    raise RuntimeError("TEKKIN_ANALYZER_SECRET non impostata nell'ambiente")


app = FastAPI(title="Tekkin Analyzer (minimal)")


class AnalyzeRequest(BaseModel):
    # identity
    project_id: str = Field(..., min_length=1)
    version_id: str = Field(..., min_length=1)

    # reference profile key, e.g. "minimal_deep_tech"
    profile_key: str = Field(..., min_length=1)

    # "master" | "premaster" (client decides)
    mode: str = Field("master")

    # audio
    audio_url: str = Field(..., min_length=10)
    audio_sha256: Optional[str] = None

    # optional: upload arrays blob (momentary/short-term LUFS + beats/tempo curve) to supabase storage
    # if you don't need it, keep it false and you'll avoid extra failure points.
    upload_arrays_blob: bool = False

    # optional: supabase storage upload (only used if upload_arrays_blob=true)
    storage_bucket: str = "tracks"
    storage_base_path: str = "analyzer"


class AnalyzeResponse(BaseModel):
    version_id: str
    project_id: str
    profile_key: str
    mode: str

    duration_seconds: float
    bpm: Optional[float] = None
    key: Optional[str] = None

    # kept top-level so the Tekkin site can store it in project_versions.analyzer_zero_crossing_rate
    zero_crossing_rate: Optional[float] = None

    spectral: dict[str, Any]
    stereo_width: Optional[float] = None
    loudness_stats: dict[str, Any]

    warnings: list[str]
    confidence: dict[str, Any]

    essentia_features: dict[str, Any]
    analysis_pro: dict[str, Any] | None = None
    model_match: Optional[dict[str, Any]] = None

    waveform_peaks: list[float]
    waveform_duration: float
    waveform_bands: dict[str, Any]
    band_energy_norm: dict[str, Any] | None = None

    arrays_blob: Optional[dict[str, Any]] = None
    arrays_blob_path: Optional[str] = None
    arrays_blob_size_bytes: Optional[int] = None


def _download_to_tmp(url: str) -> str:
    try:
        with httpx.stream("GET", url, timeout=90.0, follow_redirects=True) as r:
            r.raise_for_status()
            suffix = ".bin"
            # best-effort extension
            ct = (r.headers.get("content-type") or "").lower()
            if "audio/wav" in ct:
                suffix = ".wav"
            elif "audio/x-wav" in ct:
                suffix = ".wav"
            elif "audio/aiff" in ct:
                suffix = ".aiff"
            elif "audio/flac" in ct:
                suffix = ".flac"
            elif "audio/mpeg" in ct:
                suffix = ".mp3"
            elif "audio/mp4" in ct or "audio/m4a" in ct:
                suffix = ".m4a"

            fd, path = tempfile.mkstemp(prefix="tekkin_audio_", suffix=suffix)
            os.close(fd)

            with open(path, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        return path
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"download failed: {exc}") from exc


def _sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def _read_audio(path: str) -> tuple[np.ndarray, int]:
    """
    Returns (stereo_float32, sr)
    stereo shape: (2, n) or (1, n)
    """
    try:
        audio, sr = sf.read(path, dtype="float32", always_2d=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"cannot read audio: {exc}") from exc

    # soundfile returns (n, ch)
    audio = audio.T
    if audio.shape[0] >= 2:
        stereo = audio[:2]
    else:
        stereo = audio[:1]
    return stereo, int(sr)


def _json_default(o: Any):
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (np.floating, np.integer)):
        return o.item()
    return str(o)


def _upload_json_to_supabase_storage(
    *,
    bucket: str,
    object_path: str,
    payload: dict[str, Any],
) -> tuple[Optional[str], Optional[int]]:
    """
    Upload using Supabase Storage REST API.

    NOTE:
    - Use POST with "x-upsert: true" to overwrite.
    - If Supabase returns 400, it's usually an auth/headers/path issue.
    """
    base_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

    if not base_url or not service_key:
        return None, None

    url = f"{base_url.rstrip('/')}/storage/v1/object/{bucket}/{object_path.lstrip('/')}"
    data = json.dumps(payload, separators=(",", ":"), ensure_ascii=False, default=_json_default).encode("utf-8")
    headers = {
        "authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "content-type": "application/json",
        "x-upsert": "true",
    }

    try:
        r = httpx.post(url, content=data, headers=headers, timeout=30.0)
        r.raise_for_status()
        return object_path, len(data)
    except Exception as exc:
        # keep analyzer green - do not fail the whole run because of storage upload
        logging.getLogger("tekkin-analyzer-min").warning("[storage] upload failed: %s", exc)
        return None, None


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    secret = request.headers.get("x-analyzer-secret")
    if not secret or secret != ANALYZER_SECRET:
        raise HTTPException(status_code=401, detail="invalid analyzer secret")

    tmp_path = _download_to_tmp(req.audio_url)
    try:
        sha = _sha256_file(tmp_path)
        if req.audio_sha256 and req.audio_sha256.lower() != sha.lower():
            raise HTTPException(status_code=400, detail="audio_sha256 mismatch")

        stereo, sr = _read_audio(tmp_path)

        # 1) core analysis (essentia + model + waveform)
        try:
            result = analyze_track(
                project_id=req.project_id,
                version_id=req.version_id,
                mode=req.mode,
                profile_key=req.profile_key,
                audio_stereo=stereo,
                sr=sr,
            )
        except Exception as exc:
            logging.exception("Analyzer crash")
            raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")

        log = logging.getLogger("tekkin-analyzer-min")
        log.setLevel(logging.INFO)
        log.info("ANALYZE result keys: %s", list(result.keys()))
        try:
            lufs = (result.get("loudness_stats") or {}).get("integrated_lufs")
            log.info("LUFS integrated: %s", lufs)
        except Exception as exc:
            log.warning("LUFS log failed: %s", exc)

        try:
            log.info(
                "RESULT BRIEF | bpm=%s lufs=%s key=%s width=%s",
                result.get("bpm"),
                (result.get("loudness_stats") or {}).get("integrated_lufs"),
                result.get("key"),
                result.get("stereo_width"),
            )
        except Exception as exc:
            log.warning("Result brief log failed: %s", exc)

        # 2) optional arrays blob
        arrays_blob_path = None
        arrays_blob_size = None
        if req.upload_arrays_blob:
            arrays_blob = result.get("arrays_blob")
            if arrays_blob:
                obj_path = f"{req.storage_base_path}/{req.project_id}/{req.version_id}/arrays.json"
                arrays_blob_path, arrays_blob_size = _upload_json_to_supabase_storage(
                    bucket=req.storage_bucket,
                    object_path=obj_path,
                    payload=arrays_blob,
                )

        # Response shape that matches what your Next routes expect.
        return AnalyzeResponse(
            version_id=req.version_id,
            project_id=req.project_id,
            profile_key=req.profile_key,
            mode=req.mode,
            duration_seconds=float(result.get("duration_seconds") or result.get("waveform_duration") or 0.0),
            bpm=result.get("bpm"),
            key=result.get("key"),
            spectral=result.get("spectral") or {},
            stereo_width=result.get("stereo_width"),
            loudness_stats=result.get("loudness_stats") or {},
            warnings=result.get("warnings") or [],
            confidence=result.get("confidence") or {},
            essentia_features=result.get("essentia_features") or {},
            model_match=result.get("model_match"),
            band_energy_norm=result.get("band_energy_norm") or {},
            waveform_peaks=[float(v) for v in (result.get("waveform_peaks") or [])],
            waveform_duration=float(result.get("waveform_duration") or result.get("duration_seconds") or 0.0),
            waveform_bands=result.get("waveform_bands") or {},
            arrays_blob=result.get("arrays_blob"),
            arrays_blob_path=arrays_blob_path,
            arrays_blob_size_bytes=arrays_blob_size,
        )
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass