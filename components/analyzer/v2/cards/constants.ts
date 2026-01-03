import type { Bands } from "@/lib/analyzer/v2/types";

export const BAND_LABELS: Record<"it" | "en", Record<keyof Bands, string>> = {
  it: {
    sub: "Sub",
    low: "Bassi",
    lowmid: "Low-mid",
    mid: "Medi",
    presence: "Presence",
    high: "Alti",
    air: "Air",
  },
  en: {
    sub: "Sub",
    low: "Low",
    lowmid: "Low-mid",
    mid: "Mid",
    presence: "Presence",
    high: "High",
    air: "Air",
  },
};
