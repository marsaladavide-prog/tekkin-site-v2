"use client";

import { useMemo, useState } from "react";
import type { Bands } from "@/lib/analyzer/v2/types";
import type { AnalyzerCardsModel } from "@/lib/analyzer/cards/types";
import type { RefState } from "@/lib/analyzer/cards/refState";
import { Card, SourcePills, StatusChip } from "../utils/ui";
import { BAND_ORDER, bandsToPct, clamp01, sumBands } from "../utils/number";
import { BAND_LABELS } from "./constants";

type BandsPercentiles = Record<string, { p10?: number; p90?: number; p25?: number; p75?: number }>;

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
      low: (band: string) => `Serve piu energia in ${band} (EQ/level/comp)`,
      high: (band: string) => `Alleggerisci ${band} con EQ o level`,
    },
    footerRef: "Giudizio basato sui percentili del reference model. Dettagli disponibili nel pannello.",
    footerNoRef: "Percentili reference non disponibili: mostra solo valori traccia.",
    trackPercentile: "Energia nella banda",
    targetWindow: "Range tipico (reference)",
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
    trackPercentile: "Band energy",
    targetWindow: "Typical range (reference)",
    refOn: "REF ON",
    refOff: "NO REF",
  },
} as const;

function fmt1(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fmt0(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "n/a";
  return String(Math.round(n));
}

type Props = {
  data?: AnalyzerCardsModel["computed"]["tonal"] | null;
  refState?: RefState | null;
  variant?: "full" | "compact";
};

export function TonalBalanceCard({ data, refState, variant = "full" }: Props) {
  const trackBands = data?.trackBands ?? null;
  const referencePercentiles = data?.referencePercentiles ?? null;
  const referenceName = data?.referenceName ?? null;
  const lang = data?.lang ?? "it";

  const hasTrackLive = !!trackBands && sumBands(trackBands) > 0;
  const fallbackState: RefState = {
    ref: false,
    live: hasTrackLive,
    mock: !hasTrackLive,
    reason: hasTrackLive ? "Dati tonali disponibili" : "Nessun dato tonal balance",
  };
  const badgeState = refState ?? fallbackState;

  return (
    <HorizontalTonalBalance
      trackBands={trackBands}
      referenceName={referenceName}
      referencePercentiles={referencePercentiles}
      lang={lang}
      refState={badgeState}
      embedded={variant !== "full"}
    />
  );
}

function HorizontalTonalBalance({
  trackBands,
  referenceName,
  referencePercentiles,
  lang = "it",
  refState,
  embedded,
}: {
  trackBands?: Bands | null;
  referenceName?: string | null;
  referencePercentiles?: BandsPercentiles | null;
  lang?: "it" | "en";
  refState: RefState;
  embedded?: boolean;
}) {
  const trackPct = useMemo(() => bandsToPct(trackBands), [trackBands]);

  const hasPerc = !!referencePercentiles;
  const hasTrack = !!trackBands && sumBands(trackBands) > 0;

  const copy = TONAL_COPY[lang] ?? TONAL_COPY.it;

  function bandRange(key: keyof Bands) {
    const p = referencePercentiles?.[key];
    const rawLow = p?.p25 ?? p?.p10 ?? null;
    const rawHigh = p?.p75 ?? p?.p90 ?? null;

    const label =
      p?.p25 != null && p?.p75 != null ? "25-75" : p?.p10 != null && p?.p90 != null ? "10-90" : "n/a";

    const refLooksNorm =
      typeof rawLow === "number" &&
      typeof rawHigh === "number" &&
      rawLow >= 0 &&
      rawHigh <= 1.2;

    return { low: rawLow, high: rawHigh, label, refLooksNorm };
  }

  function bandStatus(
    key: keyof Bands,
    tNorm: number | null,
    tPct: number | null
  ) {
    if (!hasPerc) return { status: "unknown" as const, refOk: false, range: bandRange(key) };

    const range = bandRange(key);
    if (range.low == null || range.high == null) return { status: "unknown" as const, refOk: false, range };

    const tVal = range.refLooksNorm ? tNorm : tPct;
    if (tVal == null) return { status: "unknown" as const, refOk: true, range };

    const low = range.refLooksNorm ? range.low : range.low;
    const high = range.refLooksNorm ? range.high : range.high;

    if (tVal < low) return { status: "low" as const, refOk: true, range };
    if (tVal > high) return { status: "high" as const, refOk: true, range };
    return { status: "ok" as const, refOk: true, range };
  }

  const bandData = BAND_ORDER.map((key) => {
    const tNorm = (trackBands as any)?.[key] ?? null;
    const tPctVal = hasTrack ? (trackPct as any)?.[key] : null;

    const status = bandStatus(
      key,
      typeof tNorm === "number" ? tNorm : null,
      typeof tPctVal === "number" ? tPctVal : null
    );
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
      tPct: typeof tPctVal === "number" ? tPctVal : null,
      status,
      chip,
      hint,
    };
  });

  const known = bandData.filter((b) => b.status.status !== "unknown").length;
  const okCount = bandData.filter((b) => b.status.status === "ok").length;
  const overallScore = known ? Math.round((okCount / known) * 100) : null;
  const [showDetails, setShowDetails] = useState(false);

  const content = (
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
            return (
              <div key={b.key} className={`rounded-xl border p-3 ${cardTone} min-w-[70px]`}>
                <div className={`mb-2 h-0.5 w-8 rounded-full ${topTone}`} />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold text-white/75 truncate" title={b.label}>{b.label}</div>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <StatusChip tone={chipTone}>{b.chip}</StatusChip>
                </div>

                {showDetails ? (
                  <div className="mt-2 text-[11px] text-white/45">
                    <div className="text-[12px] text-white/80">{b.hint}</div>
                    <div className="mt-2 space-y-1 text-[11px] text-white/60">
                      <div>
                        <span className="text-white/70">{copy.trackPercentile}:</span>{" "}
                        <span className="font-semibold text-white/85">
                          {b.tPct == null ? "n/a" : `${fmt1(b.tPct)}%`}
                        </span>
                      </div>

                      <div>
                        <span className="text-white/70">{copy.targetWindow}:</span>{" "}
                        <span className="font-semibold text-white/85">
                          {b.status.range.low != null && b.status.range.high != null
                            ? `${fmt1(b.status.range.low)}% - ${fmt1(b.status.range.high)}%`
                            : "n/a"}
                        </span>
                      </div>

                      <div className="text-white/55">
                        {b.status.status === "low"
                          ? "Sei sotto il range."
                          : b.status.status === "high"
                          ? "Sei sopra il range."
                          : b.status.status === "ok"
                          ? "Sei in linea col reference."
                          : "Reference range non disponibile."}
                      </div>
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
  );

  if (embedded) {
    return content;
  }

  return (
    <Card
      title={copy.title}
      subtitle={
        hasPerc ? copy.subtitleRef(referenceName) : copy.subtitleNoRef
      }
      right={
        <div className="flex items-center gap-3">
          <SourcePills state={refState} />
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
      {content}
    </Card>
  );
}
