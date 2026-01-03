"use client";

import type { PercentileRange } from "@/lib/analyzer/v2/types";
import type { AnalyzerCardsModel } from "@/lib/analyzer/cards/types";
import type { RefState } from "@/lib/analyzer/cards/refState";
import { Card, StatusTone } from "../utils/ui";
import { clamp01 } from "../utils/number";

type TransientsComputed = AnalyzerCardsModel["computed"]["transients"];

type Props = {
  data: TransientsComputed;
  refState: RefState;
  variant?: "full" | "compact";
};

export function TransientsCard({ data, refState, variant = "full" }: Props) {
  const presentation = data ?? {};
  const values = presentation.transients ?? null;

  const cardClass = variant === "compact" ? "flex flex-col" : "h-full flex flex-col";
  const bodyClass = variant === "compact" ? "" : "flex-1 overflow-auto";
  const srReason = refState.reason ?? "";

  if (!values) {
    return (
      <Card
        title="Transients"
        subtitle="Impatto e densita"
        className={cardClass}
        bodyClassName={bodyClass}
        right={srReason ? <span className="sr-only">{srReason}</span> : null}
      >
        <div className="text-sm text-white/65">Dati transients non disponibili.</div>
      </Card>
    );
  }

  const legacyStrength = (() => {
    const legacyValue = (values as Record<string, unknown>).transient_strength;
    return typeof legacyValue === "number" ? legacyValue : null;
  })();
  const strength =
    typeof values.strength === "number" ? values.strength : legacyStrength;
  const legacyDensity = (() => {
    const legacyValue = (values as Record<string, unknown>).transient_density;
    return typeof legacyValue === "number" ? legacyValue : null;
  })();
  const density =
    typeof values.density === "number" ? values.density : legacyDensity;
  const legacyCrestFactor = (() => {
    const legacyValue = (values as Record<string, unknown>).crest_factor_db;
    return typeof legacyValue === "number" ? legacyValue : null;
  })();
  const crest: number | null =
    typeof values.crestFactorDb === "number" ? values.crestFactorDb : legacyCrestFactor;
  const logAttack =
    typeof values.log_attack_time === "number"
      ? values.log_attack_time
      : null;
  const attackSeconds =
    typeof logAttack === "number" && Number.isFinite(logAttack) ? Math.pow(10, logAttack) : null;

  const hasStrength = typeof strength === "number" && Number.isFinite(strength);
  const hasDensity = typeof density === "number" && Number.isFinite(density);

  const crestClassification = (() => {
    if (crest == null) return null;
    if (crest < 10) return { label: "Soft / flattened", tone: "low" as StatusTone };
    if (crest <= 18) return { label: "Balanced", tone: "ok" as StatusTone };
    return { label: "Spiky", tone: "high" as StatusTone };
  })();

  const ref = presentation.referencePercentiles ?? null;
  const referenceName = presentation.referenceName ?? null;

  const actionFallback = (() => {
    const hints: string[] = [];
    if (crest != null && crest < 10) hints.push("Riduci limiting e recupera attacco con transient shaper.");
    if (density != null && density > 10) hints.push("Semplifica layering o accorcia code per piu spazio.");
    if (strength != null && strength < 0.5) hints.push("Aumenta contrasto attacco/sustain con comp o shaper.");
    return hints.length ? hints.slice(0, 3) : ["Ascolta per coerenza: usa transient shaper solo dove serve."];
  })();

  const actions = actionFallback;

  const domainRange = (refPct?: PercentileRange | null, fallbackMax = 8) => {
    const domainMin = typeof refPct?.p10 === "number" ? refPct.p10 : 0;
    const domainMax = typeof refPct?.p90 === "number" ? refPct.p90 : fallbackMax;
    const denom = domainMax - domainMin || fallbackMax || 1;
    return { domainMin, domainMax, denom };
  };

  const targetBar = ({
    label,
    value,
    unit,
    refPct,
    max,
    meaning,
  }: {
    label: string;
    value: number | null;
    unit: string;
    refPct: PercentileRange | null | undefined;
    max: number;
    meaning: string;
  }) => {
    const { domainMin, domainMax, denom } = domainRange(refPct, max);
    const refLeft = typeof refPct?.p10 === "number" ? clamp01((refPct.p10 - domainMin) / denom) : null;
    const refRight = typeof refPct?.p90 === "number" ? clamp01((refPct.p90 - domainMin) / denom) : null;
    const marker = typeof value === "number" && Number.isFinite(value) ? clamp01((value - domainMin) / denom) : null;
    const refText =
      refPct && (typeof refPct.p10 === "number" || typeof refPct.p90 === "number")
        ? `Ref p10/p90: ${typeof refPct.p10 === "number" ? refPct.p10.toFixed(2) : "n/a"} / ${
            typeof refPct.p90 === "number" ? refPct.p90.toFixed(2) : "n/a"
          }`
        : "Ref p10/p90: n/a";

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span>{label}</span>
          <span>{value == null ? "n/a" : `${value.toFixed(2)}${unit}`}</span>
        </div>
        <div className="relative h-3 w-full rounded-full bg-white/5">
          {refLeft != null && refRight != null && (
            <div
              className="absolute inset-y-0 rounded-full bg-blue-500/25"
              style={{ left: `${refLeft * 100}%`, width: `${Math.max(2, (refRight - refLeft) * 100)}%` }}
            />
          )}
          {marker != null && (
            <div className="absolute inset-y-0 w-0.5 bg-emerald-300" style={{ left: `${marker * 100}%` }} />
          )}
        </div>
        <div className="text-[10px] text-white/40">{refText}</div>
        <div className="text-[10px] text-white/40">
          <span className="font-semibold">Meaning:</span> {meaning}
        </div>
      </div>
    );
  };

  return (
    <Card
      title="Transients"
      subtitle="Impatto e densita"
      className={cardClass}
      bodyClassName={bodyClass}
      right={srReason ? <span className="sr-only">{srReason}</span> : null}
    >
      <div className="space-y-3 text-white/70">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {targetBar({
            label: "Strength",
            value: hasStrength ? strength : null,
            unit: "",
            refPct: ref?.strength ?? null,
            max: 8,
            meaning: "Impact vs sustain: quanto emergono i transienti rispetto al sustain.",
          })}
          {targetBar({
            label: "Density",
            value: hasDensity ? density : null,
            unit: " 1/s",
            refPct: ref?.density ?? null,
            max: 16,
            meaning: "Hit per secondo: traccia quanto e ritmico il contenuto.",
          })}
          {targetBar({
            label: "Crest",
            value: crest,
            unit: " dB",
            refPct: ref?.crest_factor_db ?? null,
            max: 24,
            meaning: crestClassification?.label ?? "Peak/RMS ratio",
          })}
          {targetBar({
            label: "Attack time",
            value: attackSeconds,
            unit: " s",
            refPct: ref?.log_attack_time
              ? {
                  p10:
                    typeof ref.log_attack_time.p10 === "number"
                      ? Math.pow(10, ref.log_attack_time.p10)
                      : undefined,
                  p90:
                    typeof ref.log_attack_time.p90 === "number"
                      ? Math.pow(10, ref.log_attack_time.p90)
                      : undefined,
                }
              : null,
            max: 0.12,
            meaning: "Tempo stimato: un attacco troppo breve puo sembrare impastato.",
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-white/55">
            <span>Reference</span>
            <span>{referenceName ?? "no ref"}</span>
          </div>
          <TransientSignature strengthValue={strength} densityValue={density} attackValue={attackSeconds} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">What to do next</div>
          <div className="mt-1 space-y-1 text-[11px]">
            {actions.map((hint, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-white/60">-</span>
                <span>{hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function TransientSignature({
  strengthValue,
  densityValue,
  attackValue,
}: {
  strengthValue: number | null;
  densityValue: number | null;
  attackValue: number | null;
}) {
  const W = 520;
  const H = 120;
  const pulses = Math.min(8, Math.max(2, Math.round(densityValue ?? 4)));
  const hitsPerMin = typeof densityValue === "number" ? Math.round(densityValue * 60) : null;
  const attack = Math.min(0.35, Math.max(0.06, (attackValue ?? 0.02) * 2));
  const amp = Math.min(0.95, Math.max(0.35, (strengthValue ?? 1) / 4));

  const topPath = makeTransientSignaturePath({ height: H - 10, width: W, pulses, amp, attack });
  const lowPath = makeTransientSignaturePath({
    height: H - 10,
    width: W,
    pulses,
    amp: amp * 0.55,
    attack: attack * 1.4,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between text-[11px] text-white/55">
        <span>Transient signature</span>
        <span>{hitsPerMin != null ? `${hitsPerMin} hits/min` : "n/a"}</span>
      </div>
      <div className="mt-2">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <rect x={0} y={0} width={W} height={H} fill="rgba(255,255,255,0.02)" />
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={i} x1={(W / 5) * i} y1={6} x2={(W / 5) * i} y2={H - 6} stroke="rgba(255,255,255,0.05)" />
          ))}
          <path d={topPath} fill="none" stroke="#eab308" strokeWidth={2.2} />
          <path d={lowPath} fill="none" stroke="#a855f7" strokeWidth={2} />
          <text x={W - 6} y={H - 6} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10">
            time (sec)
          </text>
          <text x={6} y={H - 6} textAnchor="start" fill="rgba(255,255,255,0.3)" fontSize="10">
            0s
          </text>
          <text
            x={6}
            y={12}
            textAnchor="start"
            fill="rgba(255,255,255,0.35)"
            fontSize="10"
            transform={`rotate(-90 6 12)`}
          >
            amp / hits/min
          </text>
        </svg>
      </div>
      <div className="mt-2 text-[10px] text-white/45">
        Giallo = attacco, viola = sustain. Grafico sintetico basato su strength, density e attack time.
      </div>
    </div>
  );
}

function makeTransientSignaturePath({
  height,
  width,
  pulses,
  amp,
  attack,
}: {
  height: number;
  width: number;
  pulses: number;
  amp: number;
  attack: number;
}) {
  const total = 240;
  const decay = 6.5;
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < total; i++) {
    const t = i / (total - 1);
    const local = (t * pulses) % 1;
    let v = 0;
    if (local < attack) {
      v = local / attack;
    } else {
      v = Math.exp(-(local - attack) * decay);
    }
    const y = height - v * amp * height;
    points.push({ x: t * width, y });
  }
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}
