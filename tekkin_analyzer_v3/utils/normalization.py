# tekkin_analyzer_v3/utils/normalization.py
from __future__ import annotations
from typing import Dict
import math

BAND_KEYS = ["sub", "low", "lowmid", "mid", "presence", "high", "air"]

def safe_norm_bands(bands: Dict[str, float]) -> Dict[str, float]:
  """
  Normalizza i valori di banda in modo che sommino a 1 (se possibile).
  Mantiene solo chiavi note, ignora NaN/inf.
  """
  cleaned: Dict[str, float] = {}
  for k in BAND_KEYS:
    v = bands.get(k, None)
    if isinstance(v, (int, float)) and math.isfinite(float(v)) and float(v) >= 0:
      cleaned[k] = float(v)

  s = sum(cleaned.values())
  if s <= 0:
    return cleaned
  return {k: (v / s) for k, v in cleaned.items()}
