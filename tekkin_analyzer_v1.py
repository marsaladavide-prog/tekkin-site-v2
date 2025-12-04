import numpy as np
import librosa
import pyloudnorm as pyln  # devi installarlo
from typing import List

from tekkin_analyzer_v1_models import (
    AnalyzerV1Result,
    AnalyzerV1Metrics,
    LoudnessMetrics,
    StemsBalanceMetrics,
    SpectrumMetrics,
    StereoMetrics,
    StructureMetrics,
    StructureSection,
    Issue,
)


# -------------------------------------------------------------------
# Utility
# -------------------------------------------------------------------

def db_safe(x: float) -> float:
    """Converte in dB evitando log(0)."""
    eps = 1e-12
    return 20 * np.log10(max(abs(x), eps))


def rms(signal: np.ndarray) -> float:
    """RMS lineare."""
    return float(np.sqrt(np.mean(signal**2)))


def bandpass_mag(y: np.ndarray, sr: int, fmin: float, fmax: float) -> float:
    """Energia media di banda usando STFT."""
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))**2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    band_idx = (freqs >= fmin) & (freqs < fmax)
    if not np.any(band_idx):
        return -120.0
    band_power = np.mean(S[band_idx])
    return db_safe(band_power)


# -------------------------------------------------------------------
# 1) LOUDNESS E DINAMICA
# -------------------------------------------------------------------

def analyze_loudness(y: np.ndarray, sr: int) -> LoudnessMetrics:
    meter = pyln.Meter(sr)  # ITU-R BS.1770
    loudness = meter.integrated_loudness(y)
    # short-term loudness in finestre
    block_size = int(sr * 3.0)  # 3 s
    short_terms = []
    for start in range(0, len(y), block_size):
        end = start + block_size
        if end - start < block_size // 2:
            break
        block = y[start:end]
        st = meter.integrated_loudness(block)
        short_terms.append(st)

    if short_terms:
        st_min = float(np.min(short_terms))
        st_max = float(np.max(short_terms))
    else:
        st_min = loudness
        st_max = loudness

    peak = db_safe(np.max(np.abs(y)))
    # crest factor = peak - RMS in dB
    overall_rms = rms(y)
    crest = peak - db_safe(overall_rms)

    return LoudnessMetrics(
        integrated_lufs=float(loudness),
        short_term_min=float(st_min),
        short_term_max=float(st_max),
        true_peak_db=float(peak),
        crest_factor_db=float(crest),
    )


# -------------------------------------------------------------------
# 2) STEMS BALANCE (macro, versione semplificata V1)
# -------------------------------------------------------------------

def analyze_stems_balance(y: np.ndarray, sr: int) -> StemsBalanceMetrics:
    """
    V1: niente demix complesso, solo proxy.

    - kick/bass: low band 40-120 e 40-200
    - vocal: banda mid-high 1k-4k con envelope più smooth
    - clap: picchi nella banda 1k-8k durante i picchi di energia

    Qui lascio skeleton semplice. Per qualcosa di serio puoi
    sostituire con un modello di source separation (es. Demucs)
    e poi misurare i livelli RMS degli stem.
    """
    # RMS generico del mix
    mix_rms = db_safe(rms(y))

    # proxy "low" e "lowmid"
    low = bandpass_mag(y, sr, 40, 120)
    lowmid = bandpass_mag(y, sr, 120, 400)
    mid = bandpass_mag(y, sr, 400, 2000)
    high = bandpass_mag(y, sr, 2000, 8000)

    # Facciamo finta di avere:
    kick_db = low  # kick+sub
    bass_db = lowmid  # bassline/basso corpo
    drums_db = db_safe(rms(y))  # very rough
    vocal_db = mid  # proxy area voce

    # rapporti
    kick_vs_bass = kick_db - bass_db
    vocal_vs_mix = vocal_db - mix_rms

    # clap: assumo vicinanza a high band
    clap_vs_kick = high - kick_db

    return StemsBalanceMetrics(
        kick_db=float(kick_db),
        bass_db=float(bass_db),
        drums_db=float(drums_db),
        vocal_db=float(vocal_db),
        kick_vs_bass_db=float(kick_vs_bass),
        clap_vs_kick_db=float(clap_vs_kick),
        vocal_vs_mix_db=float(vocal_vs_mix),
        bass_vs_mix_low_db=float(bass_db - low),
    )


# -------------------------------------------------------------------
# 3) SPETTRO
# -------------------------------------------------------------------

def analyze_spectrum(y: np.ndarray, sr: int, profile: str) -> SpectrumMetrics:
    # energia per bande
    low = bandpass_mag(y, sr, 20, 120)
    lowmid = bandpass_mag(y, sr, 120, 400)
    mid = bandpass_mag(y, sr, 400, 2000)
    high = bandpass_mag(y, sr, 2000, 10000)
    air = bandpass_mag(y, sr, 10000, 16000)

    # Reference molto semplice, hardcoded per iniziare.
    # In produzione puoi sostituire con valori calcolati da dataset.
    reference_profiles = {
        "minimal_deep_tech": {
            "low_db": -18.0,
            "lowmid_db": -19.0,
            "mid_db": -20.0,
            "high_db": -22.0,
            "air_db": -25.0,
        }
    }
    ref = reference_profiles.get(
        profile,
        reference_profiles["minimal_deep_tech"],
    )

    deviation = {
        "lowmid": float(lowmid - ref["lowmid_db"]),
        "mid": float(mid - ref["mid_db"]),
        "high": float(high - ref["high_db"]),
        "air": float(air - ref["air_db"]),
    }

    return SpectrumMetrics(
        low_db=float(low),
        lowmid_db=float(lowmid),
        mid_db=float(mid),
        high_db=float(high),
        air_db=float(air),
        deviation_from_reference_db=deviation,
    )


# -------------------------------------------------------------------
# 4) STEREO
# -------------------------------------------------------------------

def analyze_stereo(y: np.ndarray, sr: int) -> StereoMetrics:
    # Se stereo: shape (2, n), se mono diventa (1, n)
    if y.ndim == 1:
        # mono: side = 0, correlation = 1
        return StereoMetrics(
            global_correlation=1.0,
            low_side_mid_db=-120.0,
            mid_side_mid_db=-120.0,
            high_side_mid_db=-120.0,
        )

    L = y[0]
    R = y[1]

    # global correlation
    if len(L) != len(R):
        min_len = min(len(L), len(R))
        L = L[:min_len]
        R = R[:min_len]

    corr_num = float(np.sum(L * R))
    corr_den = float(np.sqrt(np.sum(L**2) * np.sum(R**2)) + 1e-12)
    global_corr = corr_num / corr_den

    # mid/side
    M = (L + R) / 2.0
    S = (L - R) / 2.0

    def side_mid_band_db(fmin: float, fmax: float) -> float:
        m_band = bandpass_mag(M, sr, fmin, fmax)
        s_band = bandpass_mag(S, sr, fmin, fmax)
        return float(s_band - m_band)

    low_sm = side_mid_band_db(20, 120)
    mid_sm = side_mid_band_db(120, 3000)
    high_sm = side_mid_band_db(3000, 16000)

    return StereoMetrics(
        global_correlation=float(global_corr),
        low_side_mid_db=low_sm,
        mid_side_mid_db=mid_sm,
        high_side_mid_db=high_sm,
    )


# -------------------------------------------------------------------
# 5) STRUTTURA
# -------------------------------------------------------------------

def estimate_bpm(y: np.ndarray, sr: int) -> float:
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    return float(tempo)


def analyze_structure(y: np.ndarray, sr: int, bpm: float) -> StructureMetrics:
    """
    V1: struttura basata su energia, molto semplice.
    - calcolo energia per blocchi di N beat
    - identifico approssimativamente intro, drop, break, ecc.
    """
    # durata di 1 bar = (60 / bpm) * 4 secondi
    bar_duration = (60.0 / bpm) * 4.0
    total_seconds = len(y) / sr
    bars_total = int(total_seconds / bar_duration)

    # energia per barra (RMS)
    bar_energies = []
    for b in range(bars_total):
        start_t = b * bar_duration
        end_t = (b + 1) * bar_duration
        start_s = int(start_t * sr)
        end_s = int(end_t * sr)
        if end_s > len(y):
            break
        seg = y[start_s:end_s]
        bar_energies.append(rms(seg))

    bar_energies = np.array(bar_energies)
    if len(bar_energies) == 0:
        # fallback
        return StructureMetrics(
            bpm=bpm,
            bars_total=0,
            sections=[StructureSection(type="other", start_bar=1, end_bar=1)],
        )

    # normalizzo per capire pattern
    energy_db = 20 * np.log10(bar_energies + 1e-12)
    e_min = np.min(energy_db)
    e_max = np.max(energy_db)
    if e_max - e_min < 1.0:
        norm_e = np.zeros_like(energy_db)
    else:
        norm_e = (energy_db - e_min) / (e_max - e_min)

    sections: List[StructureSection] = []

    # Regole semplici:
    # - intro: primi bar con energia bassa
    # - drop: blocchi con energia alta e sostenuta
    # - break: calo netto rispetto ai drop

    threshold_drop = 0.7
    threshold_intro = 0.3

    # intro
    intro_end = 1
    for i, e in enumerate(norm_e):
        if e > threshold_intro:
            intro_end = max(1, i)
            break
    sections.append(
        StructureSection(type="intro", start_bar=1, end_bar=intro_end)
    )

    # drop grezzo: primo segmento con energia > threshold_drop
    drop_start = None
    for i, e in enumerate(norm_e):
        if e > threshold_drop:
            drop_start = i + 1  # bar index -> 1-based
            break

    if drop_start is None:
        # nessun vero drop rilevato
        sections.append(
            StructureSection(
                type="other", start_bar=intro_end + 1, end_bar=bars_total
            )
        )
    else:
        # stimo drop fino a quando resta sopra una soglia media
        drop_end = drop_start
        for i in range(drop_start - 1, len(norm_e)):
            if norm_e[i] < 0.5:
                drop_end = i
                break
        else:
            drop_end = len(norm_e)

        # break dopo il primo drop, se c'è un calo
        break_start = drop_end + 1
        break_end = break_start
        for i in range(break_start - 1, len(norm_e)):
            if norm_e[i] < threshold_intro:
                break_start = i + 1
                break
        for i in range(break_start - 1, len(norm_e)):
            if norm_e[i] > threshold_drop:
                break_end = i
                break

        sections.append(
            StructureSection(
                type="drop",
                start_bar=int(drop_start),
                end_bar=int(drop_end),
            )
        )

        if break_start < break_end:
            sections.append(
                StructureSection(
                    type="break",
                    start_bar=int(break_start),
                    end_bar=int(break_end),
                )
            )

        if break_end < bars_total:
            sections.append(
                StructureSection(
                    type="outro",
                    start_bar=int(break_end + 1),
                    end_bar=int(bars_total),
                )
            )

    return StructureMetrics(
        bpm=float(bpm),
        bars_total=int(bars_total),
        sections=sections,
    )


# -------------------------------------------------------------------
# 6) RULE ENGINE: trasformare metriche in feedback
# -------------------------------------------------------------------

def build_issues_v1(
    profile: str,
    loud: LoudnessMetrics,
    stems: StemsBalanceMetrics,
    spec: SpectrumMetrics,
    stereo: StereoMetrics,
    struct: StructureMetrics,
) -> List[Issue]:
    issues: List[Issue] = []

    # 6.1 Loudness
    if profile in ("minimal_deep_tech", "minimal_house", "tech_house"):
        target_min = -8.5
        target_max = -7.0
        if loud.integrated_lufs < target_min - 2.0:
            issues.append(
                Issue(
                    category="loudness",
                    priority="high",
                    issue="Traccia troppo bassa di volume",
                    analysis=(
                        f"Il livello integrato è circa {loud.integrated_lufs:.1f} LUFS, "
                        f"più basso del range tipico da {target_min} a {target_max} LUFS "
                        "per questo genere."
                    ),
                    suggestion=(
                        "Porta il master più vicino al range di riferimento, ma senza "
                        "schiacciare troppo la dinamica. Controlla saturazioni e limiter."
                    ),
                )
            )

    # 6.2 Clap vs kick
    if stems.clap_vs_kick_db is not None:
        if stems.clap_vs_kick_db < -2.5:
            issues.append(
                Issue(
                    category="mix_balance",
                    priority="high",
                    issue="Clap troppo basso rispetto al kick",
                    analysis=(
                        f"Nella banda 2k-8k il clap risulta circa "
                        f"{stems.clap_vs_kick_db:.1f} dB sotto il kick."
                    ),
                    suggestion=(
                        "Alza il livello del clap di 2-3 dB e/o lavora con una "
                        "saturazione leggera per farlo emergere nel mix."
                    ),
                )
            )

    # 6.3 Voce nascosta
    if stems.vocal_vs_mix_db is not None:
        if stems.vocal_vs_mix_db < -3.0:
            issues.append(
                Issue(
                    category="vocal",
                    priority="medium",
                    issue="Voce un po' nascosta nel mix",
                    analysis=(
                        f"Il livello medio della voce è circa "
                        f"{stems.vocal_vs_mix_db:.1f} dB sotto il mix "
                        "nella zona delle medie frequenze."
                    ),
                    suggestion=(
                        "Prova ad alzare la voce di 2 dB e scolpire leggermente "
                        "la zona 2-4 kHz su altri elementi per farle spazio."
                    ),
                )
            )

    # 6.4 Boxiness (lowmid)
    dev_lowmid = spec.deviation_from_reference_db.get("lowmid", 0.0)
    if dev_lowmid > 3.0:
        issues.append(
            Issue(
                category="spectrum",
                priority="medium",
                issue="Mix un po' 'boxy' sui low-mid",
                analysis=(
                    f"La banda 120-400 Hz è circa {dev_lowmid:.1f} dB sopra il "
                    "reference del genere. Questo può dare una sensazione di 'cassa di cartone'."
                ),
                suggestion=(
                    "Valuta un taglio di 1-2 dB attorno ai 250-350 Hz su qualche buss "
                    "(drums, bass o master) finché il mix respira di più."
                ),
            )
        )

    # 6.5 Stereo bass
    if stereo.low_side_mid_db > 4.0:
        issues.append(
            Issue(
                category="stereo",
                priority="high",
                issue="Basso troppo largo nelle basse",
                analysis=(
                    f"Il rapporto Side/Mid sotto i 120 Hz è attorno a "
                    f"{stereo.low_side_mid_db:.1f} dB, piuttosto alto per il club."
                ),
                suggestion=(
                    "Rendi più mono le basse frequenze (fino a 100-120 Hz) usando un "
                    "utility o un mid/side EQ. Questo aiuta la traduzione in impianto."
                ),
            )
        )

    # 6.6 Struttura: primo drop tardivo
    if struct.sections:
        # cerco primo drop
        first_drop = next(
            (s for s in struct.sections if s.type == "drop"), None
        )
        if first_drop is not None:
            if first_drop.start_bar > 64:
                issues.append(
                    Issue(
                        category="structure",
                        priority="medium",
                        issue="Primo drop un po' tardivo",
                        analysis=(
                            f"Il primo vero picco di energia (drop) entra circa alla barra "
                            f"{first_drop.start_bar}, che è piuttosto avanzato."
                        ),
                        suggestion=(
                            "Valuta di introdurre un primo drop intorno a 32-48 barre per "
                            "agganciare prima il DJ e il dancefloor."
                        ),
                    )
                )

    return issues


# -------------------------------------------------------------------
# FUNZIONE PRINCIPALE V1
# -------------------------------------------------------------------

def analyze_mix_v1(
    audio_path: str,
    profile: str = "minimal_deep_tech",
) -> AnalyzerV1Result:
    """
    Analisi V1:
    - legge file audio
    - calcola metriche
    - genera feedback in italiano

    Limiti:
    - stems_balance ancora approssimativo senza un vero modello di separation
    - struttura basata solo su energia
    """
    # 1) Load
    # mono mix per la maggior parte delle analisi, ma stereo per stereo image
    y_stereo, sr = librosa.load(audio_path, sr=None, mono=False)
    if y_stereo.ndim == 1:
        y_mono = y_stereo
    else:
        y_mono = np.mean(y_stereo, axis=0)

    # 2) BPM
    bpm = estimate_bpm(y_mono, sr)

    # 3) Metriche
    loud = analyze_loudness(y_mono, sr)
    stems = analyze_stems_balance(y_mono, sr)
    spec = analyze_spectrum(y_mono, sr, profile)
    stereo = analyze_stereo(y_stereo, sr)
    struct = analyze_structure(y_mono, sr, bpm)

    # 4) Issues
    issues = build_issues_v1(profile, loud, stems, spec, stereo, struct)

    metrics = AnalyzerV1Metrics(
        loudness=loud,
        stems_balance=stems,
        spectrum=spec,
        stereo=stereo,
        structure=struct,
    )

    return AnalyzerV1Result(
        profile=profile,
        metrics=metrics,
        issues=issues,
    )
