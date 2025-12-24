"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ReactNode } from "react";
import type { AnalyzerCompareModel, Bands } from "@/lib/analyzer/v2/types";
import { Badge as UiBadge } from "@/components/ui/badge";

type TimeMode = "momentary" | "short-term";
type SpectrumPoint = { hz: number; mag: number };

const TONAL_KEYS: Array<keyof Bands> = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function formatDecimal(value: number | null | undefined, digits = 1) {
  return value != null && Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}

function formatScore(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? Math.round(value).toString() : "n/a";
}

function normalizeBandValue(value: number | undefined | null) {
  if (typeof value === "number" && Number.isFinite(value)) return clamp(value, 0, 1);
  return null;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/5 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-white/70">
      {children}
    </span>
  );
}

function Badge({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "success" | "warn";
}) {
  let variant: "default" | "secondary" | "outline" | "destructive" = "default";
  if (tone === "success") variant = "secondary";
  if (tone === "warn") variant = "destructive";
  return <UiBadge variant={variant}>{text}</UiBadge>;
}

function PanelCard({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-white/50">{subtitle}</div> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {children}
    </div>
  );
}

function ReAnalyzeButton({
  payload,
  onDone,
}: {
  payload: {
    versionId: string;
    projectId: string;
    audioUrl: string | null;
    profileKey: string | null;
    mode: "master" | "premaster";
    lang: "it" | "en";
  };
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const canRun = !!payload.audioUrl && !!payload.profileKey;

  async function run() {
    if (!canRun || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/projects/run-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: payload.versionId,
          project_id: payload.projectId,
          audio_url: payload.audioUrl,
          profile_key: payload.profileKey,
          mode: payload.mode,
          lang: payload.lang,
          upload_arrays_blob: true,
          storage_bucket: "tracks",
          storage_base_path: "analyzer",
        }),
      });

      if (!res.ok) {
        console.error("[reanalyze] failed:", await res.text());
        return;
      }

      router.refresh();
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={!canRun || busy}
      onClick={() => void run()}
      className="inline-flex items-center justify-center rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Analyzing..." : "Re-analyze"}
    </button>
  );
}

function AnalyzerHero({
  model,
  onPlay,
  onShare,
}: {
  model: AnalyzerCompareModel;
  onPlay?: () => void;
  onShare?: () => void;
}) {
  const integrated = model.loudness?.integrated_lufs ?? null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Back to project</p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-semibold text-white">{model.versionName}</h1>
            <Pill>{(model.mixType ?? "master").toUpperCase()}</Pill>
            <span className="text-xs uppercase text-white/60">{model.projectTitle}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium text-white/60">
            <span>{model.key ?? "Key n/a"}</span>
            <span>{model.bpm ? `${model.bpm} BPM` : "BPM n/a"}</span>
            <span>{formatDecimal(integrated)} LUFS</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/80">
            Tekkin <span className="ml-1 text-lg font-semibold text-white">{formatScore(model.overallScore)}</span>
          </div>

          <button
            type="button"
            onClick={() => onPlay?.()}
            disabled={!onPlay}
            className="rounded-xl bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/30 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Play
          </button>

          <button
            type="button"
            onClick={() => onShare?.()}
            disabled={!onShare}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

function SparkLine({ values, height = 120 }: { values: number[]; height?: number }) {
  const width = 620;

  const { path, min, max } = useMemo(() => {
    const pts = Array.isArray(values) ? values.slice(0, 1600) : [];
    if (pts.length < 2) return { path: "", min: 0, max: 0 };

    let mn = Infinity;
    let mx = -Infinity;

    for (const value of pts) {
      if (!Number.isFinite(value)) continue;
      if (value < mn) mn = value;
      if (value > mx) mx = value;
    }

    if (!Number.isFinite(mn) || !Number.isFinite(mx)) return { path: "", min: 0, max: 0 };
    if (mn === mx) mx = mn + 1;

    const segments = pts.map((value, index) => {
      const v = Number.isFinite(value) ? value : mn;
      const x = (index / (pts.length - 1)) * (width - 2) + 1;
      const normalized = (v - mn) / (mx - mn);
      const y = (1 - normalized) * (height - 2) + 1;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    });

    return { path: segments.join(" "), min: mn, max: mx };
  }, [values, height]);

  if (!path) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center text-xs text-white/60">
        Missing loudness timeline data
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-white/60">
        <span>LUFS timeline</span>
        <span>
          min {min.toFixed(1)} | max {max.toFixed(1)}
        </span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="currentColor" className="text-fuchsia-300/80" strokeWidth={2} />
      </svg>
    </div>
  );
}

function LoudnessTimelineCard({
  reanalyzePayload,
  momentary,
  shortTerm,
}: {
  reanalyzePayload: {
    versionId: string;
    projectId: string;
    audioUrl: string | null;
    profileKey: string | null;
    mode: "master" | "premaster";
    lang: "it" | "en";
  };
  momentary: number[];
  shortTerm: number[];
}) {
  const hasMomentary = momentary.length > 1;
  const hasShortTerm = shortTerm.length > 1;

  const [timelineMode, setTimelineMode] = useState<TimeMode>(
    hasMomentary ? "momentary" : hasShortTerm ? "short-term" : "momentary"
  );

  useEffect(() => {
    if (timelineMode === "momentary" && !hasMomentary && hasShortTerm) setTimelineMode("short-term");
    if (timelineMode === "short-term" && !hasShortTerm && hasMomentary) setTimelineMode("momentary");
  }, [hasMomentary, hasShortTerm, timelineMode]);

  const timelineData = timelineMode === "momentary" ? momentary : shortTerm;

  const badge = (
    <Badge text={timelineMode} tone={timelineData.length > 1 ? "success" : "warn"} />
  );

  return (
    <PanelCard
      title="Loudness timeline"
      subtitle="Momentary / Short-term da arrays.json"
      badge={badge}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
        <button
          type="button"
          onClick={() => setTimelineMode("momentary")}
          disabled={!hasMomentary}
          className={`rounded-full border px-3 py-1 transition ${
            timelineMode === "momentary"
              ? "border-emerald-300 bg-emerald-500/10 text-emerald-200"
              : "border-white/10 text-white/60"
          } ${!hasMomentary ? "opacity-40" : ""}`}
        >
          Momentary
        </button>
        <button
          type="button"
          onClick={() => setTimelineMode("short-term")}
          disabled={!hasShortTerm}
          className={`rounded-full border px-3 py-1 transition ${
            timelineMode === "short-term"
              ? "border-emerald-300 bg-emerald-500/10 text-emerald-200"
              : "border-white/10 text-white/60"
          } ${!hasShortTerm ? "opacity-40" : ""}`}
        >
          Short-term
        </button>

        <div className="ml-auto">
          {timelineData.length > 1 ? (
            <span className="text-xs text-white/50">Timeline disponibile</span>
          ) : (
            <span className="text-xs text-white/50">Missing arrays</span>
          )}
        </div>
      </div>

      {timelineData.length > 1 ? (
        <SparkLine values={timelineData} />
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60">
            Missing loudness arrays. Re-analyze per generare momentary/short-term.
          </div>
          <ReAnalyzeButton payload={reanalyzePayload} />
        </div>
      )}
    </PanelCard>
  );
}

function TonalBalanceHorizontal({
  track,
  reference,
  percentiles,
}: {
  track: Bands | null;
  reference: Bands | null;
  percentiles: any;
}) {
  const trackOk = !!track;
  const refOk = !!reference;

  // Compute judgments
  const judgments = TONAL_KEYS.map((key) => {
    const tVal = track?.[key];
    if (tVal == null) return { key, status: "unknown" as const };

    const bandPerc = percentiles?.[key];
    if (!bandPerc) return { key, status: "unknown" as const };

    // Use p25-p75 if available, else p10-p90
    const low = bandPerc.p25 ?? bandPerc.p10 ?? null;
    const high = bandPerc.p75 ?? bandPerc.p90 ?? null;

    if (low == null || high == null) return { key, status: "unknown" as const };

    if (tVal < low) return { key, status: "low" as const };
    if (tVal > high) return { key, status: "high" as const };
    return { key, status: "ok" as const };
  });

  const okCount = judgments.filter(j => j.status === "ok").length;
  const totalKnown = judgments.filter(j => j.status !== "unknown").length;
  const badgeText = totalKnown > 0 ? `${okCount}/${totalKnown} ok` : "no data";
  const badgeTone: "success" | "warn" = okCount === totalKnown && totalKnown > 0 ? "success" : "warn";

  return (
    <PanelCard
      title="Tonal balance"
      subtitle="Bande normalizzate con giudizio reference-based"
      badge={<Badge text={badgeText} tone={badgeTone} />}
    >
      <div className="grid gap-3">
        {TONAL_KEYS.map((key) => {
          const t = trackOk ? normalizeBandValue(track?.[key]) : null;
          const r = refOk ? normalizeBandValue(reference?.[key]) : null;
          const judgment = judgments.find(j => j.key === key);

          const pct = t != null ? Math.round(t * 100) : null;
          const statusColor = judgment?.status === "ok" ? "text-emerald-400" : judgment?.status === "low" ? "text-blue-400" : judgment?.status === "high" ? "text-red-400" : "text-white/60";

          return (
            <div key={String(key)} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px]">
                <span className="uppercase text-white/60">{String(key)}</span>
                <div className="flex items-center gap-2">
                  <span className={statusColor}>
                    {judgment?.status === "ok" ? "OK" : judgment?.status === "low" ? "BASSO" : judgment?.status === "high" ? "ALTO" : "n/a"}
                  </span>
                  <span className="text-white/60">{pct != null ? pct : "n/a"}</span>
                </div>
              </div>

              <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/80"
                  style={{ width: `${t != null ? t * 100 : 0}%` }}
                />
                {r != null ? (
                  <div
                    className="absolute top-[-6px] h-6 w-[2px] bg-white/90"
                    style={{ left: `${r * 100}%` }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-white/50">
        Giudizio basato sui percentili reference (p25-p75 o p10-p90). OK = entro range, BASSO/ALTO = fuori range.
      </div>
    </PanelCard>
  );
}

function buildSpectrumPath(points: SpectrumPoint[], width = 620, height = 150) {
  if (!Array.isArray(points) || points.length < 2) return null;

  const limited = points.slice(0, 1500);

  let min = Infinity;
  let max = -Infinity;

  for (const p of limited) {
    if (!Number.isFinite(p?.mag)) continue;
    if (p.mag < min) min = p.mag;
    if (p.mag > max) max = p.mag;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) max = min + 1;

  const path = limited
    .map((p, index) => {
      const m = Number.isFinite(p.mag) ? p.mag : min;
      const x = (index / (limited.length - 1)) * (width - 2) + 1;
      const normalized = (m - min) / (max - min);
      const y = (1 - normalized) * (height - 2) + 1;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return { path, min, max };
}

function SpectrumCompareCard({
  trackPoints,
  refPoints,
}: {
  trackPoints: SpectrumPoint[];
  refPoints: SpectrumPoint[];
}) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    hz: number;
    trackDb: number;
    refDb: number;
    delta: number;
  } | null>(null);

  const trackPath = useMemo(() => buildSpectrumPath(trackPoints), [trackPoints]);
  const refPath = useMemo(() => buildSpectrumPath(refPoints), [refPoints]);

  const ok = !!trackPath && !!refPath;

  // Compute delta points for visualization
  const deltaPoints = useMemo(() => {
    if (!trackPoints.length || !refPoints.length) return [];
    const deltas: { index: number; delta: number; hz: number; trackMag: number; refMag: number }[] = [];
    // Assume same length and sorted
    const minLen = Math.min(trackPoints.length, refPoints.length);
    for (let i = 0; i < minLen; i++) {
      const t = trackPoints[i];
      const r = refPoints[i];
      if (t.hz === r.hz) {
        const delta = t.mag - r.mag;
        if (Math.abs(delta) > 1) { // Only show significant deltas
          deltas.push({ index: i, delta, hz: t.hz, trackMag: t.mag, refMag: r.mag });
        }
      }
    }
    return deltas;
  }, [trackPoints, refPoints]);

  // Frequency markers
  const markers = useMemo(() => {
    const freqs = [20, 200, 1000, 2000, 10000]; // 20Hz, 200Hz, 1kHz, 2kHz, 10kHz
    return freqs.map(freq => {
      const index = trackPoints.findIndex(p => p.hz >= freq);
      if (index === -1) return null;
      const x = (index / (trackPoints.length - 1)) * 618 + 1; // width 620 - 2
      return { freq, x };
    }).filter(Boolean);
  }, [trackPoints]);

  return (
    <PanelCard
      title="Spectrum"
      subtitle="Overlay track (verde) vs reference (blu)"
      badge={<Badge text={ok ? "ok" : "missing"} tone={ok ? "success" : "warn"} />}
    >
      {ok ? (
        <>
          <div className="relative rounded-xl border border-white/10 bg-black/20 p-4">
            <svg
              width="100%"
              height={150}
              viewBox="0 0 620 150"
              preserveAspectRatio="none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const ratio = x / rect.width;
                const index = Math.floor(ratio * (trackPoints.length - 1));
                if (index >= 0 && index < trackPoints.length) {
                  const t = trackPoints[index];
                  const r = refPoints.find(p => p.hz === t.hz);
                  if (r) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      hz: t.hz,
                      trackDb: t.mag,
                      refDb: r.mag,
                      delta: t.mag - r.mag,
                    });
                  }
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <path
                d={trackPath.path}
                fill="none"
                stroke="currentColor"
                className="text-emerald-400/80"
                strokeWidth={2}
              />
              <path
                d={refPath.path}
                fill="none"
                stroke="currentColor"
                className="text-sky-400/65"
                strokeWidth={2}
              />
              {/* Frequency markers */}
              {markers.map((marker, i) => marker && (
                <line
                  key={i}
                  x1={marker.x}
                  y1={1}
                  x2={marker.x}
                  y2={149}
                  stroke="currentColor"
                  className="text-white/30"
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
              ))}
              {/* Delta points */}
              {deltaPoints.map((dp, i) => {
                const x = (dp.index / (trackPoints.length - 1)) * 618 + 1;
                const normalized = (dp.trackMag - trackPath.min) / (trackPath.max - trackPath.min);
                const y = (1 - normalized) * 148 + 1;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={3}
                    fill={dp.delta > 0 ? "currentColor" : "currentColor"}
                    className={dp.delta > 0 ? "text-red-400" : "text-blue-400"}
                  />
                );
              })}
            </svg>
            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute z-10 rounded bg-black/90 p-2 text-xs text-white shadow-lg pointer-events-none"
                style={{
                  left: tooltip.x + 10,
                  top: tooltip.y - 10,
                  transform: tooltip.x > 300 ? 'translateX(-100%)' : 'none',
                }}
              >
                <div>Freq: {tooltip.hz.toFixed(0)} Hz</div>
                <div>Track: {tooltip.trackDb.toFixed(1)} dB</div>
                <div>Ref: {tooltip.refDb.toFixed(1)} dB</div>
                <div>Delta: {tooltip.delta > 0 ? '+' : ''}{tooltip.delta.toFixed(1)} dB</div>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/60">
            <span>track min {trackPath.min.toFixed(1)} | max {trackPath.max.toFixed(1)}</span>
            <span>ref min {refPath.min.toFixed(1)} | max {refPath.max.toFixed(1)}</span>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center text-xs text-white/60">
          Missing spectrum arrays. Devi farle generare dal Python analyzer e salvarle in arrays.json.
        </div>
      )}
    </PanelCard>
  );
}

function PowerCard({
  integrated,
  rms,
  lra,
  reanalyzePayload,
}: {
  integrated: number | null;
  rms: number | null;
  lra: number | null;
  reanalyzePayload: {
    versionId: string;
    projectId: string;
    audioUrl: string | null;
    profileKey: string | null;
    mode: "master" | "premaster";
    lang: "it" | "en";
  };
}) {
  if (integrated == null) {
    return (
      <PanelCard title="Power" subtitle="RMS, LUFS e quanto spacca" badge={<Badge text="missing" tone="warn" />}>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60">Missing loudness metrics. Re-analyze per calcolare LUFS.</div>
          <ReAnalyzeButton payload={reanalyzePayload} />
        </div>
      </PanelCard>
    );
  }

  const powerScore = Math.round(clamp(((integrated - -18) / 10) * 100, 0, 100));
  const powerLabel = integrated >= -12 ? "Aggressiva" : "Controllata";

  return (
    <PanelCard title="Power" subtitle="RMS, LUFS e quanto spacca" badge={<Badge text="power" tone="success" />}>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="text-xs text-white/50">Integrated LUFS</div>
          <div className="text-lg font-semibold text-white">{formatDecimal(integrated)}</div>
        </div>
        <div>
          <div className="text-xs text-white/50">RMS</div>
          <div className="text-lg font-semibold text-white">{formatDecimal(rms)}</div>
        </div>
        <div>
          <div className="text-xs text-white/50">LRA</div>
          <div className="text-lg font-semibold text-white">{formatDecimal(lra)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-xs text-white/60">Quanto spacca</div>
        <div className="flex items-center gap-3 text-lg font-semibold text-white">
          <span>{powerScore}</span>
          <span className="text-xs text-white/50">{powerLabel}</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/80" style={{ width: `${powerScore}%` }} />
        </div>
        <div className="text-xs text-white/50">Mappa da -18 LUFS (0) a -8 LUFS (100), clampata.</div>
      </div>
    </PanelCard>
  );
}

function TransientCard({
  transients,
  lra,
  reanalyzePayload,
}: {
  transients: {
    strength?: number;
    density?: number;
    crestFactorDb?: number;
  } | null;
  lra: number | null;
  reanalyzePayload: {
    versionId: string;
    projectId: string;
    audioUrl: string | null;
    profileKey: string | null;
    mode: "master" | "premaster";
    lang: "it" | "en";
  };
}) {
  if (!transients) {
    return (
      <PanelCard title="Transients" subtitle="Impatto e densità transienti" badge={<Badge text="missing" tone="warn" />}>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60">Missing transients metrics. Re-analyze per calcolare transienti.</div>
          <ReAnalyzeButton payload={reanalyzePayload} />
        </div>
      </PanelCard>
    );
  }

  const strength = typeof transients.strength === "number" ? transients.strength : 0;
  const density = typeof transients.density === "number" ? transients.density : 0;

  // accetta sia camelCase che snake_case
  const crest =
    typeof (transients as any).crestFactorDb === "number"
      ? (transients as any).crestFactorDb
      : typeof (transients as any).crest_factor_db === "number"
        ? (transients as any).crest_factor_db
        : null;

  // euristica semplice ma realistica coi valori che stai vedendo (es: strength ~ 1-4, crest ~ 8-13)
  const crestOk = crest == null ? true : crest >= 9.0;
  const densityOk = density >= 2.0 && density <= 12.0;
  const strengthOk = strength >= 0.6 && strength <= 6.0;

  const okCount = [crestOk, densityOk, strengthOk].filter(Boolean).length;
  const label = okCount === 3 ? "OK" : okCount === 2 ? "WARN" : "BAD";
  const tone: "success" | "warn" = okCount === 3 ? "success" : "warn";

  return (
    <PanelCard title="Transients" subtitle="Impatto e densità transienti" badge={<Badge text={label} tone={tone} />}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">Strength</span>
          <span className="text-sm font-semibold text-white">{strength.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">Density (per sec)</span>
          <span className="text-sm font-semibold text-white">{density.toFixed(1)}</span>
        </div>
        {crest != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">Crest Factor (dB)</span>
            <span className="text-sm font-semibold text-white">{crest.toFixed(1)}</span>
          </div>
        )}
        <p className="text-xs text-white/50">
          Strength indica l'impatto dei transienti. Density il numero per secondo. Crest factor misura il rapporto picco/RMS.
        </p>
      </div>
    </PanelCard>
  );
}

export default function AnalyzerV2Panel({
  model,
  reanalyze,
  onPlay,
  onShare,
}: {
  model: AnalyzerCompareModel;
  reanalyze: {
    versionId: string;
    projectId: string;
    audioUrl: string | null;
    profileKey: string | null;
    mode: "master" | "premaster";
    lang: "it" | "en";
  };
  onPlay?: () => void;
  onShare?: () => void;
}) {
  const momentary = Array.isArray((model as any).momentaryLufs) ? ((model as any).momentaryLufs as number[]) : [];
  const shortTerm = Array.isArray((model as any).shortTermLufs) ? ((model as any).shortTermLufs as number[]) : [];

  const trackBands = (model.bandsNorm ?? null) as Bands | null;
  const referenceBands = (model.referenceBandsNorm ?? null) as Bands | null;
  const referenceBandsPercentiles = (model as any).referenceBandsPercentiles ?? null;

  const trackSpectrum = Array.isArray((model as any).spectrumTrack) ? ((model as any).spectrumTrack as SpectrumPoint[]) : [];
  const referenceSpectrum = Array.isArray((model as any).spectrumRef) ? ((model as any).spectrumRef as SpectrumPoint[]) : [];

  const integrated = model.loudness?.integrated_lufs ?? null;
  const lra = model.loudness?.lra ?? null;

  const rms = ((model as any)?.loudness?.rms_db ?? null) as number | null;

  const transients = (model as any).transients ?? null;

  return (
    <div className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <AnalyzerHero model={model} onPlay={onPlay} onShare={onShare} />

        <LoudnessTimelineCard reanalyzePayload={reanalyze} momentary={momentary} shortTerm={shortTerm} />

        <TonalBalanceHorizontal track={trackBands} reference={referenceBands} percentiles={referenceBandsPercentiles} />

        <SpectrumCompareCard trackPoints={trackSpectrum} refPoints={referenceSpectrum} />

        <div className="grid gap-4 lg:grid-cols-2">
          <PowerCard integrated={integrated} rms={rms} lra={lra} reanalyzePayload={reanalyze} />
          <TransientCard transients={transients} lra={lra} reanalyzePayload={reanalyze} />
        </div>
      </div>
    </div>
  );
}
