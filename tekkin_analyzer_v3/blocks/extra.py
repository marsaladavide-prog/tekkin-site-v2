from __future__ import annotations

from typing import Any, Dict, List, Optional
import numpy as np


def _to_mono(audio: np.ndarray) -> np.ndarray:
    if audio.ndim == 2 and audio.shape[1] >= 2:
        return ((audio[:, 0] + audio[:, 1]) * 0.5).astype(np.float32, copy=False)
    if audio.ndim == 1:
        return audio.astype(np.float32, copy=False)
    return audio.reshape(-1).astype(np.float32, copy=False)


def analyze_extra(audio: np.ndarray, sr: int) -> Dict[str, Any]:
    mono = _to_mono(audio)
    if mono.size == 0:
        raise ValueError("audio buffer vuoto")

    try:
        import essentia.standard as es
    except Exception as e:
        raise RuntimeError("Essentia non disponibile nell'ambiente Python corrente.") from e

    frame_size = 2048
    hop_size = 1024

    w = es.Windowing(type="hann")
    spec = es.Spectrum(size=frame_size)

    # MFCC: prendiamo mean e std su tutto il brano (13 coeff)
    mfcc_alg = es.MFCC(numberCoefficients=13)

    # HFC e SpectralPeaks: possono non esserci su tutte le build, ma nel tuo container dovrebbero
    try:
        hfc_alg = es.HFC()
    except Exception:
        hfc_alg = None

    try:
        peaks_alg = es.SpectralPeaks(sampleRate=sr, maxPeaks=10)
    except Exception:
        peaks_alg = None

    mfcc_frames: List[np.ndarray] = []
    hfc_vals: List[float] = []
    peak_freqs_all: List[float] = []
    peak_mags_all: List[float] = []

    n_frames = 0
    for frame in es.FrameGenerator(mono, frameSize=frame_size, hopSize=hop_size, startFromZero=True):
        n_frames += 1
        sp = spec(w(frame))

        # MFCC
        _, coeffs = mfcc_alg(sp)
        mfcc_frames.append(np.asarray(coeffs, dtype=np.float32))

        # HFC
        if hfc_alg is not None:
            try:
                hfc_vals.append(float(hfc_alg(sp)))
            except Exception:
                pass

        # Peaks
        if peaks_alg is not None:
            try:
                freqs, mags = peaks_alg(sp)
                freqs = np.asarray(freqs, dtype=np.float64).reshape(-1)
                mags = np.asarray(mags, dtype=np.float64).reshape(-1)
                m = min(freqs.size, mags.size)
                for i in range(m):
                    peak_freqs_all.append(float(freqs[i]))
                    peak_mags_all.append(float(mags[i]))
            except Exception:
                pass

    if n_frames == 0:
        raise RuntimeError("Nessun frame generato")

    # MFCC summary
    mfcc_mean = None
    mfcc_std = None
    if mfcc_frames:
        mat = np.stack(mfcc_frames, axis=0).astype(np.float64)
        mfcc_mean = [float(x) for x in np.mean(mat, axis=0)]
        mfcc_std = [float(x) for x in np.std(mat, axis=0)]

    # HFC summary
    hfc_mean = None
    if hfc_vals:
        hfc_mean = float(np.mean(np.asarray(hfc_vals, dtype=np.float64)))

    # Peaks summary: top 10 globali per magnitudine
    peaks = None
    peaks_energy = None
    if peak_mags_all:
        mags = np.asarray(peak_mags_all, dtype=np.float64)
        freqs = np.asarray(peak_freqs_all, dtype=np.float64)
        idx = np.argsort(mags)[::-1][:10]

        peaks = [{"hz": float(freqs[i]), "mag": float(mags[i])} for i in idx]
        peaks_energy = float(np.sum(mags))

    return {
        "mfcc": {
            "mean": mfcc_mean,
            "std": mfcc_std,
        },
        "hfc": hfc_mean,
        "spectral_peaks": peaks,
        "spectral_peaks_energy": peaks_energy,
    }
