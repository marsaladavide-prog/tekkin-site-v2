"use client";

import { useState } from "react";

type AnalyzerAssistantProps = {
  versionId: string;
};

export function AnalyzerAssistant({ versionId }: AnalyzerAssistantProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAsk() {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/analyzer/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version_id: versionId,
          question: question.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data?.error ?? "Errore chiamando Tekkin AI Assistant.");
        setLoading(false);
        return;
      }

      setAnswer(data?.answer ?? "Nessuna risposta ricevuta dall'assistente.");
      setLoading(false);
    } catch (err) {
      console.error("[AnalyzerAssistant] Unexpected error:", err);
      setErrorMsg("Errore inatteso chiamando Tekkin AI Assistant.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/15 bg-black/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
        Domande su questa analisi?
      </p>
      <p className="mt-1 text-[11px] text-white/60">
        Scrivi una domanda specifica (es. "Perché la mid è così avanti?", "Qual è
        la priorità numero uno da sistemare?").
      </p>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        className="mt-3 w-full rounded-lg border border-white/15 bg-black/60 p-2 text-xs text-white/90 placeholder:text-white/30"
        placeholder='Es: "Perché il mix mi sembra troppo scuro?"'
      />

      <button
        type="button"
        onClick={handleAsk}
        disabled={loading || !question.trim()}
        className="mt-3 inline-flex items-center justify-center rounded-full border border-emerald-400/60 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-400/10 disabled:opacity-40"
      >
        {loading ? "Analisi in corso..." : "Chiedi a Tekkin AI"}
      </button>

      {errorMsg && (
        <p className="mt-2 text-[11px] text-red-300 whitespace-pre-line">
          {errorMsg}
        </p>
      )}

      {answer && (
        <div className="mt-3 rounded-lg border border-white/15 bg-black/80 p-2 text-[11px] text-white/85 whitespace-pre-line">
          {answer}
        </div>
      )}
    </div>
  );
}
