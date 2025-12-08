"use client";

import type { AnalyzerWarningSeverity } from "@/types/analyzer";

const HARD_MIN_BPM = 60;
const HARD_MAX_BPM = 180;

function normalizeBpmValue(raw?: number | null): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;

  let bpm = raw;

  while (bpm > HARD_MAX_BPM && bpm / 2 >= HARD_MIN_BPM) {
    bpm = bpm / 2;
  }

  while (bpm < HARD_MIN_BPM && bpm * 2 <= HARD_MAX_BPM) {
    bpm = bpm * 2;
  }

  return Math.round(bpm);
}

export function formatBpm(raw?: number | null): string {
  const bpm = normalizeBpmValue(raw);
  if (bpm == null) return "n.a.";
  const displayedBpm = bpm < 90 ? Math.round(bpm * 2) : bpm;
  return String(displayedBpm);
}

export function getMatchBucket(matchPercent: number | null) {
  if (matchPercent == null) {
    return { label: "Match sconosciuto", description: "", badge: "UNKNOWN" as const };
  }

  if (matchPercent >= 80) {
    return {
      label: "On point",
      description: "Molto vicino al centro del genere: puoi concentrarti su fine-tuning e dettagli.",
      badge: "ON_POINT" as const,
    };
  }

  if (matchPercent >= 55) {
    return {
      label: "Work in progress",
      description:
        "La base è coerente col genere, ma ci sono ancora differenze evidenti da sistemare.",
      badge: "WIP" as const,
    };
  }

  if (matchPercent >= 30) {
    return {
      label: "Fuori dai canoni",
      description:
        "Elementi chiave (bande o timbro) sono lontani dalla media del genere: può essere scelta artistica o mix sbilanciato.",
      badge: "OFF_PROFILE" as const,
    };
  }

  return {
    label: "Molto lontano dal profilo",
    description:
      "Il suono si discosta molto dalla media del genere: valuta se è il genere giusto o se servono interventi importanti al mix.",
    badge: "VERY_OFF" as const,
  };
}

export function formatNumber(
  n: number | null | undefined,
  digits: number = 1,
  fallback = "n.a."
) {
  if (n == null || Number.isNaN(n)) return fallback;
  return n.toFixed(digits);
}

export function getBrightnessLabel(centroidHz?: number | null): string {
  if (centroidHz == null || centroidHz <= 0) return "Sconosciuto";
  if (centroidHz < 1500) return "Dark / Warm";
  if (centroidHz < 3500) return "Bilanciato";
  if (centroidHz < 6000) return "Bright";
  return "Molto bright";
}

export function getMixState(lufs?: number | null): string {
  if (lufs == null) return "Sconosciuto";
  if (lufs <= -11) return "Molto conservativo";
  if (lufs <= -9.5) return "Conservativo";
  if (lufs <= -8.5) return "In zona club";
  if (lufs <= -7) return "Aggressivo";
  return "Molto aggressivo";
}

export function getScoreLabel(score?: number | null): string {
  if (score == null) return "Analisi parziale";
  if (score >= 8.5) return "Ready";
  if (score >= 7) return "Almost";
  if (score >= 5.5) return "Work in progress";
  return "Early";
}

export function formatPercentage(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "n.a.";
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return `${percent}%`;
}

export function getConfidenceWidth(value?: number | null): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

export function getMixHealthLabel(score?: number | null): string {
  if (score == null) return "In attesa di dati";
  if (score >= 85) return "Prodotto e pronto al club";
  if (score >= 70) return "Quasi pronto";
  if (score >= 55) return "Serve qualche intervento";
  return "Riscrivi il mix";
}

export function getBandWidthLabel(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "n.a.";
  if (value < -3) return "Mono";
  if (value <= 3) return "Bilanciato";
  return "Ampio";
}

export function getBandBadgeClass(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "text-white/60 bg-white/10";
  }
  if (value < -3) return "text-sky-200 bg-sky-500/20";
  if (value <= 3) return "text-emerald-200 bg-emerald-500/20";
  return "text-amber-200 bg-amber-500/20";
}

export function getBandDisplayName(band: string): string {
  if (band === "low") return "Low";
  if (band === "mid") return "Mid";
  if (band === "high") return "High";
  return band;
}

export function getWarningBadgeClass(severity?: AnalyzerWarningSeverity): string {
  if (severity === "error") return "text-red-200 bg-red-500/20";
  if (severity === "warning") return "text-amber-200 bg-amber-500/20";
  return "text-emerald-200 bg-emerald-500/20";
}
