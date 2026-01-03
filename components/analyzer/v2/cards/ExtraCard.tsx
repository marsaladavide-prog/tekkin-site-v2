"use client";

import type { AnalyzerCardsModel } from "@/lib/analyzer/cards/types";
import { Card } from "../utils/ui";
import { clamp01 } from "../utils/number";

type ExtraComputed = AnalyzerCardsModel["computed"]["extra"];

type Props = {
  data: ExtraComputed;
  variant?: "full" | "compact";
};

export function ExtraCard({ data, variant = "full" }: Props) {
  const cardClass = variant === "full" ? "h-full flex flex-col" : "flex flex-col";
  const bodyClass = variant === "full" ? "flex-1 overflow-auto" : undefined;
  const mfcc = Array.isArray(data.mfccMean) ? data.mfccMean.slice(0, 13) : [];
  const hfc = data.hfc ?? null;
  const peaksCount = data.spectralPeaksCount ?? null;
  const peaksEnergy = data.spectralPeaksEnergy ?? null;
  const hasAny = mfcc.length > 0 || hfc != null || peaksCount != null || peaksEnergy != null;
  const countPct = clamp01((peaksCount ?? 0) / 24);
  const energyPct = clamp01((peaksEnergy ?? 0) / 1.2);
  const mfccMin = mfcc.length ? Math.min(...mfcc) : 0;
  const mfccMax = mfcc.length ? Math.max(...mfcc) : 1;
  const mfccDenom = mfccMax - mfccMin || 1;
  const mfccBars = mfcc.map((v) => clamp01((v - mfccMin) / mfccDenom));

  return (
    <Card title="Extra" subtitle="MFCC, HFC, spectral peaks" className={cardClass} bodyClassName={bodyClass}>
      <div className="space-y-4">
        {!hasAny ? <div className="text-sm text-white/60">Dati extra non disponibili.</div> : null}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-xs text-white/60">MFCC profile (1-13)</div>
          {mfccBars.length ? (
            <div className="mt-2">
              <div className="flex h-16 items-end gap-1">
                {mfccBars.map((pct, i) => (
                  <div
                    key={`mfcc-${i}`}
                    className="flex-1 rounded-full bg-emerald-400/70"
                    style={{ height: `${Math.max(6, pct * 100)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-white/45">
                <span>low</span>
                <span>mid</span>
                <span>high</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-white/50">n/a</div>
          )}
          <div className="mt-1 text-[10px] text-white/45">
            MFCC = firma timbrica. Valori alti su bande alte = brillantezza; bassi = suono piu scuro.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">HFC</div>
            <div className="mt-1 text-lg font-semibold text-white">{hfc == null ? "n/a" : hfc.toFixed(2)}</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${clamp01((hfc ?? 0) / 1.5) * 100}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-white/45">HFC = energia delle alte. Alto = brillante/harsh, basso = piu scuro.</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Spectral peaks</div>
            <div className="mt-1 text-sm text-white/70">Count: {peaksCount ?? "n/a"} (0-80)</div>
            <div className="text-sm text-white/70">Energy: {peaksEnergy ?? "n/a"} dB</div>
            <div className="mt-2 space-y-1">
              <div className="text-[10px] text-white/50">Normalized count</div>
              <div className="h-1.5 w-full rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400" style={{ width: `${countPct * 100}%` }} />
              </div>
              <div className="text-[10px] text-white/50">Normalized energy</div>
              <div className="h-1.5 w-full rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-400" style={{ width: `${energyPct * 100}%` }} />
              </div>
            </div>
            <div className="mt-1 text-[10px] text-white/45">
              Count = numero di picchi. Energy = forza media dei picchi (alto = contenuto complesso o aggressivo).
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-white/60">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Interpretation</div>
          <div className="mt-1">MFCC e peaks descrivono timbro e densita armonica.</div>
          <div className="mt-2 text-white/70">Action: se peaks count/energy sono alti, riduci saturazione o filtra il top-end.</div>
        </div>
      </div>
    </Card>
  );
}
