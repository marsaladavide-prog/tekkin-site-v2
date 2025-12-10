"use client";
import { Share_Tech_Mono } from "next/font/google";
import { useState } from "react";

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function AnalyzerPage() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState("");
  const [lang, setLang] = useState("it");
  const [mode, setMode] = useState("master");
  const [genre, setGenre] = useState("minimal_deep_tech");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setReport(`📡 File caricato: ${file.name}\n⏳ Analisi in corso...\n`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lang", lang);
    formData.append("mode", mode);
    formData.append("genre", genre);

    const fakeProgress = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 1.5 : p));
    }, 180);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const text = await res.text();
      clearInterval(fakeProgress);
      setProgress(100);
      setReport(text);
    } catch (err) {
      setReport("❌ Errore durante l'analisi. Controlla il file o riprova.");
    } finally {
      clearInterval(fakeProgress);
      setAnalyzing(false);
    }
  };

  return (
    <main
      className={`${shareTechMono.className} min-h-screen bg-[#0a0a0a] text-[#00ffff] relative overflow-hidden`}
    >
      <div className="absolute inset-0 pointer-events-none animate-scanlines bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.05),rgba(255,255,255,0.05)_1px,transparent_2px,transparent_4px)]"></div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-12 space-y-6 text-center">
        <div className="space-y-2">
          <h1
            className="relative text-5xl sm:text-6xl font-bold tracking-[0.15em] glitch"
            data-text="TEKKIN ANALYZER PRO"
          >
            TEKKIN ANALYZER PRO
          </h1>
          <p className="text-[#9ef3f3] text-lg sm:text-xl">Audio Analyzer v3.6</p>
          <p className="text-xs text-white/60">
            {open
              ? "Organizza linguaggio, genere e modalita prima di lanciare l'analisi."
              : "Clicca su Avvia Analyzer per aprire la console Tekkin PRO."}
          </p>
        </div>

        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="glitch-button mt-4 border-2 border-[#00ffff] px-10 py-4 text-lg font-semibold text-[#00ffff] hover:bg-[#00ffff] hover:text-black transition"
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
                    onChange={(e) => setLang(e.target.value)}
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
                    onChange={(e) => setMode(e.target.value)}
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
                    onChange={(e) => setGenre(e.target.value)}
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

            <section className="rounded-2xl border border-white/10 bg-black/70 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <label className="cursor-pointer rounded-2xl border border-[#00ffff55] px-5 py-3 text-sm text-white transition hover:border-[#00ffff88]">
                  Carica la tua traccia (.wav)
                  <input
                    type="file"
                    accept=".wav"
                    className="hidden"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (!selected) return;
                      setFile(selected);
                      setReport(
                        `File caricato: ${selected.name}
Pronto per l'analisi Tekkin PRO.
`
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
                    ></div>
                  </div>
                  <p>Progresso stimato: {Math.min(progress, 100).toFixed(0)}%</p>
                </div>
              )}

              {report && (
                <div className="rounded-xl border border-white/10 bg-black/60 p-4 text-sm text-[#9ef3f3] whitespace-pre-wrap leading-relaxed">
                  <h3 className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                    Report Tekkin Analyzer PRO
                  </h3>
                  <p className="mt-2">{report}</p>
                </div>
              )}
            </section>

            <button
              onClick={() => {
                setOpen(false);
                setFile(null);
                setReport("");
                setAnalyzing(false);
                setProgress(0);
              }}
              className="block w-full rounded-full border border-[#00ffff55] px-6 py-3 text-sm font-semibold text-white hover:bg-[#00ffff22] transition"
            >
              Chiudi Analyzer
            </button>
          </div>
        )}
      </div>
    </main>
      <style jsx>{`
        @keyframes scanlines {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 0 4px;
          }
        }
        .animate-scanlines {
          animation: scanlines 0.15s linear infinite;
        }
        .glitch::before,
        .glitch::after {
          content: attr(data-text);
          position: absolute;
          left: 0;
          width: 100%;
          color: #00ffff;
        }
        .glitch::before {
          text-shadow: -2px 0 red;
          clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          animation: glitchRed 1.5s infinite alternate;
        }
        .glitch::after {
          text-shadow: -2px 0 cyan;
          clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%);
          animation: glitchCyan 1.25s infinite alternate;
        }
        @keyframes glitchRed {
          0%,
          100% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(-3px, -3px);
          }
          40% {
            transform: translate(3px, 3px);
          }
          60% {
            transform: translate(-2px, 2px);
          }
          80% {
            transform: translate(2px, -2px);
          }
        }
        @keyframes glitchCyan {
          0%,
          100% {
            transform: translate(0, 0);
          }
          20% {
            transform: translate(2px, 2px);
          }
          40% {
            transform: translate(-2px, -2px);
          }
          60% {
            transform: translate(3px, -1px);
          }
          80% {
            transform: translate(-3px, 1px);
          }
        }
      `}</style>
  );
}
