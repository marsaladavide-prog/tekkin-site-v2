"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { audioManager } from "@/lib/analyzer/audioManager";
import { useRealtimeSpectrum } from "../hooks/useRealtimeSpectrum";
import type {
  PercentileRange,
  ReferenceSpectralPercentiles,
  SpectrumPoint,
  Spectral,
} from "@/lib/analyzer/v2/types";
import type { AnalyzerCardsModel } from "@/lib/analyzer/cards/types";
import type { RefState } from "@/lib/analyzer/cards/refState";
import { Card, SourcePills } from "../utils/ui";
import { clamp01 } from "../utils/number";

type SpectrumComputed = AnalyzerCardsModel["computed"]["spectrum"];

type Props = {
  data?: SpectrumComputed | null;
  refState?: RefState | null;
  variant?: "full" | "compact";
};

type SpectrumMetric = {
  key: "centroid" | "bandwidth" | "rolloff" | "flatness" | "zcr";
  label: string;
  desc: string;
  value: number | null;
  range: PercentileRange | null | undefined;
  format: (value: number | null | undefined) => string;
};

export function SpectrumCard({ data, refState, variant = "full" }: Props) {
  const track = data?.track ?? null;
  const reference = data?.reference ?? null;
  const spectral = data?.spectral ?? null;
  const referenceSpectralPercentiles = data?.referenceSpectralPercentiles ?? null;
  const embedded = variant !== "full";

  const hasTrack = Array.isArray(track) && track.length > 0;
  const hasRef = Array.isArray(reference) && reference.length > 0;
  const fallbackRefState: RefState = {
    ref: hasRef,
    live: hasTrack,
    mock: !hasTrack,
    reason: hasTrack ? "Spectrum data live" : "No spectrum data",
  };
  const finalRefState = refState ?? fallbackRefState;

  return (
    <SpectrumCompareCard
      track={track}
      reference={reference}
      spectral={spectral}
      referenceSpectralPercentiles={referenceSpectralPercentiles}
      refState={finalRefState}
      variant={variant}
      embedded={embedded}
    />
  );
}

function SpectrumCompareCard({
  track,
  reference,
  spectral,
  referenceSpectralPercentiles,
  refState,
  variant,
  embedded,
  height,
}: {
  track?: SpectrumPoint[] | null;
  reference?: SpectrumPoint[] | null;
  spectral?: Spectral | null;
  referenceSpectralPercentiles?: ReferenceSpectralPercentiles | null;
  refState: RefState;
  variant: "full" | "compact";
  embedded: boolean;
  height?: number;
}) {
  const H = height ?? 180;
  const pad = useMemo(() => ({ l: 44, r: 10, t: 16, b: 26 }), []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = useState(820);
  const [deltaMode, setDeltaMode] = useState(false);

  const isPlaying = useTekkinPlayer((s) => s.isPlaying);
  // const realtimeData = useRealtimeSpectrum(isPlaying);
  const realtimeData = null; // Disabilitato per ora su richiesta

  const hasRef = Array.isArray(reference) && reference.length > 0;
  const hasTrack = Array.isArray(track) && track.length > 0;

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setSvgWidth(containerRef.current.clientWidth || 820);
    };
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const obs = new ResizeObserver(() => updateWidth());
      if (containerRef.current) obs.observe(containerRef.current);
      return () => obs.disconnect();
    }
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const data = useMemo(() => {
    // Se stiamo suonando e abbiamo dati realtime, usiamo quelli
    if (isPlaying && realtimeData) {
      const out: { hz: number; t?: number; r?: number; d?: number }[] = [];
      
      // 1. Realtime Track
      const sr = audioManager.context?.sampleRate || 44100;
      const fftSize = 4096; 
      const binCount = realtimeData.length;
      
      for (let i = 0; i < binCount; i++) {
        const hz = i * sr / fftSize;
        if (hz < 20) continue;
        if (hz > 20000) break;
        out.push({ hz, t: realtimeData[i] });
      }

      // 2. Reference (se presente)
      if (Array.isArray(reference)) {
        for (const p of reference) {
          out.push({ hz: p.hz, r: p.mag });
        }
      }
      return out;
    }

    const t = Array.isArray(track) ? track : [];
    const r = Array.isArray(reference) ? reference : [];
    const n = Math.max(t.length, r.length);
    const out: { hz: number; t?: number; r?: number; d?: number }[] = [];
    for (let i = 0; i < n; i++) {
      const hz = (t[i]?.hz ?? r[i]?.hz) as number | undefined;
      const tt = typeof t[i]?.mag === "number" ? t[i]!.mag : undefined;
      const rr = typeof r[i]?.mag === "number" ? r[i]!.mag : undefined;
      out.push({
        hz: typeof hz === "number" ? hz : i,
        t: tt,
        r: rr,
        d: typeof tt === "number" && typeof rr === "number" ? tt - rr : undefined,
      });
    }
    return out;
  }, [track, reference, isPlaying, realtimeData]);

  const avgInRange = useCallback(
    (key: "t" | "r" | "d", hzMin: number, hzMax: number) => {
      let sum = 0;
      let n = 0;
      for (const p of data) {
        const hz = typeof p.hz === "number" ? p.hz : null;
        const v = (p as any)[key] as number | undefined;
        if (hz == null || typeof v !== "number") continue;
        if (hz >= hzMin && hz <= hzMax) {
          sum += v;
          n += 1;
        }
      }
      return n ? sum / n : null;
    },
    [data]
  );

  const summary = useMemo(() => {
    if (!hasRef || !hasTrack) return null;
    const sub = avgInRange("d", 20, 60);
    const lowmid = avgInRange("d", 150, 400);
    const high = avgInRange("d", 6000, 12000);
    return { sub, lowmid, high };
  }, [avgInRange, hasRef, hasTrack]);

  const domain = useMemo(() => {
    if (deltaMode) {
      let maxAbs = 0;
      for (const p of data) {
        if (typeof p.d === "number") maxAbs = Math.max(maxAbs, Math.abs(p.d));
      }
      if (!Number.isFinite(maxAbs) || maxAbs === 0) maxAbs = 6;
      const padAbs = Math.min(12, Math.max(2, maxAbs * 1.1));
      return { min: -padAbs, max: padAbs, isDelta: true };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const p of data) {
      if (typeof p.t === "number") {
        min = Math.min(min, p.t);
        max = Math.max(max, p.t);
      }
      if (typeof p.r === "number") {
        min = Math.min(min, p.r);
        max = Math.max(max, p.r);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      min = -60;
      max = 0;
    }
    return { min, max, isDelta: false };
  }, [data, deltaMode]);

  const xFromHz = useCallback(
    (hz: number) => {
      const lo = Math.log10(20);
      const hi = Math.log10(20000);
      const v = clamp01((Math.log10(Math.max(20, Math.min(20000, hz))) - lo) / (hi - lo));
      return pad.l + v * (svgWidth - pad.l - pad.r);
    },
    [pad, svgWidth]
  );

  const yFromVal = useCallback(
    (v: number) => {
      const t = clamp01((v - domain.min) / (domain.max - domain.min));
      return pad.t + (1 - t) * (H - pad.t - pad.b);
    },
    [H, domain.max, domain.min, pad]
  );

  const smoothPath = useCallback((points: { x: number; y: number }[]) => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      d += ` Q ${midX} ${p0.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, []);

  const pathFrom = useCallback(
    (key: "t" | "r" | "d") => {
      const pts = data
        .filter((p) => typeof (p as any)[key] === "number")
        .map((p) => ({ x: xFromHz(p.hz), y: yFromVal((p as any)[key] as number) }));
      return smoothPath(pts);
    },
    [data, smoothPath, xFromHz, yFromVal]
  );

  const tPath = useMemo(() => (deltaMode ? "" : pathFrom("t")), [deltaMode, pathFrom]);
  const rPath = useMemo(() => (deltaMode ? "" : pathFrom("r")), [deltaMode, pathFrom]);
  const dPath = useMemo(() => (deltaMode ? pathFrom("d") : ""), [deltaMode, pathFrom]);

  const yTicks = useMemo(() => {
    const top = domain.max;
    const mid = (domain.min + domain.max) / 2;
    const bot = domain.min;
    const fmt = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(0)} dB`;
    return [
      { v: top, label: fmt(top) },
      { v: mid, label: fmt(mid) },
      { v: bot, label: fmt(bot) },
    ];
  }, [domain.min, domain.max]);

  const zeroY = domain.isDelta ? yFromVal(0) : null;

  const formatHz = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
    if (value >= 1000) return `${(value / 1000).toFixed(2)} kHz`;
    return `${value.toFixed(0)} Hz`;
  };

  const formatNum = (value: number | null | undefined) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
    return value.toFixed(3);
  };

  const formatRange = (range: PercentileRange | null | undefined, unit: (v: number) => string) => {
    if (!range) return "n/a";
    const low = range.p10 ?? range.p50 ?? null;
    const high = range.p90 ?? range.p50 ?? null;
    if (low == null || high == null) return "n/a";
    return `${unit(low)} - ${unit(high)}`;
  };

  const spectrumMetrics: SpectrumMetric[] = [
    {
      key: "centroid",
      label: "Centroid",
      desc: "Brillantezza media",
      value: spectral?.spectral_centroid_hz ?? null,
      range: referenceSpectralPercentiles?.spectral_centroid_hz ?? null,
      format: formatHz,
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      desc: "Larghezza spettrale",
      value: spectral?.spectral_bandwidth_hz ?? null,
      range: referenceSpectralPercentiles?.spectral_bandwidth_hz ?? null,
      format: formatHz,
    },
    {
      key: "rolloff",
      label: "Rolloff",
      desc: "Taglio alte frequenze",
      value: spectral?.spectral_rolloff_hz ?? null,
      range: referenceSpectralPercentiles?.spectral_rolloff_hz ?? null,
      format: formatHz,
    },
    {
      key: "flatness",
      label: "Flatness",
      desc: "Rumorosita del timbro",
      value: spectral?.spectral_flatness ?? null,
      range: referenceSpectralPercentiles?.spectral_flatness ?? null,
      format: formatNum,
    },
    {
      key: "zcr",
      label: "ZCR",
      desc: "Densita transienti",
      value: spectral?.zero_crossing_rate ?? null,
      range: referenceSpectralPercentiles?.zero_crossing_rate ?? null,
      format: formatNum,
    },
  ];

  const content = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-white/5 px-2 py-0.5 text-[11px] text-emerald-200">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Traccia
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/25 bg-white/5 px-2 py-0.5 text-[11px] text-blue-200">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400" /> Reference
            </span>
            {deltaMode ? (
              <span className="text-[11px] text-white/50">Vista differenza</span>
            ) : null}
          </div>
          <div className="text-[11px] text-white/50">
            Verde sopra blu = piu energia della traccia. Verde sotto blu = meno energia.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {summary ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={`rounded-full border bg-black/20 px-2 py-1 ${
                  summary.sub == null
                    ? "border-white/10 text-white/60"
                    : summary.sub >= 0
                    ? "border-emerald-400/25 text-emerald-200"
                    : "border-rose-400/25 text-rose-200"
                }`}
              >
                Sub {summary.sub == null ? "n/a" : `${summary.sub >= 0 ? "+" : ""}${summary.sub.toFixed(1)} dB`}
              </span>
              <span
                className={`rounded-full border bg-black/20 px-2 py-1 ${
                  summary.lowmid == null
                    ? "border-white/10 text-white/60"
                    : summary.lowmid >= 0
                    ? "border-emerald-400/25 text-emerald-200"
                    : "border-rose-400/25 text-rose-200"
                }`}
              >
                LowMid {summary.lowmid == null ? "n/a" : `${summary.lowmid >= 0 ? "+" : ""}${summary.lowmid.toFixed(1)} dB`}
              </span>
              <span
                className={`rounded-full border bg-black/20 px-2 py-1 ${
                  summary.high == null
                    ? "border-white/10 text-white/60"
                    : summary.high >= 0
                    ? "border-emerald-400/25 text-emerald-200"
                    : "border-rose-400/25 text-rose-200"
                }`}
              >
                High {summary.high == null ? "n/a" : `${summary.high >= 0 ? "+" : ""}${summary.high.toFixed(1)} dB`}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
            onClick={() => setDeltaMode((prev) => !prev)}
          >
            {deltaMode ? "Vista overlay" : "Vista differenza"}
          </button>
        </div>
      </div>

      <div ref={containerRef} className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 relative w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${svgWidth} ${H}`}>
          <defs>
            <linearGradient id="trackGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="refGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[100, 1000, 10000].map((hz) => {
            const x = xFromHz(hz);
            return <line key={hz} x1={x} y1={pad.t} x2={x} y2={H - pad.b} stroke="rgba(255,255,255,0.08)" />;
          })}

          {yTicks.map((t, i) => {
            const y = yFromVal(t.v);
            return (
              <g key={i}>
                <line x1={pad.l} y1={y} x2={svgWidth - pad.r} y2={y} stroke="rgba(255,255,255,0.06)" />
                <text x={pad.l - 8} y={y + 4} fill="rgba(255,255,255,0.45)" fontSize="11" textAnchor="end">
                  {t.label}
                </text>
              </g>
            );
          })}

          {domain.isDelta && zeroY != null ? (
            <line x1={pad.l} y1={zeroY} x2={svgWidth - pad.r} y2={zeroY} stroke="rgba(255,255,255,0.18)" />
          ) : null}

          <text x={xFromHz(20)} y={H - 8} fill="rgba(255,255,255,0.45)" fontSize="11" textAnchor="start">
            20Hz
          </text>
          <text x={xFromHz(100)} y={H - 8} fill="rgba(255,255,255,0.45)" fontSize="11" textAnchor="middle">
            100Hz
          </text>
          <text x={xFromHz(1000)} y={H - 8} fill="rgba(255,255,255,0.45)" fontSize="11" textAnchor="middle">
            1kHz
          </text>
          <text x={xFromHz(10000)} y={H - 8} fill="rgba(255,255,255,0.45)" fontSize="11" textAnchor="middle">
            10kHz
          </text>
          <text x={xFromHz(20000)} y={H - 8} fill="rgba(255,255,255,0.45)" fontSize="11" textAnchor="end">
            20kHz
          </text>

          {!deltaMode && hasRef && rPath ? (
            <>
              <path d={`${rPath} L ${xFromHz(20000)} ${H - pad.b} L ${xFromHz(20)} ${H - pad.b} Z`} fill="url(#refGradient)" stroke="none" />
              <path d={rPath} fill="none" stroke="#3b82f6" strokeWidth={2.0} />
            </>
          ) : null}

          {!deltaMode && hasTrack && tPath ? (
            <>
              <path d={`${tPath} L ${xFromHz(20000)} ${H - pad.b} L ${xFromHz(20)} ${H - pad.b} Z`} fill="url(#trackGradient)" stroke="none" />
              <path d={tPath} fill="none" stroke="#34d399" strokeWidth={2.6} />
            </>
          ) : null}

          {deltaMode && dPath ? <path d={dPath} fill="none" stroke="rgba(236,72,153,0.9)" strokeWidth={2.4} /> : null}

          {!hasTrack ? (
            <text
              x={(pad.l + (svgWidth - pad.r)) / 2}
              y={H / 2}
              textAnchor="middle"
              fill="rgba(255,255,255,0.5)"
              fontSize="12"
            >
              no spectrum data
            </text>
          ) : null}
        </svg>

        <div className="mt-2 text-[11px] text-white/45">
          {deltaMode
            ? "Asse Y in dB: differenza Traccia - Reference (0 dB = uguale)."
            : "Asse Y in dB (range auto)."}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
        {spectrumMetrics.map((metric) => (
          <div key={metric.key} className="rounded-lg border border-white/10 bg-black/20 p-2">
            <div className="text-[11px] font-semibold text-white/80">{metric.label}</div>
            <div className="text-[10px] text-white/50">{metric.desc}</div>
            <div className="mt-1 text-[12px] text-white">{metric.format(metric.value)}</div>
            <div className="text-[10px] text-white/45">
              Ref: {formatRange(metric.range, metric.format)}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card
      title="Spettro (confronto)"
      right={
        <div className="flex items-center gap-2">
          <SourcePills state={refState} />
          <button
            type="button"
            onClick={() => setDeltaMode((v) => !v)}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
            disabled={!hasRef || !hasTrack}
            title={
              !hasRef || !hasTrack
                ? "Delta disponibile solo con Traccia e Reference"
                : "Mostra Traccia - Reference"
            }
          >
            {deltaMode ? "Delta view: ON" : "Delta view"}
          </button>
        </div>
      }
    >
      {content}
    </Card>
  );
}
