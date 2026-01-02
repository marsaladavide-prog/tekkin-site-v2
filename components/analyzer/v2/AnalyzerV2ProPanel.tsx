"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalyzerCompareModel, Bands, PercentileRange } from "@/lib/analyzer/v2/types";
import { LoudnessMeterCard } from "./cards/LoudnessMeterCard";
import { RhythmCard } from "./cards/RhythmCard";
import { TekkinRankExplanationCard } from "./cards/TekkinRankCard";
import WaveformPreviewUnified from "@/components/player/WaveformPreviewUnified";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import {
  Card,
  Pill,
  SourcePills,
  StatusChip,
  type StatusTone,
} from "./utils/ui";
import { BAND_ORDER, bandsToPct, clamp01, formatDb, safeNum, sumBands } from "./utils/number";
import {
  getLiveStateForX,
  getRefStateForLoudness,
  getRefStateForSpectrum,
  getRefStateForTonal,
  type RefState,
} from "./utils/refState";

type SpectrumPoint = { hz: number; mag: number };

const BAND_LABELS: Record<"it" | "en", Record<keyof Bands, string>> = {
  it: {
    sub: "Sub",
    low: "Bassi",
    lowmid: "Low-mid",
    mid: "Medi",
    presence: "Presence",
    high: "Alti",
    air: "Air",
  },
  en: {
    sub: "Sub",
    low: "Low",
    lowmid: "Low-mid",
    mid: "Mid",
    presence: "Presence",
    high: "High",
    air: "Air",
  },
};

const TONAL_COPY = {
  it: {
    title: "Tonal balance",
    subtitleRef: (refName: string | null | undefined) =>
      `Giudizio su range reference (${refName ?? "ref"})`,
    subtitleNoRef: "Reference percentiles mancanti: mostro solo valori traccia.",
    overallLabel: "Fit tonale complessivo",
    overallHint: (ok: number, total: number) => `In target: ${ok}/${total}`,
    detailsToggle: "Dettagli",
    detailsHide: "Nascondi",
    status: {
      ok: "In target",
      low: "LOW",
      high: "HIGH",
      unknown: "n/a",
    },
    hint: {
      ok: "Bilanciato",
      low: (band: string) => `Serve più energia in ${band} (EQ/level/comp)`,
      high: (band: string) => `Alleggerisci ${band} con EQ o level`,
    },
    footerRef: "Giudizio basato sui percentili del reference model. Dettagli disponibili nel pannello.",
    footerNoRef: "Percentili reference non disponibili: mostra solo valori traccia.",
    trackPercentile: "Energia nella banda",
    targetWindow: "Range tipico (reference)",
    refOn: "REF ON",
    refOff: "NO REF",
  },
  en: {
    title: "Tonal balance",
    subtitleRef: (refName: string | null | undefined) =>
      `Judgment vs reference range (${refName ?? "ref"})`,
    subtitleNoRef: "Missing reference percentiles: showing track values only.",
    overallLabel: "Overall tonal fit",
    overallHint: (ok: number, total: number) => `In target: ${ok}/${total}`,
    detailsToggle: "Details",
    detailsHide: "Hide",
    status: {
      ok: "In target",
      low: "LOW",
      high: "HIGH",
      unknown: "n/a",
    },
    hint: {
      ok: "Balanced",
      low: (band: string) => `Needs more energy in ${band} (EQ/level/comp)`,
      high: (band: string) => `Lighten ${band} with EQ or level`,
    },
    footerRef: "Judgment based on reference percentiles. Details available in the panel.",
    footerNoRef: "Reference percentiles missing: showing track values only.",
    trackPercentile: "Band energy",
    targetWindow: "Typical range (reference)",
    refOn: "REF ON",
    refOff: "NO REF",
  },
} as const;

function fmt1(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fmt0(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return String(Math.round(n));
}

function classifyPeak(
  peak: number | null | undefined
): { label: "OK" | "WARN" | "BAD" | "n/a"; tone: StatusTone; delta: number | null } {
  if (typeof peak !== "number" || !Number.isFinite(peak)) {
    return { label: "n/a", tone: "muted", delta: null };
  }

  const target = -1.0;
  const delta = Math.max(0, peak - target);
  if (peak <= target) {
    return { label: "OK", tone: "ok", delta };
  }
  if (peak < 0) {
    return { label: "WARN", tone: "low", delta };
  }
  return { label: "BAD", tone: "high", delta };
}

function classifyBalance(diff: number | null | undefined): { label: "OK" | "WARN" | "BAD" | "n/a"; tone: StatusTone } {
  if (typeof diff !== "number" || !Number.isFinite(diff)) {
    return { label: "n/a", tone: "muted" };
  }

  const absDiff = Math.abs(diff);
  if (absDiff <= 0.5) {
    return { label: "OK", tone: "ok" };
  }
  if (absDiff <= 1.5) {
    return { label: "WARN", tone: "low" };
  }
  return { label: "BAD", tone: "high" };
}

function labelFromDeltaAbs(deltaPct: number) {
  const d = Math.abs(deltaPct);
  if (d <= 3) return { label: "OK", tone: "ok" as const };
  if (d <= 7) return { label: "BASSO", tone: "mid" as const };
  return { label: "ALTO", tone: "high" as const };
}

type MetricChip = {
  label: string;
  tone: StatusTone;
};

type MetricGraph = {
  value: number | null | undefined;
  max: number;
  accent: string;
  label: string;
};

type ExpandableCardKey =
  | "tekkin-rank"
  | "tonal-snapshot"
  | "stereo-snapshot"
  | "transient-snapshot";

function MetricRow({
  label,
  value,
  chip,
  meaning,
  action,
  note,
  graph,
}: {
  label: string;
  value: React.ReactNode;
  chip?: MetricChip;
  meaning: string;
  action: string;
  note?: string;
  graph?: MetricGraph;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-white/55">{label}</span>
        {chip ? <StatusChip tone={chip.tone}>{chip.label}</StatusChip> : null}
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[11px] text-white/60">
        <span className="font-semibold text-white/80">Meaning:</span> {meaning}
      </div>
      <div className="text-[11px] text-white/60">
        <span className="font-semibold text-white/80">Action:</span> {action}
      </div>
      {graph ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-white/60">
            <span>{graph.label}</span>
            <span>{typeof graph.value === "number" ? graph.value.toFixed(1) : "n/a"}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${graph.accent}`}
              style={{
                width: `${Math.round(
                  Math.min(1, typeof graph.value === "number" ? graph.value / graph.max : 0) * 10000
                ) / 100}%`,
              }}
            />
          </div>
        </div>
      ) : null}
      {note ? <div className="text-[10px] text-white/40">{note}</div> : null}
    </div>
  );
}

function ExpandableCard({
  id,
  label,
  expandedCard,
  onExpand,
  onClose,
  children,
}: {
  id: ExpandableCardKey;
  label: string;
  expandedCard: ExpandableCardKey | null;
  onExpand: (key: ExpandableCardKey) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const isExpanded = expandedCard === id;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onExpand(id);
    }
  };

  if (isExpanded) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 py-6">
        <button
          type="button"
          aria-label={`Close ${label}`}
          className="absolute inset-0 cursor-zoom-out"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-5xl max-h-[90vh] overflow-auto">
          <div className="rounded-3xl border border-white/10 bg-black/85 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] font-semibold text-white/80 hover:border-white/30 hover:bg-white/10"
              >
                Chiudi
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${label}`}
      onClick={() => onExpand(id)}
      onKeyDown={handleKeyDown}
      className="group cursor-zoom-in"
    >
      <div className="transition group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
        {children}
      </div>
    </div>
  );
}


function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number, i: number): T | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const idx = (seed + i * 2654435761) % arr.length;
  return arr[idx] ?? null;
}


// ---------- MOCK builders (fallback) ----------
function makeMockSpectrum(seed = 1) {
  const pts: SpectrumPoint[] = [];
  const n = 160;

  const rand = (i: number) => {
    const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const bright = (seed % 10) / 10;
  const tiltDb = -8 - bright * 10;
  const lowGain = 5 + (1 - bright) * 5;
  const resoAmp = 0.6 + bright * 1.8;

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hz = 20 * Math.pow(10, t * 3);

    const logHz = Math.log10(hz);

    const bumpCenter = 1.9 + (seed % 3) * 0.08;
    const lowBump = -12 + lowGain * Math.exp(-Math.pow((logHz - bumpCenter) / 0.28, 2));

    const tilt = tiltDb * t;

    const r1 = resoAmp * Math.exp(-Math.pow((logHz - (3.7 + (seed % 4) * 0.03)) / 0.04, 2));
    const r2 = (resoAmp * 0.7) * Math.exp(-Math.pow((logHz - (3.85 + (seed % 5) * 0.02)) / 0.035, 2));

    const noise = (rand(i) - 0.5) * 1.6 + (Math.sin((i + seed) * 0.11) - 0.5) * 0.35;

    const mag = -34 + lowBump + tilt + r1 + r2 + noise;
    pts.push({ hz, mag });
  }
  return pts;
}

function makeMockSoundField(seed = 1) {
  const pts: { angleDeg: number; radius: number }[] = [];
  const wide = ((seed % 10) / 10) * 0.35;
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * 360;
    const base = 0.28 + wide;
    const rad =
      base +
      0.18 * Math.sin((i / 120) * Math.PI * 2 * (2 + (seed % 3))) +
      0.10 * Math.sin((i / 120) * Math.PI * 2 * (5 + (seed % 4)));
    pts.push({ angleDeg: a, radius: clamp01(rad) });
  }
  return pts;
}

function makeMockLevels(seed = 1) {
  const loud = ((seed % 10) / 10) * 6;
  return [
    { label: "L" as const, rmsDb: -24 + loud, peakDb: -11 + loud * 0.7 },
    { label: "C" as const, rmsDb: -31 + loud * 0.9, peakDb: -15 + loud * 0.6 },
    { label: "R" as const, rmsDb: -24 + loud, peakDb: -11 + loud * 0.7 },
    { label: "Ls" as const, rmsDb: -35 + loud * 0.7, peakDb: -19 + loud * 0.5 },
    { label: "Rs" as const, rmsDb: -34 + loud * 0.7, peakDb: -19 + loud * 0.5 },
    { label: "LFE" as const, rmsDb: -41 + loud * 0.6, peakDb: -23 + loud * 0.4 },
  ];
}

// ---------- UI blocks ----------
function AnalyzerHero({
  model,
  onPlay,
  onShare,
  reanalyze,
  waveform,
  lastAnalyzedAt,
}: {
  model: AnalyzerCompareModel;
  onPlay?: () => void;
  onShare?: () => void;
  reanalyze?: {
    isLoading: boolean;
    canRun: boolean;
    onRun: () => void;
    status?: "idle" | "running" | "success" | "error";
    message?: string | null;
  };
  waveform?: {
    peaks?: number[] | null;
    bands?: any | null;
    duration?: number | null;
    progressRatio: number;
    isPlaying: boolean;
    timeLabel: string;
    onTogglePlay: () => void;
    onSeekRatio: (ratio: number) => void;
  };
  lastAnalyzedAt?: string | null;
}) {
  const tekkinScoreValue = model.tekkinRank?.score ?? model.overallScore ?? null;
  const tekkinPrecisionBonus = model.tekkinRank?.precisionBonus ?? 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-white/60">Back to project</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-white">{model.projectTitle}</div>
            <Pill tone="muted">{model.mixType}</Pill>
            {model.referenceName ? <Pill tone="muted">{model.referenceName}</Pill> : null}
            <span className="text-xs text-white/50">{model.versionName}</span>
          </div>
          <div className="mt-1 text-sm text-white/70">
            {model.key ?? "Key n/a"} | {model.bpm ?? "BPM n/a"} BPM | {fmt1(model.loudness?.integrated_lufs ?? null)} LUFS
          </div>
          {lastAnalyzedAt ? (
            <div className="mt-1 text-[11px] text-white/50">Last analyzed: {new Date(lastAnalyzedAt).toLocaleString()}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
            Tekkin <span className="font-semibold text-white">{fmt0(tekkinScoreValue)}</span>
          </div>
          {tekkinPrecisionBonus > 0 ? (
            <div className="text-[10px] text-emerald-300">Precision +{tekkinPrecisionBonus.toFixed(1)}</div>
          ) : null}
          <button
            type="button"
            onClick={onPlay}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 hover:bg-white/8"
          >
            Play
          </button>
          <button
            type="button"
            onClick={onShare}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 hover:bg-white/8"
          >
            Share
          </button>
          {reanalyze ? (
            <button
              type="button"
              className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 hover:bg-white/8 disabled:opacity-60"
              onClick={reanalyze.onRun}
              disabled={!reanalyze.canRun || reanalyze.isLoading}
            >
              {reanalyze.isLoading ? "Analyzing..." : "Re-analyze"}
            </button>
          ) : null}
        </div>
      </div>

      {reanalyze?.message ? (
        <div className={`mt-2 text-[11px] ${reanalyze.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {reanalyze.message}
        </div>
      ) : null}

      <div className="mt-4">
        {waveform?.peaks ? (
          <WaveformPreviewUnified
            peaks={waveform.peaks}
            bands={waveform.bands ?? null}
            duration={waveform.duration ?? null}
            progressRatio={waveform.progressRatio}
            isPlaying={waveform.isPlaying}
            timeLabel={waveform.timeLabel}
            onTogglePlay={waveform.onTogglePlay}
            onSeekRatio={waveform.onSeekRatio}
          />
        ) : (
          <div className="text-sm text-white/60">Waveform non disponibile.</div>
        )}
      </div>
    </div>
  );
}

type BandsPercentiles = Record<string, { p10?: number; p90?: number; p25?: number; p75?: number }>;

function HorizontalTonalBalance({
  trackBands,
  referenceBands,
  referenceName,
  referencePercentiles,
  lang = "it",
  refState,
  embedded,
}: {
  trackBands?: Bands | null;
  referenceBands?: Bands | null;
  referenceName?: string | null;
  referencePercentiles?: BandsPercentiles | null;
  lang?: "it" | "en";
  refState: RefState;
  embedded?: boolean;
}) {
  const trackPct = useMemo(() => bandsToPct(trackBands), [trackBands]);

  const hasRef = !!referenceBands && sumBands(referenceBands) > 0;
  const hasPerc = !!referencePercentiles;
  const hasTrack = !!trackBands && sumBands(trackBands) > 0;

  const copy = TONAL_COPY[lang] ?? TONAL_COPY.it;

  function bandRange(key: keyof Bands) {
    const p = referencePercentiles?.[key];
    const rawLow = p?.p25 ?? p?.p10 ?? null;
    const rawHigh = p?.p75 ?? p?.p90 ?? null;

    const label =
      p?.p25 != null && p?.p75 != null ? "25-75" : p?.p10 != null && p?.p90 != null ? "10-90" : "n/a";

    // Detect scale:
    // - if reference looks like 0..1 -> it's bands_norm domain
    // - if reference looks like 0..100 -> it's percent domain
    const refLooksNorm =
      typeof rawLow === "number" &&
      typeof rawHigh === "number" &&
      rawLow >= 0 &&
      rawHigh <= 1.2;

    return { low: rawLow, high: rawHigh, label, refLooksNorm };
  }

  function bandStatus(
    key: keyof Bands,
    tNorm: number | null,
    tPct: number | null
  ) {
    if (!hasPerc) return { status: "unknown" as const, refOk: false, range: bandRange(key) };

    const range = bandRange(key);
    if (range.low == null || range.high == null) return { status: "unknown" as const, refOk: false, range };

    // Use the same domain as reference
    const tVal = range.refLooksNorm ? tNorm : tPct;
    if (tVal == null) return { status: "unknown" as const, refOk: true, range };

    const low = range.refLooksNorm ? range.low : range.low; // already in correct domain
    const high = range.refLooksNorm ? range.high : range.high;

    if (tVal < low) return { status: "low" as const, refOk: true, range };
    if (tVal > high) return { status: "high" as const, refOk: true, range };
    return { status: "ok" as const, refOk: true, range };
  }

const bandData = BAND_ORDER.map((key) => {
  const tNorm = (trackBands as any)?.[key] ?? null;
  const tPctVal = hasTrack ? (trackPct as any)?.[key] : null;

  const status = bandStatus(
    key,
    typeof tNorm === "number" ? tNorm : null,
    typeof tPctVal === "number" ? tPctVal : null
  );
  const label = BAND_LABELS[lang]?.[key] ?? BAND_LABELS.it[key];
  const chip =
    status.status === "ok" ? "OK" : status.status === "low" ? "LOW" : status.status === "high" ? "HIGH" : "n/a";
  const hint =
    status.status === "ok"
      ? copy.hint.ok
      : status.status === "low"
      ? copy.hint.low(label)
      : status.status === "high"
      ? copy.hint.high(label)
      : copy.status.unknown;

  return {
    key,
    label,
    tPct: typeof tPctVal === "number" ? tPctVal : null,
    status,
    chip,
    hint,
  };
});


  const known = bandData.filter((b) => b.status.status !== "unknown").length;
  const okCount = bandData.filter((b) => b.status.status === "ok").length;
  const overallScore = known ? Math.round((okCount / known) * 100) : null;
  const [showDetails, setShowDetails] = React.useState(false);

  const content = (
    <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-white/55">{copy.overallLabel}</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {overallScore == null ? "n/a" : `${overallScore}%`}
              </div>
              {known ? (
                <div className="mt-1 text-[11px] text-white/50">{copy.overallHint(okCount, known)}</div>
              ) : (
                <div className="mt-1 text-[11px] text-white/50">n/a</div>
              )}
            </div>
            <div className="flex-1">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/80"
                  style={{ width: `${overallScore ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-3 overflow-x-auto">
            {bandData.map((b) => {
              const chipTone =
                b.status.status === "ok"
                  ? "ok"
                  : b.status.status === "low"
                  ? "low"
                  : b.status.status === "high"
                  ? "high"
                  : "muted";
              const cardTone = "border-white/10 bg-white/3";
              const topTone =
                b.status.status === "ok"
                  ? "bg-emerald-400/70"
                  : b.status.status === "low"
                  ? "bg-sky-400/70"
                  : b.status.status === "high"
                  ? "bg-amber-400/70"
                  : "bg-white/10";
              const rangeKeys =
                b.status.range.label === "25-75"
                  ? { low: "p25", high: "p75" }
                  : b.status.range.label === "10-90"
                  ? { low: "p10", high: "p90" }
                  : null;
              const tooltip =
                rangeKeys && b.status.range.low != null && b.status.range.high != null
                  ? `${rangeKeys.low} ${fmt1(b.status.range.low)} | ${rangeKeys.high} ${fmt1(b.status.range.high)}`
                  : "no reference range";

              return (
                <div key={b.key} className={`rounded-xl border p-3 ${cardTone}`}>
                  <div className={`mb-2 h-0.5 w-8 rounded-full ${topTone}`} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-white/75">{b.label}</div>
                  </div>

                  <div className="mt-3 flex flex-col gap-2">
                    <StatusChip tone={chipTone}>{b.chip}</StatusChip>
                  </div>

                  {showDetails ? (
                    <div className="mt-2 text-[11px] text-white/45">
                      <div className="text-[12px] text-white/80">{b.hint}</div>
                      <div className="mt-2 space-y-1 text-[11px] text-white/60">
                        <div>
                          <span className="text-white/70">{copy.trackPercentile}:</span>{" "}
                          <span className="font-semibold text-white/85">
                            {b.tPct == null ? "n/a" : `${fmt1(b.tPct)}%`}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/70">{copy.targetWindow}:</span>{" "}
                          <span className="font-semibold text-white/85">
                            {b.status.range.low != null && b.status.range.high != null
                              ? `${fmt1(b.status.range.low)}% - ${fmt1(b.status.range.high)}%`
                              : "n/a"}
                          </span>
                        </div>

                        <div className="text-white/55">
                          {b.status.status === "low"
                            ? "Sei sotto il range."
                            : b.status.status === "high"
                            ? "Sei sopra il range."
                            : b.status.status === "ok"
                            ? "Sei in linea col reference."
                            : "Reference range non disponibile."}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-white/55">{hasPerc ? copy.footerRef : copy.footerNoRef}</div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card
      title={copy.title}
      subtitle={
        hasPerc
          ? copy.subtitleRef(referenceName)
          : copy.subtitleNoRef
      }
      right={
        <div className="flex items-center gap-3">
          <SourcePills state={refState} />
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:bg-white/10"
          >
            {showDetails ? copy.detailsHide : copy.detailsToggle}
          </button>
        </div>
      }
    >
      {content}
    </Card>
  );
}

function SoundFieldCard({
  points,
  stereoWidth,
  widthByBand,
  correlation,
  referenceStereoPercentiles,
  referenceSoundField,
  refState,
  embedded,
}: {
  points: { angleDeg: number; radius: number }[] | null | undefined;
  stereoWidth?: number | null;
  widthByBand?: Partial<Record<keyof Bands, number>> | null;
  correlation?: number[] | null;
  referenceStereoPercentiles?: AnalyzerCompareModel["referenceStereoPercentiles"] | null;
  referenceSoundField?: AnalyzerCompareModel["referenceSoundField"] | null;
  refState: RefState;
  embedded?: boolean;
}) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const rMax = 92;

  const path = useMemo(() => {
    const pts = Array.isArray(points) ? points : [];
    if (pts.length < 2) return "";
    const toXY = (p: { angleDeg: number; radius: number }) => {
      const a = (p.angleDeg * Math.PI) / 180;
      const rr = clamp01(p.radius) * rMax;
      return { x: cx + Math.cos(a) * rr, y: cy - Math.sin(a) * rr };
    };
    const first = toXY(pts[0]);
    let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const q = toXY(pts[i]);
      d += ` L ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
    }
    return d;
  }, [points, cx, cy, rMax]);

  const refBandPath = useMemo(() => {
    const sf = referenceSoundField;
    const angles = Array.isArray(sf?.angle_deg) ? sf?.angle_deg : null;
    const p10 = Array.isArray(sf?.p10_radius) ? sf?.p10_radius : null;
    const p90 = Array.isArray(sf?.p90_radius) ? sf?.p90_radius : null;
    if (!angles || !p10 || !p90 || angles.length < 2) return null;

    const buildPath = (radii: Array<number | null | undefined>) => {
      const pts = angles
        .map((a, i) => ({ angleDeg: a, radius: radii[i] }))
        .filter((p): p is { angleDeg: number; radius: number } => typeof p.angleDeg === "number" && typeof p.radius === "number");
      if (pts.length < 2) return "";
      const toXY = (p: { angleDeg: number; radius: number }) => {
        const a = (p.angleDeg * Math.PI) / 180;
        const rr = clamp01(p.radius) * rMax;
        return { x: cx + Math.cos(a) * rr, y: cy - Math.sin(a) * rr };
      };
      const first = toXY(pts[0]);
      let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
      for (let i = 1; i < pts.length; i++) {
        const q = toXY(pts[i]);
        d += ` L ${q.x.toFixed(2)} ${q.y.toFixed(2)}`;
      }
      d += " Z";
      return d;
    };

    const outer = buildPath(p90);
    const inner = buildPath(p10);
    if (!outer || !inner) return null;
    return `${outer} ${inner}`;
  }, [referenceSoundField, cx, cy, rMax]);

  const widthVal =
    typeof stereoWidth === "number" && Number.isFinite(stereoWidth) ? clamp01(stereoWidth) : null;

  const corrArr = Array.isArray(correlation) ? correlation.filter((x) => typeof x === "number" && Number.isFinite(x)) : [];
  const corrMean = corrArr.length ? corrArr.reduce((a, b) => a + b, 0) / corrArr.length : null;

  const widthRef = referenceStereoPercentiles?.stereoWidth ?? null;
  const corrRef = referenceStereoPercentiles?.lrCorrelation ?? null;

  const widthLabel =
    widthVal == null ? "n/a" : widthVal < 0.25 ? "stretto" : widthVal < 0.45 ? "moderato" : "wide";

  const corrLabel =
    corrMean == null ? "n/a" : corrMean >= 0.7 ? "mono-safe" : corrMean >= 0.2 ? "attenzione fase" : "rischio fase";

  const inRange = (v: number | null, p: any) =>
    v != null && p && typeof p.p10 === "number" && typeof p.p90 === "number" ? v >= p.p10 && v <= p.p90 : null;

  const widthInRef = inRange(widthVal, widthRef);
  const corrInRef = inRange(corrMean, corrRef);

  const rangeText = (p: any) =>
    p && (typeof p.p10 === "number" || typeof p.p90 === "number")
      ? `${typeof p.p10 === "number" ? fmt2(p.p10) : "n/a"} ↔ ${typeof p.p90 === "number" ? fmt2(p.p90) : "n/a"}`
      : "n/a";

  function fmt2(n: number) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  const content = (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-center">
          <div className="relative">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <defs>
                <radialGradient id="sfGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(52,211,153,0.25)" />
                  <stop offset="70%" stopColor="rgba(52,211,153,0.08)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
              </defs>

              <circle cx={cx} cy={cy} r={rMax} fill="url(#sfGlow)" stroke="rgba(255,255,255,0.12)" />
              <circle cx={cx} cy={cy} r={rMax * 0.66} fill="none" stroke="rgba(255,255,255,0.10)" />
              <circle cx={cx} cy={cy} r={rMax * 0.33} fill="none" stroke="rgba(255,255,255,0.08)" />

              <line x1={cx - rMax} y1={cy} x2={cx + rMax} y2={cy} stroke="rgba(255,255,255,0.10)" />
              <line x1={cx} y1={cy - rMax} x2={cx} y2={cy + rMax} stroke="rgba(255,255,255,0.10)" />

              {refBandPath ? (
                <path d={refBandPath} fill="rgba(59,130,246,0.15)" stroke="none" fillRule="evenodd" />
              ) : null}

              {path ? (
                <path d={path} fill="none" stroke="rgba(52,211,153,0.9)" strokeWidth={2.2} />
              ) : (
                <text x={cx} y={cy} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12">
                  no data
                </text>
              )}

              {/* etichette scala */}
              <text x={cx} y={cy - rMax - 6} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10">
                wide 1.00
              </text>
              <text x={cx} y={cy - rMax * 0.66 - 2} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10">
                0.66
              </text>
              <text x={cx} y={cy - rMax * 0.33 + 2} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10">
                0.33
              </text>
              <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10">
                mono 0.00
              </text>
            </svg>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-white/55">Stereo width</div>
              {widthRef && typeof widthRef.p10 === "number" && typeof widthRef.p90 === "number" ? (
                widthInRef ? <StatusChip tone="ok">OK</StatusChip> : <StatusChip tone="high">OUT</StatusChip>
              ) : (
                <StatusChip tone="muted">NO REF</StatusChip>
              )}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {widthVal == null ? "n/a" : widthVal.toFixed(2)}{" "}
              <span className="text-sm font-semibold text-white/60">{widthLabel}</span>
            </div>
            <div className="mt-1 text-[11px] text-white/55">Scala: 0.00 mono, 1.00 wide</div>
            <div className="mt-1 text-[11px] text-white/55">Reference p10/p90: {rangeText(widthRef)}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-white/55">Correlation</div>
              {corrRef && typeof corrRef.p10 === "number" && typeof corrRef.p90 === "number" ? (
                corrInRef ? <StatusChip tone="ok">OK</StatusChip> : <StatusChip tone="high">OUT</StatusChip>
              ) : (
                <StatusChip tone="muted">NO REF</StatusChip>
              )}
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              {corrMean == null ? "n/a" : corrMean.toFixed(2)}{" "}
              <span className="text-sm font-semibold text-white/60">{corrLabel}</span>
            </div>
            <div className="mt-1 text-[11px] text-white/55">Scala: -1.00 anti-phase, +1.00 mono-safe</div>
            <div className="mt-1 text-[11px] text-white/55">Reference p10/p90: {rangeText(corrRef)}</div>
          </div>
        </div>

        {widthByBand ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55 mb-2">Width by band</div>
            <div className="grid grid-cols-2 gap-2">
              {BAND_ORDER.map((k) => {
                const v = (widthByBand as any)?.[k];
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
        <div className="mt-3 text-[10px] text-white/45">
          Angle 0-180°, radius = stereo energy (normalized). {refBandPath ? "Range band shows p10-p90." : "No reference band."}
        </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Card
      title="Sound field"
      subtitle="Distribuzione stereo (track) con metrica reale e range reference"
      right={<SourcePills state={refState} />}
    >
      {content}
    </Card>
  );
}

type BandRange = {
  low: number | null;
  high: number | null;
  label: "10-90" | "25-75" | "n/a";
  refLooksNorm: boolean;
};

function resolveBandRange(
  referencePercentiles: BandsPercentiles | null | undefined,
  key: keyof Bands
): BandRange {
  const p = referencePercentiles?.[key];
  const low = p?.p10 ?? p?.p25 ?? null;
  const high = p?.p90 ?? p?.p75 ?? null;
  const label =
    p?.p10 != null && p?.p90 != null ? "10-90" : p?.p25 != null && p?.p75 != null ? "25-75" : "n/a";
  const refLooksNorm =
    typeof low === "number" &&
    typeof high === "number" &&
    low >= 0 &&
    high <= 1.2;
  return { low, high, label, refLooksNorm };
}

function resolveBandStatus(
  range: BandRange,
  tNorm: number | null,
  tPct: number | null
) {
  if (range.low == null || range.high == null) {
    return { status: "unknown" as const, range };
  }
  const tVal = range.refLooksNorm ? tNorm : tPct;
  if (tVal == null || !Number.isFinite(tVal)) {
    return { status: "unknown" as const, range };
  }
  const lower = Math.min(range.low, range.high);
  const upper = Math.max(range.low, range.high);
  if (tVal < lower) return { status: "low" as const, range };
  if (tVal > upper) return { status: "high" as const, range };
  return { status: "ok" as const, range };
}

function TonalSnapshotCompact({
  trackBands,
  referencePercentiles,
}: {
  trackBands?: Bands | null;
  referencePercentiles?: BandsPercentiles | null;
}) {
  const trackPct = useMemo(() => bandsToPct(trackBands), [trackBands]);
  const hasTrack = !!trackBands && sumBands(trackBands) > 0;
  const hasPerc = !!referencePercentiles;

  const bandData = BAND_ORDER.map((key) => {
    const tNorm = (trackBands as any)?.[key] ?? null;
    const tPctVal = hasTrack ? (trackPct as any)?.[key] : null;
    const range = resolveBandRange(referencePercentiles ?? null, key);
    const status = hasPerc ? resolveBandStatus(range, tNorm, tPctVal) : { status: "unknown" as const, range };
    return {
      key,
      label: BAND_LABELS.it[key],
      status: status.status,
      rangeLabel: range.label,
    };
  });

  const known = bandData.filter((b) => b.status !== "unknown").length;
  const okCount = bandData.filter((b) => b.status === "ok").length;
  const overallScore = known ? Math.round((okCount / known) * 100) : null;

  const chipTone = (status: string) => {
    if (status === "ok") return "bg-emerald-400/70";
    if (status === "low") return "bg-sky-400/70";
    if (status === "high") return "bg-amber-400/70";
    return "bg-white/10";
  };

  const statusLabel = (status: string) => {
    if (status === "ok") return "OK";
    if (status === "low") return "LOW";
    if (status === "high") return "HIGH";
    return "n/a";
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-white/55">Fit tonale</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {overallScore == null ? "n/a" : `${overallScore}%`}
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              In target: {known ? `${okCount}/${known}` : "n/a"}
            </div>
          </div>
          <div className="flex-1">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/80"
                style={{ width: `${overallScore ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {bandData.map((b) => (
          <div key={b.key} className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1">
            <span className={`h-2 w-2 rounded-full ${chipTone(b.status)}`} />
            <span className="text-[10px] font-semibold text-white/70">{b.label}</span>
          </div>
        ))}
      </div>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
          Dettagli
        </summary>
        {!hasPerc ? (
          <div className="mt-2 text-[10px] text-white/45">Reference percentili non disponibili.</div>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-white/60">
          {bandData.map((b) => (
            <div key={b.key} className="flex items-center justify-between gap-2">
              <span className="text-white/70">{b.label}</span>
              <span className="text-white/50">
                {statusLabel(b.status)} {b.rangeLabel !== "n/a" ? `(${b.rangeLabel})` : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-white/45">Range riferimento: p10/p90.</div>
      </details>
    </div>
  );
}


function SpectrumCompareCard({
  track,
  reference,
  referenceName,
  spectral,
  referenceSpectralPercentiles,
  refState,
  embedded,
  height,
}: {
  track?: SpectrumPoint[] | null;
  reference?: SpectrumPoint[] | null;
  referenceName?: string | null;
  spectral?: AnalyzerCompareModel["spectral"] | null;
  referenceSpectralPercentiles?: AnalyzerCompareModel["referenceSpectralPercentiles"] | null;
  refState: RefState;
  embedded?: boolean;
  height?: number;
}) {
  const H = height ?? 180;
  const pad = useMemo(() => ({ l: 44, r: 10, t: 16, b: 26 }), []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [svgWidth, setSvgWidth] = React.useState(820);
  const [deltaMode, setDeltaMode] = React.useState(false);

  React.useEffect(() => {
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

  const hasRef = Array.isArray(reference) && reference.length > 0;
  const hasTrack = Array.isArray(track) && track.length > 0;

  const data = useMemo(() => {
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
  }, [track, reference]);

  const avgInRange = useCallback((key: "t" | "r" | "d", hzMin: number, hzMax: number) => {
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
  }, [data]);

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

  const xFromHz = useCallback((hz: number) => {
    const lo = Math.log10(20);
    const hi = Math.log10(20000);
    const v = clamp01((Math.log10(Math.max(20, Math.min(20000, hz))) - lo) / (hi - lo));
    return pad.l + v * (svgWidth - pad.l - pad.r);
  }, [pad, svgWidth]);

  const yFromVal = useCallback((v: number) => {
    const t = clamp01((v - domain.min) / (domain.max - domain.min));
    return pad.t + (1 - t) * (H - pad.t - pad.b);
  }, [H, domain.max, domain.min, pad]);

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

  const pathFrom = useCallback((key: "t" | "r" | "d") => {
    const pts = data
      .filter((p) => typeof (p as any)[key] === "number")
      .map((p) => ({ x: xFromHz(p.hz), y: yFromVal((p as any)[key] as number) }));
    return smoothPath(pts);
  }, [data, smoothPath, xFromHz, yFromVal]);

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

  const spectrumMetrics = [
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
          {summary && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`rounded-full border bg-black/20 px-2 py-1 ${summary.sub == null ? "border-white/10 text-white/60" : summary.sub >= 0 ? "border-emerald-400/25 text-emerald-200" : "border-rose-400/25 text-rose-200"}`}>
                Sub {summary.sub == null ? "n/a" : `${summary.sub >= 0 ? "+" : ""}${summary.sub.toFixed(1)} dB`}
              </span>
              <span className={`rounded-full border bg-black/20 px-2 py-1 ${summary.lowmid == null ? "border-white/10 text-white/60" : summary.lowmid >= 0 ? "border-emerald-400/25 text-emerald-200" : "border-rose-400/25 text-rose-200"}`}>
                LowMid {summary.lowmid == null ? "n/a" : `${summary.lowmid >= 0 ? "+" : ""}${summary.lowmid.toFixed(1)} dB`}
              </span>
              <span className={`rounded-full border bg-black/20 px-2 py-1 ${summary.high == null ? "border-white/10 text-white/60" : summary.high >= 0 ? "border-emerald-400/25 text-emerald-200" : "border-rose-400/25 text-rose-200"}`}>
                High {summary.high == null ? "n/a" : `${summary.high >= 0 ? "+" : ""}${summary.high.toFixed(1)} dB`}
              </span>
            </div>
          )}
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

          {!deltaMode && hasTrack && tPath ? <path d={tPath} fill="none" stroke="#34d399" strokeWidth={2.6} /> : null}
          {!deltaMode && hasRef && rPath ? <path d={rPath} fill="none" stroke="#3b82f6" strokeWidth={2.0} /> : null}

          {deltaMode && dPath ? (
            <path d={dPath} fill="none" stroke="rgba(236,72,153,0.9)" strokeWidth={2.4} />
          ) : null}

          {!hasTrack ? (
            <text x={(pad.l + (svgWidth - pad.r)) / 2} y={H / 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12">
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
            title={!hasRef || !hasTrack ? "Delta disponibile solo con Traccia e Reference" : "Mostra Traccia - Reference"}
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


function TimbreCard({
  model,
  tonalRefState,
  spectrumRefState,
}: {
  model: AnalyzerCompareModel;
  tonalRefState: RefState;
  spectrumRefState: RefState;
}) {
  const spectral = model.spectral ?? null;
  const refSpectral = model.referenceSpectralPercentiles ?? null;
  const hasLive = !!(model.bandsNorm && sumBands(model.bandsNorm) > 0) || (model.spectrumTrack?.length ?? 0) > 0;
  const hasRef = tonalRefState.ref || spectrumRefState.ref;
  const timbreRefState = getLiveStateForX(model, {
    hasLive,
    ref: hasRef,
    mockEnabled: false,
    reason: hasRef ? "Reference timbre disponibile" : model.referenceName ? "Reference timbre mancante" : "Nessun reference timbre",
  });

  const metrics = [
    {
      key: "centroid",
      label: "Centroid",
      value: spectral?.spectral_centroid_hz ?? null,
      unit: "Hz",
      ref: refSpectral?.spectral_centroid_hz ?? null,
      max: 8000,
      hintHigh: "alto: possibile harsh e hi-hat aggressivi",
      hintLow: "basso: mix chiuso, poco air",
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      value: spectral?.spectral_bandwidth_hz ?? null,
      unit: "Hz",
      ref: refSpectral?.spectral_bandwidth_hz ?? null,
      max: 6000,
      hintHigh: "ampio: piu complesso/ricco",
      hintLow: "stretto: mix concentrato",
    },
    {
      key: "rolloff",
      label: "Rolloff",
      value: spectral?.spectral_rolloff_hz ?? null,
      unit: "Hz",
      ref: refSpectral?.spectral_rolloff_hz ?? null,
      max: 12000,
      hintHigh: "alto: top-end brillante",
      hintLow: "basso: top-end chiuso",
    },
    {
      key: "flatness",
      label: "Flatness",
      value: spectral?.spectral_flatness ?? null,
      unit: "",
      ref: refSpectral?.spectral_flatness ?? null,
      max: 0.6,
      hintHigh: "alto: rumore o texture diffuse",
      hintLow: "basso: contenuto piu tonale",
    },
    {
      key: "zcr",
      label: "ZCR",
      value: spectral?.zero_crossing_rate ?? null,
      unit: "",
      ref: refSpectral?.zero_crossing_rate ?? null,
      max: 0.2,
      hintHigh: "alto: percussivo/ruvido",
      hintLow: "basso: piu morbido",
    },
  ];

  const rangeText = (p: any) =>
    p && (typeof p.p10 === "number" || typeof p.p90 === "number")
      ? `${typeof p.p10 === "number" ? p.p10.toFixed(2) : "n/a"} / ${typeof p.p90 === "number" ? p.p90.toFixed(2) : "n/a"}`
      : "no ref";

  const normalize = (value: number | null, p: any, fallbackMax: number) => {
    if (value == null || !Number.isFinite(value)) return 0;
    if (p && typeof p.p10 === "number" && typeof p.p90 === "number" && p.p90 > p.p10) {
      return clamp01((value - p.p10) / (p.p90 - p.p10));
    }
    return clamp01(value / fallbackMax);
  };

  return (
    <Card
      title="Timbre"
      subtitle="Tonal balance + spectrum + spectral stats"
      right={<SourcePills state={timbreRefState} />}
      className="h-full flex flex-col"
      bodyClassName="flex-1 overflow-auto"
    >
      <div className="space-y-4">
        <HorizontalTonalBalance
          trackBands={model.bandsNorm as any}
          referenceBands={model.referenceBandsNorm as any}
          referenceName={model.referenceName}
          referencePercentiles={(model as any).referenceBandsPercentiles ?? null}
          lang={(model as any).lang === "en" ? "en" : "it"}
          refState={tonalRefState}
          embedded
        />

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <SpectrumCompareCard
            track={model.spectrumTrack as any}
            reference={model.spectrumRef as any}
            referenceName={model.referenceName}
            refState={spectrumRefState}
            embedded
            height={140}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => {
            const val = typeof m.value === "number" && Number.isFinite(m.value) ? m.value : null;
            const pct = normalize(val, m.ref, m.max);
            const hint = (() => {
              if (val == null) return "n/a";
              if (m.ref && typeof m.ref.p10 === "number" && typeof m.ref.p90 === "number") {
                if (val > m.ref.p90) return m.hintHigh;
                if (val < m.ref.p10) return m.hintLow;
                return "in range";
              }
              return val > m.max * 0.7 ? m.hintHigh : val < m.max * 0.35 ? m.hintLow : "in range";
            })();
            return (
              <div key={m.key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">{m.label}</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {val == null ? "n/a" : `${m.key === "flatness" || m.key === "zcr" ? val.toFixed(3) : Math.round(val)}${m.unit ? ` ${m.unit}` : ""}`}
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${pct * 100}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-white/45">Ref p10/p90: {rangeText(m.ref)}</div>
                <div className="mt-1 text-[10px] text-white/55">{hint}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function CorrelationMeter({
  value,
  ref,
  height = 56,
}: {
  value: number | null;
  ref?: { p10?: number; p50?: number; p90?: number } | null;
  height?: number;
}) {
  const W = 520;
  const H = height;
  const pad = { l: 18, r: 18, t: 10, b: 18 };
  const innerW = W - pad.l - pad.r;
  const xFromVal = (v: number) => pad.l + ((v + 1) / 2) * innerW;
  const needle = typeof value === "number" && Number.isFinite(value) ? xFromVal(Math.max(-1, Math.min(1, value))) : null;
  const refBand =
    ref && typeof ref.p10 === "number" && typeof ref.p90 === "number"
      ? { left: xFromVal(ref.p10), right: xFromVal(ref.p90) }
      : null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between text-[11px] text-white/55">
        <span>Correlation meter</span>
        <span>{typeof value === "number" ? value.toFixed(2) : "n/a"}</span>
      </div>
      <div className="mt-2">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect x={pad.l} y={pad.t} width={innerW} height={16} fill="rgba(255,255,255,0.05)" rx={8} />
          <rect x={pad.l} y={pad.t} width={innerW / 2} height={16} fill="#dc2626" rx={8} />
          <rect x={pad.l + innerW / 2} y={pad.t} width={innerW / 2} height={16} fill="#22c55e" rx={8} />

          {refBand ? (
            <rect
              x={refBand.left}
              y={pad.t - 2}
              width={Math.max(2, refBand.right - refBand.left)}
              height={20}
              fill="rgba(59,130,246,0.22)"
            />
          ) : null}

          {needle != null ? (
            <line x1={needle} y1={pad.t - 4} x2={needle} y2={pad.t + 20} stroke="white" strokeWidth={2} />
          ) : null}

          {[-1, -0.5, 0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={xFromVal(v)} y1={pad.t + 20} x2={xFromVal(v)} y2={pad.t + 26} stroke="rgba(255,255,255,0.35)" />
              <text x={xFromVal(v)} y={H - 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10">
                {v > 0 ? `+${v}` : `${v}`}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-2 text-[10px] text-white/45">
        Rosso = anti-phase, verde = mono-safe. Fascia blu = reference p10-p90.
      </div>
    </div>
  );
}

function StereoScope({
  pointsXY,
  referenceXY,
  size = 320,
}: {
  pointsXY?: { x: number; y: number }[] | null;
  referenceXY?: { x: number; y: number }[] | null;
  size?: number;
}) {
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

function StereoCard({
  model,
  refState,
}: {
  model: AnalyzerCompareModel;
  refState: RefState;
}) {
  const widthVal = typeof model.stereoWidth === "number" ? model.stereoWidth : null;
  const widthRef = model.referenceStereoPercentiles?.stereoWidth ?? null;
  const corrRef = model.referenceStereoPercentiles?.lrCorrelation ?? null;
  const corrArr = Array.isArray(model.correlation) ? model.correlation.filter((x) => typeof x === "number") : [];
  const corrMean = corrArr.length ? corrArr.reduce((a, b) => a + b, 0) / corrArr.length : null;

  const rangeText = (p: any) =>
    p && (typeof p.p10 === "number" || typeof p.p90 === "number")
      ? `${typeof p.p10 === "number" ? p.p10.toFixed(2) : "n/a"} / ${typeof p.p90 === "number" ? p.p90.toFixed(2) : "n/a"}`
      : "no ref";

  return (
    <Card
      title="Stereo"
      subtitle="Width, correlation, width by band"
      right={
        <div className="flex items-center gap-2">
          <SourcePills state={refState} />
        </div>
      }
      className="h-full flex flex-col"
      bodyClassName="flex-1 overflow-auto"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Stereo width</div>
            <div className="mt-1 text-lg font-semibold text-white">{widthVal == null ? "n/a" : widthVal.toFixed(2)}</div>
            <div className="text-[10px] text-white/50">Ref p10/p90: {rangeText(widthRef)}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/60">Correlation</div>
            <div className="mt-1 text-lg font-semibold text-white">{corrMean == null ? "n/a" : corrMean.toFixed(2)}</div>
            <div className="text-[10px] text-white/50">Ref p10/p90: {rangeText(corrRef)}</div>
          </div>
        </div>

        <CorrelationMeter value={corrMean} ref={corrRef ?? null} />

        <StereoScope pointsXY={model.soundFieldXY ?? null} referenceXY={model.referenceSoundFieldXY ?? null} />

        {model.widthByBand ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55 mb-2">Width by band</div>
            <div className="grid grid-cols-2 gap-2">
              {BAND_ORDER.map((k) => {
                const v = (model.widthByBand as any)?.[k];
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

function ExtraCard({ extra }: { extra?: AnalyzerCompareModel["extra"] | null }) {
  const mfcc = Array.isArray(extra?.mfcc_mean) ? extra?.mfcc_mean.slice(0, 13) : [];
  const hfc = typeof extra?.hfc === "number" ? extra?.hfc : null;
  const peaksCount = typeof extra?.spectral_peaks_count === "number" ? extra?.spectral_peaks_count : null;
  const peaksEnergy = typeof extra?.spectral_peaks_energy === "number" ? extra?.spectral_peaks_energy : null;
  const hasAny = mfcc.length > 0 || hfc != null || peaksCount != null || peaksEnergy != null;
  const countPct = clamp01((peaksCount ?? 0) / 24);
  const energyPct = clamp01((peaksEnergy ?? 0) / 1.2);
  const mfccMin = mfcc.length ? Math.min(...mfcc) : 0;
  const mfccMax = mfcc.length ? Math.max(...mfcc) : 1;
  const mfccDenom = mfccMax - mfccMin || 1;
  const mfccBars = mfcc.map((v) => clamp01((v - mfccMin) / mfccDenom));

  return (
    <Card title="Extra" subtitle="MFCC, HFC, spectral peaks" className="h-full flex flex-col" bodyClassName="flex-1 overflow-auto">
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

function OverviewStrip({ model }: { model: AnalyzerCompareModel }) {
  const lufs = model.loudness?.integrated_lufs ?? null;
  const peak = model.loudness?.true_peak_db ?? model.loudness?.sample_peak_db ?? null;
  const lra = model.loudness?.lra ?? null;
  const width = typeof model.stereoWidth === "number" ? model.stereoWidth : null;
  const dance = model.rhythm?.danceability ?? null;
  const strength = typeof model.transients?.strength === "number" ? model.transients?.strength : null;

  const fmt = (v: number | null, unit: string) =>
    typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)}${unit}` : "n/a";

  const tiles = [
    { key: "lufs", label: "Integrated", value: fmt(lufs, " LUFS"), pct: lufs != null ? clamp01((lufs + 24) / 16) : 0, tone: "bg-emerald-400/70" },
    { key: "peak", label: "Peak", value: peak != null ? formatDb(peak, 1) : "n/a", pct: peak != null ? clamp01((peak + 12) / 12) : 0, tone: "bg-rose-400/70" },
    { key: "lra", label: "LRA", value: typeof lra === "number" ? `${lra.toFixed(1)} LU` : "n/a", pct: lra != null ? clamp01(lra / 16) : 0, tone: "bg-amber-300/70" },
    { key: "width", label: "Width", value: width != null ? width.toFixed(2) : "n/a", pct: width != null ? clamp01(width) : 0, tone: "bg-cyan-400/70" },
    { key: "dance", label: "Dance", value: dance != null ? dance.toFixed(2) : "n/a", pct: dance != null ? clamp01(dance / 2) : 0, tone: "bg-sky-400/70" },
    { key: "strength", label: "Strength", value: strength != null ? strength.toFixed(2) : "n/a", pct: strength != null ? clamp01(strength / 1.5) : 0, tone: "bg-violet-400/70" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.key} className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">{t.label}</div>
          <div className="mt-1 text-lg font-semibold text-white">{t.value}</div>
          <div className="mt-3 flex items-end gap-3">
            <div className="relative h-12 w-3 rounded-full bg-white/5">
              <div className={`absolute bottom-0 left-0 right-0 rounded-full ${t.tone}`} style={{ height: `${Math.max(8, t.pct * 100)}%` }} />
            </div>
            <div className="text-[10px] text-white/45">trend</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LevelsMetersCard({
  levels,
  referenceStereoPercentiles,
  refState,
}: {
  levels?: { label: "L" | "C" | "R" | "Ls" | "Rs" | "LFE"; rmsDb: number; peakDb: number }[] | null;
  referenceStereoPercentiles?: AnalyzerCompareModel["referenceStereoPercentiles"] | null;
  refState: RefState;
}) {
  const items = Array.isArray(levels) ? levels : [];

  const minDb = -60;
  const maxDb = 0;

  const toPct = (db: number) => {
    const v = clamp01((db - minDb) / (maxDb - minDb));
    return v * 100;
  };

  const L = items.find((x) => x.label === "L");
  const R = items.find((x) => x.label === "R");

  const lrBalance =
    typeof L?.rmsDb === "number" && typeof R?.rmsDb === "number" ? L.rmsDb - R.rmsDb : null;
  const lrDiff = lrBalance == null ? null : Math.abs(lrBalance);

  const peakMax = items.reduce((m, x) => (typeof x.peakDb === "number" ? Math.max(m, x.peakDb) : m), -Infinity);
  const peakMaxValue = Number.isFinite(peakMax) ? peakMax : null;

  const peakStatus = classifyPeak(peakMaxValue);
  const balanceStatus = classifyBalance(lrDiff);
  const overallOk = peakStatus.label === "OK" && balanceStatus.label === "OK";
  const badge = overallOk ? <Pill tone="ok">OK</Pill> : <Pill tone="high">ATTENZIONE</Pill>;

  const peakAction =
    peakStatus.delta == null
      ? "Lower limiter/output by n/a"
      : `Lower limiter/output by ${formatDb(peakStatus.delta)}`;

  const balanceReferenceRange = referenceStereoPercentiles?.lrBalanceDb;
  const hasBalanceRange =
    !!balanceReferenceRange &&
    (typeof balanceReferenceRange.p10 === "number" || typeof balanceReferenceRange.p90 === "number");
  const hasStrictBalanceRange =
    !!balanceReferenceRange &&
    typeof balanceReferenceRange.p10 === "number" &&
    typeof balanceReferenceRange.p90 === "number";
  const balanceReferenceText = hasBalanceRange
    ? `${formatDb(balanceReferenceRange?.p10)} ↔ ${formatDb(balanceReferenceRange?.p90)}`
    : "n/a";
  const balanceWithinReference =
    hasStrictBalanceRange &&
    lrBalance != null &&
    lrBalance >= balanceReferenceRange!.p10! &&
    lrBalance <= balanceReferenceRange!.p90!;
  const referenceRangeMissing = !hasBalanceRange;
  const balanceReferenceFooter = hasStrictBalanceRange
    ? balanceWithinReference
      ? "Within reference stereo range"
      : "Outside reference stereo range"
    : referenceRangeMissing
      ? "Reference stereo data unavailable"
      : "Reference stereo range incomplete";

  return (
    <Card
      title="Levels"
      subtitle="Livello medio (RMS) e picco massimo (Peak) per canale"
      right={
        <div className="flex items-center gap-3">
          <SourcePills state={refState} />
          {badge}
        </div>
      }
    >
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="grid grid-cols-6 gap-3">
          {items.map((ch) => {
            const rmsPct = toPct(ch.rmsDb);
            const peakPct = toPct(ch.peakDb);

            return (
              <div key={ch.label} className="flex flex-col items-center gap-2">
                <div className="relative h-36 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/6">
                  <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{ height: `${rmsPct}%`, background: "rgba(255,255,255,0.16)" }}
                  />
                  <div
                    className="absolute left-0 right-0 h-[2px]"
                    style={{ bottom: `${peakPct}%`, background: "rgba(52,211,153,0.85)" }}
                  />
                </div>

                <div className="text-[11px] font-semibold text-white/70">{ch.label}</div>
                <div className="text-[9px] text-white/50">RMS {Math.round(ch.rmsDb)} dB</div>
                <div className="text-[8px] text-white/40">Average level</div>
                <div className="text-[10px] text-white/45">Peak {Math.round(ch.peakDb)} dB</div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-white/55">Bilanciamento L/R</div>
              <StatusChip tone={balanceStatus.tone}>{balanceStatus.label}</StatusChip>
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {lrDiff == null ? "n/a" : formatDb(lrDiff)}
            </div>
            <div className="text-[11px] text-white/60">What it means: Stereo center bias</div>
            <div className="text-[11px] text-white/60">What to do: Check panning, mono bass, stereo imager</div>
            <div className="text-[11px] text-white/60">Reference range: {balanceReferenceText}</div>
            <div className="text-[11px] text-white/55">{balanceReferenceFooter}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-white/55">Peak max</div>
              <StatusChip tone={peakStatus.tone}>{peakStatus.label}</StatusChip>
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {peakMaxValue == null ? "n/a" : formatDb(peakMaxValue)}
            </div>
            <div className="text-[11px] text-white/60">What it means: Headroom for mastering/club</div>
            <div className="text-[11px] text-white/60">What to do: {peakAction}</div>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-white/45">
          Scala: {minDb} dB to {maxDb} dB. Peak è la linea verde.
        </div>
      </div>
    </Card>
  );
}


// ---------- checks + advice ----------
function deriveChecks(model: AnalyzerCompareModel) {
  const peak = model.loudness?.sample_peak_db ?? null;
  const lufs = model.loudness?.integrated_lufs ?? null;
  const lra = model.loudness?.lra ?? null;
  const flat = model.spectral?.spectral_flatness ?? null;
  const zcr = model.spectral?.zero_crossing_rate ?? null;
  const centroid = model.spectral?.spectral_centroid_hz ?? null;

  const clippingRisk = typeof peak === "number" ? peak > -1.0 : false;
  const loudnessHot = typeof lufs === "number" ? lufs > -8.5 : false;
  const overCompressed = typeof lra === "number" ? lra < 6.0 : false;

  const noiseRisk = typeof flat === "number" ? flat > 0.18 : false;
  const whistleRisk = typeof centroid === "number" && typeof zcr === "number" ? centroid > 4200 && zcr > 0.08 : false;

  const widthVal = typeof model.stereoWidth === "number" ? model.stereoWidth : null;
  const tooNarrow = typeof widthVal === "number" ? widthVal < 0.28 : false;

  return {
    clippingRisk,
    loudnessHot,
    overCompressed,
    noiseRisk,
    whistleRisk,
    tooNarrow,
  };
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />;
}

function SmallStatus({ label, ok, note }: { label: string; ok: boolean; note: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div>
        <div className="flex items-center gap-2">
          <StatusDot ok={ok} />
          <div className="text-sm font-semibold text-white">{label}</div>
        </div>
        <div className="mt-1 text-xs text-white/55">{note}</div>
      </div>
      <Pill tone={ok ? "ok" : "high"}>{ok ? "OK" : "ATTENZIONE"}</Pill>
    </div>
  );
}

function HealthChecks({ model }: { model: AnalyzerCompareModel }) {
  const c = useMemo(() => deriveChecks(model), [model]);

  return (
    <Card
      title="Checks"
      subtitle="Semafori rapidi. In prod li agganciamo a metriche reali e reference models"
      right={<Pill tone={model.referenceName ? "ok" : "muted"}>{model.referenceName ? "REF" : "NO REF"}</Pill>}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <SmallStatus
          label="Clipping"
          ok={!c.clippingRisk}
          note={c.clippingRisk ? "Peak troppo vicino a 0 dB. Rischio distorsione." : "Peak sotto controllo."}
        />
        <SmallStatus
          label="Loudness hot"
          ok={!c.loudnessHot}
          note={c.loudnessHot ? "LUFS molto alto. Possibile schiacciamento." : "LUFS in zona gestibile."}
        />
        <SmallStatus
          label="Over-compression"
          ok={!c.overCompressed}
          note={c.overCompressed ? "LRA bassa. Potrebbe essere troppo compresso." : "Dinamica ok per club."}
        />
        <SmallStatus
          label="Noise floor"
          ok={!c.noiseRisk}
          note={c.noiseRisk ? "Flatness alta: possibile rumore diffuso o mix sporco." : "Rumore non evidente (proxy)."}
        />
        <SmallStatus
          label="Fischi / harshness"
          ok={!c.whistleRisk}
          note={c.whistleRisk ? "Zona alta aggressiva: controlla 6-12k e resonanze." : "Harshness non evidente (proxy)."}
        />
        <SmallStatus
          label="Stereo width"
          ok={!c.tooNarrow}
          note={c.tooNarrow ? "Sound field stretto: valuta widening controllato." : "Stereo non troppo stretto."}
        />
      </div>

      <div className="mt-3 text-xs text-white/45">
        Nota: questi check sono euristiche di preview. Non posso confermare questo finché non usiamo misure dedicate.
      </div>
    </Card>
  );
}

function QuickFacts({ model }: { model: AnalyzerCompareModel }) {
  const centroid = model.spectral?.spectral_centroid_hz ?? null;
  const bw = model.spectral?.spectral_bandwidth_hz ?? null;
  const zcr = model.spectral?.zero_crossing_rate ?? null;
  const lra = model.loudness?.lra ?? null;

  const formatHz = (value: number | null | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? `${fmt0(value)} Hz` : "n/a";

  const lraChip = (() => {
    if (typeof lra !== "number" || !Number.isFinite(lra)) return undefined;
    if (lra < 4) return { label: "Compressed", tone: "low" as StatusTone };
    if (lra <= 10) return { label: "Balanced", tone: "ok" as StatusTone };
    return { label: "Too dynamic", tone: "high" as StatusTone };
  })();

  const lraAction =
    lraChip?.label === "Compressed"
      ? "Loosen limiting and let more dynamic detail through."
      : lraChip?.label === "Too dynamic"
      ? "Tame peaks with gentle compression or automation."
      : "Keep an eye on transitions with subtle automation or parallel compression.";

const quickFacts: Array<{
  key: string;
  label: string;
  value: React.ReactNode;
  meaning: string;
  action: string;
  chip?: MetricChip;
  note?: string;
  graph?: MetricGraph;
  }> = [
    {
      key: "centroid",
      label: "Centroid",
      value: formatHz(centroid),
      chip: { label: "INFO", tone: "muted" },
      meaning: "Centro di gravità dello spettro: valori più alti possono suonare più brillanti.",
      action: "Usa EQ tonale o bilanciamenti strumentali per allineare la brillantezza al mood desiderato.",
      graph: {
        label: "0-6k Hz",
        value: centroid,
        max: 6000,
        accent: "bg-gradient-to-r from-sky-400 to-blue-500",
      },
    },
    {
      key: "bandwidth",
      label: "Bandwidth",
      value: formatHz(bw),
      chip: { label: "INFO", tone: "muted" },
      meaning: "Ampiezza dell'energia intorno al centroid; più ampia = corpo più largo.",
      action: "Allarga o restringi layer e filtri per cambiare la sensazione di spazio.",
      graph: {
        label: "0-5k Hz",
        value: bw,
        max: 5000,
        accent: "bg-gradient-to-r from-indigo-400 to-purple-500",
      },
    },
    {
      key: "zcr",
      label: "ZCR",
      value: fmt1(zcr),
      chip: { label: "INFO", tone: "muted" },
      meaning: "Frequenza di attraversamento dello zero: suggerisce percussività o rumorosità.",
      action: "Leviga con gating o transient shaper per evitare frizzantiature indesiderate.",
      graph: {
        label: "0-0.2",
        value: zcr,
        max: 0.2,
        accent: "bg-gradient-to-r from-fuchsia-400 to-rose-500",
      },
    },
    {
      key: "lra",
      label: "LRA",
      value: fmt1(lra),
      chip: lraChip,
      meaning: "Range di loudness: indica quanto variano le parti quiet e forti.",
      action: lraAction,
      note: "Heuristic thresholds per guidare il bilanciamento dinamico.",
      graph: {
        label: "0-16",
        value: lra,
        max: 16,
        accent: "bg-gradient-to-r from-emerald-400 to-lime-400",
      },
    },
  ];

  return (
    <Card title="Quick facts" subtitle="Spectral e loudness (dal tuo analyzer_json)">
      <div className="grid grid-cols-2 gap-3">
        {quickFacts.map(({ key: metricKey, ...rest }) => (
          <MetricRow key={metricKey} {...rest} />
        ))}
      </div>
    </Card>
  );
}

function makeTransientSignaturePath({
  height,
  width,
  pulses,
  amp,
  attack,
}: {
  height: number;
  width: number;
  pulses: number;
  amp: number;
  attack: number;
}) {
  const total = 240;
  const decay = 6.5;
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < total; i++) {
    const t = i / (total - 1);
    const local = (t * pulses) % 1;
    let v = 0;
    if (local < attack) {
      v = local / attack;
    } else {
      v = Math.exp(-(local - attack) * decay);
    }
    const y = height - v * amp * height;
    points.push({ x: t * width, y });
  }
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

function TransientSignature({
  strengthValue,
  densityValue,
  attackValue,
}: {
  strengthValue: number | null;
  densityValue: number | null;
  attackValue: number | null;
}) {
  const W = 520;
  const H = 120;
  const pulses = Math.min(8, Math.max(2, Math.round(densityValue ?? 4)));
  const hitsPerMin = typeof densityValue === "number" ? Math.round(densityValue * 60) : null;
  const attack = Math.min(0.35, Math.max(0.06, (attackValue ?? 0.02) * 2));
  const amp = Math.min(0.95, Math.max(0.35, (strengthValue ?? 1) / 4));

  const topPath = makeTransientSignaturePath({ height: H - 10, width: W, pulses, amp, attack });
  const lowPath = makeTransientSignaturePath({ height: H - 10, width: W, pulses, amp: amp * 0.55, attack: attack * 1.4 });

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between text-[11px] text-white/55">
        <span>Transient signature</span>
        <span>{hitsPerMin != null ? `${hitsPerMin} hits/min` : "n/a"}</span>
      </div>
      <div className="mt-2">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect x={0} y={0} width={W} height={H} fill="rgba(255,255,255,0.02)" />
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={i} x1={(W / 5) * i} y1={6} x2={(W / 5) * i} y2={H - 6} stroke="rgba(255,255,255,0.05)" />
          ))}
          <path d={topPath} fill="none" stroke="#eab308" strokeWidth={2.2} />
          <path d={lowPath} fill="none" stroke="#a855f7" strokeWidth={2} />
          <text x={W - 6} y={H - 6} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10">
            time (sec)
          </text>
          <text x={6} y={H - 6} textAnchor="start" fill="rgba(255,255,255,0.3)" fontSize="10">
            0s
          </text>
          <text
            x={6}
            y={12}
            textAnchor="start"
            fill="rgba(255,255,255,0.35)"
            fontSize="10"
            transform={`rotate(-90 6 12)`}
          >
            amp / hits/min
          </text>
        </svg>
      </div>
      <div className="mt-2 text-[10px] text-white/45">
        Giallo = attacco, viola = sustain. Grafico sintetico basato su strength, density e attack time.
      </div>
    </div>
  );
}

function TransientsCard({
  transients,
  referencePercentiles,
  referenceName,
  fixSuggestions,
}: {
  transients?: { strength?: number | null; density?: number | null; crestFactorDb?: number | null; log_attack_time?: number | null } | null;
  referencePercentiles?: AnalyzerCompareModel["referenceTransientsPercentiles"] | null;
  referenceName?: string | null;
  fixSuggestions?: string[] | null;
}) {
  if (!transients) {
    return (
      <Card title="Transients" subtitle="Impatto e densita">
        <div className="text-sm text-white/65">Dati transients non disponibili.</div>
      </Card>
    );
  }

  const strength =
    typeof (transients as any).strength === "number"
      ? (transients as any).strength
      : typeof (transients as any).transient_strength === "number"
        ? (transients as any).transient_strength
        : null;

  const density =
    typeof (transients as any).density === "number"
      ? (transients as any).density
      : typeof (transients as any).transient_density === "number"
        ? (transients as any).transient_density
        : null;

  const crest =
    typeof (transients as any).crestFactorDb === "number"
      ? (transients as any).crestFactorDb
      : typeof (transients as any).crest_factor_db === "number"
        ? (transients as any).crest_factor_db
        : null;

  const hasStrength = typeof strength === "number" && Number.isFinite(strength);
  const hasDensity = typeof density === "number" && Number.isFinite(density);

  const crestClassification = (() => {
    if (crest == null) return null;
    if (crest < 10) return { label: "Soft / flattened", tone: "low" as StatusTone };
    if (crest <= 18) return { label: "Balanced", tone: "ok" as StatusTone };
    return { label: "Spiky", tone: "high" as StatusTone };
  })();

  const ref = referencePercentiles ?? null;

  const logAttack =
    typeof (transients as any).logAttackTime === "number"
      ? (transients as any).logAttackTime
      : typeof (transients as any).log_attack_time === "number"
      ? (transients as any).log_attack_time
      : null;

  const attackSeconds =
    typeof logAttack === "number" && Number.isFinite(logAttack) ? Math.pow(10, logAttack) : null;

  const actionFallback = (() => {
    const hints: string[] = [];
    if (crest != null && crest < 10) hints.push("Riduci limiting e recupera attacco con transient shaper.");
    if (density != null && density > 10) hints.push("Semplifica layering o accorcia code per piu spazio.");
    if (strength != null && strength < 0.5) hints.push("Aumenta contrasto attacco/sustain con comp o shaper.");
    return hints.length ? hints.slice(0, 3) : ["Ascolta per coerenza: usa transient shaper solo dove serve."];
  })();

  const actions = Array.isArray(fixSuggestions) && fixSuggestions.length ? fixSuggestions.slice(0, 3) : actionFallback;

  const targetBar = ({
    label,
    value,
    unit,
    refPct,
    max,
    meaning,
  }: {
    label: string;
    value: number | null;
    unit: string;
    refPct: { p10?: number; p90?: number } | null | undefined;
    max: number;
    meaning: string;
  }) => {
    const domainMin = typeof refPct?.p10 === "number" ? refPct.p10 : 0;
    const domainMax = typeof refPct?.p90 === "number" ? refPct.p90 : max;
    const denom = domainMax - domainMin || 1;
    const refLeft = typeof refPct?.p10 === "number" ? clamp01((refPct.p10 - domainMin) / denom) : null;
    const refRight = typeof refPct?.p90 === "number" ? clamp01((refPct.p90 - domainMin) / denom) : null;
    const marker = typeof value === "number" ? clamp01((value - domainMin) / denom) : null;

    const refText =
      refPct && (typeof refPct.p10 === "number" || typeof refPct.p90 === "number")
        ? `Ref p10/p90: ${typeof refPct.p10 === "number" ? refPct.p10.toFixed(2) : "n/a"} / ${typeof refPct.p90 === "number" ? refPct.p90.toFixed(2) : "n/a"}`
        : "Ref p10/p90: n/a";

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>{label}</span>
          <span>{value == null ? "n/a" : `${value.toFixed(2)}${unit}`}</span>
        </div>
        <div className="relative h-3 w-full rounded-full bg-white/5">
          {refLeft != null && refRight != null ? (
            <div
              className="absolute inset-y-0 rounded-full bg-blue-500/25"
              style={{ left: `${refLeft * 100}%`, width: `${Math.max(2, (refRight - refLeft) * 100)}%` }}
            />
          ) : null}
          {marker != null ? (
            <div className="absolute inset-y-0 w-0.5 bg-emerald-300" style={{ left: `${marker * 100}%` }} />
          ) : null}
        </div>
        <div className="text-[10px] text-white/40">{refText}</div>
        <div className="text-[10px] text-white/40">
          <span className="font-semibold">Meaning:</span> {meaning}
        </div>
      </div>
    );
  };

  return (
    <Card title="Transients" subtitle="Impatto e densita" className="h-full flex flex-col" bodyClassName="flex-1 overflow-auto">
      <div className="space-y-3 text-white/70">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {targetBar({
            label: "Strength",
            value: hasStrength ? strength : null,
            unit: "",
            refPct: ref?.strength ?? null,
            max: 8,
            meaning: "Impact vs sustain: quanto emergono i transienti rispetto al sustain.",
          })}
          {targetBar({
            label: "Density",
            value: hasDensity ? density : null,
            unit: " 1/s",
            refPct: ref?.density ?? null,
            max: 16,
            meaning: "Hit per secondo: traccia quanto e ritmico il contenuto.",
          })}
          {targetBar({
            label: "Crest",
            value: crest,
            unit: " dB",
            refPct: ref?.crest_factor_db ?? null,
            max: 24,
            meaning: crestClassification?.label ?? "Peak/RMS ratio",
          })}
          {targetBar({
            label: "Attack time",
            value: attackSeconds,
            unit: " s",
            refPct: ref?.log_attack_time
              ? {
                  p10: typeof ref.log_attack_time.p10 === "number" ? Math.pow(10, ref.log_attack_time.p10) : undefined,
                  p90: typeof ref.log_attack_time.p90 === "number" ? Math.pow(10, ref.log_attack_time.p90) : undefined,
                }
              : null,
            max: 0.12,
            meaning: "Tempo stimato: un attacco troppo breve può sembrare impastato.",
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-white/55">
            <span>Reference</span>
            <span>{referenceName ?? "no ref"}</span>
          </div>
          <TransientSignature strengthValue={strength} densityValue={density} attackValue={attackSeconds} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">What to do next</div>
          <div className="mt-1 space-y-1 text-[11px]">
            {actions.map((hint, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-white/60">-</span>
                <span>{hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function HumanAdvice({ model }: { model: AnalyzerCompareModel }) {
    
  const seed = useMemo(() => hashSeed(`${model.projectTitle}|${model.versionName}|${model.referenceName ?? ""}`), [model]);
  const c = useMemo(() => deriveChecks(model), [model]);

  const tips = useMemo(() => {
    const out: string[] = [];

    const lufs = model.loudness?.integrated_lufs ?? null;
    const centroid = model.spectral?.spectral_centroid_hz ?? null;
    const zcr = model.spectral?.zero_crossing_rate ?? null;

    const base = [
      "Se vuoi che la traccia respiri, lascia micro-spazi tra kick e sub, non solo sidechain pesante.",
      "Prima di toccare EQ a caso: trova la frequenza che ti dà fastidio e taglia stretto, poi allarga se serve.",
      "Se il drop sembra piccolo: non serve più volume, serve contrasto (intro più low, drop più wide e bright).",
      "Se il master ti sembra spento: controlla prima il bilanciamento lowmid, non alzare solo high shelf.",
    ];

    const loud = [
      "LUFS alto: prova -0.8 dB di input sul limiter e recupera impatto con transient shaper sul buss drums.",
      "Se vuoi loud senza schiacciare: clipper leggero sul kick buss, limiter più rilassato sul master.",
      "Occhio al pumping non voluto: controlla release del limiter, non solo threshold.",
    ];

    const harsh = [
      "Zona 7-10k: cerca resonanze in hat e ride. Una dynamic EQ lì vale più di 2 dB di shelf.",
      "Se senti fischio: sweep con EQ stretto in solo, poi dynamic in mix. Non tagliare tutto l'air.",
      "Se il top ti stanca: riduci saturazione sul bus high e usa un de-esser leggero sui gruppi.",
    ];

    const noise = [
      "Se c'è rumore: controlla riverberi e delay. High-pass sui return e gate leggero spesso basta.",
      "Noise floor alto: verifica resampling e dithering. Alcuni sample pack sono già sporchi.",
      "Se il mix è fuzzy: meno saturazione globale, più saturazione mirata (kick, bass, synth lead).",
    ];

    const stereo = [
      "Se lo stereo è stretto: widening solo sopra 200-300Hz, lascia mono il sub.",
      "Se vuoi wide senza fase: usa mid/side EQ, non un widening aggressivo.",
      "Per traduzione club: mono compatibilità prima, width dopo.",
    ];

const first = pick(base, seed, 0);
if (first) out.push(first);


    if (c.loudnessHot || c.overCompressed || (typeof lufs === "number" && lufs > -9.5)) {
      const t = pick(loud, seed, 1);
      if (t) out.push(t);
    }
    if (c.whistleRisk || (typeof centroid === "number" && typeof zcr === "number" && centroid > 3800 && zcr > 0.07)) {
      const t = pick(harsh, seed, 2);
      if (t) out.push(t);
    }
    if (c.noiseRisk) {
      const t = pick(noise, seed, 3);
      if (t) out.push(t);
    }
    if (c.tooNarrow) {
      const t = pick(stereo, seed, 4);
      if (t) out.push(t);
    }

    return out.slice(0, 4);
  }, [model, seed, c]);

  return (
    <Card title="Consigli (umani)" subtitle="Cambiano in base ai segnali, ma restano utili">
      <div className="space-y-2">
        {tips.map((t, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
            {t}
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-white/45">
        In prod: possiamo mischiare consigli generati + consigli editoriali a rotazione, salvati per profilo.
      </div>
    </Card>
  );
}

function WhyThisScore({ model }: { model: AnalyzerCompareModel }) {
  const centroid = model.spectral?.spectral_centroid_hz ?? null;
  const zcr = model.spectral?.zero_crossing_rate ?? null;
  const lra = model.loudness?.lra ?? null;

  const bullets = useMemo(() => {
    const out: string[] = [];
    if (typeof centroid === "number") {
      if (centroid < 2500) out.push("Brightness scura: vibe underground");
      else if (centroid <= 4000) out.push("Brightness bilanciata");
      else out.push("Brightness alta: occhio a harshness");
    }
    if (typeof zcr === "number") {
      if (zcr < 0.04) out.push("Transienti morbidi");
      else if (zcr <= 0.08) out.push("Transienti controllati");
      else out.push("Transienti aggressivi: rischio affaticamento");
    }
    if (typeof lra === "number") {
      if (lra < 6) out.push("Dinamica molto compressa");
      else if (lra <= 12) out.push("Dinamica club-friendly");
      else out.push("Dinamica ampia: attenzione ai salti in club");
    }
    return out.slice(0, 3);
  }, [centroid, zcr, lra]);

  const interventions = useMemo(() => {
    const c = deriveChecks(model);
    const out: string[] = [];

    if (c.clippingRisk) out.push("Abbassa output o ceiling true-peak e ricontrolla sample peak.");
    if (c.loudnessHot) out.push("Rilassa limiter: meno gain reduction continua, più controllo a monte (clipper o buss comp).");
    if (c.overCompressed) out.push("Recupera micro-dinamica: attacco più lento su buss comp, oppure parallel leggero.");
    if (c.whistleRisk) out.push("Hunt di resonanze 6-12k con dynamic EQ, poi rifinisci con shelf leggero.");
    if (c.noiseRisk) out.push("Pulizia: high-pass su return e sulle texture, verifica rumori nei sample.");
    if (c.tooNarrow) out.push("Width solo sopra 250Hz, sub mono. Controlla mono compat.");

    if (!out.length) out.push("Nessuna red flag grossa. Passa al fine-tuning vs reference (bande e top-end).");
    return out.slice(0, 5);
  }, [model]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Why this score" subtitle="3 righe secche">
        <ul className="list-disc space-y-2 pl-5 text-sm text-white/70">
          {bullets.length ? bullets.map((b, i) => <li key={i}>{b}</li>) : <li>Dati insufficienti</li>}
        </ul>
      </Card>

      <Card title="Interventi suggeriti" subtitle="Cosa toccherei adesso, in ordine">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-white/70">
          {interventions.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

export default function AnalyzerV2ProPanel({
  model,
  onPlay,
  onShare,
  reanalyze,
  track,
}: {
  model: AnalyzerCompareModel;
  onPlay?: () => void;
  onShare?: () => void;
  reanalyze?: {
    isLoading: boolean;
    canRun: boolean;
    onRun: () => void;
    status?: "idle" | "running" | "success" | "error";
    message?: string | null;
  };
  track?: {
    versionId: string;
    projectId?: string | null;
    title: string;
    subtitle?: string;
    audioUrl?: string | null;
    waveformPeaks?: number[] | null;
    waveformBands?: any | null;
    waveformDuration?: number | null;
    createdAt?: string | null;
    isPlaying?: boolean;
  };
}) {
  const player = useTekkinPlayer();
  const currentVersionId = useTekkinPlayer((state) => state.versionId);
  const isPlaying = useTekkinPlayer((state) => state.isPlaying);
  const currentTime = useTekkinPlayer((state) => state.currentTime);
  const duration = useTekkinPlayer((state) => state.duration);

  const isActive = !!track?.versionId && currentVersionId === track.versionId;
  const progressRatio = isActive && duration > 0 ? currentTime / duration : 0;
  const timeLabel = (() => {
    if (!isActive || !duration || !Number.isFinite(duration)) return "--:--";
    const m = Math.floor(currentTime / 60);
    const s = Math.floor(currentTime % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  const playPayload =
    track?.audioUrl && track.versionId
      ? {
          projectId: track.projectId ?? null,
          versionId: track.versionId,
          title: track.title ?? "Untitled",
          subtitle: track.subtitle ?? undefined,
          audioUrl: track.audioUrl,
          duration: track.waveformDuration ?? undefined,
        }
      : null;

  const handleTogglePlay = () => {
    if (!playPayload) return;
    if (isActive) {
      useTekkinPlayer.getState().toggle();
      return;
    }
    player.play(playPayload);
  };

  const handleSeekRatio = (ratio: number) => {
    if (!playPayload) return;
    if (isActive) {
      player.seekToRatio(ratio);
      return;
    }
    player.playAtRatio(playPayload, ratio);
  };

  const handlePlay = onPlay ?? handleTogglePlay;
  const [activeTab, setActiveTab] = useState<
    "overview" | "tonal" | "loudness" | "spectral" | "stereo" | "transients" | "rhythm" | "extra"
  >("overview");
  const [expandedCard, setExpandedCard] = useState<ExpandableCardKey | null>(null);

  const closeExpandedCard = useCallback(() => setExpandedCard(null), []);

  useEffect(() => {
    if (!expandedCard) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expandedCard]);

  useEffect(() => {
    if (!expandedCard) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeExpandedCard();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedCard, closeExpandedCard]);


  const live = useMemo(
    () => ({
      spectrumTrack: Array.isArray(model.spectrumTrack) && model.spectrumTrack.length > 0,
      spectrumRef: Array.isArray(model.spectrumRef) && model.spectrumRef.length > 0,
      soundField: Array.isArray(model.soundFieldXY) && model.soundFieldXY.length > 0,
      levels: Array.isArray(model.levels) && model.levels.length > 0,
    }),
    [model.spectrumTrack, model.spectrumRef, model.soundFieldXY, model.levels]
  );

  const rhythmLive = useMemo(() => {
    const rhythm = model?.rhythm ?? null;
    const hasLive = !!(
      typeof model?.bpm === "number" ||
      (typeof model?.key === "string" && model.key.trim().length > 0) ||
      typeof rhythm?.danceability === "number" ||
      (Array.isArray(rhythm?.beat_times) && rhythm.beat_times.length > 0) ||
      (rhythm?.descriptors && Object.keys(rhythm.descriptors).length > 0)
    );
    return {
      bpm: model?.bpm ?? null,
      keyName: model?.key ?? null,
      rhythm,
      hasLive,
    };
  }, [model]);

  const rhythmRefState = useMemo(() => {
    const hasRef = !!(model?.referenceRhythmPercentiles || model?.referenceRhythmDescriptorsPercentiles);
    const base = getLiveStateForX(model, {
      hasLive: rhythmLive.hasLive,
      ref: hasRef,
      reason: hasRef
        ? "Reference rhythm percentiles available"
        : model?.referenceName
        ? "Reference rhythm percentiles missing"
        : "No reference rhythm",
    });
    return { ...base, rangeLabel: "p10/p90" };
  }, [model, rhythmLive.hasLive]);



  const tonalRefState = useMemo(() => getRefStateForTonal(model), [model]);
  const spectrumRefState = useMemo(() => getRefStateForSpectrum(model, { mockEnabled: false }), [model]);
  const loudnessRefState = useMemo(() => getRefStateForLoudness(model), [model]);
  const soundFieldRefState = useMemo(() => {
  const hasRef = !!(
    (model.referenceStereoPercentiles &&
      (model.referenceStereoPercentiles.stereoWidth || model.referenceStereoPercentiles.lrCorrelation)) ||
    model.referenceSoundField ||
    model.referenceSoundFieldXY
  );

  return getLiveStateForX(model, {
    hasLive: live.soundField,
    ref: hasRef,
    mockEnabled: false,
    reason: hasRef ? "Stereo reference disponibile" : model.referenceName ? "Reference stereo mancante" : "Nessun reference stereo",
  });
}, [model, live.soundField]);

const merged: AnalyzerCompareModel = useMemo(() => {
  // Definitivo: niente dati inventati.
  // Se mancano, la UI mostra "no data" o "n/a".
  return { ...model };
}, [model]);

  const overviewCorrMean = useMemo(() => {
    const corrArr = Array.isArray(merged.correlation)
      ? merged.correlation.filter((x) => typeof x === "number" && Number.isFinite(x))
      : [];
    return corrArr.length ? corrArr.reduce((a, b) => a + b, 0) / corrArr.length : null;
  }, [merged.correlation]);

  const overviewStrength =
    typeof (merged as any).transients?.strength === "number"
      ? (merged as any).transients.strength
      : typeof (merged as any).transients?.transient_strength === "number"
        ? (merged as any).transients.transient_strength
        : null;

  const overviewDensity =
    typeof (merged as any).transients?.density === "number"
      ? (merged as any).transients.density
      : typeof (merged as any).transients?.transient_density === "number"
        ? (merged as any).transients.transient_density
        : null;

  const overviewAttackSeconds = (() => {
    const logAttack =
      typeof (merged as any).transients?.logAttackTime === "number"
        ? (merged as any).transients.logAttackTime
        : typeof (merged as any).transients?.log_attack_time === "number"
          ? (merged as any).transients.log_attack_time
          : null;
    return typeof logAttack === "number" && Number.isFinite(logAttack) ? Math.pow(10, logAttack) : null;
  })();

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-[1400px] px-0 pb-20 pt-8 lg:px-2 xl:px-4">
        <AnalyzerHero
          model={merged}
          onPlay={handlePlay}
          onShare={onShare}
          reanalyze={reanalyze}
          lastAnalyzedAt={track?.createdAt ?? null}
          waveform={
            track?.waveformPeaks
              ? {
                  peaks: track.waveformPeaks ?? null,
                  bands: track.waveformBands ?? null,
                  duration: track.waveformDuration ?? null,
                  progressRatio,
                  isPlaying: isActive && isPlaying,
                  timeLabel,
                  onTogglePlay: handleTogglePlay,
                  onSeekRatio: handleSeekRatio,
                }
              : undefined
          }
        />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {[
            { key: "overview", label: "Overview" },
            { key: "tonal", label: "Tonal balance" },
            { key: "loudness", label: "Loudness" },
            { key: "spectral", label: "Spettro" },
            { key: "transients", label: "Transients" },
            { key: "rhythm", label: "Rhythm" },
            { key: "stereo", label: "Stereo" },
            { key: "extra", label: "Extra" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeTab === tab.key
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "overview" ? (
            <div className="space-y-4">
              <OverviewStrip model={merged} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
                <ExpandableCard
                  id="tekkin-rank"
                  label="Tekkin Rank"
                  expandedCard={expandedCard}
                  onExpand={setExpandedCard}
                  onClose={closeExpandedCard}
                >
                  <TekkinRankExplanationCard
                    rank={merged.tekkinRank ?? null}
                    referenceName={merged.referenceName}
                    suggestedReferenceKey={merged.suggestedReferenceKey ?? null}
                    suggestedReferenceMatch={merged.suggestedReferenceMatch ?? null}
                    suggestedReferenceDelta={merged.suggestedReferenceDelta ?? null}
                  />
                </ExpandableCard>

                <ExpandableCard
                  id="tonal-snapshot"
                  label="Tonal overview"
                  expandedCard={expandedCard}
                  onExpand={setExpandedCard}
                  onClose={closeExpandedCard}
                >
                  <Card title="Tonal overview" subtitle="Bilanciamento bande (reference)" className="h-full">
                    <TonalSnapshotCompact
                      trackBands={merged.bandsNorm as any}
                      referencePercentiles={(merged as any).referenceBandsPercentiles ?? null}
                    />
                  </Card>
                </ExpandableCard>

                <ExpandableCard
                  id="stereo-snapshot"
                  label="Stereo snapshot"
                  expandedCard={expandedCard}
                  onExpand={setExpandedCard}
                  onClose={closeExpandedCard}
                >
                  <Card title="Stereo snapshot" subtitle="Correlation + field" className="h-full">
                    <div className="space-y-3">
                      <CorrelationMeter value={overviewCorrMean} ref={merged.referenceStereoPercentiles?.lrCorrelation ?? null} />
                      <StereoScope pointsXY={merged.soundFieldXY ?? null} referenceXY={merged.referenceSoundFieldXY ?? null} />
                    </div>
                  </Card>
                </ExpandableCard>

                <ExpandableCard
                  id="transient-snapshot"
                  label="Transient snapshot"
                  expandedCard={expandedCard}
                  onExpand={setExpandedCard}
                  onClose={closeExpandedCard}
                >
                  <Card title="Transient snapshot" subtitle="Attack + density" className="h-full">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-white/55">
                        <span>Reference</span>
                        <span>{merged.referenceName ?? "no ref"}</span>
                      </div>
                      <TransientSignature
                        strengthValue={overviewStrength}
                        densityValue={overviewDensity}
                        attackValue={overviewAttackSeconds}
                      />
                    </div>
                  </Card>
                </ExpandableCard>
              </div>
            </div>
          ) : null}

          {activeTab === "loudness" ? (
            <LoudnessMeterCard
              loudness={merged.loudness ?? null}
              referenceName={merged.referenceName}
              referenceTarget={merged.referenceFeaturesPercentiles?.lufs ?? null}
              referenceLra={merged.referenceFeaturesPercentiles?.lra ?? null}
              referencePeak={
                merged.referenceFeaturesPercentiles?.true_peak_db ??
                merged.referenceFeaturesPercentiles?.sample_peak_db ??
                null
              }
              momentary={merged.momentaryLufs ?? null}
              shortTerm={merged.shortTermLufs ?? null}
              levels={merged.levels ?? null}
              refState={loudnessRefState}
            />
          ) : null}

          {activeTab === "tonal" ? (
            <Card
              title="Tonal balance"
              subtitle="Sub, bassi, mid, presence, alti, air"
              right={<SourcePills state={tonalRefState} />}
              className="h-full"
            >
              <HorizontalTonalBalance
                trackBands={merged.bandsNorm as any}
                referenceBands={merged.referenceBandsNorm as any}
                referenceName={merged.referenceName}
                referencePercentiles={(merged as any).referenceBandsPercentiles ?? null}
                lang={(merged as any).lang === "en" ? "en" : "it"}
                refState={tonalRefState}
                embedded
              />
            </Card>
          ) : null}

          {activeTab === "spectral" ? (
            <Card
              title="Spettro"
              subtitle="Confronto traccia vs reference"
              right={<SourcePills state={spectrumRefState} />}
              className="h-full"
            >
              <SpectrumCompareCard
                track={merged.spectrumTrack ?? null}
                reference={merged.spectrumRef ?? null}
                referenceName={merged.referenceName}
                spectral={merged.spectral ?? null}
                referenceSpectralPercentiles={merged.referenceSpectralPercentiles ?? null}
                refState={spectrumRefState}
                embedded
              />
            </Card>
          ) : null}

          {activeTab === "stereo" ? (
            <StereoCard model={merged} refState={soundFieldRefState} />
          ) : null}

          {activeTab === "transients" ? (
            <TransientsCard
              transients={(merged as any).transients ?? null}
              referencePercentiles={merged.referenceTransientsPercentiles ?? null}
              referenceName={merged.referenceName}
            />
          ) : null}

          {activeTab === "rhythm" ? (
            <RhythmCard
              bpm={merged.bpm}
              keyName={merged.key}
              rhythm={merged.rhythm ?? null}
              percentiles={merged.referenceRhythmPercentiles ?? null}
              descriptorsPercentiles={merged.referenceRhythmDescriptorsPercentiles ?? null}
              refState={rhythmRefState}
            />
          ) : null}

          {activeTab === "extra" ? <ExtraCard extra={merged.extra ?? null} /> : null}
        </div>
      </div>
    </div>
  );
}


