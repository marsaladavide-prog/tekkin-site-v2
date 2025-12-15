"use client";

import { Share_Tech_Mono } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

type Lang = "it" | "en";
type Mode = "master" | "premaster";
type Genre = "minimal_deep_tech" | "tech_house" | "minimal_house" | "house";

export default function AnalyzerPage() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState("");
  const [lang, setLang] = useState<Lang>("it");
  const [mode, setMode] = useState<Mode>("master");
  const [genre, setGenre] = useState<Genre>("minimal_deep_tech");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const intervalRef = useRef<number | null>(null);

  const clearProgressTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearProgressTimer();
  }, [clearProgressTimer]);

  const handleAnalyze = useCallback(async () => {
    if (!file || analyzing) return;

    setAnalyzing(true);
    setProgress(0);
    setReport(`📡 File caricato: ${file.name}\n⏳ Analisi in corso...\n`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lang", lang);
    formData.append("mode", mode);
    formData.append("genre", genre);

    clearProgressTimer();
    intervalRef.current = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + 1.5 : p));
    }, 180);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const text = await res.text();

      clearProgressTimer();
      setProgress(100);
      setReport(text);
    } catch {
      clearProgressTimer();
      setReport("❌ Errore durante l'analisi. Controlla il file o riprova.");
    } finally {
      setAnalyzing(false);
    }
  }, [file, analyzing, lang, mode, genre, clearProgressTimer]);

  const handleClose = useCallback(() => {
    clearProgressTimer();
    setOpen(false);
    setFile(null);
    setReport("");
    setAnalyzing(false);
    setProgress(0);
  }, [clearProgressTimer]);

  return (
    <main
      className={`${shareTechMono.className} relative min-h-screen overflow-hidden bg-[#0a0a0a] text-[#00ffff]`}
    >
      <div className="absolute inset-0 pointer-events-none tekkin-animate-scanlines bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.05),rgba(255,255,255,0.05)_1px,transparent_2px,transparent_4px)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center space-y-6 px-4 py-12 text-center">
        <div className="space-y-2">
          <h1
            className="tekkin-glitch relative text-5xl font-bold tracking-[0.15em] sm:text-6xl"
            data-text="TEKKIN ANALYZER PRO"
          >
            TEKKIN ANALYZER PRO
          </h1>
          <p className="text-lg text-[#9ef3f3] sm:text-xl">Audio Analyzer v3.6</p>
          <p className="text-xs text-white/60">
            {open
              ? "Organizza linguaggio, genere e modalita prima di lanciare l'analisi."
              : "Clicca su Avvia Analyzer per aprire la console Tekkin PRO."}
          </p>
        </div>

        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="glitch-button mt-4 border-2 border-[#00ffff] px-10 py-4 text-lg font-semibold text-[#00ffff] transition hover:bg-[#00ffff] hover:text-black"
          >
            Avvia Analyzer
          </button>
        ) : (
          <div className="w-full space-y-6 text-left">
            <section className="rounded-2xl border border-white/10 bg-black/70 p-5 text-white/80">
              <h2 className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                Parametri di analisi
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="flex flex-col text-white/60">
                  Lingua
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Lang)}
                    className="mt-1 rounded-md border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                  >
                    <option value="en">English</option>
                    <option value="it">Italiano</option>
                  </select>
                </label>

                <label className="flex flex-col text-white/60">
                  Modalita
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as Mode)}
                    className="mt-1 rounded-md border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                  >
                    <option value="master">Master</option>
                    <option value="premaster">Premaster</option>
                  </select>
                </label>

                <label className="flex flex-col text-white/60">
                  Genere
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value as Genre)}
                    className="mt-1 rounded-md border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                  >
                    <option value="minimal_deep_tech">Minimal / Deep Tech</option>
                    <option value="tech_house">Tech House</option>
                    <option value="minimal_house">Minimal House</option>
                    <option value="house">House Groovy Classic</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-white/10 bg-black/70 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <label className="cursor-pointer rounded-2xl border border-[#00ffff55] px-5 py-3 text-sm text-white transition hover:border-[#00ffff88]">
                  Carica la tua traccia (.wav)
                  <input
                    type="file"
                    accept=".wav"
                    className="hidden"
                    onChange={(e) => {
                      const selected = e.target.files?.[0] ?? null;
                      if (!selected) return;
                      setFile(selected);
                      setReport(
                        `File caricato: ${selected.name}\nPronto per l'analisi Tekkin PRO.\n`
                      );
                    }}
                  />
                </label>

                <span className="text-[11px] text-white/60">
                  {file ? `File pronto: ${file.name}` : "Nessun file caricato"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleAnalyze}
                  disabled={!file || analyzing}
                  className={`rounded-full px-6 py-2 text-sm font-semibold uppercase tracking-[0.4em] transition ${
                    analyzing
                      ? "border border-gray-500 text-gray-500"
                      : "border border-[#00ffff] text-[#00ffff] hover:bg-[#00ffff] hover:text-black"
                  }`}
                >
                  {analyzing ? "Analisi in corso..." : "Avvia Analisi"}
                </button>

                {file && !analyzing && (
                  <span className="text-[11px] text-white/60">Pronto per l'invio</span>
                )}
              </div>

              {analyzing && (
                <div className="space-y-2 text-[11px] text-white/60">
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#00ffff]"
                      style={{ width: `${Math.min(progress, 99)}%` }}
                    />
                  </div>
                  <p>Progresso stimato: {Math.min(progress, 100).toFixed(0)}%</p>
                </div>
              )}

              {report && (
                <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/60 p-4 text-sm leading-relaxed text-[#9ef3f3]">
                  <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                    Report Tekkin Analyzer PRO
                  </h3>
                  <p className="mt-2">{report}</p>
                </div>
              )}
            </section>

            <button
              onClick={handleClose}
              className="block w-full rounded-full border border-[#00ffff55] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#00ffff22]"
            >
              Chiudi Analyzer
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
