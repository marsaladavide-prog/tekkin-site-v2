import type { AnalyzerResult } from "@/types/analyzer";
import type { GenreReference, BandKey } from "@/lib/reference/types";

export type Severity = "low" | "med" | "high";

export type AnalyzerPreviewData = {
  rank: {
    value: number;
    label: string;
    thisSeason: number;
    thisYear: number;
    series: number[];
    totals: { label: string; value: string; hint?: string }[];
  };
  trackTitle: string;
  artistName: string;
  coverUrl?: string | null;
  readyLevel: "none" | "quick" | "pro";
  profileKey: string;
  referenceModel: string | null;
  metrics: {
    overallScore: number;
    qualityScore: number;
    loudnessLufs: number;
    bpm: number;
    key: string;
    stereoWidth: number;
    dynamics: number;
    lowEnd: number;
    highEnd: number;
  };
  issues: {
    id: string;
    title: string;
    severity: Severity;
    why: string;
    fix: string;
    actionLabel: string;
    etaMin?: number;
  }[];
  suggestions: { title: string; bullets: string[] }[];
  references: { title: string; artist: string; match: number; notes: string[] }[];
};

type Status = "low" | "ok" | "high" | "unknown";

function n(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function statusByPercentiles(value: number | null, p10?: number | null, p90?: number | null): Status {
  if (value == null) return "unknown";
  if (p10 == null || p90 == null) return "unknown";
  if (value < p10) return "low";
  if (value > p90) return "high";
  return "ok";
}

function zScore(value: number | null, mean?: number | null, std?: number | null): number | null {
  if (value == null) return null;
  if (mean == null || std == null || std === 0) return null;
  return (value - mean) / std;
}

function sevFromZ(z: number | null): Severity {
  if (z == null) return "low";
  const a = Math.abs(z);
  if (a >= 2.2) return "high";
  if (a >= 1.2) return "med";
  return "low";
}

function safeKeyLabel(k: string | null): string {
  if (!k) return "-";
  return k;
}

function getBandsNorm(result: AnalyzerResult): Partial<Record<BandKey, number>> {
  const bandNorm = result?.spectral?.band_norm ?? null;
  if (bandNorm && typeof bandNorm === "object") return bandNorm;
  return {};
}

export function toAnalyzerPreviewData(args: {
  analyzer: AnalyzerResult;
  reference: GenreReference;
  trackTitle: string;
  artistName: string;
  coverUrl?: string | null;
  readyLevel?: "none" | "quick" | "pro";
  trendSeries?: number[];
}): AnalyzerPreviewData {
  const { analyzer, reference } = args;

  const bpm = n(analyzer.bpm) ?? 0;
  const key = safeKeyLabel(analyzer.key);
  const lufs = n(analyzer?.loudness_stats?.integrated_lufs) ?? n(analyzer.lufs) ?? 0;
  const overall = n(analyzer.overall_score) ?? 0;

  // Stereo width: in AnalyzerResult spesso è un oggetto; nel tuo log è un numero 0..1.
  const stereoRaw =
    n((analyzer as any).stereo_width) ??
    n((analyzer as any).stereo_width?.mean) ??
    n((analyzer as any).stereo_width?.value);
  const stereoPct = stereoRaw == null ? 0 : stereoRaw <= 1.2 ? clamp(stereoRaw * 100, 0, 100) : clamp(stereoRaw, 0, 100);

  const bands = getBandsNorm(analyzer);
  const sub = n(bands.sub) ?? null;
  const air = n(bands.air) ?? null;

  // Z-score vs reference
  const lufsZ = zScore(lufs, reference.features_stats?.lufs?.mean ?? null, reference.features_stats?.lufs?.std ?? null);
  const subZ = zScore(sub, reference.bands_norm_stats?.sub?.mean ?? null, reference.bands_norm_stats?.sub?.std ?? null);
  const airZ = zScore(air, reference.bands_norm_stats?.air?.mean ?? null, reference.bands_norm_stats?.air?.std ?? null);

  const lufsStatus = statusByPercentiles(
    lufs,
    reference.features_percentiles?.lufs?.p10 ?? null,
    reference.features_percentiles?.lufs?.p90 ?? null
  );
  const subStatus = statusByPercentiles(
    sub,
    reference.bands_norm_percentiles?.sub?.p10 ?? null,
    reference.bands_norm_percentiles?.sub?.p90 ?? null
  );
  const airStatus = statusByPercentiles(
    air,
    reference.bands_norm_percentiles?.air?.p10 ?? null,
    reference.bands_norm_percentiles?.air?.p90 ?? null
  );

  const issues: AnalyzerPreviewData["issues"] = [];

  if (subStatus !== "ok" && subStatus !== "unknown") {
    issues.push({
      id: "sub",
      title: subStatus === "low" ? "Sub sotto target" : "Sub sopra target",
      severity: sevFromZ(subZ),
      why: "Influenza pressione e pulizia su impianto. Se non è in range, kick e bass non respirano.",
      fix:
        subStatus === "low"
          ? "Aumenta energia 40-60 Hz sul basso o riduci competizione del kick in quella banda. Controlla sidechain."
          : "Riduci 1-2 dB nella banda 40-60 Hz sul bass bus e controlla il limiter (meno pumping).",
      actionLabel: "Apri checklist low-end",
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
          ? "Aumenta 0.5-1 dB di livello prima del limiter, controlla low-end e clip leggero sui drums."
          : "Riduci input al limiter di 0.5-1 dB e recupera percezione con EQ/clip controllato sui drums.",
      actionLabel: "Guida loudness",
      etaMin: 8,
    });
  }

  if (airStatus !== "ok" && airStatus !== "unknown") {
    issues.push({
      id: "air",
      title: airStatus === "low" ? "Poca aria sopra 10 kHz" : "Air troppo aggressivo",
      severity: sevFromZ(airZ),
      why: "Impatta brillantezza e fatica d'ascolto. In cuffia cambia tantissimo.",
      fix:
        airStatus === "low"
          ? "Shelf +0.5 dB sopra 12 kHz su hats/fx, controlla harshness con de-esser leggero."
          : "Riduci shelf e controlla 10-16 kHz su hats. Se serve, dynamic EQ sul picco.",
      actionLabel: "Apri EQ map",
      etaMin: 5,
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: "polish",
      title: "Rifinitura finale",
      severity: "low",
      why: "Sei già in range sui punti principali. Ora vincono dettagli e automazioni.",
      fix: "Rifinisci punch del kick e micro-contrasto nei drop. Poi bounce e recheck.",
      actionLabel: "Apri piano",
      etaMin: 7,
    });
  }

  const highCount = issues.filter((i) => i.severity === "high").length;
  const etaSum = issues.reduce((acc, i) => acc + (typeof i.etaMin === "number" ? i.etaMin : 0), 0);

  // Per ora: quality = overall_score (proxy). Quando vuoi, lo sostituiamo con quality_score vero.
  const quality = clamp(Math.round(overall), 0, 100);

  const matchPercent =
    n((analyzer as any).model_match_percent) ?? n((analyzer as any).reference_ai?.model_match?.match_percent) ?? null;
  const bestMatch = matchPercent == null ? "-" : `${clamp(Math.round(matchPercent), 0, 100)}%`;

  const series =
    Array.isArray(args.trendSeries) && args.trendSeries.length > 1
      ? args.trendSeries
      : [40, 41, 42, 45, 48, 52, 55, 58, 62, 66, 70, 72, 74, 76, 78, 80, 82, 83, 84];

  const rankImpact = highCount > 0 ? "+1.6" : "+0.6";

  return {
    rank: {
      label: "Tekkin Power",
      value: 10000 + Math.round(quality * 52.3),
      thisSeason: 120 + Math.round(quality * 2.3),
      thisYear: 4000 + Math.round(quality * 140.5),
      series,
      totals: [
        { label: "Quality", value: String(quality), hint: "Su 100" },
        { label: "Issues", value: `${issues.length}`, hint: highCount ? `${highCount} high` : "OK" },
        { label: "Fix stimati", value: `${etaSum}m`, hint: "Totale" },
        { label: "Reference match", value: bestMatch, hint: "Best" },
        { label: "Rank impact", value: rankImpact, hint: "Se pubblichi" },
      ],
    },
    trackTitle: args.trackTitle,
    artistName: args.artistName,
    coverUrl: args.coverUrl ?? null,
    readyLevel: args.readyLevel ?? "pro",
    profileKey: (analyzer as any).profile_key ?? analyzer.analysis_scope ?? reference.profile_key,
    referenceModel: reference.profile_key,
    metrics: {
      overallScore: quality,
      qualityScore: quality,
      loudnessLufs: Number(lufs.toFixed(1)),
      bpm: Math.round(bpm),
      key,
      stereoWidth: Math.round(stereoPct),
      dynamics: clamp(Math.round(60 - (lufsZ ?? 0) * 8), 0, 100),
      lowEnd: clamp(Math.round(70 - (subZ ?? 0) * 10), 0, 100),
      highEnd: clamp(Math.round(70 + (airZ ?? 0) * 10), 0, 100),
    },
    issues,
    suggestions: [
      {
        title: "3 step ad alto impatto",
        bullets: [
          "Sistema 1 problema high (o il primo in lista) e rimbalza.",
          "Ricontrolla loudness e low-end con riferimento, non a caso.",
          "Pubblica solo master: aggiorna cover e metti public se vuoi entrare in /charts.",
        ],
      },
    ],
    references: [
      {
        title: "Reference A",
        artist: "Artist X",
        match: matchPercent == null ? 82 : clamp(Math.round(matchPercent), 0, 100),
        notes: ["Kick più secco", "Sub più controllato", "Top-end più aperto"],
      },
      { title: "Reference B", artist: "Artist Y", match: 88, notes: ["Basso più dinamico", "Stereo più stretto sotto 150 Hz", "Drop più corto"] },
      { title: "Reference C", artist: "Artist Z", match: 81, notes: ["LUFS simile", "Mid più pieno", "Hats più presenti"] },
    ],
  };
}
