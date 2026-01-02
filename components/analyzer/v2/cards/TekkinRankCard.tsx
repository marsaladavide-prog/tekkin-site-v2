"use client";

import React, { useMemo, useState } from "react";
import type {
  TekkinVersionRankComponentKey,
  TekkinVersionRankDetails,
} from "@/lib/analyzer/tekkinRankTypes";
import { Card } from "../utils/ui";

type TekkinRankCardProps = {
  rank?: TekkinVersionRankDetails | null;
  referenceName?: string | null;
  suggestedReferenceKey?: string | null;
  suggestedReferenceMatch?: number | null;
  suggestedReferenceDelta?: number | null;
};

function fmtScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(1);
}

function fmtPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

const ISSUE_COPY: Record<
  TekkinVersionRankComponentKey,
  { ok: string; warn: string; action: string; praise: string; keep: string }
> = {
  tonal: {
    ok: "Bande tonali allineate al reference.",
    warn: "Bilanciamento sub/bassi/medi/alti non in target reference.",
    action: "Ribilancia le bande con EQ e livelli, confronta il reference.",
    praise: "Tonal balance centrato: sub, bassi e alte sono coerenti col reference.",
    keep: "Mantieni questi rapporti di banda, evita boost eccessivi.",
  },
  loudness: {
    ok: "LUFS e LRA in target.",
    warn: "LUFS/LRA non in target: volume o dinamica da riallineare.",
    action: "Regola gain e compressione, controlla il limiter.",
    praise: "Loudness solido: LUFS e LRA in target e controllati.",
    keep: "Non spingere oltre il limiter, preserva la dinamica.",
  },
  spectral: {
    ok: "Spettro coerente col reference.",
    warn: "Spettro non in target: centroid/bandwidth/rolloff/flatness non allineati.",
    action: "Lavora su centroid/rolloff con EQ o saturazione leggera.",
    praise: "Spettro allineato: equilibrio tra centroid, rolloff e flatness.",
    keep: "Evita nuove saturazioni che alterino il top-end.",
  },
  transients: {
    ok: "Transienti in linea col reference.",
    warn: "Transienti non in target: strength/density/crest/attack non allineati.",
    action: "Aggiusta attack e densita con transient shaper o comp parallela.",
    praise: "Transienti ottimi: attacco e densita coerenti col genere.",
    keep: "Non smussare troppo gli attacchi con compressioni aggressive.",
  },
  rhythm: {
    ok: "BPM e danceability in target.",
    warn: "Rhythm non in target: BPM o danceability da riallineare.",
    action: "Verifica timing e groove, mantieni il BPM stabile.",
    praise: "Rhythm centrato: BPM e danceability in target, groove stabile.",
    keep: "Mantieni il timing: piccole variazioni degradano il groove.",
  },
  stereo: {
    ok: "Stereo width e correlation in target.",
    warn: "Stereo non in target: width o correlation da riallineare.",
    action: "Controlla width globale e correlation: evita widening eccessivo.",
    praise: "Stereo solido: width e correlation coerenti col reference.",
    keep: "Mantieni il campo stereo stabile, senza eccessi di widening.",
  },
};

function getIssueCopy(key: TekkinVersionRankComponentKey, isOk: boolean) {
  return isOk ? ISSUE_COPY[key].ok : ISSUE_COPY[key].warn;
}

function getActionCopy(key: TekkinVersionRankComponentKey) {
  return ISSUE_COPY[key].action;
}

function getPraiseCopy(key: TekkinVersionRankComponentKey) {
  return ISSUE_COPY[key].praise;
}

function getKeepCopy(key: TekkinVersionRankComponentKey) {
  return ISSUE_COPY[key].keep;
}

export function TekkinRankExplanationCard({
  rank,
  referenceName,
  suggestedReferenceKey,
  suggestedReferenceMatch,
  suggestedReferenceDelta,
}: TekkinRankCardProps) {
const [openAdviceKey, setOpenAdviceKey] = useState<string | null>(null);

const precisionMap = useMemo(() => {
  if (!rank) return new Map<TekkinVersionRankComponentKey, number | null>();
  return new Map(rank.precisionBreakdown.map((entry) => [entry.key, entry.closeness]));
}, [rank]);

if (!rank) {
  return (
    <Card title="Tekkin Rank" subtitle="Cosa lo tiene sotto 100" className="h-full">
      <div className="text-sm text-white/60">
        Calcolo in corso o riferimento mancante. Riprova dopo un nuovo analyzer.
      </div>
    </Card>
  );
}


  const issueCandidates = rank.components
    .map((component) => {
      const closeness = precisionMap.get(component.key) ?? null;
      const isOk = component.score != null ? component.score >= 95 : false;
      const severity =
        component.score != null ? 1 - component.score / 100 : closeness != null ? 1 - closeness : 0;
      return {
        key: component.key,
        label: component.label,
        closeness,
        isOk,
        severity,
        description: getIssueCopy(component.key, isOk),
      };
    })
    .filter((entry) => !entry.isOk)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 3);

  const strongComponents = rank.components
    .filter((component) => component.score != null && component.score >= 95)
    .map((component) => component.label);

  const penaltyPoints = rank.penalties.reduce((acc, entry) => acc + entry.points, 0);
  const coachFocus = issueCandidates.length
    ? `Focus: ${issueCandidates.map((entry) => entry.label).join(", ")}.`
    : "Tutto in range: resta su questa linea.";
  const coachStrength = strongComponents.length
    ? `Punti forti: ${strongComponents.slice(0, 3).join(", ")}.`
    : "Sistema i fondamentali e alza il livello.";

  return (
    <Card title="Tekkin Rank" subtitle="Cosa lo tiene sotto 100" className="h-full">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-4xl font-semibold text-white">{Math.round(rank.score)}</div>
              <div className="text-[11px] text-white/60">Pre-penalty: {fmtScore(rank.prePenaltyScore)}</div>
              {rank.precisionBonus > 0 && (
                <div className="mt-1 text-[11px] text-emerald-300">
                  Precision bonus +{rank.precisionBonus.toFixed(1)}
                </div>
              )}
            </div>
            <div className="space-y-1 text-right text-[11px] text-white/60">
              <div>Fit reference: {fmtScore(rank.referenceFit)}</div>
              <div>Overall tecnico (info): {fmtScore(rank.baseQuality)}</div>
              {rank.penalties.length ? (
                <div className="text-emerald-300">Penalita -{penaltyPoints.toFixed(1)} pts</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Coach note</div>
          <div className="mt-2 text-[12px] text-white/80">{coachFocus}</div>
          <div className="mt-1 text-[11px] text-white/50">{coachStrength}</div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rank.components.map((component) => {
            const closeness = precisionMap.get(component.key) ?? null;
            const isOpen = openAdviceKey === component.key;
            const isStrong = component.score != null && component.score >= 95;
            return (
              <div key={component.key} className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-white">{component.label}</div>
                  <div className="text-sm font-semibold text-white">
                    {component.score != null ? `${component.score.toFixed(1)}` : "n/a"}
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/5">
                  {component.score != null && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
                      style={{ width: `${Math.min(100, Math.max(0, component.score))}%` }}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-white/50">
                  <span>Peso {Math.round(component.weight * 100)}%</span>
                  <span>+{component.contribution != null ? component.contribution.toFixed(1) : "n/a"}</span>
                  <span>Aderenza {fmtPercent(closeness)}</span>
                </div>
                <button
                  type="button"
                  className="mt-2 text-[10px] font-medium text-white/60 hover:text-white"
                  onClick={() =>
                    setOpenAdviceKey((prev) => (prev === component.key ? null : component.key))
                  }
                >
                  {isOpen ? "Chiudi dettagli" : "Dettagli"}
                </button>
                {isOpen ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/70">
                    {isStrong ? (
                      <>
                        <div className="text-[10px] text-white/50">Punto forte</div>
                        <p className="mt-2 text-white/70">{getPraiseCopy(component.key)}</p>
                        <div className="mt-3 text-[10px] text-white/50">Mantieni</div>
                        <p className="mt-2 text-white/70">{getKeepCopy(component.key)}</p>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] text-white/50">Cosa manca</div>
                        <p className="mt-2 text-white/70">{getIssueCopy(component.key, false)}</p>
                        <div className="mt-3 text-[10px] text-white/50">Cosa fare</div>
                        <p className="mt-2 text-white/70">{getActionCopy(component.key)}</p>
                      </>
                    )}
                    {component.detailLines?.length ? (
                      <div className="mt-3 space-y-1 text-[10px] text-white/50">
                        {component.detailLines.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
            Problemi principali
          </div>
          {issueCandidates.length ? (
            <ul className="space-y-2 text-[11px] text-white/70">
              {issueCandidates.map((issue) => (
                <li key={issue.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{issue.label}</span>
                    <span className="text-rose-300">
                      Score {fmtScore(rank.components.find((c) => c.key === issue.key)?.score ?? null)}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/50">Manca: {issue.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-white/50">
              Nessun problema critico: i componenti principali sono nel range target.
            </p>
          )}
        </div>

        <details className="rounded-xl border border-white/10 bg-black/20 p-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Dettagli
          </summary>
          <div className="mt-3 space-y-2 text-[11px] text-white/60">
            <div>Tekkin Rank = Fit reference + bonus - penalita.</div>
            <div>Overall tecnico: valore interno, solo informativo.</div>
            <div>
              Reference attiva: <span className="text-white/80">{referenceName ?? "n/a"}</span>. Se il sistema
              rileva un genere piu adatto, lo segnala qui.
            </div>
            {suggestedReferenceKey ? (
              <div>
                Genere suggerito: <span className="text-white/80">{suggestedReferenceKey}</span>
                {suggestedReferenceMatch != null ? (
                  <span className="text-white/50">
                    {" "}({Math.round(suggestedReferenceMatch * 100)}%
                    {suggestedReferenceDelta != null
                      ? `, +${Math.round(suggestedReferenceDelta * 100)}% vs attuale`
                      : ""}
                    )
                  </span>
                ) : null}
              </div>
            ) : (
              <div>Nessun genere suggerito.</div>
            )}
          </div>
        </details>

        {rank.penalties.length ? (
          <details className="rounded-xl border border-white/10 bg-black/20 p-3 text-[12px] text-white/70">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Penalita attive
            </summary>
            <ul className="mt-3 space-y-2">
              {rank.penalties.map((entry) => (
                <li key={entry.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-white/60">
                    <span>{entry.label}</span>
                    <span className="text-emerald-300">-{entry.points.toFixed(1)} pt</span>
                  </div>
                  <p className="text-[10px] text-white/40">{entry.details}</p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Card>
  );
}
