"use client";

import React, { useMemo } from "react";
import type { Rhythm, ReferenceRhythmPercentiles, ReferenceRhythmDescriptorsPercentiles } from "@/lib/analyzer/v2/types";
import type { RefState } from "../utils/refState";
import { Card, Pill, SourcePills } from "../utils/ui";

const MAX_BEAT_TICKS = 256;

type RhythmCardProps = {
  bpm: number | null;
  keyName: string | null;
  rhythm?: Rhythm | null;
  percentiles?: ReferenceRhythmPercentiles | null;
  descriptorsPercentiles?: ReferenceRhythmDescriptorsPercentiles | null;
  refState?: RefState;
  className?: string;
  bodyClassName?: string;
};

function downsampleBeatTimes(times: number[] | null | undefined) {
  const clean = Array.isArray(times)
    ? times.filter((value) => typeof value === "number" && Number.isFinite(value))
    : [];
  if (!clean.length) return [];
  const step = Math.max(1, Math.ceil(clean.length / MAX_BEAT_TICKS));
  const sampled: number[] = [];
  for (let i = 0; i < clean.length; i += step) {
    sampled.push(clean[i]);
  }
  if (sampled[sampled.length - 1] !== clean[clean.length - 1]) {
    sampled.push(clean[clean.length - 1]);
  }
  return sampled;
}

export function RhythmCard({ bpm, keyName, rhythm, percentiles, descriptorsPercentiles, refState, className, bodyClassName }: RhythmCardProps) {
  const beatPositions = useMemo(() => {
    const beats = downsampleBeatTimes(rhythm?.beat_times);
    if (!beats.length) return [];
    const maxTime = beats[beats.length - 1] ?? beats[0] ?? 1;
    if (!Number.isFinite(maxTime) || maxTime <= 0) return [];
    return beats.map((value, index) => ({
      key: `${value}-${index}`,
      left: Math.min(100, Math.max(0, (value / maxTime) * 100)),
    }));
  }, [rhythm?.beat_times]);

const sourceLive = !!(
  typeof rhythm?.danceability === "number" ||
  (Array.isArray(rhythm?.beat_times) && rhythm.beat_times.length > 0) ||
  (!!rhythm?.descriptors && Object.keys(rhythm.descriptors).length > 0)
);


  const badgeState: RefState = refState ?? {
    ref: false,
    live: sourceLive,
    mock: !sourceLive,
    reason: sourceLive ? "Rhythm data live" : "No rhythm data",
  };

  const dance = rhythm?.danceability;
  const danceValid =
    typeof dance === "number" && dance >= 0 && dance <= 2 && Number.isFinite(dance);
  const danceRangeMax = danceValid ? (dance <= 1 ? 1 : 2) : null;
  const dancePercent = danceValid ? Math.min(1, dance / danceRangeMax!) : 0;

  const fmtRange = (p: any) =>
    p && (typeof p.p10 === "number" || typeof p.p90 === "number")
      ? `${typeof p.p10 === "number" ? p.p10.toFixed(2) : "n/a"} / ${typeof p.p90 === "number" ? p.p90.toFixed(2) : "n/a"}`
      : "n/a";

  const descriptorRows = [
    { key: "beats_count", label: "Beats count", value: rhythm?.descriptors?.beats_count, ref: descriptorsPercentiles?.beats_count },
    { key: "ibi_mean", label: "IBI mean", value: rhythm?.descriptors?.ibi_mean, ref: descriptorsPercentiles?.ibi_mean },
    { key: "ibi_std", label: "IBI std", value: rhythm?.descriptors?.ibi_std, ref: descriptorsPercentiles?.ibi_std },
    { key: "key_strength", label: "Key strength", value: rhythm?.descriptors?.key_strength, ref: descriptorsPercentiles?.key_strength },
  ];
  const relativeKey =
    rhythm?.relative_key ??
    ((rhythm?.descriptors as Record<string, any> | null | undefined)?.relative_key ?? null);

  return (
    <Card
      title="Rhythm"
      subtitle="Groove, key, danceability e descriptors"
      right={<SourcePills state={badgeState} />}
      className={className}
      bodyClassName={bodyClassName}
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-xs text-white/55">BPM</div>
            <div className="text-3xl font-semibold text-white">{typeof bpm === "number" ? Math.round(bpm) : "n/a"}</div>
            <div className="text-[11px] text-white/55 mt-1">Ref p10/p90: {fmtRange(percentiles?.bpm)}</div>
          </div>
          <div>
            <div className="text-xs text-white/55">Key</div>
            <div className="text-3xl font-semibold text-white">{keyName ?? "n/a"}</div>
            <div className="text-[11px] text-white/60 mt-1">
              Relative key: {relativeKey ?? "n/a"}
            </div>
          </div>
        </div>

        <div className="space-y-2 border border-white/10 rounded-xl bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-white/60">Danceability</div>
              <div className="text-lg font-semibold text-white">
                {typeof dance === "number" ? dance.toFixed(2) : "n/a"}
              </div>
            </div>
            {!danceValid && typeof dance === "number" ? <Pill tone="muted">INFO</Pill> : null}
          </div>
          {danceValid ? (
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${dancePercent * 100}%` }}
              />
            </div>
          ) : (
            <div className="text-[11px] text-white/50">Range non confermato: mostro solo il valore</div>
          )}
          <div className="text-[11px] text-white/55">Ref p10/p90: {fmtRange(percentiles?.danceability)}</div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Descriptors</div>
            <div className="mt-2 space-y-2 text-xs text-white/70">
              {descriptorRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-2">
                  <span className="capitalize first-letter:uppercase">{row.label}</span>
                  <div className="text-right">
                    <div>{typeof row.value === "number" ? row.value.toFixed(2) : "n/a"}</div>
                    <div className="text-[10px] text-white/45">Ref {fmtRange(row.ref)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3 h-full">
            <div className="text-xs text-white/60 mb-2">Beat times (view)</div>
            {beatPositions.length ? (
              <div className="relative h-8 w-full rounded-full bg-white/5">
                {beatPositions.map((marker) => (
                  <span
                    key={marker.key}
                    className="absolute top-0 h-8 w-px bg-emerald-400/80"
                    style={{ left: `${marker.left}%` }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-white/60">n/a</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
