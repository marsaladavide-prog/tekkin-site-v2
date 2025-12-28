import type { AnalyzerPreviewData, Severity } from "@/lib/analyzer/previewAdapter";
import { getAnalyzerAvailability } from "@/lib/analyzer/getAnalyzerAvailability";
import type { GenreReference } from "@/lib/reference/types";

// Tipo minimo: adattalo se la tua select ha più campi, ma questi bastano.
export type ProjectVersionForAnalyzer = {
  id: string;
  project_id: string;

  title?: string | null; // se ce l'hai già joinata
  artist_name?: string | null;
  cover_url?: string | null;

  mix_type?: "premaster" | "master" | null;

  bpm?: number | null;
  key?: string | null;
  lufs?: number | null;
  overall_score?: number | null;

  analyzer_bpm?: number | null;
  analyzer_key?: string | null;
  analyzer_json?: unknown | null;
  analyzer_profile_key?: string | null;
  reference_model_key?: string | null;

  analyzer_bands_norm?: Record<string, number> | null;

  analyzer_arrays?: {
    momentary_lufs?: number[] | null;
  } | null;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function zScore(
  value: number | null,
  mean: number | null | undefined,
  std: number | null | undefined
) {
  if (value == null) return null;
  if (mean == null || std == null || std === 0) return null;
  return (value - mean) / std;
}

function statusByPercentiles(
  value: number | null,
  p10: number | null | undefined,
  p90: number | null | undefined
) {
  if (value == null) return "unknown" as const;
  if (p10 == null || p90 == null) return "unknown" as const;
  if (value < p10) return "low" as const;
  if (value > p90) return "high" as const;
  return "ok" as const;
}

function sevFromZ(z: number | null): Severity {
  if (z == null) return "low";
  const a = Math.abs(z);
  if (a >= 2.2) return "high";
  if (a >= 1.2) return "med";
  return "low";
}

function safeText(v: unknown, fallback: string) {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function getRecord(record: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  if (!record) return null;
  const value = record[key];
  return isRecord(value) ? value : null;
}

function getNum(record: Record<string, unknown> | null, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStr(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function toPreviewDataFromVersion(args: {
  version: ProjectVersionForAnalyzer;
  reference: GenreReference | null;
}): AnalyzerPreviewData {
  const { version, reference } = args;

  const availability = getAnalyzerAvailability(version);
  const readyLevel: AnalyzerPreviewData["readyLevel"] = availability.readyLevel;

  const versionRecord = isRecord(version) ? version : {};
  const analyzerJson = getRecord(versionRecord, "analyzer_json");

  const profileKey =
    version.analyzer_profile_key ??
    getStr(analyzerJson, "profile_key") ??
    "unknown";

  const referenceModel = null;

  const bpm = Math.round(
    (version.analyzer_bpm ?? getNum(analyzerJson, "bpm") ?? 0)
  );

  const key =
    (version.analyzer_key ?? getStr(analyzerJson, "key")) ?? "-";

  const lufs = Number(
    (
      (typeof version.lufs === "number"
        ? version.lufs
        : getNum(getRecord(analyzerJson, "loudness_stats"), "integrated_lufs")) ?? 0
    ).toFixed(1)
  );

  const overall = clamp(Math.round(version.overall_score ?? 0), 0, 100);
  const quality = overall;

  const bands = (version.analyzer_bands_norm ?? {}) as Record<string, number>;
  const sub = typeof bands.sub === "number" ? bands.sub : null;
  const air = typeof bands.air === "number" ? bands.air : null;

  const lufsZ = reference
    ? zScore(lufs, reference.features_stats?.lufs?.mean, reference.features_stats?.lufs?.std)
    : null;

  const subZ = reference
    ? zScore(sub, reference.bands_norm_stats?.sub?.mean, reference.bands_norm_stats?.sub?.std)
    : null;

  const airZ = reference
    ? zScore(air, reference.bands_norm_stats?.air?.mean, reference.bands_norm_stats?.air?.std)
    : null;

  const lufsStatus = reference
    ? statusByPercentiles(lufs, reference.features_percentiles?.lufs?.p10, reference.features_percentiles?.lufs?.p90)
    : ("unknown" as const);

  const subStatus = reference
    ? statusByPercentiles(sub, reference.bands_norm_percentiles?.sub?.p10, reference.bands_norm_percentiles?.sub?.p90)
    : ("unknown" as const);

  const airStatus = reference
    ? statusByPercentiles(air, reference.bands_norm_percentiles?.air?.p10, reference.bands_norm_percentiles?.air?.p90)
    : ("unknown" as const);

  const issues: AnalyzerPreviewData["issues"] = [];

  if (subStatus !== "ok" && subStatus !== "unknown") {
    issues.push({
      id: "sub",
      title: subStatus === "low" ? "Sub sotto target" : "Sub sopra target",
      severity: sevFromZ(subZ),
      why: "Se sub è fuori range, su impianto perdi pressione o impasti kick e bass.",
      fix:
        subStatus === "low"
          ? "Aumenta energia 40-60 Hz sul basso o riduci competizione del kick. Sidechain pulito."
          : "Riduci 1-2 dB in 40-60 Hz sul bass bus e controlla pumping sul limiter.",
      actionLabel: "Checklist low-end",
      etaMin: 10,
    });
  }

  if (lufsStatus !== "ok" && lufsStatus !== "unknown") {
    issues.push({
      id: "lufs",
      title: lufsStatus === "low" ? "Loudness sotto target" : "Loudness sopra target",
      severity: sevFromZ(lufsZ),
      why: "Se sei troppo fuori, o non competi o schiacci transiente e perdi groove.",
      fix:
        lufsStatus === "low"
          ? "Aumenta 0.5-1 dB prima del limiter, clip leggero sui drums se serve."
          : "Riduci input al limiter 0.5-1 dB e recupera percezione con EQ/clip controllato.",
      actionLabel: "Guida loudness",
      etaMin: 8,
    });
  }

  if (airStatus !== "ok" && airStatus !== "unknown") {
    issues.push({
      id: "air",
      title: airStatus === "low" ? "Poca aria sopra 10 kHz" : "Air troppo aggressivo",
      severity: sevFromZ(airZ),
      why: "Impattante su cuffie e brillantezza. Troppo poco sembra scuro, troppo tanto affatica.",
      fix:
        airStatus === "low"
          ? "Shelf +0.5 dB sopra 12 kHz su hats/fx, controlla harshness."
          : "Riduci shelf e controlla 10-16 kHz su hats. Dynamic EQ se serve.",
      actionLabel: "EQ map",
      etaMin: 5,
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: "polish",
      title: "Rifinitura finale",
      severity: "low",
      why: "Sei già in range. Ora vincono i dettagli e la coerenza col reference set.",
      fix: "Micro-contrasto: automazioni su FX e pulizia low-end nei drop. Poi recheck.",
      actionLabel: "Apri piano",
      etaMin: 7,
    });
  }

  const highCount = issues.filter((i) => i.severity === "high").length;
  const etaSum = issues.reduce((acc, i) => acc + (typeof i.etaMin === "number" ? i.etaMin : 0), 0);

  const momentary = version.analyzer_arrays?.momentary_lufs ?? null;
  const series =
    Array.isArray(momentary) && momentary.length >= 10
      ? momentary
          .slice(0, 28)
          .map((x) => clamp(50 + (Number(x) + 14) * 6, 0, 100)) // mapping grezzo per sparkline
      : [40, 41, 42, 45, 48, 52, 55, 58, 62, 66, 70, 72, 74, 76, 78, 80, 82, 83, 84];

  return {
    rank: {
      label: "Tekkin Power",
      value: 10000 + Math.round(quality * 52.3),
      thisSeason: 120 + Math.round(quality * 2.3),
      thisYear: 4000 + Math.round(quality * 140.5),
      series,
      totals: [
        { label: "Quality", value: String(quality), hint: "Su 100" },
        { label: "Issues", value: String(issues.length), hint: highCount ? `${highCount} high` : "OK" },
        { label: "Fix stimati", value: `${etaSum}m`, hint: "Totale" },
        { label: "Ref model", value: version.reference_model_key ?? "—", hint: reference ? "Loaded" : "Missing" },
        { label: "Publish", value: version.mix_type === "master" ? "OK" : "No", hint: "Master only" },
      ],
    },
    trackTitle: safeText(version.title, "Track"),
    artistName: safeText(version.artist_name, "Artist"),
    coverUrl: version.cover_url ?? null,
    readyLevel,
    profileKey,
    referenceModel,
    metrics: {
      overallScore: overall,
      qualityScore: quality,
      loudnessLufs: lufs,
      bpm: Math.round(bpm),
      key,
      stereoWidth: 72,
      dynamics: clamp(Math.round(60 - (lufsZ ?? 0) * 8), 0, 100),
      lowEnd: clamp(Math.round(70 - (subZ ?? 0) * 10), 0, 100),
      highEnd: clamp(Math.round(70 + (airZ ?? 0) * 10), 0, 100),
    },
    issues,
    suggestions: [
      {
        title: "3 step ad alto impatto",
        bullets: [
          "Sistema 1 issue high e rimbalza.",
          "Confronta con reference, non a gusto.",
          "Se è master e sei contento, metti public e vai in /charts.",
        ],
      },
    ],
    references: [
      { title: "Reference A", artist: "Artist X", match: 92, notes: ["Kick più secco", "Sub più controllato", "Top-end più aperto"] },
      { title: "Reference B", artist: "Artist Y", match: 88, notes: ["Basso più dinamico", "Stereo più stretto sotto 150 Hz", "Drop più corto"] },
      { title: "Reference C", artist: "Artist Z", match: 81, notes: ["LUFS simile", "Mid più pieno", "Hats più presenti"] },
    ],
  };
}
