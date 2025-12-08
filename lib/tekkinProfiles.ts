// lib/tekkinProfiles.ts

export type TekkinProfileThresholds = {
  label: string;
  master: {
    lufs_min: number;
    lufs_max: number;
    ready_match: number;
    ok_match: number;
  };
  premaster: {
    lufs_min: number;
    lufs_max: number;
    ready_match: number;
    ok_match: number;
  };
};

export const TEKKIN_PROFILES: Record<string, TekkinProfileThresholds> = {
  minimal_deep_tech: {
    label: "Minimal / Deep Tech",
    master: {
      lufs_min: -9.0,
      lufs_max: -7.5,
      ready_match: 80,
      ok_match: 65,
    },
    premaster: {
      lufs_min: -14.0,
      lufs_max: -11.0,
      ready_match: 75,
      ok_match: 60,
    },
  },
  tech_house: {
    label: "Tech House",
    master: {
      lufs_min: -8.5,
      lufs_max: -6.5,
      ready_match: 80,
      ok_match: 65,
    },
    premaster: {
      lufs_min: -13.5,
      lufs_max: -10.5,
      ready_match: 75,
      ok_match: 60,
    },
  },
  minimal_house: {
    label: "Minimal House",
    master: {
      lufs_min: -10.0,
      lufs_max: -8.0,
      ready_match: 80,
      ok_match: 65,
    },
    premaster: {
      lufs_min: -15.0,
      lufs_max: -12.0,
      ready_match: 75,
      ok_match: 60,
    },
  },
  micro_house: {
    label: "Micro House",
    master: {
      lufs_min: -11.0,
      lufs_max: -8.5,
      ready_match: 80,
      ok_match: 65,
    },
    premaster: {
      lufs_min: -16.0,
      lufs_max: -13.0,
      ready_match: 75,
      ok_match: 60,
    },
  },
};

export const DEFAULT_TEKKIN_PROFILE: TekkinProfileThresholds = {
  label: "Generic Club",
  master: {
    lufs_min: -10.5,
    lufs_max: -7.5,
    ready_match: 80,
    ok_match: 65,
  },
  premaster: {
    lufs_min: -16.0,
    lufs_max: -12.0,
    ready_match: 75,
    ok_match: 60,
  },
};

function getProfileConfig(profileKey?: string | null): TekkinProfileThresholds {
  if (!profileKey) return DEFAULT_TEKKIN_PROFILE;
  return TEKKIN_PROFILES[profileKey] ?? DEFAULT_TEKKIN_PROFILE;
}

export type TekkinReadiness =
  | "ready"
  | "almost"
  | "work"
  | "early"
  | "unknown";

export type TekkinReadinessResult = {
  status: TekkinReadiness;
  reasons: string[];
};


type StatusInput = {
  profileKey?: string | null;
  mode?: string | null; // "master" | "premaster"
  matchPercent?: number | null; // 0-100
  lufs?: number | null;
  lufsInTarget?: boolean | null;
  crestInTarget?: boolean | null;
};

export function evaluateTekkinStatus(input: StatusInput): TekkinReadinessResult {
  const reasons: string[] = [];
  const profile = getProfileConfig(input.profileKey);

  const mode = input.mode === "premaster" ? "premaster" : "master";
  const match = input.matchPercent ?? null;
  const lufs = input.lufs ?? null;
  const cfg = profile[mode];

  if (match == null || Number.isNaN(match)) {
    reasons.push("Match Tekkin non disponibile.");
    return { status: "unknown", reasons };
  }

  let lufsOk = false;
  if (lufs != null && Number.isFinite(lufs)) {
    if (lufs >= cfg.lufs_min && lufs <= cfg.lufs_max) {
      lufsOk = true;
    }
  }

  const finalLufsOk =
    input.lufsInTarget != null ? input.lufsInTarget : lufsOk;

  const crestOk = input.crestInTarget === true;

  if (match >= cfg.ready_match && finalLufsOk && crestOk) {
    reasons.push(
      `Match ${match.toFixed(1)}% sopra soglia READY (${cfg.ready_match}%).`,
      `LUFS in range per ${profile.label} (${mode}).`,
      "Crest factor in target."
    );
    return { status: "ready", reasons };
  }

  if (match >= cfg.ok_match && (finalLufsOk || crestOk)) {
    reasons.push(
      `Match ${match.toFixed(1)}% sopra soglia ALMOST (${cfg.ok_match}%).`,
      finalLufsOk
        ? "LUFS già in range, piccoli interventi su dinamica e tonal balance."
        : "Match buono, ma LUFS fuori range consigliato per il genere."
    );
    if (!crestOk) {
      reasons.push("Crest fuori target, lavora su mix e limiting.");
    }
    return { status: "almost", reasons };
  }

  if (match >= cfg.ok_match - 15) {
    reasons.push(
      `Match moderato (${match.toFixed(
        1
      )}%), base buona ma non ancora coerente col profilo.`,
      "Serve lavorare su tonal balance, loudness e dinamica."
    );
    return { status: "work", reasons };
  }

  reasons.push(
    `Match basso (${match.toFixed(
      1
    )}%), traccia ancora lontana dal profilo ${profile.label}.`,
    "Usa bande e fix mirati per ribilanciare il mix verso le reference."
  );
  return { status: "early", reasons };
}

export function getReadinessLabel(status: TekkinReadiness): string {
  switch (status) {
    case "ready":
      return "TEKKIN READY";
    case "almost":
      return "ALMOST";
    case "work":
      return "WORK IN PROGRESS";
    case "early":
      return "EARLY";
    default:
      return "UNKNOWN";
  }
}
