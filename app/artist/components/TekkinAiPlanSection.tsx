"use client";

import { Info } from "lucide-react";
import type { AnalyzerAiAction, AnalyzerAiCoach } from "@/types/analyzer";

type TekkinAiPlanSectionProps = {
  coach: AnalyzerAiCoach | null;
  loadingAi?: boolean;
  error?: string | null;
  onGenerateAi?: () => void;
};

const PRIORITY_STYLES: Record<AnalyzerAiAction["priority"], string> = {
  high: "text-red-200 bg-red-500/20",
  medium: "text-amber-200 bg-amber-500/20",
  low: "text-emerald-200 bg-emerald-500/20",
};

export function TekkinAiPlanSection({ coach, loadingAi, error, onGenerateAi }: TekkinAiPlanSectionProps) {
  const hasCoachContent = Boolean(
    coach &&
      (coach.summary?.trim() ||
        coach.actions.length > 0 ||
        coach.meta.artistic_assessment?.trim() ||
        coach.meta.label_fit?.trim() ||
        coach.meta.structure_feedback?.trim() ||
        coach.meta.risk_flags.length > 0)
  );
  const riskFlags = coach?.meta?.risk_flags ?? [];

  return (
    <section className="rounded-2xl border border-white/10 bg-black/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-emerald-300" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Tekkin AI
            </p>
            <p className="text-sm font-semibold text-white">Piano d&apos;azione Tekkin</p>
          </div>
        </div>
        {onGenerateAi && (
          <button
            type="button"
            onClick={onGenerateAi}
            disabled={loadingAi}
            className="rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200 disabled:opacity-50"
          >
            {loadingAi ? "Analisi in corso..." : "Chiedi a Tekkin AI"}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {!hasCoachContent && !loadingAi ? (
        <p className="mt-4 text-[11px] text-white/60">
          Nessun piano AI disponibile per questa versione.
        </p>
      ) : null}

      {coach?.summary ? (
        <p className="mt-4 text-sm text-white/80">{coach.summary}</p>
      ) : hasCoachContent && !loadingAi ? (
        <p className="mt-4 text-[11px] text-white/55">
          Riassunto AI in attesa di generazione.
        </p>
      ) : null}

      {coach?.meta && (
        <div className="mt-4 grid gap-3 text-[11px] text-white/80 md:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
              Valutazione artistica
            </p>
            <p className="mt-1 leading-relaxed text-sm text-white">
              {coach.meta.artistic_assessment}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">Label fit</p>
            <p className="mt-1 text-sm text-white">{coach.meta.label_fit ?? "n.a."}</p>
            <p className="mt-1 text-[10px] text-white/60">
              Potential gain: {coach.meta.predicted_rank_gain != null ? `+${coach.meta.predicted_rank_gain.toFixed(1)} punti` : "n.a."}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">Struttura</p>
            <p className="mt-1 text-sm text-white">
              {coach.meta.structure_feedback ?? "Nessun commento struttura."}
            </p>
          </div>
        </div>
      )}

      {riskFlags.length ? (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-1">Risk flags</p>
          <div className="flex flex-wrap gap-1.5">
            {riskFlags.map((flag) => (
              <span key={flag} className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-200">
                {flag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {coach?.actions.length ? (
        <div className="mt-4 space-y-3">
          {coach.actions.map((action) => (
            <div key={action.title} className="rounded-xl border border-white/15 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{action.title}</p>
                <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                  {action.focus_area}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-white/75">{action.description}</p>
              <span
                className={`mt-3 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${PRIORITY_STYLES[action.priority]}`}
              >
                Priorità {action.priority}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 rounded-xl border border-white/15 bg-black/70 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Domande su questa analisi?</p>
        <p className="mt-1 text-[11px] text-white/60">Prepara le tue domande per la futura assistenza AI.</p>
        <button
          type="button"
          onClick={() => console.log("Coming soon: AI Assistant placeholder")}
          className="mt-3 rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-400/10"
        >
          Chiedi qualcosa all&apos;Analyzer
        </button>
      </div>
    </section>
  );
}
