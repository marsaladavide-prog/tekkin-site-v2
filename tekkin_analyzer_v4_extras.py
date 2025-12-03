import numpy as np
from scipy.signal import resample_poly


def load_audio_mono(path: str, target_sr: int = 44100):
    import soundfile as sf

    y, sr = sf.read(path, dtype="float32")
    if y.ndim > 1:
        y = np.mean(y, axis=1)
    if y.size == 0:
        raise ValueError("File audio vuoto")

    if sr != target_sr:
        y = resample_poly(y, target_sr, sr)
        sr = target_sr

    peak = float(np.max(np.abs(y)) + 1e-9)
    y = y / peak

    return y.astype(np.float32), sr

def estimate_bpm(y: np.ndarray, sr: int) -> float:
    frame_size = int(0.05 * sr)
    hop = frame_size // 2
    if frame_size <= 0 or hop <= 0 or y.size < frame_size * 4:
        return 0.0

    frames = []
    for start in range(0, len(y) - frame_size, hop):
        seg = y[start:start + frame_size]
        frames.append(float(np.sum(seg * seg)))
    env = np.array(frames, dtype=np.float32)
    if env.size < 8:
        return 0.0

    env = env - np.mean(env)
    env = np.maximum(env, 0.0)
    if not np.any(env > 0):
        return 0.0

    ac = np.correlate(env, env, mode="full")
    ac = ac[ac.size // 2:]
    lags = np.arange(ac.size)

    with np.errstate(divide="ignore", invalid="ignore"):
        bpms = 60.0 * sr / (lags * hop + 1e-9)

    min_bpm = 60.0
    max_bpm = 200.0
    valid = (bpms >= min_bpm) & (bpms <= max_bpm)
    valid[0:2] = False
    if not np.any(valid):
        return 0.0

    valid_bpms = bpms[valid]
    valid_ac = ac[valid]

    order = np.argsort(valid_ac)[::-1]
    best_idx = int(order[0])
    best_bpm = float(valid_bpms[best_idx])
    best_ac = float(valid_ac[best_idx])

    if best_bpm < 90 and order.size > 1:
        target = best_bpm * 2.0
        for idx in order[1:]:
            candidate_bpm = float(valid_bpms[int(idx)])
            candidate_ac = float(valid_ac[int(idx)])
            if abs(candidate_bpm - target) <= 5.0 and candidate_ac >= best_ac * 0.3:
                best_bpm = candidate_bpm
                best_ac = candidate_ac
                break

    return round(best_bpm, 1)

def compute_spectral_features(y: np.ndarray, sr: int) -> dict:
    n = len(y)
    if n == 0:
        return {
            "spectral_centroid_hz": 0.0,
            "spectral_rolloff_hz": 0.0,
            "spectral_bandwidth_hz": 0.0,
            "spectral_flatness": 0.0,
            "zero_crossing_rate": 0.0,
        }

    window = np.hanning(n).astype(np.float32)
    y_win = y * window

    spec = np.fft.rfft(y_win)
    mag = np.abs(spec).astype(np.float64) + 1e-12
    freqs = np.fft.rfftfreq(n, 1.0 / sr)

    mag_sum = float(np.sum(mag))

    if mag_sum > 0:
        centroid = float(np.sum(freqs * mag) / mag_sum)
    else:
        centroid = 0.0

    cum = np.cumsum(mag)
    thresh = 0.95 * mag_sum
    idx_roll = np.searchsorted(cum, thresh)
    if idx_roll >= freqs.size:
        idx_roll = freqs.size - 1
    rolloff = float(freqs[idx_roll]) if freqs.size > 0 else 0.0

    if mag_sum > 0:
        bandwidth = float(
            np.sqrt(np.sum(((freqs - centroid) ** 2) * mag) / mag_sum)
        )
    else:
        bandwidth = 0.0

    log_mag = np.log(mag)
    g_mean = float(np.exp(np.mean(log_mag)))
    a_mean = float(np.mean(mag))
    flatness = float(g_mean / (a_mean + 1e-12))

    zc = np.mean(y[1:] * y[:-1] < 0.0)

    return {
        "spectral_centroid_hz": round(centroid, 2),
        "spectral_rolloff_hz": round(rolloff, 2),
        "spectral_bandwidth_hz": round(bandwidth, 2),
        "spectral_flatness": round(flatness, 4),
        "zero_crossing_rate": round(float(zc), 4),
    }

def analyze_v4_extras(path: str) -> dict:
    y, sr = load_audio_mono(path, target_sr=44100)
    bpm = estimate_bpm(y, sr)
    spectral = compute_spectral_features(y, sr)
    result = {"bpm": bpm}
    result.update(spectral)
    return result
