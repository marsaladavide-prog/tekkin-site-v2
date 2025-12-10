"use client";

import { useState } from "react";

type AskAnalyzerAIProps = {
  versionId: string;
};

/**
 * AskAnalyzerAI
 * Blocco "Domande su questa analisi?"
 * chiama /api/analyzer/ai-summary e mostra la risposta
 */
export function AskAnalyzerAI({ versionId }: AskAnalyzerAIProps) {
  if (!versionId) return null;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedQuestion = question.trim();
  const canSubmit = trimmedQuestion.length >= 8;

  async function handleAsk() {
    if (!canSubmit) return;

    setLoading(true);
    setAnswer(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/analyzer/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: versionId,
          question: trimmedQuestion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error ?? "Errore parlando con Tekkin AI.");
        return;
      }

      setAnswer(
        data?.answer ?? "Nessuna risposta ricevuta dall'assistente Tekkin."
      );
    } catch (err) {
      console.error("[AskAnalyzerAI] Network error:", err);
      setErrorMsg("Errore di rete. Riprovare.");
    } finally {
      setLoading(false);
    }
  }

  function setPreset(text: string) {
    setQuestion(text);
    setAnswer(null);
    setErrorMsg(null);
  }

  return (
    <div className="mt-8 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/60">
        Domande su questa analisi?
      </p>
      <p className="mt-1 text-[11px] text-white/60">
        Chiedi informazioni più precise su voce, hi-hats, percussioni, dinamica, stereo e groove.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          "Come faccio uscire meglio la voce in questo mix?",
          "Cosa posso migliorare su hi-hats e percussioni per avere più movimento?",
          "Dammi un piano rapido per rifinire questo mix prima del master.",
        ].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPreset(t)}
            className="rounded-full border border-white/15 px-3 py-1 text-[10px] text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {t}
          </button>
        ))}
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Esempio: come faccio uscire meglio la voce senza perdere punch sul kick?"
        className="mt-3 h-24 w-full rounded-lg border border-white/10 bg-black/60 p-2 text-xs text-white/90 outline-none focus:border-[var(--accent)]"
      />

      <button
        type="button"
        onClick={handleAsk}
        disabled={loading || !canSubmit}
        className="mt-2 rounded-full bg-[var(--accent)] px-4 py-1.5 text-[11px] font-semibold text-black disabled:opacity-50"
      >
        {loading ? "Analizzo" : "Chiedi qualcosa all'Analyzer"}
      </button>
      {!loading && trimmedQuestion.length > 0 && !canSubmit && (
        <p className="mt-1 text-[10px] text-white/50">
          Scrivi almeno 8 caratteri per inviare la domanda.
        </p>
      )}

      {errorMsg && (
        <p className="mt-2 text-[11px] text-red-400">{errorMsg}</p>
      )}

      {answer && (
        <div className="mt-3 whitespace-pre-line rounded-lg border border-white/10 bg-black/70 p-3 text-[11px] text-white/90">
          {answer}
        </div>
      )}
    </div>
  );
}
