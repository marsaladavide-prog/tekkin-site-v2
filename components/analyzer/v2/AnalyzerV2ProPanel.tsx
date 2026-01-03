"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";
import type { AnalyzerCardsModel } from "@/lib/analyzer/cards/types";
import { TonalBalanceCard } from "./cards/TonalBalanceCard";
import { SpectrumCard } from "./cards/SpectrumCard";
import { LoudnessMeterCard } from "./cards/LoudnessMeterCard";
import { RhythmCard } from "./cards/RhythmCard";
import { TekkinRankExplanationCard } from "./cards/TekkinRankCard";
import { TransientsCard, TransientSignature } from "./cards/TransientsCard";
import { StereoCard, CorrelationMeter, StereoScope } from "./cards/StereoCard";
import { ExtraCard } from "./cards/ExtraCard";
import WaveformPreviewUnified from "@/components/player/WaveformPreviewUnified";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { Card, Pill, SourcePills } from "./utils/ui";
import { clamp01, formatDb } from "./utils/number";
import dynamic from "next/dynamic";

const AnalyzerBackground3D = dynamic(() => import("./visuals/AnalyzerBackground3D"), { ssr: false });

type SpectrumPoint = { hz: number; mag: number };


function fmt1(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fmt0(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return String(Math.round(n));
}

type ExpandableCardKey =
  | "tekkin-rank"
  | "tonal-snapshot"
  | "stereo-snapshot"
  | "transient-snapshot";

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



export default function AnalyzerV2ProPanel({
  model,
  onPlay,
  onShare,
  reanalyze,
  track,
  cardsModel,
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
  cardsModel: AnalyzerCardsModel;
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
    <div className="min-h-screen relative">
      <AnalyzerBackground3D />
      <div className="relative z-10 w-full max-w-[1400px] px-0 pb-20 pt-8 lg:px-2 xl:px-4">
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
                    <TonalBalanceCard
                      data={cardsModel.computed.tonal}
                      refState={cardsModel.computed.refStates.tonal}
                      variant="compact"
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
              refState={cardsModel.computed.refStates.loudness}
            />
          ) : null}

          {activeTab === "tonal" ? (
            <TonalBalanceCard
              data={cardsModel.computed.tonal}
              refState={cardsModel.computed.refStates.tonal}
              variant="full"
            />
          ) : null}

          {activeTab === "spectral" ? (
            <SpectrumCard
              data={cardsModel.computed.spectrum}
              refState={cardsModel.computed.refStates.spectrum}
              variant="full"
            />
          ) : null}

          {activeTab === "stereo" ? (
            <StereoCard
              data={cardsModel.computed.stereo}
              refState={cardsModel.computed.refStates.stereo}
              variant="full"
            />
          ) : null}

          {activeTab === "transients" ? (
            <TransientsCard
              data={cardsModel.computed.transients}
              refState={cardsModel.computed.refStates.transients}
              variant="full"
            />
          ) : null}

          {activeTab === "rhythm" ? (
            <RhythmCard
              bpm={merged.bpm}
              keyName={merged.key}
              rhythm={merged.rhythm ?? null}
              percentiles={merged.referenceRhythmPercentiles ?? null}
              descriptorsPercentiles={merged.referenceRhythmDescriptorsPercentiles ?? null}
              refState={cardsModel.computed.refStates.rhythm}
            />
          ) : null}

          {activeTab === "extra" ? (
            <ExtraCard data={cardsModel.computed.extra} variant="full" />
          ) : null}
        </div>
      </div>
    </div>
  );
}


