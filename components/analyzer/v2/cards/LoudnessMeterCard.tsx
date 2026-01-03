"use client";

import React, { useMemo, useState } from "react";
import type { Loudness } from "@/lib/analyzer/v2/types";
import type { RefState } from "@/lib/analyzer/cards/refState";
import { Card, Pill, SourcePills, StatusChip } from "../utils/ui";
import { clamp01, formatDb } from "../utils/number";

function downsample(values?: number[] | null, maxPoints = 64) {
  const clean = Array.isArray(values)
    ? values.filter((v) => typeof v === "number" && Number.isFinite(v))
    : [];
  if (!clean.length) return [];
  if (clean.length <= maxPoints) return clean;
  const step = Math.max(1, Math.ceil(clean.length / maxPoints));
  const sampled: number[] = [];
  for (let i = 0; i < clean.length; i += step) {
    sampled.push(clean[i]);
  }
  if (sampled[sampled.length - 1] !== clean[clean.length - 1]) {
    sampled.push(clean[clean.length - 1]);
  }
  return sampled;
}

function fmtLufs(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(1)} LUFS`;
}

function sanitizeLufsValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < -200) return null;
  return value;
}

function formatRange(range?: { p10?: number | null; p90?: number | null } | null) {
  if (!range || (range.p10 == null && range.p90 == null)) return "n/a";
  return `${range.p10 != null ? range.p10.toFixed(1) : "n/a"} / ${range.p90 != null ? range.p90.toFixed(1) : "n/a"}`;
}

function VerticalLoudnessMeter({
  label,
  value,
  refRange,
  min = -60,
  max = 0,
  description,
  accent = "from-emerald-500 to-emerald-300",
  valueTone = "text-emerald-200",
}: {
  label: string;
  value: number | null | undefined;
  refRange?: { p10?: number | null; p90?: number | null } | null;
  min?: number;
  max?: number;
  description?: string;
  accent?: string;
  valueTone?: string;
}) {
  const domainMin = min;
  const domainMax = max;
  const displayValue = typeof value === "number" && Number.isFinite(value) ? value : null;
  const ratio =
    displayValue != null ? clamp01((displayValue - domainMin) / (domainMax - domainMin)) : null;
  const bandLeft =
    refRange && typeof refRange.p10 === "number"
      ? clamp01((refRange.p10 - domainMin) / (domainMax - domainMin))
      : null;
  const bandRight =
    refRange && typeof refRange.p90 === "number"
      ? clamp01((refRange.p90 - domainMin) / (domainMax - domainMin))
      : null;
  const ticks = [-60, -50, -40, -30, -20, -10, 0];
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-white/80">
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</div>
      <div className="mt-2 flex items-end gap-3">
        <div className="relative h-36 w-11">
          <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-white/5" />
          {bandLeft != null && bandRight != null && (
            <div
              className="absolute inset-x-1 rounded-full bg-blue-500/30"
              style={{
                bottom: `${bandLeft * 100}%`,
                height: `${Math.max(2, (bandRight - bandLeft) * 100)}%`,
              }}
            />
          )}
          {ratio != null && (
            <div
              className={`absolute left-0 right-0 rounded-full bg-gradient-to-t ${accent}`}
              style={{ bottom: 0, height: `${Math.max(6, ratio * 100)}%` }}
            />
          )}
          {ratio != null ? (
            <div className="absolute left-0 right-0 h-1 rounded-full bg-white/20" style={{ bottom: `${ratio * 100}%` }} />
          ) : null}
        </div>
        <div className="flex h-36 flex-col justify-between text-[9px] text-white/45">
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="flex-1 space-y-1 text-[10px] text-white/60">
          <div className={`text-base font-semibold ${valueTone}`}>
            {displayValue != null ? `${displayValue.toFixed(1)} LUFS` : "n/a"}
          </div>
          <div>Ref p10/p90: {formatRange(refRange)}</div>
          {description ? <div className="text-[10px] text-white/45">{description}</div> : null}
        </div>
      </div>
    </div>
  );
}

type LoudnessMeterCardProps = {
  loudness?: Loudness | null;
  referenceName?: string | null;
  referenceTarget?: {
    p10?: number | null;
    p50?: number | null;
    p90?: number | null;
  } | null;
  referenceLra?: {
    p10?: number | null;
    p50?: number | null;
    p90?: number | null;
  } | null;
  referencePeak?: {
    p10?: number | null;
    p50?: number | null;
    p90?: number | null;
  } | null;
  momentary?: number[] | null;
  shortTerm?: number[] | null;
  levels?: { label: "L" | "C" | "R" | "Ls" | "Rs" | "LFE"; rmsDb: number; peakDb: number }[] | null;
  refState: RefState;
};

export function LoudnessMeterCard({
  loudness,
  referenceName,
  referenceTarget,
  referenceLra,
  referencePeak,
  momentary,
  shortTerm,
  levels,
  refState,
}: LoudnessMeterCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [timelineMode, setTimelineMode] = useState<"momentary" | "short">("momentary");

  const integrated = sanitizeLufsValue(loudness?.integrated_lufs ?? null);
  const lra = loudness?.lra ?? null;
  const truePeak = typeof loudness?.true_peak_db === "number" ? loudness?.true_peak_db : null;
  const samplePeak = typeof loudness?.sample_peak_db === "number" ? loudness?.sample_peak_db : null;
  const peakValue = truePeak ?? samplePeak ?? null;

  const lraRangeText =
    referenceLra && (referenceLra.p10 != null || referenceLra.p90 != null)
      ? `${referenceLra.p10 != null ? referenceLra.p10.toFixed(1) : "n/a"} / ${
          referenceLra.p90 != null ? referenceLra.p90.toFixed(1) : "n/a"
        } LU`
      : "n/a";
  const lraBand =
    referenceLra && typeof referenceLra.p10 === "number" && typeof referenceLra.p90 === "number"
      ? { min: referenceLra.p10, max: referenceLra.p90 }
      : null;
  const lraMarker = typeof lra === "number" && Number.isFinite(lra) ? lra : null;
  const lraDomainMin = lraBand?.min ?? 0;
  const lraDomainMax = lraBand?.max ?? 20;
  const lraDenom = lraDomainMax - lraDomainMin || 1;
  const lraBandLeft = lraBand ? clamp01((lraBand.min - lraDomainMin) / lraDenom) : null;
  const lraBandRight = lraBand ? clamp01((lraBand.max - lraDomainMin) / lraDenom) : null;
  const lraMarkerPos = lraMarker != null ? clamp01((lraMarker - lraDomainMin) / lraDenom) : null;
  const peakRangeText =
    referencePeak && (referencePeak.p10 != null || referencePeak.p90 != null)
      ? `${referencePeak.p10 != null ? formatDb(referencePeak.p10) : "n/a"} / ${
          referencePeak.p90 != null ? formatDb(referencePeak.p90) : "n/a"
        }`
      : "n/a";
  const peakBand =
    referencePeak && typeof referencePeak.p10 === "number" && typeof referencePeak.p90 === "number"
      ? { min: referencePeak.p10, max: referencePeak.p90 }
      : null;
  const peakDomainMin = -12;
  const peakDomainMax = 0;
  const peakDenom = peakDomainMax - peakDomainMin || 1;
  const peakBandLeft = peakBand ? clamp01((peakBand.min - peakDomainMin) / peakDenom) : null;
  const peakBandRight = peakBand ? clamp01((peakBand.max - peakDomainMin) / peakDenom) : null;
  const peakMarker = truePeak != null ? clamp01((truePeak - peakDomainMin) / peakDenom) : null;

  const momentaryTicks = useMemo(() => downsample(momentary, 96), [momentary]);
  const shortTermTicks = useMemo(() => downsample(shortTerm, 96), [shortTerm]);
  const timelinePoints = timelineMode === "momentary" ? momentaryTicks : shortTermTicks;
  const latestMomentary = sanitizeLufsValue(
    momentary && momentary.length ? momentary[momentary.length - 1] : null
  );
  const latestShort = sanitizeLufsValue(shortTerm && shortTerm.length ? shortTerm[shortTerm.length - 1] : null);
  const momentaryRange = loudness?.momentary_percentiles ?? null;
  const shortRange = loudness?.short_term_percentiles ?? null;

const SECTION_ORDER = ["intro", "drop", "break", "outro"] as const;
type SectionKey = (typeof SECTION_ORDER)[number];

const sections = (loudness?.sections ?? null) as Record<SectionKey, any> | null;


  const checks = [
    {
      key: "clipping",
      label: "Clipping",
      ok: typeof peakValue === "number" ? peakValue <= -1.0 : false,
      title: "Peak sopra -1.0 dB: rischio clipping/limiter troppo aggressivo.",
      action: "Abbassa output/ceiling del limiter di 0.5-1 dB e riascolta.",
    },
    {
      key: "loudness",
      label: "Loudness hot",
      ok: typeof integrated === "number" ? integrated <= -8.5 : false,
      title: "LUFS molto alto: rischio affaticamento e poca dinamica.",
      action: "Riduci gain sul limiter e recupera punch con transient shaper.",
    },
    {
      key: "overcompressed",
      label: "Over-compressed",
      ok: typeof lra === "number" ? lra >= 6 : false,
      title: "LRA molto basso: mix troppo schiacciato.",
      action: "Rilassa buss/limiter, prova attacco piu lento.",
    },
    {
      key: "headroom",
      label: "Headroom",
      ok: typeof peakValue === "number" ? peakValue <= -0.2 : false,
      title: "Headroom basso: rischio overs in conversione.",
      action: "Lascia -0.3/-0.8 dB di margine per distribuzione.",
    },
  ];

  const levelsItems = Array.isArray(levels) ? levels : [];
  const left = levelsItems.find((x) => x.label === "L");
  const right = levelsItems.find((x) => x.label === "R");
  const minDb = -60;
  const maxDb = 0;
  const toPct = (db: number) => clamp01((db - minDb) / (maxDb - minDb)) * 100;

  return (
    <Card
      title="Loudness"
      subtitle={refState.ref ? `Target ${referenceName ?? "reference model"}` : "Target reference non disponibile"}
      right={
        <div className="flex items-center gap-2">
          {checks.map((check) => (
            <Pill key={check.key} tone={check.ok ? "ok" : "high"} title={check.title}>
              {check.label}
            </Pill>
          ))}
          <SourcePills state={refState} />
        </div>
      }
      className="h-full flex flex-col"
      bodyClassName="flex-1 overflow-auto"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <VerticalLoudnessMeter
            label="Momentary"
            value={latestMomentary}
            refRange={momentaryRange}
            description="Trend 400 ms"
            accent="from-amber-400 to-yellow-300"
            valueTone="text-amber-200"
          />
          <VerticalLoudnessMeter
            label="Integrated"
            value={integrated}
            refRange={referenceTarget}
            description="Valore complessivo"
            accent="from-rose-500 to-rose-300"
            valueTone="text-rose-200"
          />
          <VerticalLoudnessMeter
            label="Short-term"
            value={latestShort}
            refRange={shortRange}
            accent="from-emerald-400 to-emerald-300"
            valueTone="text-emerald-200"
            description="Media 3s: riferimento per dinamica e densità."
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">True peak</div>
            <div className="mt-1 text-base font-semibold text-white">
              {truePeak != null ? formatDb(truePeak, 2) : "n/a"}
            </div>
            <div className="text-[10px] text-white/50">Range: {peakRangeText}</div>
            <div className="mt-2 relative h-2 w-full rounded-full bg-white/5">
              {peakBandLeft != null && peakBandRight != null ? (
                <div
                  className="absolute inset-y-0 rounded-full bg-blue-500/25"
                  style={{ left: `${peakBandLeft * 100}%`, width: `${Math.max(2, (peakBandRight - peakBandLeft) * 100)}%` }}
                />
              ) : null}
              {peakMarker != null ? (
                <div className="absolute inset-y-0 w-0.5 bg-emerald-300" style={{ left: `${peakMarker * 100}%` }} />
              ) : null}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Sample peak</div>
            <div className="mt-1 text-base font-semibold text-white">
              {samplePeak != null ? formatDb(samplePeak, 2) : "n/a"}
            </div>
            <div className="text-[10px] text-white/50">Misura in uscita</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">LRA</div>
            <div className="mt-1 text-base font-semibold text-white">
              {typeof lra === "number" ? `${lra.toFixed(1)} LU` : "n/a"}
            </div>
            <div className="text-[10px] text-white/50">Range: {lraRangeText}</div>
            <div className="mt-2 relative h-2 w-full rounded-full bg-white/5">
              {lraBandLeft != null && lraBandRight != null ? (
                <div
                  className="absolute inset-y-0 rounded-full bg-blue-500/25"
                  style={{ left: `${lraBandLeft * 100}%`, width: `${Math.max(2, (lraBandRight - lraBandLeft) * 100)}%` }}
                />
              ) : null}
              {lraMarkerPos != null ? (
                <div className="absolute inset-y-0 w-0.5 bg-emerald-300" style={{ left: `${lraMarkerPos * 100}%` }} />
              ) : null}
            </div>
            <div className="mt-1 text-[10px] text-white/45">LRA = variazione dinamica forte/debole.</div>
          </div>
        </div>

        {levelsItems.length ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">Levels (L/R)</div>
            <div className="grid grid-cols-2 gap-3">
              {[left, right].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <span>{item?.label ?? "n/a"}</span>
                    <span>{item ? `${Math.round(item.rmsDb)} dB` : "n/a"}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-emerald-400/70"
                      style={{ width: `${item ? toPct(item.rmsDb) : 0}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-white/45">Peak {item ? Math.round(item.peakDb) : "n/a"} dB</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 text-white/60">
{SECTION_ORDER.map((key) => {
  const section = sections?.[key];

            return (
              <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">{key}</div>
                <div className="mt-1 text-base font-semibold text-white">{fmtLufs(section?.mean_short_term_lufs)}</div>
                <div className="text-[10px] text-white/40">
                  {typeof section?.seconds === "number" ? `${section.seconds.toFixed(1)} s` : "durata n/a"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/60">Details</div>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-[11px] text-white/60 hover:text-white/80"
            >
              {showDetails ? "Hide" : "Show"}
            </button>
          </div>
          {showDetails ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTimelineMode("momentary")}
                  className={`rounded-full border px-2 py-0.5 ${
                    timelineMode === "momentary" ? "border-emerald-400/40 text-emerald-200" : "border-white/10 text-white/50"
                  }`}
                >
                  Momentary
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineMode("short")}
                  className={`rounded-full border px-2 py-0.5 ${
                    timelineMode === "short" ? "border-sky-400/40 text-sky-200" : "border-white/10 text-white/50"
                  }`}
                >
                  Short-term
                </button>
              </div>
              <div className="h-9 flex items-end gap-0.5">
                {timelinePoints.length ? (
                  timelinePoints.map((value, index) => {
                    const pct = clamp01((value + 40) / 34);

                    return (
                      <div
                        key={`${timelineMode}-${index}`}
                        className={`flex-1 rounded-full ${
                          timelineMode === "momentary" ? "bg-emerald-400/70" : "bg-sky-400/70"
                        }`}
                        style={{ height: `${pct * 100}%` }}
                      />
                    );
                  })
                ) : (
                  <div className="text-[11px] text-white/50">No timeline data</div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px] text-white/50">
                {SECTION_ORDER.map((label) => (

                  <div key={label} className="text-center">{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {checks.map((check) => (
                  <div key={check.key} className="rounded-lg border border-white/10 bg-white/5 p-2">
                    <div className="flex items-center justify-between text-[11px] text-white/70">
                      <span>{check.label}</span>
                      <StatusChip tone={check.ok ? "ok" : "high"}>{check.ok ? "OK" : "WARN"}</StatusChip>
                    </div>
                    <div className="mt-1 text-[10px] text-white/50">{check.action}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
