"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { PercentileRange } from "@/lib/analyzer/v2/types";
import type { AnalyzerCardsModel } from "@/lib/analyzer/cards/types";
import type { RefState } from "@/lib/analyzer/cards/refState";
import { Card, SourcePills } from "../utils/ui";
import { BAND_ORDER, clamp01 } from "../utils/number";
import { BAND_LABELS } from "./constants";
import { useRealtimeStereo } from "../hooks/useRealtimeStereo";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

// Importiamo dinamicamente il componente 3D per evitare problemi di SSR
const StereoVisualizer3D = dynamic(() => import("../visuals/Stereo3D"), { ssr: false });

type StereoComputed = AnalyzerCardsModel["computed"]["stereo"];

type Props = {
  data: StereoComputed;
  refState: RefState;
  variant?: "full" | "compact";
};

export function CorrelationMeter({
  value,
  ref,
  height = 56,
}: {
  value: number | null;
  ref?: PercentileRange | null;
  height?: number;
}) {
  const W = 520;
  const H = height;
  const pad = { l: 18, r: 18, t: 10, b: 18 };
  const innerW = W - pad.l - pad.r;
  const xFromVal = (v: number) => pad.l + ((v + 1) / 2) * innerW;
  const needle =
    typeof value === "number" && Number.isFinite(value) ? xFromVal(Math.max(-1, Math.min(1, value))) : null;
  const refBand =
    ref && typeof ref.p10 === "number" && typeof ref.p90 === "number"
      ? { left: xFromVal(ref.p10), right: xFromVal(ref.p90) }
      : null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4 shadow-inner">
      <div className="flex items-center justify-between text-[11px] text-white/55 mb-3">
        <span>Correlation meter</span>
        <span className={value && value < 0 ? "text-rose-400" : "text-emerald-400"}>
          {typeof value === "number" ? value.toFixed(2) : "n/a"}
        </span>
      </div>
      <div className="relative h-8 w-full">
        {/* Background Track */}
        <div className="absolute top-2 left-0 right-0 h-4 rounded-full bg-white/5 overflow-hidden">
           {/* Gradient Bar */}
           <div 
             className="absolute inset-0 opacity-80"
             style={{
               background: `linear-gradient(90deg, 
                 rgba(220, 38, 38, 0.8) 0%, 
                 rgba(220, 38, 38, 0.1) 45%, 
                 rgba(34, 197, 94, 0.1) 55%, 
                 rgba(34, 197, 94, 0.8) 100%)`
             }}
           />
           {/* Center Marker */}
           <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2" />
        </div>

        {/* Reference Range (Blue Glow) */}
        {refBand && (
          <div 
            className="absolute top-1 h-6 rounded-md border border-blue-400/30 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
            style={{ 
              left: `${(refBand.left / W) * 100}%`, 
              width: `${((refBand.right - refBand.left) / W) * 100}%` 
            }}
          />
        )}

        {/* Needle (Glowing) */}
        {needle != null && (
          <div 
            className="absolute top-0 h-8 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] rounded-full z-10 transition-all duration-300 ease-out"
            style={{ left: `${(needle / W) * 100}%`, transform: 'translateX(-50%)' }}
          />
        )}
        
        {/* Labels */}
        <div className="absolute top-7 w-full flex justify-between px-1 text-[9px] text-white/30 font-mono">
          <span>-1</span>
          <span>0</span>
          <span>+1</span>
        </div>
      </div>
      
      <div className="mt-4 text-[10px] text-white/45 flex justify-between">
        <span>Anti-phase (Red)</span>
        <span>Mono-safe (Green)</span>
      </div>
    </div>
  );
}

export function StereoScope({
  pointsXY,
  referenceXY,
  size = 320,
}: {
  pointsXY?: { x: number; y: number }[] | null;
  referenceXY?: { x: number; y: number }[] | null;
  size?: number;
}) {
  const isPlaying = useTekkinPlayer((s) => s.isPlaying);
  // Attiviamo l'analisi real-time solo se stiamo suonando
  // const realtimePoints = useRealtimeStereo(isPlaying);
  const realtimePoints: { x: number; y: number }[] = []; // Disabilitato per ora su richiesta

  // Se stiamo suonando e abbiamo dati real-time, usiamo quelli.
  // Altrimenti fallback ai dati statici (snapshot).
  const activePoints = isPlaying && realtimePoints.length > 0 ? realtimePoints : pointsXY;

  // Se abbiamo punti validi (real-time o statici), usiamo il visualizzatore 3D
  if (activePoints && activePoints.length > 0) {
    return <StereoVisualizer3D points={activePoints} />;
  }

  const W = size;
  const H = size;
  const cx = W / 2;
  const cy = H / 2;
  const rMax = W * 0.42;

  const pts = useMemo(() => {
    const raw = Array.isArray(pointsXY)
      ? pointsXY.filter((p) => typeof p.x === "number" && typeof p.y === "number")
      : [];
    if (!raw.length) return [] as Array<{ x: number; y: number }>;
    const maxPts = 1800;
    const step = Math.max(1, Math.ceil(raw.length / maxPts));
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < raw.length; i += step) {
      const p = raw[i];
      const x = Math.max(-1, Math.min(1, p.x));
      const y = Math.max(-1, Math.min(1, p.y));
      out.push({ x, y });
    }
    return out;
  }, [pointsXY]);

  const refPts = useMemo(() => {
    const raw = Array.isArray(referenceXY)
      ? referenceXY.filter((p) => typeof p.x === "number" && typeof p.y === "number")
      : [];
    if (!raw.length) return [] as Array<{ x: number; y: number }>;
    const maxPts = 1200;
    const step = Math.max(1, Math.ceil(raw.length / maxPts));
    const out: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < raw.length; i += step) {
      const p = raw[i];
      const x = Math.max(-1, Math.min(1, p.x));
      const y = Math.max(-1, Math.min(1, p.y));
      out.push({ x, y });
    }
    return out;
  }, [referenceXY]);

  const toXY = (p: { x: number; y: number }) => ({
    x: cx + p.x * rMax,
    y: cy - p.y * rMax,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between text-[11px] text-white/55">
        <span>Stereo field (Lissajous)</span>
        <span>{pts.length ? `${pts.length} pts` : "n/a"}</span>
      </div>
      <div className="mt-3 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <rect x={0} y={0} width={W} height={H} fill="rgba(255,255,255,0.02)" />
          <line x1={cx} y1={cy - rMax} x2={cx} y2={cy + rMax} stroke="rgba(255,255,255,0.08)" />
          <line x1={cx - rMax} y1={cy} x2={cx + rMax} y2={cy} stroke="rgba(255,255,255,0.08)" />
          <rect
            x={cx - rMax}
            y={cy - rMax}
            width={rMax * 2}
            height={rMax * 2}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
          />

          {refPts.length ? (
            <g>
              {refPts.map((p, i) => {
                const q = toXY(p);
                return <circle key={`r-${i}`} cx={q.x} cy={q.y} r={1} fill="rgba(255,255,255,0.18)" />;
              })}
            </g>
          ) : null}

          {pts.length ? (
            <g>
              {pts.map((p, i) => {
                const q = toXY(p);
                return <circle key={i} cx={q.x} cy={q.y} r={1} fill="rgba(255,255,255,0.55)" />;
              })}
            </g>
          ) : (
            <text x={cx} y={cy} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12">
              no data
            </text>
          )}

          <text x={cx} y={cy - rMax - 6} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10">
            R
          </text>
          <text x={cx} y={cy + rMax + 14} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10">
            L
          </text>
          <text x={cx - rMax - 6} y={cy + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="10">
            L
          </text>
          <text x={cx + rMax + 6} y={cy + 4} textAnchor="start" fill="rgba(255,255,255,0.55)" fontSize="10">
            R
          </text>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-white/55">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-white/80" /> Track (X=L, Y=R)
        </span>
        {refPts.length ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-white/40" /> Reference XY
          </span>
        ) : (
          <span className="text-white/40">Reference XY non disponibile</span>
        )}
      </div>
    </div>
  );
}

export function StereoCard({ data, refState, variant = "full" }: Props) {
  const cardClass = variant === "full" ? "h-full flex flex-col" : "flex flex-col";
  const bodyClass = variant === "full" ? "flex-1 overflow-auto" : undefined;
  const widthValue = typeof data.width === "number" ? data.width : null;
  const widthRef = data.widthPercentiles ?? null;
  const corrValue = typeof data.correlation === "number" ? data.correlation : null;
  const corrRef = data.correlationPercentiles ?? null;
  const widthByBand = data.widthByBand ?? null;

  return (
    <Card
      title="Stereo"
      subtitle="Width, correlation, width by band"
      right={
        <div className="flex items-center gap-2">
          <SourcePills state={refState} />
        </div>
      }
      className={cardClass}
      bodyClassName={bodyClass}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Stereo width</div>
            <div className="mt-1 text-lg font-semibold text-white">{widthValue == null ? "n/a" : widthValue.toFixed(2)}</div>
            <div className="text-[10px] text-white/50">Ref p10/p90: {formatRange(widthRef)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Correlation</div>
            <div className="mt-1 text-lg font-semibold text-white">{corrValue == null ? "n/a" : corrValue.toFixed(2)}</div>
            <div className="text-[10px] text-white/50">Ref p10/p90: {formatRange(corrRef)}</div>
          </div>
        </div>

        <CorrelationMeter value={corrValue} ref={corrRef} />

        <StereoScope pointsXY={data.soundFieldXY ?? null} referenceXY={data.referenceSoundFieldXY ?? null} />

        {widthByBand ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55 mb-2">Width by band</div>
            <div className="grid grid-cols-2 gap-2">
              {BAND_ORDER.map((k) => {
                const v = (widthByBand as Record<string, number> | null)?.[k];
                const vv = typeof v === "number" && Number.isFinite(v) ? clamp01(v) : null;
                return (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-white/55">{BAND_LABELS.it[k]}</span>
                    <span className="text-[11px] text-white/70">{vv == null ? "n/a" : vv.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function formatRange(range: PercentileRange | null | undefined) {
  if (!range || (range.p10 == null && range.p90 == null)) return "no ref";
  const low = typeof range.p10 === "number" ? range.p10.toFixed(2) : "n/a";
  const high = typeof range.p90 === "number" ? range.p90.toFixed(2) : "n/a";
  return `${low} / ${high}`;
}
