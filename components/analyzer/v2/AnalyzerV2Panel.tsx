"use client";

import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";

function fmt0(v: number | null) {
  return v != null ? v.toFixed(0) : "n/a";
}

function fmt1(v: number | null) {
  return v != null ? v.toFixed(1) : "n/a";
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted";
}) {
  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
      {children}
    </span>
  );
}

// ====== TEMP STUBS (V2) – da sostituire con versioni complete ======

type Bands = AnalyzerCompareModel["bandsNorm"];
type SpectrumPoint = { hz: number; mag: number };
type SoundFieldPoint = { angleDeg: number; radius: number };
type LevelItem = { label: "L" | "C" | "R" | "Ls" | "Rs" | "LFE"; rmsDb: number; peakDb: number };

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        {subtitle && <div className="text-xs text-white/50">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function HorizontalTonalBalance({
  trackBands,
  referenceBands,
  referenceName,
}: {
  trackBands?: Bands | null;
  referenceBands?: Bands | null;
  referenceName?: string | null;
}) {
  return <Card title="Tonal balance">TODO</Card>;
}

function SoundFieldCard({
  points,
}: {
  points?: SoundFieldPoint[] | null;
}) {
  return <Card title="Sound field">TODO</Card>;
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
  return <Card title="Spectrum">TODO</Card>;
}

function LevelsMetersCard({
  levels,
}: {
  levels?: LevelItem[] | null;
}) {
  return <Card title="Levels">TODO</Card>;
}

function QuickFacts({ model }: { model: AnalyzerCompareModel }) {
  return <Card title="Quick facts">TODO</Card>;
}

function HealthChecks({ model }: { model: AnalyzerCompareModel }) {
  return <Card title="Checks">TODO</Card>;
}

function HumanAdvice({ model }: { model: AnalyzerCompareModel }) {
  return <Card title="Consigli">TODO</Card>;
}

function WhyThisScore({ model }: { model: AnalyzerCompareModel }) {
  return <Card title="Why this score">TODO</Card>;
}

export default function AnalyzerV2Panel({
  model,
  onPlay,
  onShare,
}: {
  model: AnalyzerCompareModel;
  onPlay?: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
        <AnalyzerHero model={model} onPlay={onPlay} onShare={onShare} />

        <div className="mt-6 grid grid-cols-1 gap-4">
          <HorizontalTonalBalance
            trackBands={model.bandsNorm}
            referenceBands={model.referenceBandsNorm}
            referenceName={model.referenceName}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SoundFieldCard points={model.soundField} />
            <div className="lg:col-span-2">
              <SpectrumCompareCard
                track={model.spectrumTrack}
                reference={model.spectrumRef}
                referenceName={model.referenceName}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LevelsMetersCard levels={model.levels} />
            </div>
            <QuickFacts model={model} />
          </div>

          <HealthChecks model={model} />
          <HumanAdvice model={model} />
          <WhyThisScore model={model} />
        </div>
      </div>
    </div>
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
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-white/60">Back to project</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-white">
              {model.projectTitle}
            </div>
            <Pill tone="muted">{model.mixType}</Pill>
            <span className="text-xs text-white/50">
              {model.versionName}
            </span>
          </div>
          <div className="mt-1 text-sm text-white/70">
            {model.key ?? "Key n/a"} · {model.bpm ?? "BPM n/a"} BPM ·{" "}
            {fmt1(model.loudness?.integrated_lufs ?? null)} LUFS
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
            Tekkin{" "}
            <span className="font-semibold text-white">
              {fmt0(model.overallScore ?? null)}
            </span>
          </div>

          <button
            type="button"
            onClick={onPlay}
            className="rounded-xl bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/20 hover:bg-emerald-400/20"
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