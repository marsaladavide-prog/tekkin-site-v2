import os
import tempfile
import math

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from reference_models import fetch_genre_model
from model_math import compute_model_match

# motore v3.6
from analyze_master_web import analyze_to_text, extract_metrics_from_report
from tekkin_analyzer_v4_extras import analyze_v4_extras

# nuovo motore V1 mix metrics
from tekkin_analyzer_v1 import analyze_mix_v1

ANALYZER_SECRET = os.environ.get("TEKKIN_ANALYZER_SECRET")

if not ANALYZER_SECRET:
    raise RuntimeError("TEKKIN_ANALYZER_SECRET non impostata nell'ambiente")

app = FastAPI()


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

        # 3. uso il motore v3.6 per generare il report testuale + struttura
        analysis = analyze_to_text(
            lang=payload.lang,
            profile_key=payload.profile_key,
            mode=payload.mode,
            file_path=tmp_path,
            enable_plots=False,
            plots_dir="plots",
            emoji=False,
            return_struct=True,
        )

        report = analysis["report"]
        fix_suggestions = analysis.get("fix_suggestions", [])
        reference_ai = analysis.get("reference_ai")

        # 4. estraggo i numeri principali dal report
        lufs, overall = extract_metrics_from_report(report, payload.lang)

        if lufs is None or overall is None:
            print("[analyzer] Impossibile estrarre LUFS / overall dal report")
            raise HTTPException(status_code=500, detail="Report non parsabile")

        # 5. analisi v4 extras
        extras = analyze_v4_extras(tmp_path)
        raw_bpm = extras.get("bpm")
        corrected_bpm = raw_bpm

        if raw_bpm is not None and raw_bpm < 90:
            corrected_bpm = raw_bpm * 2

        print("[analyzer] v4 extras:", extras)

        # 6. Tekkin Analyzer V1: mix, bilanci, stereo, struttura
        mix_v1_result = None
        try:
            mix_v1_result = analyze_mix_v1(
                audio_path=tmp_path,
                profile=payload.profile_key,
            )
        except Exception as e:
            print("[analyzer-v1] errore in analyze_mix_v1:", repr(e))
            mix_v1_result = None

        # 7. AI MODEL v1: confronto con il modello statistico dal DB
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
                        "spectral_centroid_hz": extras.get("spectral_centroid_hz"),
                        "spectral_rolloff_hz": extras.get("spectral_rolloff_hz"),
                        "spectral_bandwidth_hz": extras.get("spectral_bandwidth_hz"),
                        "spectral_flatness": extras.get("spectral_flatness"),
                        "zero_crossing_rate": extras.get("zero_crossing_rate"),
                        "bpm": corrected_bpm,
                    },
                    model=model,
                    lufs=lufs,
                )
            except Exception as e:
                print("[analyzer-ai] errore calcolo model_match:", repr(e))
                model_match = None

        if reference_ai is not None and model_match is not None:
            reference_ai["model_match"] = model_match

        print("[analyzer-api] reference_ai debug:", reference_ai)

        # 8. costruisco il risultato grezzo
        result = {
            "version_id": payload.version_id,
            "project_id": payload.project_id,
            "lufs": lufs,
            "sub_clarity": None,
            "hi_end": None,
            "dynamics": None,
            "stereo_image": None,
            "tonality": None,
            "overall_score": overall,
            "feedback": report,
            "fix_suggestions": fix_suggestions,
            "reference_ai": reference_ai,
            "bpm": corrected_bpm,
            "spectral_centroid_hz": extras.get("spectral_centroid_hz"),
            "spectral_rolloff_hz": extras.get("spectral_rolloff_hz"),
            "spectral_bandwidth_hz": extras.get("spectral_bandwidth_hz"),
            "spectral_flatness": extras.get("spectral_flatness"),
            "zero_crossing_rate": extras.get("zero_crossing_rate"),
            # nuovo blocco: Tekkin Analyzer Mix V1
            "mix_v1": mix_v1_result.model_dump() if mix_v1_result is not None else None,
        }

        # 9. debug per capire eventuali NaN / inf
        debug_non_finite(result)

        # 10. sanifico prima di restituire
        safe_result = sanitize_non_finite(result)

        return JSONResponse(content=safe_result)

    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
