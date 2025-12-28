# tekkin_analyzer_v3/utils/windowing.py
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class WindowConfig:
  hop_sec: float = 0.1  # 10 Hz timeline, ottimo per loudness view e correlation view
  min_points: int = 64

def compute_hop_samples(sr: int, hop_sec: float) -> int:
  hop = int(round(sr * hop_sec))
  return max(1, hop)

def downsample_to_view(values: list[float], target_points: int) -> list[float]:
  if not values:
    return []
  if target_points <= 0:
    return []
  n = len(values)
  if n <= target_points:
    return values
  step = n / float(target_points)
  out: list[float] = []
  i = 0.0
  while int(i) < n and len(out) < target_points:
    out.append(values[int(i)])
    i += step
  return out
