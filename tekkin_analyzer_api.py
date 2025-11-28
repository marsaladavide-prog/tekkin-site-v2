import tempfile
import re

import httpx
from fastapi import FastAPI, Request, HTTPException

from analyze_master_web import analyze_to_text, ANALYZER_SECRET

app = FastAPI()

# Regex per estrarre numeri dal report
_lufs_it_re = re.compile(r"LUFS integrato:\s*(-?\d+(?:\.\d+)?)")
_lufs_en_re = re.compile(r"Integrated LUFS:\s*(-?\d+(?:\.\d+)?)")

_overall_it_re = re.compile(r"Valutazione finale:\s*([0-9.]+)/10")
_overall_en_re = re.compile(r"Overall rating:\s*([0-9.]+)/10")


def extract_metrics_from_report(report: str, lang: str):
    """Estrae lufs e overall_score dal report testuale."""
    lufs = None
    overall = None

    if lang == "it":
        m_lufs = _lufs_it_re.search(report)
        if m_lufs:
            lufs = float(m_lufs.group(1))

        m_overall = _overall_it_re.search(report)
        if m_overall:
            overall = float(m_overall.group(1))
    else:
        m_lufs = _lufs_en_re.search(report)
        if m_lufs:
            lufs = float(m_lufs.group(1))

        m_overall = _overall_en_re.search(report)
        if m_overall:
            overall = float(m_overall.group(1))

    return lufs, overall


@app.post("/analyze")
async def analyze_endpoint(request: Request):
    # 1) Controllo secret
    header_secret = request.headers.get("x-analyzer-secret")
    if header_secret != ANALYZER_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    # 2) Body JSON
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    audio_url = payload.get("audio_url")
    lang = payload.get("lang", "it")
    profile_key = payload.get("profile_key", "minimal_deep_tech")
    mode = payload.get("mode", "master")

    if not audio_url:
        raise HTTPException(status_code=400, detail="Missing audio_url")

    # 3) Scarico il file in una temp
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url)
            resp.raise_for_status()
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(resp.content)
                tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Download error: {e}")

    # 4) Chiamo l'Analyzer esistente
    try:
        report = analyze_to_text(
            lang=lang,
            profile_key=profile_key,
            mode=mode,
            file_path=tmp_path,
            enable_plots=False,
            plots_dir="plots",
            emoji=False,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analyzer crashed: {e}")

    # 5) Estraggo lufs e overall_score dal report
    lufs, overall = extract_metrics_from_report(report, lang)

    # 6) Risposta JSON per il sito
    return {
        "lufs": lufs,
        "sub_clarity": None,
        "hi_end": None,
        "dynamics": None,
        "stereo_image": None,
        "tonality": None,
        "overall_score": overall,
        "feedback": report,
    }
