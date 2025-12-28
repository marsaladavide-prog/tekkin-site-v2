"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/app/artist/hooks/useTheme";
import ArtistSettingsHeader from "@/components/settings/ArtistSettingsHeader";

export default function ArtistPreferencesSettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [language, setLanguage] = useState("it");

  return (
    <section className="space-y-5">
      <ArtistSettingsHeader
        title="Preferences"
        description="Tema, lingua e comportamenti base dell'esperienza Tekkin."
      />

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                Tema
              </p>
              <p className="text-sm text-white/70">
                Il toggle aggiorna il theme globale Tekkin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleTheme()}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-cyan-400/40 hover:bg-white/10"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-200" />
              ) : (
                <Moon className="h-4 w-4 text-slate-500" />
              )}
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-xl backdrop-blur">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
              Lingua
            </p>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
            <p className="text-[11px] text-white/50">
              TODO: sincronizza con il profilo Tekkin quando sarà disponibile.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
