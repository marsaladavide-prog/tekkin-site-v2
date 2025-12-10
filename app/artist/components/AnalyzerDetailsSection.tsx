"use client";

import { Activity, ChartBar, Gauge, Info } from "lucide-react";
import {
  formatBpm,
  formatNumber,
  formatPercentage,
  getBandBadgeClass,
  getBandDisplayName,
  getBandWidthLabel,
  getConfidenceWidth,
  getMixHealthLabel,
  getWarningBadgeClass,
} from "./analyzerDisplayUtils";
import type {
  AnalyzerV1Result,
  AnalyzerWarning,
  HarmonicBalanceReport,
  ReferenceAi,
  StereoWidthInfo,
} from "@/types/analyzer";
import type { TekkinReadinessResult } from "@/lib/tekkinProfiles";
import { AnalyzerCollapsibleSection } from "./AnalyzerCollapsibleSection";

type MixHealthEntry = {
  label: string;
  value: number | null;
  description: string;
};

type ConfidenceEntry = {
  label: string;
  value: number | null;
};

type AnalyzerDetailsSectionProps = {
  mixHealthScore: number | null;
  mixHealthBreakdownEntries: MixHealthEntry[];
  confidenceEntries: ConfidenceEntry[];
  harmonicBalance: HarmonicBalanceReport | null;
  stereoWidth: StereoWidthInfo | null;
  loudness?: number | null;
  mixStateLabel: string;
  bpm?: number | null;
  brightnessLabel: string;
  spectralCentroidHz?: number | null;
  spectralRolloffHz?: number | null;
  spectralBandwidthHz?: number | null;
  refAi: ReferenceAi | null;
  matchPercent: number | null;
  matchLabel: string;
  matchDescription: string;
  readiness: TekkinReadinessResult;
  mixV1?: AnalyzerV1Result | null;
  warnings?: AnalyzerWarning[];
  feedbackText?: string | null;
};

export function AnalyzerDetailsSection({
  mixHealthScore,
  mixHealthBreakdownEntries,
  confidenceEntries,
  harmonicBalance,
  stereoWidth,
  loudness,
  mixStateLabel,
  bpm,
  brightnessLabel,
  spectralCentroidHz,
  spectralRolloffHz,
  spectralBandwidthHz,
  refAi,
  matchPercent,
  matchLabel,
  matchDescription,
  readiness,
  mixV1,
  warnings = [],
  feedbackText,
}: AnalyzerDetailsSectionProps) {
  const mixV1Structure = mixV1?.metrics?.structure ?? null;
  const mixV1Loudness =
    mixV1?.metrics?.loudness?.integrated_lufs ?? null;
  const mixV1Issues = mixV1?.issues ?? [];

  return (
    <AnalyzerCollapsibleSection
      title="Analisi tecnica dettagliata"
      subtitle="Mix Health, Confidence, spettro e report completo."
      defaultOpen={false}
    >
      <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-4 w-4 text-emerald-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Mix Health Score
              </span>
            </div>
            <span className="text-[10px] text-white/55">0-100</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-semibold text-white">
              {mixHealthScore != null ? mixHealthScore : "n.a."}
            </span>
            <span className="text-[11px] text-white/60">score</span>
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            {getMixHealthLabel(mixHealthScore)}
          </p>
          <p className="mt-2 text-[11px] text-white/70">
            Combina cinque aspetti del mix in un punteggio unico: volume (LUFS),
            tonalità, spettro, apertura stereo e dinamica.
          </p>
          {mixHealthScore != null ? (
            <div className="mt-3 grid gap-2 text-[10px] text-white/70 md:grid-cols-2">
              {mixHealthBreakdownEntries.map((entry) => (
                <div key={entry.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">{entry.label}</span>
                    <span className="font-semibold text-white">
                      {formatPercentage(entry.value)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10">
                    <div
                      className="h-1 rounded-full bg-emerald-400"
                      style={{ width: `${getConfidenceWidth(entry.value)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-white/50">{entry.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[10px] text-white/60">
              Score non ancora disponibile. Attendi che il processore completi
              tutte le metriche per vedere il breakdown.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/15 bg-black/80 px-3.5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-300" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
                Confidence system
              </span>
            </div>
            <span className="text-[10px] text-white/55">0-100%</span>
          </div>
          <p className="mt-1 text-[10px] text-white/60">
            Quanto l&apos;analyzer è sicuro delle sue misure (non è una
            valutazione della qualità del mix). Valori bassi indicano segnali
            sporchi, troppo silenziosi o poco leggibili.
          </p>
          <p className="text-[10px] text-white/60">
            Una confidence stereo bassa comunica incertezza nella misurazione
            dell&apos;apertura, non che il mix sia sbagliato.
          </p>
          <div className="mt-3 space-y-2 text-[11px] text-white/70">
            {confidenceEntries.map((entry) => (
              <div key={entry.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/60">{entry.label}</span>
                  <span className="font-semibold text-white">
                    {formatPercentage(entry.value)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/10">
                  <div
                    className="h-1 rounded-full bg-emerald-400"
                    style={{ width: `${getConfidenceWidth(entry.value)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(harmonicBalance || stereoWidth) && (
        <section className="mt-4 rounded-xl border border-white/12 bg-black/70 px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-sky-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Harmonic & Balance Report
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px]">
              <p className="text-[10px] uppercase text-white/60">Tilt</p>
              <p className="text-sm font-semibold text-white">
                {harmonicBalance
                  ? `${harmonicBalance.tilt_db.toFixed(2)} dB`
                  : "n.a."}
              </p>
              <p className="text-[10px] text-white/60">
                Indica la tonalità complessiva del mix rispetto al riferimento.
              </p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px]">
              <p className="text-[10px] uppercase text-white/60">Low end</p>
              <p className="text-sm font-semibold text-white">
                {harmonicBalance
                  ? `${harmonicBalance.low_end_definition.toFixed(2)}%`
                  : "n.a."}
              </p>
              <p className="text-[10px] text-white/60">
                Livello di definizione e punch nella parte bassa dello spettro.
              </p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[11px]">
              <p className="text-[10px] uppercase text-white/60">Hi end</p>
              <p className="text-sm font-semibold text-white">
                {harmonicBalance
                  ? `${harmonicBalance.hi_end_harshness.toFixed(1)}%`
                  : "n.a."}
              </p>
              <p className="text-[10px] text-white/60">
                Indica il rischio di alte aggressive o affaticanti sopra gli 8
                kHz.
              </p>
            </div>
          </div>

          {stereoWidth && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Stereo width score</span>
                <span>
                  Corr{" "}
                  {stereoWidth.global_correlation != null
                    ? stereoWidth.global_correlation.toFixed(2)
                    : "n.a."}
                </span>
              </div>
              <p className="text-[10px] text-white/60">
                LR balance{" "}
                {stereoWidth.lr_balance_db != null
                  ? `${stereoWidth.lr_balance_db.toFixed(1)} dB`
                  : "n.a."}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Object.entries(stereoWidth.band_widths_db).map(
                  ([band, value]) => (
                    <div
                      key={band}
                      className="rounded-lg border border-white/10 bg-black/60 p-2"
                    >
                      <p className="text-[10px] uppercase text-white/60">
                        {getBandDisplayName(band)}
                      </p>
                      <p className="text-sm font-semibold text-white">
                        {formatNumber(value, 2)} dB
                      </p>
                      <span
                        className={`mt-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${getBandBadgeClass(
                          value
                        )}`}
                      >
                        {getBandWidthLabel(value)}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              {loudness != null ? loudness.toFixed(1) : "n.a."}
            </span>
            <span className="text-[11px] text-white/60">LUFS</span>
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            Stato mix: <span className="font-semibold">{mixStateLabel}</span>
          </p>
        </div>

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
            <span className="text-xl font-semibold text-white">{formatBpm(bpm)}</span>
            <span className="text-[11px] text-white/60">BPM</span>
          </div>
          <p className="mt-1 text-[11px] text-white/60">
            Usa questo valore per allineare la versione a reference e set.
          </p>
        </div>

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
              <dd>{formatNumber(spectralCentroidHz, 0)} Hz</dd>
            </div>
            <div className="flex justify-between">
              <dt>Rolloff 95%</dt>
              <dd>{formatNumber(spectralRolloffHz, 0)} Hz</dd>
            </div>
            <div className="flex justify-between">
              <dt>Bandwidth</dt>
              <dd>{formatNumber(spectralBandwidthHz, 0)} Hz</dd>
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
                <p className="mt-0.5 text-[11px] font-medium text-emerald-300">
                  {matchLabel}
                </p>
                <p className="mt-0.5 text-[11px] text-white/60">
                  {matchDescription}
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
                {Object.entries(refAi.bands_status).map(([band, infoRaw]) => {
                  const info: any = infoRaw;
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
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {mixV1 && (
        <section className="mt-4 rounded-xl border border-white/12 bg-black/70 px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-sky-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Tekkin Analyzer V1 (legacy)
            </span>
          </div>
          <div className="mt-3 grid gap-3 text-[11px] text-white/80 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2">
              <p className="text-[10px] uppercase text-white/50">Integrated LUFS</p>
              <p className="text-sm font-semibold text-white">
                {mixV1Loudness != null ? `${mixV1Loudness.toFixed(1)} LUFS` : "n.a."}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2">
              <p className="text-[10px] uppercase text-white/50">Structure BPM</p>
              <p className="text-sm font-semibold text-white">
                {mixV1Structure?.bpm != null ? `${mixV1Structure.bpm.toFixed(0)} BPM` : "n.a."}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-2">
              <p className="text-[10px] uppercase text-white/50">Bars totali</p>
              <p className="text-sm font-semibold text-white">
                {mixV1Structure?.bars_total != null
                  ? mixV1Structure.bars_total
                  : "n.a."}
              </p>
            </div>
          </div>

          {mixV1Issues.length > 0 ? (
            <div className="mt-3 space-y-3 text-xs text-white/80">
              {mixV1Issues.slice(0, 4).map((issue, index) => (
                <div
                  key={`${issue.issue}-${index}`}
                  className="rounded-lg border border-white/15 bg-white/5 p-3"
                >
                  <p className="text-sm font-semibold text-white">{issue.issue}</p>
                  <p className="mt-1 text-[11px] text-white/70">{issue.analysis}</p>
                  {issue.suggestion && (
                    <p className="mt-1 text-[11px] text-lime-200">
                      Suggerimento: {issue.suggestion}
                    </p>
                  )}
                </div>
              ))}
              {mixV1Issues.length > 4 && (
                <p className="text-[10px] text-white/50">
                  Mostrate solo le note principali del vecchio motore V1.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-white/60">
              Nessun warning registrato dal motore V1 su questa versione.
            </p>
          )}
        </section>
      )}

      {warnings.length > 0 && (
        <section className="mt-4 rounded-xl border border-white/12 bg-black/80 px-3.5 py-3">
          <div className="flex items-center gap-1.5">
            <Info className="h-4 w-4 text-emerald-300" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">
              Analyzer warnings
            </span>
          </div>
          <div className="mt-3 space-y-2 text-[11px] text-white/80">
            {warnings.map((warning, index) => (
              <div
                key={`${warning.code}-${index}`}
                className="rounded-lg border border-white/15 bg-white/5 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    {warning.message}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${getWarningBadgeClass(
                      warning.severity
                    )}`}
                  >
                    {warning.severity}
                  </span>
                </div>
                <p className="text-[10px] text-white/60">Codice: {warning.code}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {feedbackText && feedbackText.trim().length > 0 && (
        <section className="mt-4 rounded-xl border border-white/15 bg-black px-3.5 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/65">
            <Info className="h-4 w-4 text-emerald-300" />
            Report tecnico completo
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg bg-black/90 p-2">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/80">
              {feedbackText}
            </pre>
          </div>
        </section>
      )}
      </div>
    </AnalyzerCollapsibleSection>
  );
}
