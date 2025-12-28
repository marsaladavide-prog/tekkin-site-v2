"use client";

/*
  This file is a large UI orchestrator and currently ingests heterogeneous analyzer payloads.
  We intentionally disable `no-explicit-any` here until the analyzer data contract is fully
  consolidated into strict types.
*/

import React, { useMemo, useState } from "react";
import type { AnalyzerCompareModel, Bands } from "@/lib/analyzer/v2/types";
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
import { BAND_ORDER, bandsToPct, clamp01, sumBands } from "./utils/number";
import {
  getLiveStateForX,
  getRefStateForLoudness,
  getRefStateForSpectrum,
  getRefStateForTonal,
  type RefState,
} from "./utils/refState";

type _SpectrumPoint = { hz: number; mag: number };

const _BAND_LABELS: Record<"it" | "en", Record<keyof Bands, string>> = {
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

const _TONAL_COPY = {
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

function _classifyPeak(
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

function _classifyBalance(diff: number | null | undefined): { label: "OK" | "WARN" | "BAD" | "n/a"; tone: StatusTone } {
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

function _labelFromDeltaAbs(deltaPct: number) {
  const d = Math.abs(deltaPct);
  if (d <= 3) return { label: "OK", tone: "ok" as const };
  if (d <= 7) return { label: "BASSO", tone: "mid" as const };
  return { label: "ALTO", tone: "high" as const };
}

type _MetricChip = {
  label: string;
  tone: StatusTone;
};

type _MetricGraph = {
  value: number | null | undefined;
  max: number;
  accent: string;
  label: string;
};

function _MetricRow({
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
  chip?: _MetricChip;
  meaning: string;
  action: string;
  note?: string;
  graph?: _MetricGraph;
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

function _hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function _pick<T>(arr: T[], seed: number, i: number): T | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const idx = (seed + i * 2654435761) % arr.length;
  return arr[idx] ?? null;
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

function _resolveBandRange(p: any) {
  const low = p?.p25 ?? p?.p10 ?? null;
  const high = p?.p75 ?? p?.p90 ?? null;
  const label = p?.p25 != null && p?.p75 != null ? "25-75" : p?.p10 != null && p?.p90 != null ? "10-90" : "n/a";
  return { low, high, label };
}

// ---------- Missing components (single-file fallback) ----------

function OverviewStrip({ model }: { model: AnalyzerCompareModel }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/55">Overview</div>
      <div className="mt-1 text-sm text-white/70">
        {model.referenceName ? `Reference: ${model.referenceName}` : "No reference"}
      </div>
      <div className="mt-1 text-[11px] text-white/55">
        {typeof model.overallScore === "number" ? `Overall: ${Math.round(model.overallScore)}` : "Overall: n/a"}
      </div>
    </div>
  );
}

function TonalSnapshotCompact({
  trackBands,
  referencePercentiles,
}: {
  trackBands?: Bands | null;
  referencePercentiles?: Record<string, { p10?: number; p90?: number; p25?: number; p75?: number }> | null;
}) {
  const trackPct = useMemo(() => bandsToPct(trackBands), [trackBands]);
  const hasTrack = !!trackBands && sumBands(trackBands) > 0;

  const rows = BAND_ORDER.map((k) => {
    const v = hasTrack ? (trackPct as any)?.[k] : null;
    const ref = referencePercentiles ? (referencePercentiles as any)?.[k] : null;
    const low = ref?.p25 ?? ref?.p10 ?? null;
    const high = ref?.p75 ?? ref?.p90 ?? null;
    const inRef =
      typeof v === "number" &&
      typeof low === "number" &&
      typeof high === "number" &&
      v >= Math.min(low, high) &&
      v <= Math.max(low, high);

    return { k, v, low, high, inRef, hasRef: low != null && high != null };
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.k} className="rounded-xl border border-white/10 bg-black/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-white/75">{String(r.k)}</div>
              {r.hasRef ? (
                <StatusChip tone={r.inRef ? "ok" : "high"}>{r.inRef ? "OK" : "OUT"}</StatusChip>
              ) : (
                <StatusChip tone="muted">NO REF</StatusChip>
              )}
            </div>
            <div className="mt-1 text-sm text-white">
              {typeof r.v === "number" ? `${r.v.toFixed(1)}%` : "n/a"}
            </div>
            <div className="mt-1 text-[10px] text-white/45">
              {r.hasRef ? `${(r.low as number).toFixed(1)} - ${(r.high as number).toFixed(1)}` : "ref n/a"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CorrelationMeter({
  value,
  ref,
}: {
  value: number | null;
  ref?: { p10?: number; p90?: number } | null;
}) {
  const v = typeof value === "number" && Number.isFinite(value) ? value : null;
  const pct = v == null ? 0 : clamp01((v + 1) / 2); // -1..+1 -> 0..1

  const hasRef = !!ref && typeof ref.p10 === "number" && typeof ref.p90 === "number";
  const inRef = hasRef && v != null ? v >= (ref!.p10 as number) && v <= (ref!.p90 as number) : null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/55">Correlation</div>
        {hasRef ? (
          <StatusChip tone={inRef ? "ok" : "high"}>{inRef ? "OK" : "OUT"}</StatusChip>
        ) : (
          <StatusChip tone="muted">NO REF</StatusChip>
        )}
      </div>
      <div className="mt-1 text-lg font-semibold text-white">{v == null ? "n/a" : v.toFixed(2)}</div>
      <div className="mt-2 h-2 w-full rounded-full bg-white/5">
        <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 text-[10px] text-white/45">Scale: -1 anti-phase, +1 mono-safe</div>
    </div>
  );
}

function StereoScope({
  pointsXY,
  referenceXY,
}: {
  pointsXY?: Array<{ x: number; y: number }> | null;
  referenceXY?: Array<{ x: number; y: number }> | null;
}) {
  const pts = Array.isArray(pointsXY) ? pointsXY : [];
  const rpts = Array.isArray(referenceXY) ? referenceXY : [];

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;

  const toPath = (arr: Array<{ x: number; y: number }>) => {
    if (arr.length < 2) return "";
    const first = arr[0];
    let d = `M ${(cx + first.x * 60).toFixed(2)} ${(cy - first.y * 60).toFixed(2)}`;
    for (let i = 1; i < arr.length; i++) {
      const p = arr[i];
      d += ` L ${(cx + p.x * 60).toFixed(2)} ${(cy - p.y * 60).toFixed(2)}`;
    }
    return d;
  };

  const d = toPath(pts);
  const rd = toPath(rpts);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-white/55">Stereo field</div>
      <div className="mt-2 flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={70} fill="none" stroke="rgba(255,255,255,0.10)" />
          <circle cx={cx} cy={cy} r={35} fill="none" stroke="rgba(255,255,255,0.08)" />
          <line x1={cx - 70} y1={cy} x2={cx + 70} y2={cy} stroke="rgba(255,255,255,0.08)" />
          <line x1={cx} y1={cy - 70} x2={cx} y2={cy + 70} stroke="rgba(255,255,255,0.08)" />

          {rd ? <path d={rd} fill="none" stroke="rgba(59,130,246,0.45)" strokeWidth={2} /> : null}
          {d ? <path d={d} fill="none" stroke="rgba(52,211,153,0.85)" strokeWidth={2} /> : (
            <text x={cx} y={cy} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="12">
              no data
            </text>
          )}
        </svg>
      </div>
      <div className="mt-1 text-[10px] text-white/45">Green: track, Blue: reference (if available)</div>
    </div>
  );
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
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] text-white/70 space-y-1">
      <div>Strength: {typeof strengthValue === "number" ? strengthValue.toFixed(2) : "n/a"}</div>
      <div>Density: {typeof densityValue === "number" ? densityValue.toFixed(2) : "n/a"}</div>
      <div>Attack: {typeof attackValue === "number" ? `${attackValue.toFixed(3)}s` : "n/a"}</div>
    </div>
  );
}

function HorizontalTonalBalance(_props: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm text-white/60">
        Tonal balance UI non incollata in questo file. Se vuoi la versione completa, la rimettiamo qui (è lunga).
      </div>
    </div>
  );
}

function SpectrumCompareCard(_props: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm text-white/60">
        Spectrum compare UI non incollata in questo file. Se vuoi la versione completa, la rimettiamo qui (è lunga).
      </div>
    </div>
  );
}

function StereoCard({ model, refState }: { model: AnalyzerCompareModel; refState: RefState }) {
  return (
    <Card
      title="Stereo"
      subtitle="Sound field + width/correlation"
      right={<SourcePills state={refState} />}
      className="h-full"
    >
      <div className="space-y-3">
        <CorrelationMeter value={(() => {
          const arr = Array.isArray(model.correlation)
            ? model.correlation.filter((x) => typeof x === "number" && Number.isFinite(x))
            : [];
          return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        })()} ref={model.referenceStereoPercentiles?.lrCorrelation ?? null} />
        <StereoScope pointsXY={model.soundFieldXY ?? null} referenceXY={model.referenceSoundFieldXY ?? null} />
      </div>
    </Card>
  );
}

function TransientsCard({
  transients,
  referencePercentiles,
  referenceName,
}: {
  transients: any;
  referencePercentiles: any;
  referenceName?: string | null;
}) {
  return (
    <Card title="Transients" subtitle={referenceName ? `Ref: ${referenceName}` : "No ref"}>
      <div className="text-sm text-white/60">Transients view placeholder.</div>
      <div className="mt-2 text-[11px] text-white/45">
        transients: {transients ? "ok" : "n/a"} | ref: {referencePercentiles ? "ok" : "n/a"}
      </div>
    </Card>
  );
}

function ExtraCard({ extra }: { extra: any }) {
  return (
    <Card title="Extra" subtitle="Other analyzer data">
      <pre className="max-h-[340px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
        {extra ? JSON.stringify(extra, null, 2) : "n/a"}
      </pre>
    </Card>
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
                <TekkinRankExplanationCard
                  rank={merged.tekkinRank ?? null}
                  referenceName={merged.referenceName}
                  suggestedReferenceKey={merged.suggestedReferenceKey ?? null}
                  suggestedReferenceMatch={merged.suggestedReferenceMatch ?? null}
                  suggestedReferenceDelta={merged.suggestedReferenceDelta ?? null}
                />

                <Card title="Tonal overview" subtitle="Bilanciamento bande (reference)" className="h-full">
                  <TonalSnapshotCompact
                    trackBands={merged.bandsNorm as any}
                    referencePercentiles={(merged as any).referenceBandsPercentiles ?? null}
                  />
                </Card>

                <Card title="Stereo snapshot" subtitle="Correlation + field" className="h-full">
                  <div className="space-y-3">
                    <CorrelationMeter value={overviewCorrMean} ref={merged.referenceStereoPercentiles?.lrCorrelation ?? null} />
                    <StereoScope pointsXY={merged.soundFieldXY ?? null} referenceXY={merged.referenceSoundFieldXY ?? null} />
                  </div>
                </Card>

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


