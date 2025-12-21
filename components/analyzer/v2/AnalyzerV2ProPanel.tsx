"use client";

import React, { useMemo } from "react";
import type { AnalyzerCompareModel, Bands } from "@/lib/analyzer/v2/types";

type SpectrumPoint = { hz: number; mag: number };

const BAND_ORDER: Array<keyof Bands> = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

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
    trackPercentile: "Quota",
    targetWindow: "Ref",
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
    trackPercentile: "Share",
    targetWindow: "Ref",
    refOn: "REF ON",
    refOff: "NO REF",
  },
} as const;

function safeNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function sumBands(b?: Bands | null) {
  return BAND_ORDER.reduce((acc, k) => acc + safeNum(b?.[k]), 0);
}

function bandsToPct(b?: Bands | null) {
  const total = sumBands(b);
  const denom = total > 0 ? total : 1;
  const out: Record<string, number> = {};
  for (const k of BAND_ORDER) out[k] = (safeNum(b?.[k]) / denom) * 100;
  return out as Record<keyof Bands, number>;
}

function fmt1(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fmt0(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return String(Math.round(n));
}

type StatusTone = "ok" | "low" | "high" | "muted";

function formatDb(value: number | null | undefined, decimals = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(decimals)} dB`;
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

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "mid" | "high" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/25 bg-white/5 text-white/80 ring-white/10 hover:bg-white/10"
      : tone === "mid"
      ? "border-white/15 bg-white/8 text-white/75"
      : tone === "high"
      ? "border-amber-400/25 bg-amber-400/15 text-amber-200"
      : "border-white/10 bg-white/5 text-white/60";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
      {children}
    </span>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "ok" | "low" | "high" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
      : tone === "low"
      ? "border-sky-400/30 bg-sky-400/15 text-sky-100"
      : tone === "high"
      ? "border-amber-400/35 bg-amber-400/20 text-amber-100"
      : "border-white/10 bg-white/5 text-white/60";
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${cls}`}>
      {children}
    </span>
  );
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

function Card({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-white/55">{subtitle}</div> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
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

function pick<T>(arr: T[], seed: number, i: number) {
  if (!arr.length) return arr[0];
  const idx = (seed + i * 2654435761) % arr.length;
  return arr[idx];
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
}: {
  model: AnalyzerCompareModel;
  onPlay?: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-white/60">Back to project</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-white">{model.projectTitle}</div>
            <Pill tone="muted">{model.mixType}</Pill>
            <span className="text-xs text-white/50">{model.versionName}</span>
          </div>
          <div className="mt-1 text-sm text-white/70">
            {model.key ?? "Key n/a"} · {model.bpm ?? "BPM n/a"} BPM · {fmt1(model.loudness?.integrated_lufs ?? null)} LUFS
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
            Tekkin <span className="font-semibold text-white">{fmt0(model.overallScore ?? null)}</span>
          </div>
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
        </div>
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
}: {
  trackBands?: Bands | null;
  referenceBands?: Bands | null;
  referenceName?: string | null;
  referencePercentiles?: BandsPercentiles | null;
  lang?: "it" | "en";
}) {
  const trackPct = useMemo(() => bandsToPct(trackBands), [trackBands]);

  const hasRef = !!referenceBands && sumBands(referenceBands) > 0;
  const hasPerc = !!referencePercentiles;
  const hasTrack = !!trackBands && sumBands(trackBands) > 0;

  const copy = TONAL_COPY[lang] ?? TONAL_COPY.it;

  function bandRange(key: keyof Bands) {
    const p = referencePercentiles?.[key];
    const low = p?.p25 ?? p?.p10 ?? null;
    const high = p?.p75 ?? p?.p90 ?? null;
    const label =
      p?.p25 != null && p?.p75 != null ? "25-75" : p?.p10 != null && p?.p90 != null ? "10-90" : "n/a";
    return { low, high, label };
  }

  function bandStatus(key: keyof Bands, tVal: number | null) {
    if (!hasPerc || tVal == null) return { status: "unknown" as const, refOk: false, range: bandRange(key) };

    const range = bandRange(key);
    if (range.low == null || range.high == null) return { status: "unknown" as const, refOk: false, range };

    if (tVal < range.low) return { status: "low" as const, refOk: true, range };
    if (tVal > range.high) return { status: "high" as const, refOk: true, range };
    return { status: "ok" as const, refOk: true, range };
  }

  const bandData = BAND_ORDER.map((key) => {
    const tNorm = (trackBands as any)?.[key] ?? null;
    const status = bandStatus(key, typeof tNorm === "number" ? tNorm : null);
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
      tPct: hasTrack ? trackPct[key] : null,
      status,
      chip,
      hint,
    };
  });

  const known = bandData.filter((b) => b.status.status !== "unknown").length;
  const okCount = bandData.filter((b) => b.status.status === "ok").length;
  const overallScore = known ? Math.round((okCount / known) * 100) : null;
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <Card
      title={copy.title}
      subtitle={
        hasPerc
          ? copy.subtitleRef(referenceName)
          : copy.subtitleNoRef
      }
      right={
        <div className="flex items-center gap-2">
          <Pill tone={hasRef ? "ok" : "muted"}>{hasRef ? copy.refOn : copy.refOff}</Pill>
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
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
                        <span>{copy.trackPercentile}: {b.tPct == null ? "n/a" : `${fmt1(b.tPct)}%`}</span>
                        <span className="text-white/35">•</span>
                        <span title={tooltip}>{copy.targetWindow}: {b.status.range.label}</span>
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
    </Card>
  );
}

function SoundFieldCard({ points, isLive }: { points: { angleDeg: number; radius: number }[] | null | undefined; isLive: boolean }) {
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
  }, [points]);

  const has = Array.isArray(points) && points.length > 0;

  const meanRadius = useMemo(() => {
    const pts = Array.isArray(points) ? points : [];
    if (!pts.length) return null;
    const m = pts.reduce((a, p) => a + safeNum((p as any).radius), 0) / pts.length;
    return Number.isFinite(m) ? m : null;
  }, [points]);

  const widthLabel =
    typeof meanRadius !== "number"
      ? "n/a"
      : meanRadius < 0.25
        ? "stretto"
        : meanRadius < 0.38
          ? "moderato"
          : "wide";

  return (
    <Card
      title="Sound field"
      subtitle="Distribuzione stereo della traccia (descrittivo, non comparativo)"
      right={
        <div className="flex items-center gap-2">
          <Pill tone={has ? "ok" : "muted"}>{has ? "LIVE" : "MOCK"}</Pill>
          <Pill tone="muted">NO REF</Pill>
        </div>
      }
    >
      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-center">
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

            {path ? (
              <path d={path} fill="none" stroke="rgba(52,211,153,0.9)" strokeWidth={2.2} />
            ) : (
              <text x={cx} y={cy} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12">
                no data
              </text>
            )}
          </svg>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55">Width index</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {typeof meanRadius === "number" ? meanRadius.toFixed(2) : "n/a"}{" "}
              <span className="text-sm font-semibold text-white/60">{widthLabel}</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-white/55">Correlation</div>
            <div className="mt-1 text-lg font-semibold text-white">n/a</div>
            <div className="mt-1 text-[11px] text-white/45">In arrivo: metrica reale</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SpectrumCompareCard({
  track,
  reference,
  referenceName,
}: {
  track?: SpectrumPoint[] | null;
  reference?: SpectrumPoint[] | null;
  referenceName?: string | null;
}) {
  // Responsive width
  const W = 0; // will be set by ref
  const H = 180;
  // Nessun padding laterale: curva da 0 a width
  const pad = { l: 0, r: 0, t: 16, b: 26 };
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = React.useState(820);
  React.useEffect(() => {
    if (svgRef.current) {
      setSvgWidth(svgRef.current.clientWidth || 820);
    }
    const handleResize = () => {
      if (svgRef.current) setSvgWidth(svgRef.current.clientWidth || 820);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const data = useMemo(() => {
    const t = Array.isArray(track) ? track : [];
    const r = Array.isArray(reference) ? reference : [];
    const n = Math.max(t.length, r.length);
    const out: { hz: number; t?: number; r?: number }[] = [];
    for (let i = 0; i < n; i++) {
      out.push({
        hz: t[i]?.hz ?? r[i]?.hz ?? i,
        t: typeof t[i]?.mag === "number" ? t[i].mag : undefined,
        r: typeof r[i]?.mag === "number" ? r[i].mag : undefined,
      });
    }
    return out;
  }, [track, reference]);

  const hasRef = Array.isArray(reference) && reference.length > 0;
  const hasTrack = Array.isArray(track) && track.length > 0;

  function avgInRange(key: "t" | "r", hzMin: number, hzMax: number) {
    let sum = 0;
    let n = 0;
    for (const p of data) {
      const hz = typeof p.hz === "number" ? p.hz : null;
      const v = p[key];
      if (hz == null || typeof v !== "number") continue;
      if (hz >= hzMin && hz <= hzMax) {
        sum += v;
        n += 1;
      }
    }
    return n ? sum / n : null;
  }

  const summary = useMemo(() => {
    if (!hasRef || !hasTrack) return null;

    const subT = avgInRange("t", 20, 60);
    const subR = avgInRange("r", 20, 60);

    const lmT = avgInRange("t", 150, 400);
    const lmR = avgInRange("r", 150, 400);

    const hiT = avgInRange("t", 6000, 12000);
    const hiR = avgInRange("r", 6000, 12000);

    const d = (a: number | null, b: number | null) =>
      typeof a === "number" && typeof b === "number" ? a - b : null;

    return {
      sub: d(subT, subR),
      lowmid: d(lmT, lmR),
      high: d(hiT, hiR),
    };
  }, [data, hasRef, hasTrack]);

  const { tMin, tMax } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      if (typeof d.t === "number") {
        min = Math.min(min, d.t);
        max = Math.max(max, d.t);
      }
      if (typeof d.r === "number") {
        min = Math.min(min, d.r);
        max = Math.max(max, d.r);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      min = -60;
      max = 0;
    }
    return { tMin: min, tMax: max };
  }, [data]);

  const xFromHz = (hz: number) => {
    const lo = Math.log10(20);
    const hi = Math.log10(20000);
    const v = clamp01((Math.log10(Math.max(20, Math.min(20000, hz))) - lo) / (hi - lo));
    return v * svgWidth;
  };

  const yFromMag = (m: number) => {
    const v = clamp01((m - tMin) / (tMax - tMin));
    return pad.t + (1 - v) * (H - pad.t - pad.b);
  };

  // Smooth path (Catmull-Rom to Bezier)
  function smoothPath(points: { x: number; y: number }[]) {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      d += ` Q ${midX} ${p0.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }
  const pathFrom = (key: "t" | "r") => {
    const pts = data.filter((p) => typeof p[key] === "number").map((p) => ({ x: xFromHz(p.hz), y: yFromMag(p[key]!) }));
    return smoothPath(pts);
  };

  const tPath = useMemo(() => pathFrom("t"), [data]);
  const rPath = useMemo(() => pathFrom("r"), [data]);

  return (
    <Card
      title="Spettro (confronto)"
      right={<Pill tone={hasRef ? "ok" : "muted"}>{hasRef ? "REF" : "NO REF"}</Pill>}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-white/5 px-2 py-0.5 text-[11px] text-emerald-200">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Traccia
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-400/25 bg-white/5 px-2 py-0.5 text-[11px] text-blue-200">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" /> Reference
          </span>
        </div>
        {summary && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`rounded-full border bg-black/20 px-2 py-1 ${summary.sub == null ? 'border-white/10 text-white/60' : summary.sub >= 0 ? 'border-emerald-400/25 text-emerald-200' : 'border-rose-400/25 text-rose-200'}`}>
              Sub {summary.sub == null ? "n/a" : `${summary.sub >= 0 ? "+" : ""}${summary.sub.toFixed(1)} dB`}
            </span>
            <span className={`rounded-full border bg-black/20 px-2 py-1 ${summary.lowmid == null ? 'border-white/10 text-white/60' : summary.lowmid >= 0 ? 'border-emerald-400/25 text-emerald-200' : 'border-rose-400/25 text-rose-200'}`}>
              LowMid {summary.lowmid == null ? "n/a" : `${summary.lowmid >= 0 ? "+" : ""}${summary.lowmid.toFixed(1)} dB`}
            </span>
            <span className={`rounded-full border bg-black/20 px-2 py-1 ${summary.high == null ? 'border-white/10 text-white/60' : summary.high >= 0 ? 'border-emerald-400/25 text-emerald-200' : 'border-rose-400/25 text-rose-200'}`}>
              High {summary.high == null ? "n/a" : `${summary.high >= 0 ? "+" : ""}${summary.high.toFixed(1)} dB`}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 relative w-full">
        <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${svgWidth} ${H}`}>
          <defs>
            <linearGradient id="specTrack" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(236,72,153,0.65)" />
              <stop offset="55%" stopColor="rgba(168,85,247,0.55)" />
              <stop offset="100%" stopColor="rgba(52,211,153,0.55)" />
            </linearGradient>
            <linearGradient id="specTrackFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(52,211,153,0.18)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </linearGradient>
          </defs>

          {[100, 1000, 10000].map((hz) => {
            const x = xFromHz(hz);
            return <line key={hz} x1={x} y1={pad.t} x2={x} y2={H - pad.b} stroke="rgba(255,255,255,0.08)" />;
          })}
          {[0.25, 0.5, 0.75].map((p, i) => {
            const y = pad.t + p * (H - pad.t - pad.b);
            return <line key={i} x1={0} y1={y} x2={svgWidth} y2={y} stroke="rgba(255,255,255,0.06)" />;
          })}

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

          {hasTrack && tPath ? (
            <path
              d={tPath}
              fill="none"
              stroke="#34d399"
              strokeWidth={2.6}
            />
          ) : null}
          {hasRef && rPath ? <path d={rPath} fill="none" stroke="#3b82f6" strokeWidth={2.0} /> : null}

          {!hasTrack ? (
            <text x={svgWidth / 2} y={H / 2} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12">
              no spectrum data
            </text>
          ) : null}
        </svg>
      </div>
    </Card>
  );
}

function LevelsMetersCard({
  levels,
  isLive,
  referenceStereoPercentiles,
}: {
  levels?: { label: "L" | "C" | "R" | "Ls" | "Rs" | "LFE"; rmsDb: number; peakDb: number }[] | null;
  isLive: boolean;
  referenceStereoPercentiles?: AnalyzerCompareModel["referenceStereoPercentiles"] | null;
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
        <div className="flex items-center gap-2">
          <Pill tone={isLive ? "ok" : "muted"}>{isLive ? "LIVE" : "MOCK"}</Pill>
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

  const sf = Array.isArray(model.soundField) ? model.soundField : null;
  const sfMean = sf && sf.length ? sf.reduce((a, p) => a + safeNum(p.radius), 0) / sf.length : null;
  const tooNarrow = typeof sfMean === "number" ? sfMean < 0.28 : false;

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
        {quickFacts.map((metric) => (
          <MetricRow key={metric.key} {...metric} />
        ))}
      </div>
    </Card>
  );
}

function TransientsCard({
  transients,
}: {
  transients?: { strength?: number; density?: number; crestFactorDb?: number } | null;
}) {
  if (!transients) {
    return (
      <Card title="Transients" subtitle="Impatto e densità">
        <div className="text-sm text-white/65">Dati transients non disponibili.</div>
      </Card>
    );
  }

  const strength =
    typeof (transients as any).strength === "number"
      ? (transients as any).strength
      : typeof (transients as any).transient_strength === "number"
        ? (transients as any).transient_strength
        : 0;

  const density =
    typeof (transients as any).density === "number"
      ? (transients as any).density
      : typeof (transients as any).transient_density === "number"
        ? (transients as any).transient_density
        : 0;

  const crest =
    typeof (transients as any).crestFactorDb === "number"
      ? (transients as any).crestFactorDb
      : typeof (transients as any).crest_factor_db === "number"
        ? (transients as any).crest_factor_db
        : null;

  const hasStrength = typeof strength === "number" && strength > 0;
  const hasDensity = typeof density === "number" && density > 0;

  const crestClassification = (() => {
    if (crest == null) return null;
    if (crest < 10) return { label: "Soft / flattened", tone: "low" as StatusTone };
    if (crest <= 18) return { label: "Balanced", tone: "ok" as StatusTone };
    return { label: "Spiky", tone: "high" as StatusTone };
  })();

  const crestAction =
    crestClassification?.label === "Soft / flattened"
      ? "Riduci limiting sul bus e prova un transient shaper per ritrovare attacco."
      : crestClassification?.label === "Balanced"
      ? "Mantieni il bilanciamento attuale ma controlla i picchi con automation leggera."
      : crestClassification?.label === "Spiky"
      ? "Doma i picchi con clipper/limiter e controlla le percussioni più incisive."
      : "Monitora il rapporto picco/RMS con transient shaper o limiter se serve.";

  return (
    <Card title="Transients" subtitle="Impatto e densità">
      <div className="space-y-3 text-white/70">
        <MetricRow
          label="Strength"
          value={hasStrength ? strength.toFixed(2) : "MISSING"}
          meaning="Indica quanto l'impatto si distingue dal sustain."
          action={
            hasStrength
              ? "Modella l'attacco con compressor/shaper per ottenere il livello desiderato."
              : "Rianalizza o controlla il passaggio analyzer per ottenere i transienti."
          }
        />
        <MetricRow
          label="Density (1/s)"
          value={hasDensity ? density.toFixed(2) : "MISSING"}
          meaning="Numero di transienti al secondo: misura la complessità ritmica."
          action={
            hasDensity
              ? "Semplifica layering o regola sustain per avere la densità voluta."
              : "Rianalizza o controlla il passaggio analyzer per ottenere i transienti."
          }
        />
        {crest != null && (
          <MetricRow
            label="Crest (dB)"
            value={crest.toFixed(1)}
            chip={crestClassification ?? undefined}
            meaning="Rapporto picco/RMS che segnala quanto i transienti emergono."
            action={crestAction}
            note="Heuristic classification."
          />
        )}
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Grafico transients</div>
          {[
            {
              label: "Strength",
              value: hasStrength ? strength : null,
              max: 8,
              color: "bg-gradient-to-r from-emerald-400 to-cyan-400",
            },
            {
              label: "Density",
              value: hasDensity ? density : null,
              max: 16,
              color: "bg-gradient-to-r from-orange-400 to-amber-400",
            },
          ].map((item) => {
            const pct = item.value ? Math.min(1, item.value / item.max) : 0;
            const displayValue = item.value ? item.value.toFixed(1) : "n/a";
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span>{item.label}</span>
                  <span>{displayValue}</span>
                </div>
                <div className="h-3 w-full rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="text-[10px] text-white/40">
            Barre relative ai range tipici: ascolta comunque il risultato finale.
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">What to do</div>
          <div className="mt-1 space-y-1 text-[11px]">
            <div className="flex gap-2">
              <span className="text-white/60">•</span>
              <span>Flattened: riduci limiting sul bus e aggiungi transient shaper.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-white/60">•</span>
              <span>Spiky: doma con clipper/limiter e controlla i picchi di percussioni.</span>
            </div>
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

    out.push(pick(base, seed, 0));
    if (c.loudnessHot || c.overCompressed || (typeof lufs === "number" && lufs > -9.5)) out.push(pick(loud, seed, 1));
    if (c.whistleRisk || (typeof centroid === "number" && typeof zcr === "number" && centroid > 3800 && zcr > 0.07))
      out.push(pick(harsh, seed, 2));
    if (c.noiseRisk) out.push(pick(noise, seed, 3));
    if (c.tooNarrow) out.push(pick(stereo, seed, 4));

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
}: {
  model: AnalyzerCompareModel;
  onPlay?: () => void;
  onShare?: () => void;
  reanalyze?: {
    isLoading: boolean;
    canRun: boolean;
    onRun: () => void;
  };
}) {
  const stableSeed = useMemo(() => hashSeed(`${model.projectTitle}|${model.versionName}`) % 30, [model.projectTitle, model.versionName]);

  const live = useMemo(() => ({
    spectrumTrack: Array.isArray(model.spectrumTrack) && model.spectrumTrack.length > 0,
    spectrumRef: Array.isArray(model.spectrumRef) && model.spectrumRef.length > 0,
    soundField: Array.isArray(model.soundField) && model.soundField.length > 0,
    levels: Array.isArray(model.levels) && model.levels.length > 0,
  }), [model.spectrumTrack, model.spectrumRef, model.soundField, model.levels]);

  const merged: AnalyzerCompareModel = useMemo(() => {
    const spectrumTrack = model.spectrumTrack && model.spectrumTrack.length ? model.spectrumTrack : makeMockSpectrum(stableSeed);
    const soundField = model.soundField && model.soundField.length ? model.soundField : makeMockSoundField(stableSeed);
    const levels = model.levels && model.levels.length ? model.levels : makeMockLevels(stableSeed);

    return {
      ...model,
      spectrumTrack,
      soundField,
      levels,
      // spectrumRef resta null finché non la calcoli nel backend
    };
  }, [model, stableSeed]);

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/4 p-4">
          <div>
            <div className="text-xs text-white/55">Analyzer controls</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill tone="muted">ui v2</Pill>
              <Pill tone={model.referenceName ? "ok" : "muted"}>{model.referenceName ? "REF ON" : "REF OFF"}</Pill>
              <Pill tone={model.spectrumTrack?.length ? "ok" : "muted"}>{model.spectrumTrack?.length ? "DATA" : "MOCK"}</Pill>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 hover:bg-white/8"
              onClick={reanalyze?.onRun}
              disabled={!reanalyze?.canRun || reanalyze?.isLoading}
            >
              {reanalyze?.isLoading ? "Analyzing..." : "Re-analyze"}
            </button>
<div className="hidden sm:flex items-center gap-2 text-xs text-white/45">
  <Pill tone="muted">DATA</Pill>
  <span>spectrum, sound field, levels, transients</span>
</div>

          </div>
        </div>

        <AnalyzerHero model={merged} onPlay={onPlay} onShare={onShare} />

        <div className="mt-6 grid grid-cols-1 gap-4">
          <HorizontalTonalBalance
            trackBands={merged.bandsNorm as any}
            referenceBands={merged.referenceBandsNorm as any}
            referenceName={merged.referenceName}
            referencePercentiles={(merged as any).referenceBandsPercentiles ?? null}
            lang={(merged as any).lang === "en" ? "en" : "it"}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SoundFieldCard points={merged.soundField as any} isLive={live.soundField} />
            <div className="lg:col-span-2">
              <SpectrumCompareCard
                track={merged.spectrumTrack as any}
                reference={merged.spectrumRef as any}
                referenceName={merged.referenceName}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LevelsMetersCard
                levels={merged.levels as any}
                isLive={live.levels}
                referenceStereoPercentiles={merged.referenceStereoPercentiles as any}
              />
            </div>
            <div className="space-y-4">
              <QuickFacts model={merged} />
              <TransientsCard transients={(merged as any).transients ?? null} />
            </div>
          </div>

          <HealthChecks model={merged} />
          <HumanAdvice model={merged} />
          <WhyThisScore model={merged} />
        </div>
      </div>
    </div>
  );
}
