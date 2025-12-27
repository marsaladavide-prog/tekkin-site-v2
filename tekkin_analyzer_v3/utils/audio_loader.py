# tekkin_analyzer_v3/utils/audio_loader.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple
import os
import subprocess
import numpy as np

@dataclass
class AudioData:
  y: np.ndarray        # shape: (n_samples, n_channels) float32
  sr: int
  channels: int
  samples: int
  duration_sec: float

def _ensure_2d(y: np.ndarray) -> np.ndarray:
  if y.ndim == 1:
    return np.stack([y, y], axis=1)
  if y.ndim == 2:
    return y
  raise ValueError(f"Audio array dimension not supported: {y.ndim}")

def load_audio(
  path: str,
  sr: int = 44100,
  force_stereo: bool = True,
) -> AudioData:
  """
  Carica audio come float32, shape (N, C). Preferisce Essentia se disponibile,
  altrimenti fallback su ffmpeg (via subprocess) o librosa (se presente).

  Regola: per Tekkin V3 vogliamo sempre stereo coerente.
  """
  y: Optional[np.ndarray] = None
  used_sr = sr

  # 1) Essentia (dentro container)
  try:
    import essentia.standard as es

    loader = es.MonoLoader(filename=path, sampleRate=sr)  # MonoLoader è robusto
    mono = loader().astype(np.float32)
    if force_stereo:
      y = np.stack([mono, mono], axis=1)
    else:
      y = mono
  except Exception:
    y = None

  # 2) Fallback: ffmpeg -> pcm_f32le stereo
  if y is None:
    try:
      ffmpeg = os.environ.get("FFMPEG_BIN", "ffmpeg")
      cmd = [
        ffmpeg, "-v", "error",
        "-i", path,
        "-f", "f32le",
        "-acodec", "pcm_f32le",
        "-ac", "2" if force_stereo else "1",
        "-ar", str(sr),
        "pipe:1",
      ]
      p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
      raw = np.frombuffer(p.stdout, dtype=np.float32)
      ch = 2 if force_stereo else 1
      if raw.size % ch != 0:
        raise RuntimeError("ffmpeg output not aligned to channels")
      y = raw.reshape((-1, ch))
    except Exception:
      y = None

  # 3) Ultimo fallback: librosa
  if y is None:
    try:
      import librosa
      mono, used_sr = librosa.load(path, sr=sr, mono=True)
      mono = mono.astype(np.float32)
      y = np.stack([mono, mono], axis=1) if force_stereo else mono
    except Exception as e:
      raise RuntimeError(f"Unable to load audio: {path}. {e}") from e

  y2 = _ensure_2d(y).astype(np.float32)
  channels = int(y2.shape[1])
  samples = int(y2.shape[0])
  duration_sec = float(samples) / float(used_sr)

  return AudioData(
    y=y2,
    sr=int(used_sr),
    channels=channels,
    samples=samples,
    duration_sec=duration_sec,
  )

def load_audio_ffmpeg(
  path: str,
  sr: int = 44100,
  max_seconds: Optional[float] = None,
  ffmpeg_bin: str = "ffmpeg",
) -> Tuple[np.ndarray, int]:
  """
  Compat: API vecchia usata da analyze_v3.py
  Ritorna audio stereo float32 shape (n, 2) e sample rate sr.
  """
  if not os.path.exists(path):
    raise FileNotFoundError(path)

  ffmpeg_bin = os.environ.get("FFMPEG_BIN", ffmpeg_bin)

  cmd = [
    ffmpeg_bin,
    "-v", "error",
    "-i", path,
    "-f", "f32le",
    "-acodec", "pcm_f32le",
    "-ac", "2",
    "-ar", str(sr),
  ]

  if max_seconds is not None and max_seconds > 0:
    cmd += ["-t", str(max_seconds)]

  cmd += ["pipe:1"]

  p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
  if p.returncode != 0:
    err = p.stderr.decode("utf-8", errors="replace")
    raise RuntimeError(f"ffmpeg failed ({p.returncode}): {err}")

  raw = p.stdout
  if not raw:
    raise RuntimeError("ffmpeg returned empty audio buffer")

  audio = np.frombuffer(raw, dtype=np.float32)
  if audio.size % 2 != 0:
    audio = audio[: audio.size - 1]

  audio = audio.reshape((-1, 2))
  return audio, sr
