import type { Bands } from "@/lib/analyzer/v2/types";

export const BAND_ORDER: Array<keyof Bands> = ["sub", "low", "lowmid", "mid", "presence", "high", "air"];

export function safeNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function sumBands(b?: Bands | null) {
  return BAND_ORDER.reduce((acc, k) => acc + safeNum(b?.[k]), 0);
}

export function bandsToPct(b?: Bands | null) {
  const total = sumBands(b);
  const denom = total > 0 ? total : 1;
  const out: Record<string, number> = {};
  for (const k of BAND_ORDER) {
    out[k] = (safeNum(b?.[k]) / denom) * 100;
  }
  return out as Record<keyof Bands, number>;
}

export function formatDb(value: number | null | undefined, decimals = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return `${value.toFixed(decimals)} dB`;
}
