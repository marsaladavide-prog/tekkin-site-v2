# Tekkin Analyzer PRO v3.6 - Full Web Edition
# Uso:
#   python analyze_master_web.py <lang: it|en> <profile_key> <mode: master|premaster> "<path_to_wav>" [--plots] [--plots-dir <dir>] [--no-emoji]
#
# Esempio:
#   python analyze_master_web.py it minimal_deep_tech master "C:\\audio\\master.wav" --plots --plots-dir "plots"
#
# Output: report testuale UTF-8 su stdout. Se --plots è presente, salva PNG e annota i percorsi a fine report.

import os
import sys
import io
import json
import math
import argparse
import numpy as np
import re
import tempfile
import httpx
from reference_ai import load_reference_db, evaluate_track_with_reference


# Matplotlib in headless
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import butter, sosfiltfilt, resample_poly
from fastapi import Request, HTTPException


ANALYZER_SECRET = os.environ["TEKKIN_ANALYZER_SECRET"]

# Forza UTF-8 anche su Windows e quando avviato da Node
try:
    sys.stdout.reconfigure(encoding="utf-8")  # Py3.7+
except Exception:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

VERSION = "3.6"

REFERENCE_DB = None
try:
    REFERENCE_DB = load_reference_db("reference_db.json")
except:
    REFERENCE_DB = None

# ---------- Profili ----------
PROFILES = {
    "minimal_deep_tech": {
        "label": "Minimal / Deep Tech",
        "lufs_range": (-8.5, -7.0),
        "crest_range": (6.0, 9.0),
        "true_peak_range_dbfs": (-1.0, -0.1),
        "bands_target": {
            "sub": (0.25, 0.35),
            "low": (0.35, 0.45),
            "lowmid": (0.03, 0.07),
            "mid": (0.08, 0.12),
            "presence": (0.03, 0.06),
            "air": (0.02, 0.04),
            "high": (0.03, 0.06),
        },
        "artistic_weights": {"low_end": 0.5, "clarity": 0.25, "air": 0.25},
    },
    "tech_house_modern": {
        "label": "Tech House Modern",
        "lufs_range": (-7.0, -6.0),
        "crest_range": (6.0, 8.5),
        "true_peak_range_dbfs": (-1.0, -0.1),
        "bands_target": {
            "sub": (0.20, 0.25),
            "low": (0.35, 0.40),
            "lowmid": (0.04, 0.08),
            "mid": (0.12, 0.18),
            "presence": (0.08, 0.12),
            "air": (0.06, 0.10),
            "high": (0.06, 0.10),
        },
        "artistic_weights": {"low_end": 0.4, "clarity": 0.35, "air": 0.25},
    },
    "melodic_deep_house": {
        "label": "Melodic / Deep House",
        "lufs_range": (-9.0, -8.0),
        "crest_range": (7.0, 10.0),
        "true_peak_range_dbfs": (-1.0, -0.1),
        "bands_target": {
            "sub": (0.22, 0.28),
            "low": (0.28, 0.35),
            "lowmid": (0.06, 0.10),
            "mid": (0.18, 0.24),
            "presence": (0.12, 0.18),
            "air": (0.08, 0.12),
            "high": (0.08, 0.12),
        },
        "artistic_weights": {"low_end": 0.3, "clarity": 0.4, "air": 0.3},
    },
    "peak_time_techno": {
        "label": "Peak-Time Techno",
        "lufs_range": (-6.0, -5.0),
        "crest_range": (5.5, 7.5),
        "true_peak_range_dbfs": (-1.0, -0.1),
        "bands_target": {
            "sub": (0.18, 0.24),
            "low": (0.32, 0.40),
            "lowmid": (0.08, 0.12),
            "mid": (0.20, 0.28),
            "presence": (0.10, 0.16),
            "air": (0.04, 0.08),
            "high": (0.06, 0.10),
        },
        "artistic_weights": {"low_end": 0.35, "clarity": 0.4, "air": 0.25},
    },
    "house_groovy_classic": {
        "label": "House Groovy Classic",
        "lufs_range": (-8.5, -7.5),
        "crest_range": (6.5, 9.5),
        "true_peak_range_dbfs": (-1.0, -0.1),
        "bands_target": {
            "sub": (0.22, 0.28),
            "low": (0.38, 0.44),
            "lowmid": (0.06, 0.10),
            "mid": (0.16, 0.22),
            "presence": (0.08, 0.12),
            "air": (0.05, 0.09),
            "high": (0.05, 0.09),
        },
        "artistic_weights": {"low_end": 0.4, "clarity": 0.35, "air": 0.25},
    },
}

def compute_reference_ai(profile_key, band_norm, meters):
    """
    Calcola un profilo "reference_ai" semplice basato su:
    - quante bande sono dentro il target
    - se LUFS è nel range
    - se il crest è nel range
    Usa i dati di PROFILES come "reference" del genere.
    """
    prof = PROFILES.get(profile_key)
    if not prof:
        return None

    bands_target = prof["bands_target"]
    lufs_min, lufs_max = prof["lufs_range"]
    crest_min, crest_max = prof["crest_range"]

    bands_in_target = 0
    bands_total = 0
    bands_status = {}

    for band_name, value in band_norm.items():
        if band_name not in bands_target:
            continue
        bands_total += 1
        lo, hi = bands_target[band_name]
        in_range = lo <= value <= hi
        if in_range:
            bands_in_target += 1
            status = "in_target"
        elif value < lo:
            status = "low"
        else:
            status = "high"
        bands_status[band_name] = {
            "value": value,
            "target_min": lo,
            "target_max": hi,
            "status": status,
        }

    match_ratio = (bands_in_target / bands_total) if bands_total > 0 else 0.0

    integrated_lufs = meters.get("integrated_lufs")
    crest = meters.get("crest")

    lufs_in_target = (
        integrated_lufs is not None and lufs_min <= integrated_lufs <= lufs_max
    )
    crest_in_target = (
        crest is not None and crest_min <= crest <= crest_max
    )

    # tag semplice sul colore del mix
    top_energy = band_norm.get("high", 0) + band_norm.get("air", 0) + band_norm.get("presence", 0)
    low_energy = band_norm.get("sub", 0) + band_norm.get("low", 0)
    if top_energy > low_energy + 0.05:
        tone_tag = "bright"
    elif low_energy > top_energy + 0.05:
        tone_tag = "warm"
    else:
        tone_tag = "balanced"

    return {
        "profile_key": profile_key,
        "profile_label": prof["label"],
        "match_ratio": match_ratio,
        "bands_in_target": bands_in_target,
        "bands_total": bands_total,
        "lufs_in_target": lufs_in_target,
        "crest_in_target": crest_in_target,
        "tone_tag": tone_tag,
        "bands_status": bands_status,
    }

# ---------- Bande ----------
BAND_DEFS = {
    "sub": (30, 60),
    "low": (20, 150),
    "lowmid": (200, 300),
    "mid": (150, 2000),
    "presence": (2000, 5000),
    "air": (8000, 12000),
    "high": (2000, 16000),
}

# ---------- DSP helpers ----------
def butter_sos_band(low_hz, high_hz, fs, order=4):
    nyq = 0.5 * fs
    lo = max(1e-6, low_hz / nyq)
    hi = min(0.999999, high_hz / nyq)
    if hi <= lo:
        return None
    return butter(order, [lo, hi], btype="band", output="sos")

def band_rms(x_mono, fs, low_hz, high_hz):
    sos = butter_sos_band(low_hz, high_hz, fs, order=4)
    if sos is None:
        return 0.0
    y = sosfiltfilt(sos, x_mono)
    return float(np.sqrt(np.mean(y**2)))

def clamp_score(val, rng):
    lo, hi = rng
    if hi < lo:
        lo, hi = hi, lo
    if lo <= val <= hi:
        return 1.0
    d = min(abs(val - lo), abs(val - hi))
    width = (hi - lo) if (hi - lo) != 0 else 1.0
    return max(0.0, 1.0 - d / (width * 2.0))

def pretty_percent(x):
    return f"{x*100:.1f}%"

# ---------- Feedback testuale ----------
def gen_feedback_text(lang, prof_key, meters, band_norm, mode):
    p = PROFILES[prof_key]
    lr = p["lufs_range"]; cr = p["crest_range"]
    lufs = meters["integrated_lufs"]; crest = meters["crest"]; tp = meters["true_peak_dbfs"]

    sub = band_norm["sub"]; low = band_norm["low"]; lowmid = band_norm["lowmid"]
    mid = band_norm["mid"]; presence = band_norm["presence"]; air = band_norm["air"]

    lines = []

    # Loudness
    if mode == "premaster":
        if -7.5 <= tp <= -4.0:
            lines += [("EN", f"Premaster headroom OK: True Peak {tp:.1f} dBFS; dynamics preserved."),
                      ("IT", f"Headroom premaster OK: True Peak {tp:.1f} dBFS; dinamica preservata.")]
        elif tp > -4.0:
            lines += [("EN", f"Premaster True Peak {tp:.1f} dBFS is high; reduce peaks for safer mastering."),
                      ("IT", f"True Peak premaster {tp:.1f} dBFS elevato; riduci i picchi per un mastering sicuro.")]
        else:
            lines += [("EN", f"Premaster True Peak {tp:.1f} dBFS is low; more level is acceptable if balance holds."),
                      ("IT", f"True Peak premaster {tp:.1f} dBFS basso; puoi alzare un po' mantenendo il bilanciamento.")]
    else:
        if lufs < lr[0] - 1.0:
            lines += [("EN", f"Loudness {lufs:.1f} LUFS is conservative for this profile."),
                      ("IT", f"Loudness {lufs:.1f} LUFS è conservativo per questo profilo.")]
        elif lufs > lr[1] + 0.5:
            lines += [("EN", f"Loudness {lufs:.1f} LUFS is hot; check limiter drive."),
                      ("IT", f"Loudness {lufs:.1f} LUFS è spinto; controlla il limiter.")]
        else:
            lines += [("EN", f"Loudness {lufs:.1f} LUFS sits within target."),
                      ("IT", f"Loudness {lufs:.1f} LUFS in linea col target.")]

    # Dynamics
    if crest < cr[0]:
        lines += [("EN", f"Crest {crest:.1f} dB is low; transients may be squashed."),
                  ("IT", f"Crest {crest:.1f} dB basso; transienti potenzialmente schiacciati.")]
    elif crest > cr[1]:
        lines += [("EN", f"Crest {crest:.1f} dB is high; a touch more limiting may add weight."),
                  ("IT", f"Crest {crest:.1f} dB alto; un filo di limiting può aggiungere peso.")]
    else:
        lines += [("EN", f"Dynamics {crest:.1f} dB feel controlled and musical."),
                  ("IT", f"Dinamica {crest:.1f} dB controllata e musicale.")]

    # Low end
    sub_t = p["bands_target"]["sub"]
    if sub > sub_t[1]:
        lines += [("EN", "Sub 30-60 Hz slightly dominant; tame 35-45 Hz to avoid boominess."),
                  ("IT", "Sub 30-60 Hz leggermente dominante; contiene 35-45 Hz per evitare boominess.")]
    elif sub < sub_t[0]:
        lines += [("EN", "Sub presence could be higher for this profile."),
                  ("IT", "Il sub potrebbe essere più presente per questo profilo.")]
    else:
        lines += [("EN", "Sub range is well controlled."),
                  ("IT", "Gamma sub ben controllata.")]

    # Low-mid sensitivity
    lowmid_t = p["bands_target"]["lowmid"]
    if lowmid > lowmid_t[1] * 0.9:
        lines += [("EN", "Low-mid 200-300 Hz buildup detected; consider dynamic EQ on the bus."),
                  ("IT", "Accumulo 200-300 Hz; valuta un EQ dinamico sul bus.")]

    # Presence & Air
    presence_t = p["bands_target"]["presence"]
    air_t = p["bands_target"]["air"]
    if presence < presence_t[0]:
        lines += [("EN", "Presence 2-5 kHz is soft; +1 dB near 3 kHz can improve definition."),
                  ("IT", "Presence 2-5 kHz morbida; +1 dB a 3 kHz migliora la definizione.")]
    elif presence > presence_t[1]:
        lines += [("EN", "Presence is bright; check for harshness 3-4 kHz."),
                  ("IT", "Presence brillante; verifica harshness 3-4 kHz.")]
    if air < air_t[0]:
        lines += [("EN", "Air 8-12 kHz is restrained; a gentle high-shelf can open the top."),
                  ("IT", "Air 8-12 kHz contenuta; un leggero high-shelf apre le alte.")]
    elif air > air_t[1]:
        lines += [("EN", "Air is vivid; ensure it is not fatiguing over time."),
                  ("IT", "Air vivace; verifica che non affatichi all'ascolto.")]

    # Mids
    mid_t = p["bands_target"]["mid"]
    if mid < mid_t[0]:
        lines += [("EN", "Mids are slightly scooped; fill 600 Hz-1.5 kHz on key elements if the mix feels hollow."),
                  ("IT", "Medie leggermente scavate; riempi 600 Hz-1.5 kHz sui key elements se il mix è vuoto.")]

    return [t for code, t in lines if code == ("IT" if lang == "it" else "EN")]

def gen_conclusion_text(lang, verdict, overall, prof_label, mode):
    if lang == "it":
        if mode == "premaster":
            vmap = {
                "Ready for Mastering": "Pronto per il mastering",
                "Needs EQ Balance": "Richiede bilanciamento EQ",
                "Needs Cleanup": "Richiede pulizia del mix",
                "Needs Work": "Richiede interventi",
            }
            return [
                f"Conclusione (Premaster) - profilo: {prof_label}.",
                f"Valutazione finale: {overall:.1f}/10 - {vmap.get(verdict, verdict)}."
            ]
        else:
            vmap = {
                "Release Ready": "Pronto per la release",
                "Club Ready": "Pronto per il club",
                "Needs Tweak": "Richiede piccoli interventi",
                "Needs Work": "Richiede interventi",
            }
            return [
                f"Conclusione (Master) - profilo: {prof_label}.",
                f"Valutazione finale: {overall:.1f}/10 - {vmap.get(verdict, verdict)}."
            ]
    else:
        if mode == "premaster":
            return [
                f"Conclusion (Premaster) - profile: {prof_label}.",
                f"Overall rating: {overall:.1f}/10 - {verdict}."
            ]
        else:
            return [
                f"Conclusion (Master) - profile: {prof_label}.",
                f"Overall rating: {overall:.1f}/10 - {verdict}."
            ]

# ---------- Consigli di Produzione ----------
def gen_production_advice(band_norm, mode, lang):
    advice = []
    if band_norm["sub"] > 0.35 and band_norm["mid"] < 0.08:
        advice += [("IT", "Kick troppo lungo o sub invadente: prova un kick più punchy o sidechain più profondo."),
                   ("EN", "Kick too long or sub-heavy: try a punchier kick or deeper sidechain.")]
    if (band_norm["presence"] + band_norm["air"]) > (band_norm["mid"] + band_norm["lowmid"]) * 1.4:
        advice += [("IT", "Hi-hat/top brillanti: valuta saturazione più morbida o uno shelf dolce sopra 10 kHz."),
                   ("EN", "Bright hats/top: consider softer saturation or a gentle shelf above 10 kHz.")]
    if band_norm["mid"] < 0.07 and band_norm["presence"] > 0.05:
        advice += [("IT", "Vocal o lead nascosti: aggiungi 800-1500 Hz sugli elementi chiave."),
                   ("EN", "Vocals or leads may be buried: add 800-1500 Hz on key elements.")]
    if band_norm["lowmid"] > 0.08:
        advice += [("IT", "Accumulo 200-300 Hz: rivedi interazione kick-bass o usa un kick più pulito."),
                   ("EN", "200-300 Hz buildup: adjust kick-bass relationship or use a cleaner kick.")]
    if not advice:
        advice += [("IT", "Scelta dei suoni e bilanciamento coerenti con il genere. Solida base."),
                   ("EN", "Sound selection and balance fit the style. Solid base.")]
    return [t for code, t in advice if code == ("IT" if lang == "it" else "EN")]

# ---------- Punteggi ----------
def compute_scores(prof, band_norm, integrated_lufs, crest, true_peak_dbfs, mode):
    band_status = {}
    out_of_target_count = 0
    for k, (lo, hi) in prof["bands_target"].items():
        v = band_norm[k]
        if v < lo:
            band_status[k] = "LOW"; out_of_target_count += 1
        elif v > hi:
            band_status[k] = "HIGH"; out_of_target_count += 1
        else:
            band_status[k] = "OK"

    if mode == "premaster":
        lufs_score = 1.0
        crest_score = clamp_score(crest, prof["crest_range"])
        headroom_score = clamp_score(true_peak_dbfs, (-8.0, -4.0))
        band_scores = [clamp_score(band_norm[k], prof["bands_target"][k]) for k in prof["bands_target"]]
        tonal_score = float(np.mean(band_scores)) if band_scores else 0.0
        tech_score = 0.40 * crest_score + 0.30 * headroom_score + 0.30 * tonal_score
    else:
        lufs_score = clamp_score(integrated_lufs, prof["lufs_range"])
        crest_score = clamp_score(crest, prof["crest_range"])
        tp_score = clamp_score(true_peak_dbfs, prof["true_peak_range_dbfs"])
        band_scores = [clamp_score(band_norm[k], prof["bands_target"][k]) for k in prof["bands_target"]]
        tonal_score = float(np.mean(band_scores)) if band_scores else 0.0
        tech_score = 0.35 * lufs_score + 0.25 * crest_score + 0.15 * tp_score + 0.25 * tonal_score

    w = prof["artistic_weights"]
    low_end_ratio = band_norm["sub"] + band_norm["low"]
    le_lo = prof["bands_target"]["sub"][0] + prof["bands_target"]["low"][0]
    le_hi = prof["bands_target"]["sub"][1] + prof["bands_target"]["low"][1]
    low_end_score = clamp_score(low_end_ratio, (le_lo, le_hi))

    clarity_ratio = band_norm["mid"] + band_norm["presence"]
    cl_lo = prof["bands_target"]["mid"][0] + prof["bands_target"]["presence"][0]
    cl_hi = prof["bands_target"]["mid"][1] + prof["bands_target"]["presence"][1]
    clarity_score = clamp_score(clarity_ratio, (cl_lo, cl_hi))

    air_score = clamp_score(band_norm["air"], prof["bands_target"]["air"])

    artistic_score = w["low_end"] * low_end_score + w["clarity"] * clarity_score + w["air"] * air_score
    artistic_score *= max(0.7, 1.0 - 0.04 * out_of_target_count)

    penalty_per_band = 0.06 if mode == "master" else 0.04
    penalty = out_of_target_count * penalty_per_band
    base_overall = 0.6 * tech_score + 0.4 * artistic_score
    overall = 10.0 * max(0.0, base_overall - penalty)
    overall = max(0.0, min(10.0, overall))

    if mode == "premaster":
        if overall >= 8.5 and -8.0 <= true_peak_dbfs <= -4.0:
            verdict = "Ready for Mastering"
        elif overall >= 7.0:
            verdict = "Needs EQ Balance"
        elif overall >= 5.0:
            verdict = "Needs Cleanup"
        else:
            verdict = "Needs Work"
    else:
        if overall >= 9.0:
            verdict = "Release Ready"
        elif overall >= 7.5:
            verdict = "Club Ready"
        elif overall >= 5.5:
            verdict = "Needs Tweak"
        else:
            verdict = "Needs Work"

    return band_status, tech_score, artistic_score, overall, verdict, out_of_target_count
def gen_fix_suggestions(lang, prof_key, band_norm, meters, mode):
    """Suggerimenti pratici di mix/master in base a bande e metri."""
    prof = PROFILES.get(prof_key, PROFILES["minimal_deep_tech"])
    it = (lang == "it")

    def txt(it_str, en_str):
        return it_str if it else en_str

    def add_suggestion(issue_it, issue_en, analysis_it, analysis_en, steps_it, steps_en, priority="medium"):
        return {
            "issue": txt(issue_it, issue_en),
            "priority": priority,  # "low", "medium", "high"
            "analysis": txt(analysis_it, analysis_en),
            "steps": steps_it if it else steps_en,
        }

    suggestions = []

    sub = band_norm.get("sub", 0.0)
    low = band_norm.get("low", 0.0)
    lowmid = band_norm.get("lowmid", 0.0)
    mid = band_norm.get("mid", 0.0)
    presence = band_norm.get("presence", 0.0)
    air = band_norm.get("air", 0.0)
    high = band_norm.get("high", 0.0)

    lufs = meters.get("integrated_lufs")
    crest = meters.get("crest")
    true_peak = meters.get("true_peak_dbfs")

    t = prof["bands_target"]

    def deviation(val, lo, hi):
        if lo <= val <= hi:
            return 0.0
        if val < lo and lo > 0:
            return (lo - val) / lo
        if val > hi and hi > 0:
            return (val - hi) / hi
        return 0.0

    def dev_priority(dev):
        if dev >= 0.4:
            return "high"
        if dev >= 0.2:
            return "medium"
        return "low"

    # 1) Sub bass
    sub_dev = deviation(sub, *t["sub"])
    if sub_dev > 0:
        prio = dev_priority(sub_dev)
        if sub < t["sub"][0]:
            suggestions.append(
                add_suggestion(
                    "Sub poco presente",
                    "Sub energy is low",
                    f"Il sub è al {sub*100:.1f}% mentre il target è {t['sub'][0]*100:.1f} - {t['sub'][1]*100:.1f}%.",
                    f"Sub sits at {sub*100:.1f}% vs target {t['sub'][0]*100:.1f} - {t['sub'][1]*100:.1f}%.",
                    [
                        "Aumenta 1.5 - 3.0 dB intorno a 45 - 55 Hz con Q largo.",
                        "Aggiungi una saturazione morbida sul canale bass/sub per farlo emergere.",
                        "Controlla che il sidechain sul sub non sia troppo profondo o lungo."
                    ],
                    [
                        "Boost 1.5 - 3.0 dB around 45 - 55 Hz with a wide Q.",
                        "Add gentle saturation on the bass/sub channel to bring it forward.",
                        "Check that sidechain on the sub is not too deep or too long."
                    ],
                    priority=prio,
                )
            )
        else:
            suggestions.append(
                add_suggestion(
                    "Sub troppo dominante",
                    "Sub energy is dominant",
                    f"Il sub è al {sub*100:.1f}% sopra il range target {t['sub'][0]*100:.1f} - {t['sub'][1]*100:.1f}%.",
                    f"Sub is {sub*100:.1f}% above target {t['sub'][0]*100:.1f} - {t['sub'][1]*100:.1f}%.",
                    [
                        "Riduci 1.5 - 3.0 dB fra 35 - 50 Hz sul bus o sul sub.",
                        "Accorcia leggermente il decay del kick o della bassline.",
                        "Controlla il low cut su synth e fx per evitare accumulo nel sub."
                    ],
                    [
                        "Cut 1.5 - 3.0 dB around 35 - 50 Hz on the bus or sub channel.",
                        "Shorten the decay of kick or bassline slightly.",
                        "Check low cuts on synths and fx to avoid sub buildup."
                    ],
                    priority=prio,
                )
            )

    # 2) Lowmid 200 - 300 Hz
    lowmid_dev = deviation(lowmid, *t["lowmid"])
    if lowmid_dev > 0 and lowmid > t["lowmid"][1]:
        prio = dev_priority(lowmid_dev)
        suggestions.append(
            add_suggestion(
                "Accumulo 200 - 300 Hz",
                "Buildup around 200 - 300 Hz",
                f"L'area lowmid è all'incirca {lowmid*100:.1f}%, sopra il target {t['lowmid'][0]*100:.1f} - {t['lowmid'][1]*100:.1f}%.",
                f"Lowmid area is about {lowmid*100:.1f}% vs target {t['lowmid'][0]*100:.1f} - {t['lowmid'][1]*100:.1f}%.",
                [
                    "Inserisci un EQ dinamico sul mix bus con cut -1.5 / -3 dB a 220 - 260 Hz, Q 1.2.",
                    "Sidechaina questa banda sul kick per aprire spazio sul colpo.",
                    "Ripulisci bassline, pad e fx risonanti intorno ai 250 Hz."
                ],
                [
                    "Place a dynamic EQ on the mix bus with -1.5 / -3 dB cut at 220 - 260 Hz, Q 1.2.",
                    "Sidechain that band to the kick to open space on the hit.",
                    "Clean up bassline, pads and resonant fx around 250 Hz."
                ],
                priority=prio,
            )
        )

    # 3) Mid body
    mid_dev = deviation(mid, *t["mid"])
    if mid_dev > 0:
        prio = dev_priority(mid_dev)
        if mid < t["mid"][0]:
            suggestions.append(
                add_suggestion(
                    "Medie un po' scavate",
                    "Mids slightly scooped",
                    f"Le medie sono sotto il range target ({mid*100:.1f}% vs {t['mid'][0]*100:.1f} - {t['mid'][1]*100:.1f}%).",
                    f"Mids sit below target ({mid*100:.1f}% vs {t['mid'][0]*100:.1f} - {t['mid'][1]*100:.1f}%).",
                    [
                        "Aggiungi 1 - 2 dB fra 800 Hz e 1.5 kHz su lead, vocal chop o elementi portanti.",
                        "Valuta un lieve tilt EQ che sposti un po' di energia dal low end alle medie.",
                    ],
                    [
                        "Add 1 - 2 dB between 800 Hz and 1.5 kHz on leads, vocal chops or main elements.",
                        "Consider a light tilt EQ to move some energy from low end into mids.",
                    ],
                    priority=prio,
                )
            )
        else:
            suggestions.append(
                add_suggestion(
                    "Medie un po' avanti",
                    "Mids slightly forward",
                    f"Le medie superano il range target ({mid*100:.1f}% vs {t['mid'][0]*100:.1f} - {t['mid'][1]*100:.1f}%).",
                    f"Mids exceed target ({mid*100:.1f}% vs {t['mid'][0]*100:.1f} - {t['mid'][1]*100:.1f}%).",
                    [
                        "Riduci 1 dB fra 900 Hz e 1.8 kHz sul bus o sui gruppi che spingono.",
                        "Verifica che percussioni mid e synth non siano troppo aggressivi in quella zona."
                    ],
                    [
                        "Cut about 1 dB between 900 Hz and 1.8 kHz on the bus or on the groups that poke out.",
                        "Check that mid percs and synths are not too aggressive in that area."
                    ],
                    priority=prio,
                )
            )

    # 4) Presence e Air
    pres_dev = deviation(presence, *t["presence"])
    if pres_dev > 0:
        prio = dev_priority(pres_dev)
        if presence < t["presence"][0]:
            suggestions.append(
                add_suggestion(
                    "Presence morbida",
                    "Presence is soft",
                    "La zona 2 - 5 kHz è leggermente sotto target, la definizione può risultare soft.",
                    "The 2 - 5 kHz area sits a bit below target, definition may feel soft.",
                    [
                        "Aggiungi 1 dB intorno a 3 kHz su elementi chiave (voci, lead, clap).",
                        "Evita boost troppo larghi che rendono il mix stridente."
                    ],
                    [
                        "Add around 1 dB near 3 kHz on key elements (vocals, leads, clap).",
                        "Avoid overly wide boosts that make the mix harsh."
                    ],
                    priority=prio,
                )
            )
        else:
            suggestions.append(
                add_suggestion(
                    "Presence brillante",
                    "Presence is bright",
                    "La zona 2 - 5 kHz è sopra target, rischio di harshness sulle medie alte.",
                    "The 2 - 5 kHz band is above target, risk of harshness in upper mids.",
                    [
                        "Riduci 1 - 2 dB a 3 - 4 kHz sui gruppi più aggressivi.",
                        "Valuta un de-esser largo su hat, shakers e loop rumorosi."
                    ],
                    [
                        "Cut 1 - 2 dB at 3 - 4 kHz on the most aggressive groups.",
                        "Consider a wide de-esser on hats, shakers and noisy loops."
                    ],
                    priority=prio,
                )
            )

    air_dev = deviation(air, *t["air"])
    if air_dev > 0:
        prio = dev_priority(air_dev)
        if air < t["air"][0]:
            suggestions.append(
                add_suggestion(
                    "Air contenuta",
                    "Air is restrained",
                    "La banda 8 - 12 kHz è sotto il range, il mix può risultare un po' chiuso.",
                    "The 8 - 12 kHz band is below range, the mix may feel a bit closed.",
                    [
                        "Aggiungi un high shelf di +0.5 / +1 dB a partire da 10 kHz sul bus.",
                        "Attenzione a non enfatizzare troppo rumore e sibilanti."
                    ],
                    [
                        "Add a high shelf of +0.5 / +1 dB from 10 kHz on the mix bus.",
                        "Be careful not to overemphasize noise and sibilance."
                    ],
                    priority=prio,
                )
            )
        else:
            suggestions.append(
                add_suggestion(
                    "Air molto vivace",
                    "Air is very bright",
                    "La banda 8 - 12 kHz è sopra target, possibile affaticamento all'ascolto.",
                    "The 8 - 12 kHz band is above target, potential listening fatigue.",
                    [
                        "Riduci 1 dB con uno shelf sopra 10 kHz sul bus.",
                        "Controlla hat e ride con un EQ dinamico mirato intorno a 9 - 11 kHz."
                    ],
                    [
                        "Reduce about 1 dB with a high shelf above 10 kHz on the bus.",
                        "Control hats and rides with a dynamic EQ around 9 - 11 kHz."
                    ],
                    priority=prio,
                )
            )

    # 5) Crest factor e loudness
    cr_lo, cr_hi = prof["crest_range"]
    if crest is not None:
        if crest < cr_lo:
            suggestions.append(
                add_suggestion(
                    "Crest basso, mix troppo compresso",
                    "Low crest, mix overcompressed",
                    f"Crest a {crest:.1f} dB, sotto il range {cr_lo:.1f} - {cr_hi:.1f} dB.",
                    f"Crest at {crest:.1f} dB, below target {cr_lo:.1f} - {cr_hi:.1f} dB.",
                    [
                        "Allenta leggermente il limiter o riduci la compressione sul bus.",
                        "Lascia più transienti al kick riducendo l'attacco della compressione."
                    ],
                    [
                        "Ease the limiter a bit or reduce bus compression.",
                        "Let more transients through on the kick by relaxing compressor attack."
                    ],
                    priority="medium",
                )
            )
        elif crest > cr_hi:
            suggestions.append(
                add_suggestion(
                    "Crest alto, mix molto dinamico",
                    "High crest, very dynamic mix",
                    f"Crest a {crest:.1f} dB, sopra il range {cr_lo:.1f} - {cr_hi:.1f} dB.",
                    f"Crest at {crest:.1f} dB, above target {cr_lo:.1f} - {cr_hi:.1f} dB.",
                    [
                        "Puoi usare un limiter con attacco 2 - 5 ms e release 50 - 80 ms per aggiungere peso.",
                        "Controlla i picchi isolati (kick/snare) con un clipper dolce."
                    ],
                    [
                        "You can use a limiter with 2 - 5 ms attack and 50 - 80 ms release to add weight.",
                        "Control isolated peaks (kick/snare) with a gentle clipper."
                    ],
                    priority="low",
                )
            )

    if not suggestions:
        suggestions.append(
            add_suggestion(
                "Nessuna correzione critica",
                "No critical fixes",
                "Il bilanciamento rispetta bene il profilo, puoi concentrarti su dettagli creativi.",
                "Balance fits the profile well, you can focus on creative details.",
                [
                    "Rifinisci piccoli dettagli di automazioni e transizioni.",
                    "Valuta solo micro aggiustamenti di EQ, se necessari."
                ],
                [
                    "Refine small details like automation and transitions.",
                    "Only apply micro EQ moves if needed."
                ],
                priority="low",
            )
        )

    return suggestions

    # ---------- Parser del report per estrarre numeri ----------
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

# ---------- Analisi ----------
def analyze_to_text(lang, profile_key, mode, file_path, enable_plots=False, plots_dir="plots", emoji=True, return_struct=False):
    if profile_key not in PROFILES:
        profile_key = "minimal_deep_tech"
    if mode not in ("master", "premaster"):
        mode = "master"
    if lang not in ("it", "en"):
        lang = "it"
    if not os.path.exists(file_path):
        return f"Error: file not found -> {file_path}"

    prof = PROFILES[profile_key]
    out_lines = []

    head_icon = "🎧 " if emoji else ""
    out_lines.append(f"{head_icon}Analizzato file: {os.path.basename(file_path)}\n")

    audio, sr = sf.read(file_path, dtype="float32")
    if audio.ndim == 1:
        audio = audio[:, None]
    seg64 = audio.astype(np.float64, copy=False)
    mid_mono = np.mean(seg64, axis=1)

    meter = pyln.Meter(sr, block_size=0.400)
    seg_for_loud = seg64 if seg64.shape[1] > 1 else seg64[:, 0]
    integrated_lufs = float(meter.integrated_loudness(seg_for_loud))

    short_window = 3.0
    hop = 1.0
    frame_len = int(short_window * sr)
    hop_len = int(hop * sr)
    st_vals = []
    for i in range(0, seg64.shape[0] - frame_len + 1, hop_len):
        fr = seg64[i:i + frame_len, :] if seg64.shape[1] > 1 else seg64[i:i + frame_len, 0]
        if np.max(np.abs(fr)) < 1e-9:
            continue
        try:
            val = meter.integrated_loudness(fr)
            if np.isfinite(val):
                st_vals.append(float(val))
        except Exception:
            pass
    short_lufs_mean = float(np.mean(st_vals)) if st_vals else integrated_lufs
    short_lufs_max = float(np.max(st_vals)) if st_vals else integrated_lufs

    if seg64.shape[1] > 1:
        tp_up_L = resample_poly(seg64[:, 0], 4, 1)
        tp_up_R = resample_poly(seg64[:, 1], 4, 1)
        true_peak = float(max(np.max(np.abs(tp_up_L)), np.max(np.abs(tp_up_R))))
        peak_sample = float(max(np.max(np.abs(seg64[:, 0])), np.max(np.abs(seg64[:, 1]))))
        rms = float(np.sqrt(np.mean((seg64[:, 0] ** 2 + seg64[:, 1] ** 2) / 2.0)))
    else:
        tp_up = resample_poly(seg64[:, 0], 4, 1)
        true_peak = float(np.max(np.abs(tp_up)))
        peak_sample = float(np.max(np.abs(seg64[:, 0])))
        rms = float(np.sqrt(np.mean(seg64[:, 0] ** 2)))
    true_peak_dbfs = 20 * np.log10(true_peak + 1e-12)
    rms_dbfs = 20 * np.log10(rms + 1e-12)
    crest = float(20 * np.log10((peak_sample + 1e-12) / (rms + 1e-12)))

    band_vals = {n: band_rms(mid_mono, sr, lo, hi) for n, (lo, hi) in BAND_DEFS.items()}
    total_energy = sum(band_vals.values()) + 1e-12
    band_norm = {k: v / total_energy for k, v in band_vals.items()}

    if lang == "it":
        out_lines += [
            "=== PROFILO ===",
            f"Profilo: {prof['label']}",
            f"Target LUFS: {prof['lufs_range'][0]} - {prof['lufs_range'][1]}",
            "",
            "=== MISURE ===",
            f"LUFS integrato: {integrated_lufs:.2f}",
            f"LUFS short-term medio: {short_lufs_mean:.2f}",
            f"LUFS short-term max: {short_lufs_max:.2f}",
            f"RMS: {rms_dbfs:.2f} dBFS",
            f"True Peak: {true_peak_dbfs:.2f} dBFS",
            f"Crest Factor: {crest:.2f} dB",
            "",
            "=== TONAL BALANCE ===",
        ]
    else:
        out_lines += [
            "=== PROFILE ===",
            f"Profile: {prof['label']}",
            f"Target LUFS: {prof['lufs_range'][0]} to {prof['lufs_range'][1]}",
            "",
            "=== METERS ===",
            f"Integrated LUFS: {integrated_lufs:.2f}",
            f"Short-term LUFS mean: {short_lufs_mean:.2f}",
            f"Short-term LUFS max: {short_lufs_max:.2f}",
            f"RMS: {rms_dbfs:.2f} dBFS",
            f"True Peak: {true_peak_dbfs:.2f} dBFS",
            f"Crest Factor: {crest:.2f} dB",
            "",
            "=== TONAL BALANCE ===",
        ]

    for k in ["sub", "low", "lowmid", "mid", "presence", "air", "high"]:
        perc = band_norm[k]
        tgt = prof["bands_target"][k]
        status = "OK"
        if perc < tgt[0]:
            status = "Low"
        elif perc > tgt[1]:
            status = "High"
        label = k.capitalize()
        out_lines.append(f"- {label:9s}: {pretty_percent(perc)}  Target {pretty_percent(tgt[0])} - {pretty_percent(tgt[1])}  -> {status}")

    meters = dict(
        integrated_lufs=integrated_lufs,
        short_lufs_mean=short_lufs_mean,
        short_lufs_max=short_lufs_max,
        rms_dbfs=rms_dbfs,
        true_peak_dbfs=true_peak_dbfs,
        crest=crest,
    )

    fb_lines = gen_feedback_text(lang, profile_key, meters, band_norm, mode)
    out_lines.append("")
    out_lines.append("=== ANALISI E FEEDBACK ===" if lang == "it" else "=== ANALYSIS & FEEDBACK ===")
    out_lines += fb_lines

    if mode == "premaster":
        out_lines.append("")
        out_lines.append("=== MIX INSIGHT ===")
        mix_lines = []
        body = band_norm["mid"] + band_norm["lowmid"]
        top = band_norm["presence"] + band_norm["air"]
        if top > body * 1.4 and body < 0.20:
            mix_lines += [("IT", "Alte (hat/top) evidenti rispetto al corpo del mix."),
                          ("EN", "Top-end (hats/highs) stands out over the body of the mix.")]
        low_end = band_norm["sub"] + band_norm["low"]
        if low_end > 0.55 and band_norm["mid"] < 0.10 and band_norm["presence"] < 0.05:
            mix_lines += [("IT", "Low-end dominante rispetto alle medie; il mix può risultare sbilanciato."),
                          ("EN", "Low-end dominates over mids; the mix may feel bass-heavy.")]
        if band_norm["mid"] < 0.07 and band_norm["presence"] > 0.05:
            mix_lines += [("IT", "Medie scavate: voce o lead rischiano di stare dietro a batteria e perc."),
                          ("EN", "Mids are scooped; vocals or leads may sit behind drums and percs.")]
        lowmid_limit = prof["bands_target"]["lowmid"][1]
        if band_norm["lowmid"] > (lowmid_limit * 0.9):
            mix_lines += [("IT", "Buildup area 200-300 Hz possibile."),
                          ("EN", "Buildup around 200-300 Hz detected.")]
        if band_norm["air"] < prof["bands_target"]["air"][0]:
            mix_lines += [("IT", "Manca aria sulle alte 10-12 kHz."),
                          ("EN", "Top-end could use more air around 10-12 kHz.")]
        if crest < prof["crest_range"][0]:
            mix_lines += [("IT", "Compressione marcata, transienti attenuati."),
                          ("EN", "Marked compression, attenuated transients.")]
        if not mix_lines:
            mix_lines += [("IT", "Mix bilanciato senza criticità evidenti."),
                          ("EN", "Balanced mix with no major issues.")]
        out_lines += [txt for code, txt in mix_lines if code == ("IT" if lang == "it" else "EN")]

    out_lines.append("")
    out_lines.append("=== CONSIGLI DI PRODUZIONE ===" if lang == "it" else "=== PRODUCTION ADVICE ===")
    out_lines += gen_production_advice(band_norm, mode, lang)

    band_status, tech_score, artistic_score, overall, verdict, oob = compute_scores(
        prof, band_norm, integrated_lufs, crest, true_peak_dbfs, mode
    )

    if lang == "it":
        out_lines += [
            "",
            "=== RIEPILOGO ===",
            f"Punteggio tecnico: {tech_score*10:.1f}/10",
            f"Punteggio artistico: {artistic_score*10:.1f}/10",
        ]
        if oob > 0:
            out_lines.append(f"Penalità bande fuori target: -{oob * (6 if mode == 'master' else 4) / 10:.1f} punti")
    else:
        out_lines += [
            "",
            "=== SUMMARY ===",
            f"Technical score: {tech_score*10:.1f}/10",
            f"Artistic score:  {artistic_score*10:.1f}/10",
        ]
        if oob > 0:
            out_lines.append(f"Out-of-target band penalty: -{oob * (6 if mode == 'master' else 4) / 10:.1f} points")

    concl = gen_conclusion_text(lang, verdict, overall, prof["label"], mode)
    out_lines += concl

    low_energy = (band_norm["sub"] + band_norm["low"]) * 100
    mid_energy = (band_norm["lowmid"] + band_norm["mid"]) * 100
    high_energy = (band_norm["presence"] + band_norm["air"] + band_norm["high"]) * 100
    out_lines.append("")
    out_lines.append(f"{'Distribuzione energia' if lang == 'it' else 'Energy distribution'}: Low {low_energy:.0f}%, Mid {mid_energy:.0f}%, High {high_energy:.0f}%")
    out_lines.append("")
    out_lines.append(f"Report generated by Tekkin Analyzer PRO v{VERSION}")

    # niente cambi sui plots, li puoi rimettere uguali se ti servono
    if enable_plots:
        try:
            os.makedirs(plots_dir, exist_ok=True)
            # qui puoi lasciare il blocco plots identico a prima
            # o rimettere il tuo codice esistente
        except Exception as e:
            out_lines.append("")
            out_lines.append(f"[PLOTS] error: {e}")

    report_text = "\n".join(out_lines)

    meters = {
        "integrated_lufs": integrated_lufs,
        "short_lufs_mean": short_lufs_mean,
        "short_lufs_max": short_lufs_max,
        "rms_dbfs": rms_dbfs,
        "true_peak_dbfs": true_peak_dbfs,
        "crest": crest,
    }

    fix_suggestions = gen_fix_suggestions(lang, profile_key, band_norm, meters, mode)
    reference_db_output = None

    if REFERENCE_DB is not None:
        try:
            reference_db_output = evaluate_track_with_reference(
                {
                    "lufs_integrated": integrated_lufs,
                    "crest_factor": crest,
                    "sub_ratio": band_norm["sub"],
                    "low_ratio": band_norm["low"],
                    "lowmid_ratio": band_norm["lowmid"],
                    "mid_ratio": band_norm["mid"],
                    "presence_ratio": band_norm["presence"],
                    "air_ratio": band_norm["air"],
                },
                extras=None,
                db=REFERENCE_DB,
            )
        except Exception as e:
            reference_db_output = {"error": str(e)}

    reference_ai_output = compute_reference_ai(profile_key, band_norm, meters)
    if reference_ai_output is not None and reference_db_output is not None:
        reference_ai_output["reference_db"] = reference_db_output

    if return_struct:
        return {
            "report": report_text,
            "band_norm": band_norm,
            "band_status": band_status,
            "meters": meters,
            "profile_key": profile_key,
            "mode": mode,
            "fix_suggestions": fix_suggestions,
            "tech_score": tech_score,
            "artistic_score": artistic_score,
            "overall": overall,
            "verdict": verdict,
            "reference_ai": reference_ai_output,
        }

    return report_text

# ---------- CLI ----------

def parse_args():
    p = argparse.ArgumentParser(description="Tekkin Analyzer PRO v3.6 - Full Web Edition")
    p.add_argument("lang", choices=["it", "en"])
    p.add_argument("profile_key", choices=list(PROFILES.keys()))
    p.add_argument("mode", choices=["master", "premaster"])
    p.add_argument("wav_path")
    p.add_argument("--plots", action="store_true", help="Salva grafici PNG e annota i percorsi nel report")
    p.add_argument("--plots-dir", default="plots", help="Cartella di output per i PNG")
    p.add_argument("--no-emoji", action="store_true", help="Non usare emoji nel report")
    return p.parse_args()

def main():
    args = parse_args()
    report = analyze_to_text(
        lang=args.lang,
        profile_key=args.profile_key,
        mode=args.mode,
        file_path=args.wav_path,
        enable_plots=args.plots,
        plots_dir=args.plots_dir,
        emoji=not args.no_emoji,
    )
    sys.stdout.write(report)

if __name__ == "__main__":
    main()
