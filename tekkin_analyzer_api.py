import os
import tempfile

import httpx
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

# Importiamo il motore v3.6
from analyze_master_web import analyze_to_text, extract_metrics_from_report
from tekkin_analyzer_v4_extras import analyze_v4_extras

ANALYZER_SECRET = os.environ.get("TEKKIN_ANALYZER_SECRET")

if not ANALYZER_SECRET:
  raise RuntimeError("TEKKIN_ANALYZER_SECRET non impostata nell'ambiente")

app = FastAPI()


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

  # salvo in file temporaneo
  tmp_path = None
  try:
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
    # Reference AI v1: inoltra al frontend il profilo sintetico del mix
    reference_ai = analysis.get("reference_ai")

    # 4. estraggo i numeri principali dal report
    lufs, overall = extract_metrics_from_report(report, payload.lang)

    # 5. analisi v4 extras
    extras = analyze_v4_extras(tmp_path)
    raw_bpm = extras.get("bpm")
    corrected_bpm = raw_bpm

    if raw_bpm is not None and raw_bpm < 90:
      corrected_bpm = raw_bpm * 2
    print("[analyzer] v4 extras:", extras)

    if lufs is None or overall is None:
      print("[analyzer] Impossibile estrarre LUFS / overall dal report")
      raise HTTPException(status_code=500, detail="Report non parsabile")

    print("[analyzer-api] reference_ai debug:", reference_ai)

    # 5. rispondo in JSON nel formato che il sito si aspetta
    # ATTENZIONE: per ora sub_clarity / hi_end / dynamics / stereo_image / tonality
    # non vengono calcolati dal motore v3.6 in modo diretto, quindi li lasciamo null.
    return {
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
    }

  finally:
    if tmp_path and os.path.exists(tmp_path):
      try:
        os.remove(tmp_path)
      except Exception:
        pass
