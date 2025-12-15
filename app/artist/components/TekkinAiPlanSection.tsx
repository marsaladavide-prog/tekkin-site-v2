"use client";

import { useMemo } from "react";
import type { AnalyzerAiCoach, AnalyzerAiAction } from "@/types/analyzer";
import { AnalyzerActionGroups } from "./AnalyzerActionGroups";
import {
  mapAiFocusAreaToCategory,
  type ActionCategoryKey,
  type AnalyzerInterventionAction,
} from "./analyzerActionUtils";

type TekkinAiPlanSectionProps = {
  aiCoach: AnalyzerAiCoach | null;
  isGenerating: boolean;
  hasAnalyzerResult: boolean;
  onGenerateAi: () => void | Promise<void>;
};

export function TekkinAiPlanSection({
  aiCoach,
  isGenerating,
  hasAnalyzerResult,
  onGenerateAi,
}: TekkinAiPlanSectionProps) {
  const hasAi = Boolean(aiCoach);

  const aiActionsMapped: AnalyzerInterventionAction[] = useMemo(() => {
    const list = aiCoach?.actions ?? [];
    return list.map((a: AnalyzerAiAction, idx) => {
      const category: ActionCategoryKey =
        mapAiFocusAreaToCategory(a.focus_area) ?? "dynamics";
      const priority = a.priority === "high" || a.priority === "low" ? a.priority : "medium";
      return {
        id: a.title ? `ai-${idx}-${a.title}` : `ai-${idx}`,
        title: a.title,
        description: a.description,
        category,
        priority,
        source: "ai",
      } satisfies AnalyzerInterventionAction;
    });
  }, [aiCoach?.actions]);

  return (
    <section className="rounded-xl border border-white/10 bg-black/40 p-5">
      <div className="space-y-1">
        <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-white/60">
          Livello 2 – Piano Tekkin AI
        </h3>
        <p className="text-[11px] text-white/70">
          Riassunto e piano di intervento basato sui dati tecnici Tekkin Analyzer.
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/70">
          Usa queste mosse per rifinire il mix prima del master o del club test.
        </p>

        <button
          type="button"
          onClick={onGenerateAi}
          disabled={isGenerating || !hasAnalyzerResult}
          className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[11px] font-semibold text-black disabled:opacity-40"
        >
          {isGenerating
            ? "Generazione in corso"
            : hasAi
            ? "Rigenera piano Tekkin"
            : "Crea piano Tekkin"}
        </button>
      </div>

      {!hasAi && (
        <p className="mt-4 text-[11px] text-white/60">
          Lancia prima Tekkin Analyzer sulla versione, poi genera il piano Tekkin AI
          per avere un riassunto intelligente e 3-4 mosse di intervento.
        </p>
      )}

      {hasAi && aiCoach && (
        <div className="mt-4 space-y-5">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[11px] font-semibold text-white/80">
              Piano d'azione Tekkin
            </p>
            <p className="mt-1 text-[11px] text-white/80 whitespace-pre-line">
              {aiCoach.summary}
            </p>
          </div>

          <AnalyzerActionGroups actions={aiActionsMapped} />

          <div className="grid gap-3 rounded-lg bg-white/5 p-3 text-[11px] text-white/80 md:grid-cols-2">
            <div>
              <p className="font-semibold text-white">Valutazione artistica</p>
              <p className="mt-1 text-white/80">
                {aiCoach.meta?.artistic_assessment || "Nessuna valutazione disponibile."}
              </p>
            </div>

            <div>
              <p className="font-semibold text-white">Label fit</p>
              <p className="mt-1 text-white/80">
                {aiCoach.meta?.label_fit || "Non è stato trovato un fit chiaro."}
              </p>

              <p className="mt-2 font-semibold text-white">Struttura e resa per DJ</p>
              <p className="mt-1 text-white/80">
                {aiCoach.meta?.structure_feedback ||
                  "Nessuna nota specifica sulla struttura."}
              </p>
            </div>

            <div>
              <p className="font-semibold text-white">Risk flags</p>
              {aiCoach.meta?.risk_flags?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {aiCoach.meta.risk_flags.map((flag) => (
                    <span
                      key={flag}
                      className="rounded-full border border-white/20 px-2 py-[2px] text-[10px] uppercase tracking-[0.12em] text-white/70"
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-white/60">Nessun rischio critico rilevato.</p>
              )}
            </div>

            <div>
              <p className="font-semibold text-white">Potenziale miglioramento</p>
              <p className="mt-1 text-white/80">
                {aiCoach.meta?.predicted_rank_gain != null
                  ? `Seguendo il piano Tekkin il punteggio potrebbe crescere di ~${aiCoach.meta.predicted_rank_gain.toFixed(
                      1
                    )} punti.`
                  : "Il modello non ha stimato un guadagno di punteggio preciso."}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
