"use client";

import { useMemo } from "react";
import { Waves, Gauge, Activity, ChartBar, Info } from "lucide-react";
import type {
  AnalyzerMetricsFields,
  AnalyzerV1Result,
  AnalyzerIssue,
  FixSuggestion,
  ReferenceAi,
  AnalyzerAiAction,
  AnalyzerAiMeta,
} from "@/types/analyzer";


import type {
  TekkinReadiness,
  TekkinReadinessResult,
} from "@/lib/tekkinProfiles";

import {
  evaluateTekkinStatus,
  getReadinessLabel,
} from "@/lib/tekkinProfiles";



type VersionRow = AnalyzerMetricsFields & {
  id: string;
  version_name: string;
  created_at?: string;
  audio_url?: string | null;
  analyzer_profile_key?: string | null;
  analyzer_mode?: string | null;
  fix_suggestions?: FixSuggestion[] | null;
  reference_ai?: ReferenceAi | null;
  analyzer_ai_summary?: string | null;
  analyzer_ai_actions?: AnalyzerAiAction[] | null;
  analyzer_ai_meta?: AnalyzerAiMeta | null;
};

type AnalyzerProPanelProps = {
  version: VersionRow;
  mixV1?: AnalyzerV1Result | null;
  aiSummary?: string | null;
  aiActions?: AnalyzerAiAction[] | null;
  aiMeta?: AnalyzerAiMeta | null;
  aiLoading?: boolean;
  aiError?: string | null;
  onAskAi?: () => void;
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

export function AnalyzerProPanel({
  version,
  mixV1,
  aiSummary,
  aiActions,
  aiMeta,
  aiLoading,
  aiError,
  onAskAi,
}: AnalyzerProPanelProps) {
  const modeLabel = version.analyzer_mode || "Master";
  const profileLabel = version.analyzer_profile_key || "Minimal / Deep Tech";
  const brightnessLabel = getBrightnessLabel(
    version.analyzer_spectral_centroid_hz
  );

  const mixState = getMixState(version.lufs);
  const scoreLabel = getScoreLabel(version.overall_score);
  const refAi = version.reference_ai || null;
  const effectiveLufs =
    version.lufs ?? mixV1?.metrics?.loudness?.integrated_lufs ?? null;

  const modelMatch = refAi?.model_match || null;
  const matchPercent: number | null =
    modelMatch?.match_percent != null
      ? modelMatch.match_percent
      : refAi != null && typeof refAi.match_ratio === "number"
      ? refAi.match_ratio * 100
      : null;

      const effectiveStructureBpm =
  version.analyzer_bpm ?? mixV1?.metrics?.structure?.bpm ?? null;

  const readiness: TekkinReadinessResult = refAi
    ? evaluateTekkinStatus({
        profileKey: refAi.profile_key,
        mode: version.analyzer_mode,
        matchPercent,
        lufs: version.lufs,
        lufsInTarget: refAi.lufs_in_target,
        crestInTarget: refAi.crest_in_target,
      })
    : {
        status: "unknown" as TekkinReadiness,
        reasons: [],
      };
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
  const aiSummaryText = aiSummary ?? version.analyzer_ai_summary ?? null;
  const aiActionsList = aiActions ?? version.analyzer_ai_actions ?? null;
  const aiMetaData = aiMeta ?? version.analyzer_ai_meta ?? null;

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
                {refAi.bands_in_target != null &&
                  refAi.bands_total != null && (
                    <p className="mt-0.5 text-[11px] opacity-70">
                      Bande in target:{" "}
                      <span className="font-medium">
                        {refAi.bands_in_target}/{refAi.bands_total}
                      </span>
                    </p>
                  )}
                {refAi.tone_tag && (
                  <p className="mt-0.5 text-[11px] opacity-70">
                    Tone: <span className="font-medium">{refAi.tone_tag}</span>
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-[11px] opacity-70">Match Tekkin</p>
                <p className="text-lg font-semibold leading-none">
                  {matchPercent != null ? `${matchPercent.toFixed(0)}%` : "n.a."}
                </p>
                <p className="mt-0.5 flex items-center justify-end gap-1.5">
                  <span className="text-[11px] opacity-60">
                    {matchPercent != null
                      ? getReadinessLabel(readiness.status)
                      : "Match sconosciuto"}
                  </span>
                  {matchPercent != null && (
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide " +
                        (readiness.status === "ready"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : readiness.status === "almost"
                          ? "bg-lime-500/15 text-lime-300"
                          : readiness.status === "work"
                          ? "bg-amber-500/20 text-amber-300"
                          : readiness.status === "early"
                          ? "bg-red-600/25 text-red-300"
                          : "bg-slate-600/30 text-slate-200")
                      }
                    >
                      Tekkin
                    </span>
                  )}
                </p>
                {readiness.reasons.length > 0 && (
                  <p className="mt-1 text-[10px] opacity-60">
                    {readiness.reasons[0]}
                  </p>
                )}
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
            </div>
          </div>

          {refAi.bands_status && (
            <div className="mt-2 rounded-xl border border-border/40 bg-black/30 p-3 text-[11px]">
              <p className="mb-2 font-semibold uppercase tracking-wide opacity-70">
                Bande vs target
              </p>
              <div className="grid grid-cols-7 gap-2">
                {Object.entries(refAi.bands_status).map(
                  ([band, infoRaw]) => {
                    const info: any = infoRaw as any;
                    const value =
                      typeof info.value === "number" ? info.value : null;
                    const status = info.status as
                      | "in_target"
                      | "low"
                      | "high"
                      | string;

                    return (
                      <div key={band} className="flex flex-col items-center">
                        <span className="uppercase text-[10px] opacity-70">
                          {band}
                        </span>
                        <span className="text-[11px]">
                          {value != null ? `${(value * 100).toFixed(0)}%` : "n.a."}
                        </span>
                        <span
                          className={
                            "mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] " +
                            (status === "in_target"
                              ? "bg-emerald-600/30 text-emerald-300"
                              : status === "low"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-red-600/20 text-red-300")
                          }
                        >
                          {status === "in_target"
                            ? "ok"
                            : status === "low"
                            ? "low"
                            : "high"}
                        </span>
                      </div>
                    );
                  }
                )}
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

      {mixV1 && (
        <section className="mt-4 rounded-xl border border-white/12 bg-black/70 px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-cyan-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Tekkin Analyzer V1
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-[11px] text-white/80 md:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase text-white/50">Loudness</p>
                <p className="text-sm font-semibold text-white">
                  {effectiveLufs != null
                    ? `${effectiveLufs.toFixed(1)} LUFS`
                    : "n.a."}
                </p>
              </div>
<div>
  <p className="text-[10px] uppercase text-white/50">Structure BPM</p>
  <p className="text-sm font-semibold text-white">
    {effectiveStructureBpm != null
      ? `${effectiveStructureBpm.toFixed(0)} BPM`
      : "n.a."}
  </p>
</div>
            <div>
              <p className="text-[10px] uppercase text-white/50">Structure bars</p>
              <p className="text-sm font-semibold text-white">
                {mixV1.metrics.structure.bars_total} barre
              </p>
            </div>
          </div>
          {mixV1.issues && mixV1.issues.length > 0 && (
            <div className="mt-3 space-y-3 text-xs text-white/80">
              {mixV1.issues.map((issue: AnalyzerIssue, index: number) => (
                <div
                  key={`${issue.issue}-${index}`}
                  className="rounded-lg border border-white/15 bg-white/5 p-3"
                >
                  <p className="text-sm font-semibold text-white">{issue.issue}</p>
                  <p className="mt-1 text-[11px] text-white/70">
                    {issue.analysis}
                  </p>
                  {issue.suggestion && (
                    <p className="mt-1 text-[11px] text-lime-200">
                      Suggerimento: {issue.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

            {/* TEKKIN AI COACH */}
      {(aiSummaryText ||
        (aiActionsList && aiActionsList.length > 0) ||
        aiMetaData ||
        onAskAi) && (
        <section className="mt-4 rounded-xl border border-white/12 bg-black/85 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Tekkin AI coach
              </span>
            </div>

            {onAskAi && (
              <button
                type="button"
                onClick={onAskAi}
                disabled={aiLoading}
                className="rounded-full border border-emerald-400/60 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-emerald-200 disabled:opacity-50"
              >
                {aiLoading ? "Analisi in corso..." : "Chiedi a Tekkin AI"}
              </button>
            )}
          </div>

          {aiError && (
            <p className="mt-2 text-[11px] text-red-300">{aiError}</p>
          )}

          {aiSummaryText ? (
            <p className="mt-2 text-[11px] text-white/75">{aiSummaryText}</p>
          ) : !aiLoading ? (
            <p className="mt-2 text-[11px] text-white/55">
              Nessun riassunto AI ancora generato per questa versione.
            </p>
          ) : null}

          {aiMetaData && (
            <div className="mt-3 grid gap-3 text-[11px] text-white/80 md:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase text-white/50">
                  Valutazione artistica
                </p>
                <p className="mt-1">{aiMetaData.artistic_assessment}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/50">Label fit</p>
                <p className="mt-1">{aiMetaData.label_fit ?? "n.a."}</p>
                <p className="mt-1 text-white/60">
                  Potential gain:{" "}
                  {aiMetaData.predicted_rank_gain != null
                    ? `+${aiMetaData.predicted_rank_gain.toFixed(1)} punti`
                    : "n.a."}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-white/50">Struttura</p>
                <p className="mt-1">
                  {aiMetaData.structure_feedback ??
                    "Nessun commento struttura."}
                </p>
              </div>
            </div>
          )}

          {aiMetaData?.risk_flags && aiMetaData.risk_flags.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase text-white/50 mb-1">
                Risk flags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {aiMetaData.risk_flags.map((flag: string) => (
                  <span
                    key={flag}
                    className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-200"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {aiActionsList && aiActionsList.length > 0 && (
            <div className="mt-3 space-y-2">
              {aiActionsList.map((action) => (
                <div
                  key={action.title}
                  className="rounded-lg border border-white/15 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {action.title}
                    </p>
                    <span className="text-[10px] uppercase tracking-wide text-white/60">
                      {action.focus_area} · {action.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-white/75">
                    {action.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {version.fix_suggestions && version.fix_suggestions.length > 0 && (
        <section className="mt-4 rounded-xl border border-white/12 bg-black/85 px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-emerald-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Fix mirati sul mix e sulle bande
            </span>
          </div>
          <div className="mt-3 space-y-3 text-xs text-white/80">
            {version.fix_suggestions.map((fix: FixSuggestion, idx: number) => (
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
                    {fix.steps.map((step: string, stepIndex: number) => (
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
