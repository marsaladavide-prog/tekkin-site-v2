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
      className={`${shareTechMono.className} min-h-screen bg-[#0a0a0a] text-[#00ffff] flex flex-col items-center justify-center relative overflow-hidden`}
    >
      <div className="absolute inset-0 pointer-events-none animate-scanlines bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.05),rgba(255,255,255,0.05)_1px,transparent_2px,transparent_4px)]"></div>

      <h1
        className="relative text-5xl sm:text-6xl font-bold tracking-[0.15em] glitch"
        data-text="TEKKIN ANALYZER PRO"
      >
        TEKKIN ANALYZER PRO
      </h1>
      <p className="mt-4 text-[#9ef3f3] text-lg sm:text-xl">
        Audio Analyzer — v3.6
      </p>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="glitch-button mt-10 border-2 border-[#00ffff] text-[#00ffff] px-10 py-4 text-lg font-semibold hover:bg-[#00ffff] hover:text-black transition"
        >
          Avvia Analyzer
        </button>
      )}

      {open && (
        <div className="z-10 mt-10 flex flex-col items-center gap-6 bg-[#111] border border-[#00ffff33] rounded-xl p-6 w-[90%] max-w-2xl text-sm text-[#9ef3f3] shadow-xl">
          {/* === Selettori === */}
          <div className="flex flex-col gap-3 w-full">
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <label className="flex flex-col text-[#00ffff]">
                Lingua
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="bg-[#111] border border-[#00ffff55] text-[#9ef3f3] px-3 py-2 rounded-md"
                >
                  <option value="en">English</option>
                  <option value="it">Italiano</option>
                </select>
              </label>

              <label className="flex flex-col text-[#00ffff]">
                Modalità
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="bg-[#111] border border-[#00ffff55] text-[#9ef3f3] px-3 py-2 rounded-md"
                >
                  <option value="master">Master</option>
                  <option value="premaster">Premaster</option>
                </select>
              </label>

              <label className="flex flex-col text-[#00ffff]">
                Genere
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="bg-[#111] border border-[#00ffff55] text-[#9ef3f3] px-3 py-2 rounded-md"
                >
                  <option value="minimal_deep_tech">Minimal / Deep Tech</option>
                  <option value="tech_house_modern">Tech House Modern</option>
                  <option value="melodic_deep_house">Melodic / Deep House</option>
                  <option value="peak_time_techno">Peak-Time Techno</option>
                  <option value="house_groovy_classic">House Groovy Classic</option>
                </select>
              </label>
            </div>
          </div>

          {/* === Upload File === */}
          <label className="cursor-pointer border border-[#00ffff55] px-6 py-3 rounded-md hover:bg-[#00ffff22] transition">
            Carica la tua traccia (.wav)
            <input
              type="file"
              accept=".wav"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (!selected) return;
                setFile(selected);
                setReport(`📡 File caricato: ${selected.name}\nPronto per l'analisi Tekkin PRO.\n`);
              }}
            />
          </label>

          {/* === Pulsante Analisi === */}
          <button
            onClick={handleAnalyze}
            disabled={!file || analyzing}
            className={`border-2 ${
              analyzing
                ? "border-gray-500 text-gray-500"
                : "border-[#00ffff] text-[#00ffff] hover:bg-[#00ffff] hover:text-black transition"
            } px-10 py-3 rounded-md text-lg font-semibold`}
          >
            {analyzing ? "Analisi in corso..." : "Avvia Analisi"}
          </button>

          {/* === Barra di progresso === */}
          {analyzing && (
            <div className="relative w-full h-2 bg-[#00ffff22] rounded overflow-hidden mt-2">
              <div
                className="absolute top-0 left-0 h-full bg-[#00ffff] transition-all duration-150"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          {/* === REPORT ELEGANTE === */}
          {report && (
            <div className="mt-6 w-full bg-[#00000088] border border-[#00ffff33] rounded-lg p-4 text-[#9ef3f3] whitespace-pre-wrap leading-relaxed">
              <h2 className="text-[#00ffff] font-bold text-lg mb-2 border-b border-[#00ffff33] pb-1">
                Report Tekkin Analyzer PRO
              </h2>
              <p className="text-sm sm:text-base">{report}</p>
            </div>
          )}

          <button
            onClick={() => {
              setOpen(false);
              setFile(null);
              setReport("");
              setAnalyzing(false);
              setProgress(0);
            }}
            className="mt-3 border border-[#00ffff55] px-6 py-2 rounded hover:bg-[#00ffff22] transition"
          >
            Chiudi Analyzer
          </button>
        </div>
      )}

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
    </main>
  );
}
