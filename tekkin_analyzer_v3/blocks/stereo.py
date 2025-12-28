from __future__ import annotations

from typing import Any, Dict, List, Tuple
import math
import numpy as np


BAND_KEYS = ["sub", "low", "lowmid", "mid", "presence", "high", "air"]
BAND_EDGES_HZ = [20.0, 60.0, 200.0, 500.0, 2000.0, 5000.0, 10000.0, 20000.0]


def _as_stereo(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 2 and audio.shape[1] >= 2:
        return audio[:, :2].astype(np.float32, copy=False)
    if audio.ndim == 1:
        x = audio.astype(np.float32, copy=False)
        return np.stack([x, x], axis=-1)
    flat = audio.reshape(-1).astype(np.float32, copy=False)
    return np.stack([flat, flat], axis=-1)


def _downsample_list(xs: List[float], max_points: int = 512, round_ndigits: int = 3) -> List[float]:
    if xs is None:
        return []
    n = len(xs)
    if n == 0:
        return []
    if n <= max_points:
        return [round(float(v), round_ndigits) for v in xs]
    idx = np.linspace(0, n - 1, num=max_points).astype(int)
    out = [round(float(xs[i]), round_ndigits) for i in idx]
    return out


def _band_sums_from_mag(mag: np.ndarray, hz_bins: np.ndarray) -> np.ndarray:
    # energia per banda su power spectrum
    pow_spec = (mag.astype(np.float64) ** 2)
    out = np.zeros(7, dtype=np.float64)
    for i in range(7):
        lo = BAND_EDGES_HZ[i]
        hi = BAND_EDGES_HZ[i + 1]
        mask = (hz_bins >= lo) & (hz_bins < hi)
        out[i] = float(np.sum(pow_spec[mask])) if np.any(mask) else 0.0
    return out


def analyze_stereo(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    """
    Stereo V3:
      - stereo_width (globale): RMS(side)/RMS(mid) aggregato
      - sound_field: nel tempo (polar) tramite energia mid/side per finestra
      - correlation: nel tempo (Pearson L/R su finestre)
      - width_by_band: ratio side/mid per 7 bande (media globale)

    Output:
      stereo_width: float
      sound_field_raw: arrays ang_deg, radius (len = n_frames)
      sound_field: view downsampled
      correlation_raw: array
      correlation: view downsampled
      width_by_band: dict 7 bande (float)
    """
    x = _as_stereo(audio)
    if x.size == 0:
        raise ValueError("audio buffer vuoto")

    L = x[:, 0]
    R = x[:, 1]

    # Mid/Side in time-domain
    M = (L + R) * 0.5
    S = (L - R) * 0.5

    # Parametri frame
    frame_size = 4096
    hop_size = 2048
    eps = 1e-12

    # Sound field (sample-based) for UI scope
    n_samples = int(L.shape[0])
    if n_samples > 0:
        max_lr = float(max(np.max(np.abs(L)), np.max(np.abs(R)), eps))
        max_points = min(1400, n_samples)
        idx = np.linspace(0, n_samples - 1, num=max_points).astype(int)
        xy_points: List[Dict[str, float]] = []
        polar_points: List[Dict[str, float]] = []
        for i in idx:
            lx = float(L[i] / max_lr)
            rx = float(R[i] / max_lr)
            xy_points.append({"x": round(lx, 4), "y": round(rx, 4)})
            angle = (math.degrees(math.atan2(rx, lx)) + 360.0) % 360.0
            radius = min(1.0, math.sqrt(lx * lx + rx * rx))
            polar_points.append({"angle_deg": round(angle, 2), "radius": round(radius, 3)})
    else:
        xy_points = []
        polar_points = []

    try:
        import essentia.standard as es
    except Exception as e:
        raise RuntimeError("Essentia non disponibile nell'ambiente Python corrente.") from e

    window = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=frame_size)
    hz_bins = np.linspace(0.0, sr / 2.0, num=(frame_size // 2) + 1)

    # Arrays raw
    corr_raw: List[float] = []
    ang_raw: List[float] = []
    rad_raw: List[float] = []
    width_raw: List[float] = []

    # width per banda: accumulo energia mid/side per banda
    mid_band_energy = np.zeros(7, dtype=np.float64)
    side_band_energy = np.zeros(7, dtype=np.float64)

    n_frames = 0
    # FrameGenerator lavora su mono array, quindi lo usiamo su M e S separatamente con slicing manuale
    n = int(M.shape[0])
    for start in range(0, max(0, n - frame_size + 1), hop_size):
        n_frames += 1
        m_frame = M[start : start + frame_size]
        s_frame = S[start : start + frame_size]
        l_frame = L[start : start + frame_size]
        r_frame = R[start : start + frame_size]

        # Correlazione L/R per finestra
        l0 = l_frame - float(np.mean(l_frame))
        r0 = r_frame - float(np.mean(r_frame))
        denom = float(np.sqrt(np.sum(l0 * l0) * np.sum(r0 * r0)) + eps)
        corr = float(np.sum(l0 * r0) / denom)
        corr = max(-1.0, min(1.0, corr))
        corr_raw.append(corr)

        # Energia mid/side per sound field (polar)
        m_rms = float(np.sqrt(np.mean(m_frame * m_frame) + eps))
        s_rms = float(np.sqrt(np.mean(s_frame * s_frame) + eps))

        # radius: "width" locale (side/mid). Clamp per stabilità UI.
        w = float(s_rms / (m_rms + eps))
        w = max(0.0, min(2.0, w))
        width_raw.append(w)

        # angle: mappa mid vs side su 0..90 gradi (0=center, 90=super wide)
        ang = float(math.degrees(math.atan2(s_rms, m_rms + eps)))
        ang_raw.append(ang)
        rad_raw.append(w)

        # Width per banda: spettro di M e S
        mw = window(m_frame)
        sw = window(s_frame)
        m_mag = spectrum(mw)
        s_mag = spectrum(sw)

        mid_band_energy += _band_sums_from_mag(m_mag, hz_bins)
        side_band_energy += _band_sums_from_mag(s_mag, hz_bins)

    if n_frames == 0:
        raise RuntimeError("Nessun frame generato, audio troppo corto o invalido")

    # Stereo width globale: mediana o media dei width locali (io uso mediana, più robusta)
    stereo_width = float(np.median(np.asarray(width_raw, dtype=np.float64)))

    # Width by band: side/mid energy ratio per banda
    width_by_band: Dict[str, float | None] = {}
    for i, k in enumerate(BAND_KEYS):
        mE = float(mid_band_energy[i])
        sE = float(side_band_energy[i])
        if mE <= 0:
            width_by_band[k] = None
        else:
            ratio = float(sE / (mE + eps))
            ratio = max(0.0, min(2.0, ratio))
            width_by_band[k] = ratio

    # View (downsampled)
    corr_view = _downsample_list(corr_raw, max_points=512, round_ndigits=3)
    ang_view = _downsample_list(ang_raw, max_points=512, round_ndigits=2)
    rad_view = _downsample_list(rad_raw, max_points=512, round_ndigits=3)

    # Sound field: lista di punti polar per UI
    sound_field_view = [{"angle_deg": ang_view[i], "radius": rad_view[i]} for i in range(min(len(ang_view), len(rad_view)))]
    sound_field_raw = [{"angle_deg": float(ang_raw[i]), "radius": float(rad_raw[i])} for i in range(min(len(ang_raw), len(rad_raw)))]

    corr_np = np.asarray(corr_raw, dtype=np.float64) if corr_raw else None
    corr_avg = float(np.mean(corr_np)) if corr_np is not None else None
    corr_min = float(np.min(corr_np)) if corr_np is not None else None
    corr_p05 = float(np.quantile(corr_np, 0.05)) if corr_np is not None else None

    sub_w = width_by_band.get("sub")
    low_w = width_by_band.get("low")

    return {
        "stereo_width": stereo_width,

        # per UI
        "sound_field": sound_field_view,
        "sound_field_xy": xy_points,
        "sound_field_polar": polar_points,
        "correlation": corr_view,

        # per blob / reference builder
        "sound_field_raw": sound_field_raw,
        "correlation_raw": [float(v) for v in corr_raw],

        # confronto col genere
        "width_by_band": width_by_band,

        # riepilogo
        "summary": {
            "correlation_avg": corr_avg,
            "correlation_min": corr_min,
            "correlation_p05": corr_p05,
            "sub_width": sub_w,
            "low_width": low_w,
        },
    }
