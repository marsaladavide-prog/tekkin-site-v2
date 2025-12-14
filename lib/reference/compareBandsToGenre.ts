import type { BandKey, BandsNorm, GenreReference } from "./types";

export type BandCompareStatus = "ok" | "warn" | "off" | "no_reference" | "no_value";

export type BandCompare = {
  key: BandKey;
  artist: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  status: BandCompareStatus;
};

const ORDER: BandKey[] = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function compareBandsToGenre(
  artistBands: BandsNorm | null | undefined,
  ref: GenreReference
): BandCompare[] {
  return ORDER.map((key) => {
    const artistRaw = artistBands?.[key];
    const artist = isFiniteNumber(artistRaw) ? artistRaw : null;

    const perc = ref.bands_norm_percentiles?.[key];
    const p10 = perc?.p10 ?? null;
    const p50 = perc?.p50 ?? null;
    const p90 = perc?.p90 ?? null;

    if (artist == null) {
      return { key, artist: null, p10, p50, p90, status: "no_value" };
    }

    if (![p10, p50, p90].every((x) => x != null && Number.isFinite(x))) {
      return { key, artist, p10, p50, p90, status: "no_reference" };
    }

    if (artist < (p10 as number) || artist > (p90 as number)) {
      return { key, artist, p10, p50, p90, status: "off" };
    }

    // "warn" se è molto vicino ai bordi del range
    const range = (p90 as number) - (p10 as number);
    const guard = range * 0.06; // 6% del range
    if (artist < (p10 as number) + guard || artist > (p90 as number) - guard) {
      return { key, artist, p10, p50, p90, status: "warn" };
    }

    return { key, artist, p10, p50, p90, status: "ok" };
  });
}
