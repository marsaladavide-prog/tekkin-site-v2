from __future__ import annotations

from typing import Any, Dict, List, Tuple
import numpy as np


BAND_KEYS = ["sub", "low", "lowmid", "mid", "presence", "high", "air"]
BAND_EDGES_HZ = [20.0, 60.0, 200.0, 500.0, 2000.0, 5000.0, 10000.0, 20000.0]


def _to_mono(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 2 and audio.shape[1] >= 2:
        return ((audio[:, 0] + audio[:, 1]) * 0.5).astype(np.float32, copy=False)
    if audio.ndim == 1:
        return audio.astype(np.float32, copy=False)
    return audio.reshape(-1).astype(np.float32, copy=False)


def _downsample_curve(hz: np.ndarray, db: np.ndarray, max_points: int = 512) -> Tuple[List[float], List[float]]:
    if hz.size == 0 or db.size == 0:
        return [], []
    n = int(hz.size)
    if n <= max_points:
        return [float(x) for x in hz], [float(x) for x in db]
    idx = np.linspace(0, n - 1, num=max_points).astype(int)
    return [float(x) for x in hz[idx]], [float(x) for x in db[idx]]


def _spectral_centroid(hz: np.ndarray, power: np.ndarray) -> float | None:
    total = float(np.sum(power))
    if total <= 0:
        return None
    return float(np.sum(hz * power) / total)


def _spectral_bandwidth(hz: np.ndarray, power: np.ndarray, centroid_hz: float | None) -> float | None:
    if centroid_hz is None:
        return None
    total = float(np.sum(power))
    if total <= 0:
        return None
    var = float(np.sum(((hz - centroid_hz) ** 2) * power) / total)
    return float(np.sqrt(max(var, 0.0)))


def _spectral_rolloff(hz: np.ndarray, power: np.ndarray, cutoff: float = 0.95) -> float | None:
    total = float(np.sum(power))
    if total <= 0:
        return None
    target = total * float(cutoff)
    cumsum = np.cumsum(power)
    idx = int(np.searchsorted(cumsum, target, side="left"))
    idx = min(max(idx, 0), hz.size - 1)
    return float(hz[idx])


def _spectral_flatness(power: np.ndarray) -> float | None:
    # flatness = geometric_mean / arithmetic_mean
    # usiamo power spectrum, clamp per evitare log(0)
    eps = 1e-12
    p = np.maximum(power, eps)
    gm = float(np.exp(np.mean(np.log(p))))
    am = float(np.mean(p))
    if am <= 0:
        return None
    return float(gm / am)


def _zero_crossing_rate(frame: np.ndarray) -> float:
    # ZCR frame-based
    if frame.size < 2:
        return 0.0
    s = np.sign(frame)
    s[s == 0] = 1
    crossings = np.sum(s[1:] != s[:-1])
    return float(crossings / (frame.size - 1))


def _round_list(xs: List[float], ndigits: int = 2) -> List[float]:
    return [round(float(x), ndigits) for x in xs]


def analyze_timbre_spectrum(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    mono = _to_mono(audio)
    if mono.size == 0:
        raise ValueError("audio buffer vuoto")

    try:
        import essentia.standard as es
    except Exception as e:
        raise RuntimeError("Essentia non disponibile nell'ambiente Python corrente.") from e

    frame_size = 4096
    hop_size = 2048

    window = es.Windowing(type="hann")
    spectrum = es.Spectrum(size=frame_size)

    hz_bins = np.linspace(0.0, sr / 2.0, num=(frame_size // 2) + 1).astype(np.float64)

    mean_mag = np.zeros_like(hz_bins, dtype=np.float64)
    band_energy = np.zeros(7, dtype=np.float64)

    centroid_vals: List[float] = []
    rolloff_vals: List[float] = []
    bandwidth_vals: List[float] = []
    flatness_vals: List[float] = []
    zcr_vals: List[float] = []

    def band_sums_from_mag(mag: np.ndarray) -> np.ndarray:
        power = (mag.astype(np.float64) ** 2)
        out = np.zeros(7, dtype=np.float64)
        for i in range(7):
            lo = BAND_EDGES_HZ[i]
            hi = BAND_EDGES_HZ[i + 1]
            mask = (hz_bins >= lo) & (hz_bins < hi)
            out[i] = float(np.sum(power[mask])) if np.any(mask) else 0.0
        return out

    n_frames = 0
    for frame in es.FrameGenerator(mono, frameSize=frame_size, hopSize=hop_size, startFromZero=True):
        n_frames += 1
        w = window(frame)
        mag = spectrum(w).astype(np.float64)

        mean_mag += mag

        band_energy += band_sums_from_mag(mag)

        power = mag ** 2

        c = _spectral_centroid(hz_bins, power)
        bw = _spectral_bandwidth(hz_bins, power, c)
        ro = _spectral_rolloff(hz_bins, power, cutoff=0.95)
        fl = _spectral_flatness(power)
        z = _zero_crossing_rate(frame.astype(np.float64))

        if c is not None:
            centroid_vals.append(c)
        if ro is not None:
            rolloff_vals.append(ro)
        if bw is not None:
            bandwidth_vals.append(bw)
        if fl is not None:
            flatness_vals.append(fl)
        zcr_vals.append(z)

    if n_frames == 0:
        raise RuntimeError("Nessun frame generato")

    mean_mag /= float(n_frames)

    eps = 1e-12
    mean_db = 20.0 * np.log10(np.maximum(mean_mag, eps))

    # VIEW: max 256 punti, leggibile
    hz_view, db_view = _downsample_curve(hz_bins, mean_db, max_points=96)

    # RAW: max 2048 punti (per reference, clustering, ranking)
    hz_raw, db_raw = _downsample_curve(hz_bins, mean_db, max_points=2048)

    total_energy = float(np.sum(band_energy))
    if total_energy <= 0:
        bands_norm = {k: None for k in BAND_KEYS}
    else:
        bn = np.clip(band_energy / total_energy, 0.0, 1.0)
        bands_norm = {BAND_KEYS[i]: float(bn[i]) for i in range(7)}

    def safe_mean(xs: List[float]) -> float | None:
        if not xs:
            return None
        return float(np.mean(np.asarray(xs, dtype=np.float64)))

    spectral = {
        "spectral_centroid_hz": safe_mean(centroid_vals),
        "spectral_rolloff_hz": safe_mean(rolloff_vals),
        "spectral_bandwidth_hz": safe_mean(bandwidth_vals),
        "spectral_flatness": safe_mean(flatness_vals),
        "zero_crossing_rate": safe_mean(zcr_vals),
    }

    hz_view = _round_list(hz_view, 1)
    db_view = _round_list(db_view, 2)

    hz_raw = _round_list(hz_raw, 1)
    db_raw = _round_list(db_raw, 3)

    return {
        "bands_norm": bands_norm,

        # RAW (non per UI)
        "spectrum_db_raw": {
            "hz": hz_raw,
            "track_db": db_raw,
        },

        # VIEW (per UI / debug)
        "spectrum_db": {
            "hz": hz_view,
            "track_db": db_view,
        },

        "spectral": spectral,
    }
