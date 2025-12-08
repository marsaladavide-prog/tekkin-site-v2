"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";

type TekkinScoreBreakdown = {
  total: number; // 0-10
  loudness: number; // 0-10
  spectrum: number; // bande in target
  rhythm: number; // bpm correctness
  profileMatch: number; // match AI profilo
};

type TekkinScoreInput = {
  lufs: number;
  targetLufsMin: number;
  targetLufsMax: number;
  bpm: number;
  idealBpm: number;
  profileMatchPercent: number; // 0-100
  bandsInTarget: number;
  bandsTotal: number;
};

// helper per clamp 0-10
function clampScore(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, value));
}

// conversione 0-10 → 0-100 per le progress bar
function scoreToPercent(score: number): number {
  return clampScore(score) * 10;
}

// arrotonda a 1 decimale
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Calcolo Tekkin Score ufficiale a partire dai raw metrics
 *
 * - loudness: distanza dal centro del range target in LUFS
 * - spectrum: percentuale di bande in target
 * - rhythm: differenza in BPM rispetto al target
 * - profileMatch: percentuale di match AI del profilo
 *
 * Pesi:
 * - loudness: 25 percento
 * - spectrum: 25 percento
 * - rhythm: 20 percento
 * - profileMatch: 30 percento
 */
function computeTekkinScore(input: TekkinScoreInput): TekkinScoreBreakdown {
  const {
    lufs,
    targetLufsMin,
    targetLufsMax,
    bpm,
    idealBpm,
    profileMatchPercent,
    bandsInTarget,
    bandsTotal,
  } = input;

  // 1) Loudness score
  const targetCenter = (targetLufsMin + targetLufsMax) / 2;
  const diffLufs = Math.abs(lufs - targetCenter);

  // mapping distanza LUFS → punteggio 0-10
  // 0.0 - 0.5 LUFS dal centro  -> 10
  // 0.5 - 1.0                  -> 9
  // 1.0 - 1.5                  -> 8
  // 1.5 - 2.0                  -> 7
  // 2.0 - 3.0                  -> 6
  // oltre 3.0                  -> 4
  let loudnessScore = 4;
  if (diffLufs <= 0.5) loudnessScore = 10;
  else if (diffLufs <= 1.0) loudnessScore = 9;
  else if (diffLufs <= 1.5) loudnessScore = 8;
  else if (diffLufs <= 2.0) loudnessScore = 7;
  else if (diffLufs <= 3.0) loudnessScore = 6;

  loudnessScore = clampScore(loudnessScore);

  // 2) Spectrum score da bande in target
  const bandRatio =
    bandsTotal > 0 ? Math.max(0, Math.min(1, bandsInTarget / bandsTotal)) : 0;
  const spectrumScore = clampScore(bandRatio * 10);

  // 3) Rhythm score da BPM
  const diffBpm = Math.abs(bpm - idealBpm);

  // mapping differenza BPM → punteggio
  // 0    BPM di differenza -> 10
  // 1    BPM              -> 9
  // 2    BPM              -> 8
  // 3    BPM              -> 7
  // 4    BPM              -> 6
  // >4   BPM              -> 5
  let rhythmScore = 5;
  if (diffBpm === 0) rhythmScore = 10;
  else if (diffBpm === 1) rhythmScore = 9;
  else if (diffBpm === 2) rhythmScore = 8;
  else if (diffBpm === 3) rhythmScore = 7;
  else if (diffBpm === 4) rhythmScore = 6;

  rhythmScore = clampScore(rhythmScore);

  // 4) Profile match score (0-100 → 0-10)
  const profileMatchScore = clampScore(profileMatchPercent / 10);

  // 5) totale ponderato
  const totalRaw =
    loudnessScore * 0.25 +
    spectrumScore * 0.25 +
    rhythmScore * 0.2 +
    profileMatchScore * 0.3;

  const total = clampScore(round1(totalRaw));

  return {
    total,
    loudness: round1(loudnessScore),
    spectrum: round1(spectrumScore),
    rhythm: round1(rhythmScore),
    profileMatch: round1(profileMatchScore),
  };
}

// piccolo componente per riga singola
function ScoreRow(props: {
  label: string;
  value: number;
  hint?: string;
}) {
  const percent = scoreToPercent(props.value);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-zinc-300">
        <span>{props.label}</span>
        <span className="font-semibold">{props.value.toFixed(1)} / 10</span>
      </div>
      <Progress value={percent} className="h-1.5 bg-zinc-900" />
      {props.hint && (
        <p className="mt-0.5 text-[11px] text-zinc-500">{props.hint}</p>
      )}
    </div>
  );
}

/**
 * Preview montata del Tekkin Score.
 *
 * Usa i dati del tuo screenshot:
 * - LUFS: -9.4
 * - Target LUFS: -8.5 / -7.0
 * - BPM: 129, target 128
 * - Match Tekkin: 94 percento
 * - Bande in target: 3 su 7
 */
export default function TekkinScorePreview() {
  const score = useMemo(
    () =>
      computeTekkinScore({
        lufs: -9.4,
        targetLufsMin: -8.5,
        targetLufsMax: -7.0,
        bpm: 129,
        idealBpm: 128,
        profileMatchPercent: 94,
        bandsInTarget: 3,
        bandsTotal: 7,
      }),
    []
  );

  return (
    <Card className="w-full max-w-xl border border-white/10 bg-black/70 text-white">
      <CardContent className="p-4 sm:p-5">
        {/* header */}
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">
              Tekkin Score
            </p>
            <p className="text-xs text-zinc-400">
              Aggrega loudness, spettro, ritmo e match profilo
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              totale
            </div>
            <div className="text-3xl font-semibold leading-none">
              {score.total.toFixed(1)}
            </div>
            <div className="text-[11px] text-zinc-500">su 10</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreRow
            label="Loudness"
            value={score.loudness}
            hint="Distanza dal range LUFS ideale del profilo"
          />
          <ScoreRow
            label="Spectrum"
            value={score.spectrum}
            hint="Percentuale di bande in target rispetto al profilo"
          />
          <ScoreRow
            label="Ritmo"
            value={score.rhythm}
            hint="Allineamento tra BPM della traccia e BPM ideale"
          />
          <ScoreRow
            label="Match profilo Tekkin"
            value={score.profileMatch}
            hint="Quanto il mix rispecchia il profilo AI scelto"
          />
        </div>

        <p className="mt-4 text-[11px] text-zinc-500">
          Nota: i target di LUFS, BPM e le bande in target devono arrivare dal
          backend Tekkin Analyzer per avere un punteggio coerente tra tutti gli
          utenti.
        </p>
      </CardContent>
    </Card>
  );
}
