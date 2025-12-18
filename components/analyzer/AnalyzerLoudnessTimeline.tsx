"use client";

import React, { useMemo } from "react";

type Props = {
  momentaryLufs: number[] | null | undefined;
  height?: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function AnalyzerLoudnessTimeline({ momentaryLufs, height = 44 }: Props) {
  const data = Array.isArray(momentaryLufs) ? momentaryLufs.filter((n) => Number.isFinite(n)) : [];
  const width = 640;
  const pad = 6;

  const { d, minV, maxV, flatScore } = useMemo(() => {
    if (data.length < 3) return { d: "", minV: 0, maxV: 0, flatScore: 0 };

    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const v of data) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }

    const range = Math.max(0.001, maxVal - minVal);

    // path
    const stepX = (width - pad * 2) / (data.length - 1);
    let path = "";
    for (let i = 0; i < data.length; i++) {
      const x = pad + i * stepX;
      const t = (data[i] - minVal) / range; // 0..1
      const y = pad + (1 - t) * (height - pad * 2);
      path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }

    // “flatness” quick metric: avg abs delta between samples
    let sumAbs = 0;
    for (let i = 1; i < data.length; i++) sumAbs += Math.abs(data[i] - data[i - 1]);
    const avgAbs = sumAbs / (data.length - 1);

    // heuristic: if avgAbs is very small, it’s too flat
    // normalize to 0..100-ish (lower avgAbs -> higher flatScore)
    const flat = clamp((0.35 - avgAbs) / 0.35, 0, 1);
    const flatScorePct = Math.round(flat * 100);

    return { d: path, minV: minVal, maxV: maxVal, flatScore: flatScorePct };
  }, [data, height]);

  if (data.length < 3) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-sm font-semibold text-white">Dinamica nel tempo</div>
        <div className="mt-1 text-xs text-white/55">Dati momentary LUFS non disponibili per questa versione.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Dinamica nel tempo</div>
          <div className="mt-1 text-xs text-white/55">
            Momentary LUFS (più alto = più loud). Range: {minV.toFixed(1)} → {maxV.toFixed(1)}
          </div>
        </div>

        <div
          className={[
            "rounded-full border px-3 py-1 text-[11px] font-semibold",
            flatScore >= 70
              ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
              : "border-white/10 bg-white/5 text-white/70",
          ].join(" ")}
          title="Stima rapida: quanto è 'piatta' la loudness nel tempo"
        >
          Flat {flatScore}%
        </div>
      </div>

      <div className="mt-3">
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full"
          role="img"
          aria-label="Momentary LUFS timeline"
        >
          <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70" />
        </svg>

        <div className="mt-2 flex items-center justify-between text-[11px] text-white/45">
          <span>Intro</span>
          <span>Break</span>
          <span>Drop</span>
          <span>Outro</span>
        </div>
      </div>
    </div>
  );
}
