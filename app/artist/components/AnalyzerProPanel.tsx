"use client";

import { useState } from "react";
import {
  Gauge,
  Waves,
  Activity,
  Sparkles,
  ChartBar,
  Info,
} from "lucide-react";

export type AnalyzerVersion = {
  id: string;
  version_name: string;
  created_at?: string;
  audio_url?: string | null;

  // v3.6 core
  lufs: number | null;
  overall_score: number | null;
  feedback: string | null;

  sub_clarity?: number | null;
  hi_end?: number | null;
  dynamics?: number | null;
  stereo_image?: number | null;
  tonality?: number | null;

  // v4 extras salvati in DB
  analyzer_bpm?: number | null;
  analyzer_spectral_centroid_hz?: number | null;
  analyzer_spectral_rolloff_hz?: number | null;
  analyzer_spectral_bandwidth_hz?: number | null;
  analyzer_spectral_flatness?: number | null;
  analyzer_zero_crossing_rate?: number | null;

  // opzionali se un domani li passi dal backend
  analyzer_profile_key?: string | null;
  analyzer_mode?: string | null; // "master" | "premaster" ecc
};

type AnalyzerProPanelProps = {
  version: AnalyzerVersion;
};

function formatNumber(
  n: number | null | undefined,
  digits: number = 1,
  fallback: string = "n.a."
): string {
  if (n == null || Number.isNaN(n)) return fallback;
  return n.toFixed(digits);
}

function getBrightnessLabel(centroidHz?: number | null): string {
  if (centroidHz == null || centroidHz <= 0) return "Unknown";
  if (centroidHz < 1500) return "Dark / Warm";
  if (centroidHz < 3500) return "Balanced";
  if (centroidHz < 6000) return "Bright";
  return "Very bright";
}

function getTextureLabel(
  flatness?: number | null,
  zcr?: number | null
): string {
  if (flatness == null || zcr == null) return "Unknown";

  if (flatness < 0.2 && zcr < 0.08) return "Clean / Controlled";
  if (flatness < 0.3 && zcr < 0.15) return "Punchy";
  if (flatness >= 0.3 && zcr >= 0.15) return "Noisy / Aggressive";
  if (flatness >= 0.3 && zcr < 0.1) return "Bright but controlled";

  return "Mixed texture";
}

function getScoreColor(score?: number | null): string {
  if (score == null) return "text-white/60";
  if (score >= 8.5) return "text-emerald-400";
  if (score >= 7) return "text-emerald-300";
  if (score >= 5.5) return "text-amber-300";
  return "text-red-400";
}

function getMetricPillColor(value?: number | null): string {
  if (value == null) return "bg-white/5 text-white/60";
  if (value >= 0.7) return "bg-emerald-500/20 text-emerald-300";
  if (value >= 0.4) return "bg-amber-500/20 text-amber-300";
  return "bg-red-500/20 text-red-300";
}

export function AnalyzerProPanel({ version }: AnalyzerProPanelProps) {
  const [showFullFeedback, setShowFullFeedback] = useState(false);

  const brightnessLabel = getBrightnessLabel(
    version.analyzer_spectral_centroid_hz
  );
  const textureLabel = getTextureLabel(
    version.analyzer_spectral_flatness,
    version.analyzer_zero_crossing_rate
  );

  const modeLabel = version.analyzer_mode || "master";
  const profileLabel = version.analyzer_profile_key || "minimal_deep_tech";

  const feedbackText = version.feedback ?? "";
  const feedbackShort =
    feedbackText.length > 800
      ? feedbackText.slice(0, 800) + "..."
      : feedbackText;

  return (
    <section className="w-full rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top,_#22c55e20,_transparent_55%),_#050607] p-4 md:p-6 shadow-xl shadow-emerald-500/15 backdrop-blur">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-emerald-500/15 p-2">
            <Waves className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-[0.18em] text-emerald-300 uppercase">
              Tekkin Analyzer PRO
            </h2>
            <p className="mt-0.5 text-xs text-white/60">
              Version {version.version_name}
              {version.created_at ? (
                <>
                  {" "}
                  · analyzed {new Date(version.created_at).toLocaleString()}
                </>
              ) : null}
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">
              Engine v3.6 report + v4 extras for BPM and spectral insight.
            </p>
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/60">
                {modeLabel}
              </span>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/60">
                {profileLabel}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] uppercase tracking-wide text-white/50">
                Overall score
              </span>
              <span
                className={`text-2xl font-semibold ${getScoreColor(
                  version.overall_score
                )}`}
              >
                {version.overall_score != null
                  ? version.overall_score.toFixed(1)
                  : "n.a."}
                {version.overall_score != null ? "/10" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Loudness, Rhythm, Spectrum */}
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {/* Loudness */}
        <div className="rounded-xl border border-white/8 bg-white/5 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Loudness
              </span>
            </div>
            <span className="text-[10px] text-white/50">
              Target MDTech: -8.5 / -7.0 LUFS
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-white">
              {version.lufs != null ? version.lufs.toFixed(1) : "n.a."}
            </span>
            <span className="text-[11px] text-white/60">LUFS</span>
          </div>
          <p className="mt-1.5 text-[11px] text-white/60">
            Usa questo numero per allineare le tue versioni alla reference Tekkin
            per minimal deep tech.
          </p>
        </div>

  {/* Rhythm */}
        <div className="rounded-xl border border-white/8 bg-white/5 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Rhythm
              </span>
            </div>
            <span className="text-[10px] text-white/50">Timing & key</span>
          </div>

          {/* BPM grande */}
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-semibold text-white">
              {formatNumber(version.analyzer_bpm ?? null, 1)}
            </span>
            <span className="text-[11px] text-white/60">BPM</span>
          </div>

          {/* Key placeholder pulito */}
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-white/60">Key</span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/45">
              in arrivo
            </span>
          </div>

          <p className="mt-2 text-[11px] text-white/60">
            Usa il BPM per allineare groove, reference e set DJ. La key verrà
            aggiunta come metrica dedicata nelle prossime versioni.
          </p>
        </div>

        {/* Spectrum */}
        <div className="rounded-xl border border-white/8 bg-white/5 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ChartBar className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Spectrum
              </span>
            </div>
            <span className="text-[10px] text-white/50">{brightnessLabel}</span>
          </div>
          <dl className="mt-2 space-y-1.5 text-[11px] text-white/70">
            <div className="flex justify-between">
              <dt>Centroid</dt>
              <dd>{formatNumber(version.analyzer_spectral_centroid_hz, 0)} Hz</dd>
            </div>
            <div className="flex justify-between">
              <dt>Rolloff 95%</dt>
              <dd>{formatNumber(version.analyzer_spectral_rolloff_hz, 0)} Hz</dd>
            </div>
            <div className="flex justify-between">
              <dt>Bandwidth</dt>
              <dd>{formatNumber(version.analyzer_spectral_bandwidth_hz, 0)} Hz</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-[11px] text-white/60">
            Indica quanto il mix è bilanciato tra low e top. Valori molto alti
            di rolloff e centroid indicano mix molto bright.
          </p>
        </div>
      </div>

      {/* Row 2: Texture e Mix Metrics */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Texture */}
        <div className="rounded-xl border border-white/8 bg-white/5 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Texture
              </span>
            </div>
            <span className="text-[10px] text-white/50">{textureLabel}</span>
          </div>
          <dl className="mt-2 space-y-1.5 text-[11px] text-white/70">
            <div className="flex justify-between">
              <dt>Flatness</dt>
              <dd>{formatNumber(version.analyzer_spectral_flatness, 3)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Zero crossing</dt>
              <dd>{formatNumber(version.analyzer_zero_crossing_rate, 3)}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-[11px] text-white/60">
            Flatness e zero crossing insieme ti dicono quanto il contenuto è
            pulito, punchy o rumoroso. Utile per capire se stai over saturando.
          </p>
        </div>

        {/* Mix metrics v3.6 */}
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Info className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                Mix metrics
              </span>
            </div>
            <span className="text-[10px] text-emerald-200/80">
              From Tekkin profiles
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MetricPill label="Sub clarity" value={version.sub_clarity} />
            <MetricPill label="Hi end" value={version.hi_end} />
            <MetricPill label="Dynamics" value={version.dynamics} />
            <MetricPill label="Stereo image" value={version.stereo_image} />
            <MetricPill label="Tonality" value={version.tonality} />
          </div>
          <p className="mt-1.5 text-[11px] text-emerald-100/80">
            Questi valori arrivano direttamente dal tuo motore 3.6
            e possono alimentare Tekkin Rank o highlight automatici.
          </p>
        </div>
      </div>

      {/* Feedback section */}
      <div className="mt-5 rounded-xl border border-white/10 bg-black/60 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-emerald-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Tekkin Analyzer PRO report
            </span>
          </div>
          {feedbackText && feedbackText.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowFullFeedback((v) => !v)}
              className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-white/70 hover:bg-white/10"
            >
              {showFullFeedback ? "Collapse" : "Expand"}
            </button>
          ) : null}
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-black/60 p-2 text-[11px] leading-relaxed text-white/80">
          <pre className="whitespace-pre-wrap font-mono text-[11px]">
            {feedbackText
              ? showFullFeedback
                ? feedbackText
                : feedbackShort
              : "Nessun feedback disponibile per questa versione."}
          </pre>
        </div>
      </div>
    </section>
  );
}

type MetricPillProps = {
  label: string;
  value?: number | null;
};

function MetricPill({ label, value }: MetricPillProps) {
  const colorClass = getMetricPillColor(
    value != null ? Number(value) : null
  );

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${colorClass}`}
    >
      <span>{label}</span>
      <span className="text-white/70">
        {value != null ? value.toFixed(2) : "n.a."}
      </span>
    </div>
  );
}
