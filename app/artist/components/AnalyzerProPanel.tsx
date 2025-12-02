"use client";

import { useMemo } from "react";
import { Waves, Gauge, Activity, ChartBar, Info } from "lucide-react";
import type { FixSuggestion, ReferenceAi } from "@/types/analyzer";

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

  // v4 extras
  analyzer_bpm?: number | null;
  analyzer_spectral_centroid_hz?: number | null;
  analyzer_spectral_rolloff_hz?: number | null;
  analyzer_spectral_bandwidth_hz?: number | null;
  analyzer_spectral_flatness?: number | null;
  analyzer_zero_crossing_rate?: number | null;

  analyzer_profile_key?: string | null; // in futuro: genere scelto dall artista
  analyzer_mode?: string | null; // in futuro: "master" | "premaster" scelto dall artista
  fix_suggestions?: FixSuggestion[] | null;
  reference_ai?: ReferenceAi | null;
};

type AnalyzerProPanelProps = {
  version: AnalyzerVersion;
};

function normalizeBpmValue(raw?: number | null): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;

  let bpm = raw;

  const hardMin = 60;
  const hardMax = 180;

  while (bpm > hardMax && bpm / 2 >= hardMin) {
    bpm = bpm / 2;
  }

  while (bpm < hardMin && bpm * 2 <= hardMax) {
    bpm = bpm * 2;
  }

  return Math.round(bpm);
}

function formatBpm(raw?: number | null): string {
  const bpm = normalizeBpmValue(raw);
  if (bpm == null) return "n.a.";
  const displayedBpm = bpm < 90 ? Math.round(bpm * 2) : bpm;
  return String(displayedBpm);
}

function formatNumber(
  n: number | null | undefined,
  digits: number = 1,
  fallback = "n.a."
) {
  if (n == null || Number.isNaN(n)) return fallback;
  return n.toFixed(digits);
}

function getBrightnessLabel(centroidHz?: number | null): string {
  if (centroidHz == null || centroidHz <= 0) return "Sconosciuto";
  if (centroidHz < 1500) return "Dark / Warm";
  if (centroidHz < 3500) return "Bilanciato";
  if (centroidHz < 6000) return "Bright";
  return "Molto bright";
}

function getMixState(lufs?: number | null): string {
  if (lufs == null) return "Sconosciuto";
  if (lufs <= -11) return "Molto conservativo";
  if (lufs <= -9.5) return "Conservativo";
  if (lufs <= -8.5) return "In zona club";
  if (lufs <= -7) return "Aggressivo";
  return "Molto aggressivo";
}

function getScoreLabel(score?: number | null): string {
  if (score == null) return "Analisi parziale";
  if (score >= 8.5) return "Ready";
  if (score >= 7) return "Almost";
  if (score >= 5.5) return "Work in progress";
  return "Early";
}

export function AnalyzerProPanel({ version }: AnalyzerProPanelProps) {
  const modeLabel = version.analyzer_mode || "Master";
  const profileLabel = version.analyzer_profile_key || "Minimal / Deep Tech";
  const brightnessLabel = getBrightnessLabel(
    version.analyzer_spectral_centroid_hz
  );

  const mixState = getMixState(version.lufs);
  const scoreLabel = getScoreLabel(version.overall_score);
  const refAi = version.reference_ai;

  console.log("REF AI PANEL:", refAi, version.id); // <--- aggiungi questa riga

  const quickBullets = useMemo(() => {
    const items: string[] = [];

    if (version.lufs != null) {
      items.push(`Loudness attuale: ${version.lufs.toFixed(1)} LUFS`);
    }

    if (version.analyzer_bpm != null) {
      const bpmDisplay = formatBpm(version.analyzer_bpm);
      items.push(`BPM rilevato: ${bpmDisplay}`);
    }

    const brightness = getBrightnessLabel(
      version.analyzer_spectral_centroid_hz
    );
    items.push(`Tonalità generale: ${brightness}`);

    return items;
  }, [
    version.lufs,
    version.analyzer_bpm,
    version.analyzer_spectral_centroid_hz,
  ]);

  const feedbackText = version.feedback ?? "";

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-black/70 p-4 md:p-5 shadow-xl shadow-black/50">
      {/* HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 rounded-lg bg-emerald-500/20 p-2">
            <Waves className="h-4 w-4 text-emerald-300" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-emerald-300">
              Tekkin Analyzer PRO
            </p>
            <p className="text-sm font-medium text-white">
              Versione {version.version_name}
            </p>
            <p className="mt-0.5 text-[11px] text-white/55">
              Analizzato il{" "}
              {version.created_at
                ? new Date(version.created_at).toLocaleString("it-IT")
                : "data non disponibile"}
              . Engine v3.6 con extras BPM e spectral.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 text-right">
          <div className="flex gap-2">
            <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
              {modeLabel}
            </span>
            <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
              {profileLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-wide text-white/55">
              Tekkin score
            </span>
            <span className="text-xl font-semibold text-white">
              {version.overall_score != null
                ? version.overall_score.toFixed(1)
                : "n.a."}
            </span>
            {version.overall_score != null && (
              <span className="text-[11px] text-white/55">
                ({scoreLabel})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {/* Loudness */}
        <div className="rounded-xl border border-white/12 bg-black/80 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Loudness
              </span>
            </div>
            <span className="text-[10px] text-white/55">
              Target: -8.5 / -7.0
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-semibold text-white">
              {version.lufs != null ? version.lufs.toFixed(1) : "n.a."}
            </span>
            <span className="text-[11px] text-white/60">LUFS</span>
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            Stato mix: <span className="font-semibold">{mixState}</span>
          </p>
        </div>

        {/* Rhythm */}
        <div className="rounded-xl border border-white/12 bg-black/80 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Rhythm
              </span>
            </div>
            <span className="text-[10px] text-white/55">Timing</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-semibold text-white">
              {formatBpm(version.analyzer_bpm)}
            </span>
            <span className="text-[11px] text-white/60">BPM</span>
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            Usa questo valore per allineare la versione a reference e set.
          </p>
        </div>

        {/* Spectrum */}
        <div className="rounded-xl border border-white/12 bg-black/80 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ChartBar className="h-4 w-4 text-sky-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Spectrum
              </span>
            </div>
            <span className="text-[10px] text-white/55">{brightnessLabel}</span>
          </div>
          <dl className="mt-1.5 space-y-1 text-[11px] text-white/70">
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
        </div>
      </div>

      {refAi && (
        <section className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide uppercase mb-2 text-foreground/80">
            Reference AI - Profile match
          </h3>

          <div className="rounded-xl border border-border/60 bg-black/40 p-3 text-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] opacity-70">Profilo</p>
                <p className="text-sm font-medium">{refAi.profile_label}</p>
              </div>

              <div className="text-right">
                <p className="text-[11px] opacity-70">Match</p>
                <p className="text-lg font-semibold leading-none">
                  {(refAi.match_ratio * 100).toFixed(0)}%
                </p>
                <p className="text-[11px] opacity-60 mt-0.5">
                  {refAi.match_ratio >= 0.75
                    ? "Molto vicino al profilo"
                    : refAi.match_ratio >= 0.5
                    ? "Abbastanza vicino"
                    : refAi.match_ratio >= 0.25
                    ? "Lontano"
                    : "Molto lontano"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] opacity-80">
              <span>
                Loudness in target:{" "}
                <span className="font-medium">
                  {refAi.lufs_in_target ? "si" : "no"}
                </span>
              </span>
              <span>
                Crest in target:{" "}
                <span className="font-medium">
                  {refAi.crest_in_target ? "si" : "no"}
                </span>
              </span>
              <span>
                Tone: <span className="font-medium">{refAi.tone_tag}</span>
              </span>
            </div>
          </div>

          {refAi.bands_status && (
            <div className="mt-2 rounded-xl border border-border/40 bg-black/30 p-3 text-[11px]">
              <p className="mb-2 font-semibold uppercase tracking-wide opacity-70">
                Bande vs target
              </p>
              <div className="grid grid-cols-7 gap-2">
                {Object.entries(refAi.bands_status).map(([band, info]) => (
                  <div key={band} className="flex flex-col items-center">
                    <span className="uppercase text-[10px] opacity-70">
                      {band}
                    </span>
                    <span className="text-[11px]">
                      {(info.value * 100).toFixed(0)}%
                    </span>
                    <span
                      className={
                        "mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] " +
                        (info.status === "in_target"
                          ? "bg-emerald-600/30 text-emerald-300"
                          : info.status === "low"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-red-600/20 text-red-300")
                      }
                    >
                      {info.status === "in_target"
                        ? "ok"
                        : info.status === "low"
                        ? "low"
                        : "high"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* QUICK MIX REPORT (BREVE) */}
      <div className="mt-4 rounded-xl border border-white/12 bg-black/85 px-3.5 py-3">
        <div className="flex items-center gap-1.5">
          <Info className="h-4 w-4 text-emerald-300" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
            Quick mix report
          </span>
        </div>
        <p className="mt-1 text-[11px] text-white/60">
          Punti chiave estratti dal report tecnico.
        </p>
        <ul className="mt-2 space-y-1 text-[11px] text-white/80">
          {quickBullets.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>
      </div>

      {version.fix_suggestions && version.fix_suggestions.length > 0 && (
        <section className="mt-4 rounded-xl border border-white/12 bg-black/85 px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-emerald-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Fix mirati sul mix e sulle bande
            </span>
          </div>
          <div className="mt-3 space-y-3 text-xs text-white/80">
            {version.fix_suggestions.map((fix, idx) => (
              <div
                key={`${fix.issue}-${idx}`}
                className="rounded-lg border border-white/15 bg-white/5 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">
                    {fix.issue}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-white/60">
                    {fix.priority}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/70">{fix.analysis}</p>
                {fix.steps && fix.steps.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-white/70">
                    {fix.steps.map((step, stepIndex) => (
                      <li key={stepIndex}>{step}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TERMINAL / REPORT COMPLETO */}
      <div className="mt-4 rounded-xl border border-white/15 bg-black px-3.5 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/65">
          <Info className="h-4 w-4 text-emerald-300" />
          Report tecnico completo
        </p>
        <div className="max-h-72 overflow-y-auto rounded-lg bg-black/90 p-2">
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/80">
            {feedbackText || "Nessun report testuale disponibile per questa versione."}
          </pre>
        </div>
      </div>
    </section>
  );
}
