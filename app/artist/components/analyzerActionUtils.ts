"use client";

import type {
  FixSuggestion,
  AnalyzerAiAction,
  AnalyzerAiFocusArea,
} from "@/types/analyzer";

export type ActionCategoryKey =
  | "sub"
  | "kick_clap"
  | "percussions"
  | "hihat"
  | "vocals"
  | "stereo"
  | "stereo_high"
  | "dynamics"
  | "transients";

export type ActionPriority = "low" | "medium" | "high";

export const PRIORITY_ORDER: Record<ActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CATEGORY_KEYWORDS: Record<ActionCategoryKey, RegExp[]> = {
  sub: [/\bsub\b/i, /\bsub[-\s]?bass\b/i],
  kick_clap: [/\bkick\b/i, /\bclap\b/i, /\bsnare\b/i, /\bkick\/clap\b/i],
  percussions: [/\bpercuss/i, /\bshaker\b/i, /\brace\b/i, /\bdrum\b/i, /\bgroove\b/i],
  hihat: [/\bhi[-\s]?hat\b/i, /\bhihat\b/i, /\bhats\b/i],
  vocals: [/\bvoc(al|ali|ale)?\b/i, /\bvoce\b/i, /\bvocali\b/i, /\bsing\b/i],
  stereo: [/\bstereo\b/i, /\bwidth\b/i, /\blr\b/i, /\bstereoimage\b/i, /\bbalance\b/i],
  stereo_high: [/\bair\b/i, /\bspace\b/i, /\b3d\b/i, /\bdepth\b/i, /\bscattering\b/i],
  dynamics: [/\bdynami/i, /\bloudness\b/i, /\bcrest\b/i, /\bcompress/i, /\bgain\b/i],
  transients: [/\btransient\b/i, /\bpunch\b/i, /\battack\b/i, /\bsnap\b/i, /\bimpact\b/i],
};

const TEXT_CATEGORY_ORDER: ActionCategoryKey[] = [
  "sub",
  "kick_clap",
  "percussions",
  "hihat",
  "vocals",
  "stereo_high",
  "stereo",
  "transients",
  "dynamics",
];

const FOCUS_AREA_CATEGORY_MAP: Partial<Record<AnalyzerAiFocusArea, ActionCategoryKey>> =
  {
    sub: "sub",
    loudness: "dynamics",
    lowmid: "kick_clap",
    mid: "dynamics",
    high: "hihat",
    stereo: "stereo",
    stereo_high: "stereo_high",
    structure: "percussions",
    groove: "percussions",
    arrangement: "percussions",
    other: "dynamics",
    vocals: "vocals",
    hihats: "hihat",
    percussions: "percussions",
    transients: "transients",
    punch: "transients",
  };

export const CATEGORY_LABELS: Record<ActionCategoryKey, string> = {
  sub: "SUB",
  kick_clap: "Kick / Clap",
  percussions: "Percussioni",
  hihat: "Hi-hats / Air",
  vocals: "Vocali",
  stereo: "Stereo",
  stereo_high: "Stereo / Air",
  dynamics: "Dinamica",
  transients: "Transients",
};

function normalizePriority(value?: string | null): ActionPriority {
  const normalized = (value ?? "medium").toLowerCase();
  if (normalized === "high" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function detectCategoryFromStrings(texts: (string | null | undefined)[]): ActionCategoryKey | null {
  for (const category of TEXT_CATEGORY_ORDER) {
    const patterns = CATEGORY_KEYWORDS[category];
    for (const text of texts) {
      if (!text) continue;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return category;
        }
      }
    }
  }
  return null;
}

export function mapAiFocusAreaToCategory(
  focusArea?: AnalyzerAiFocusArea | null
): ActionCategoryKey | null {
  if (!focusArea) return null;
  return FOCUS_AREA_CATEGORY_MAP[focusArea] ?? null;
}

export function sortByPriority<T extends { priority?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aScore = PRIORITY_ORDER[normalizePriority(a.priority)];
    const bScore = PRIORITY_ORDER[normalizePriority(b.priority)];
    if (aScore !== bScore) return aScore - bScore;
    return 0;
  });
}

export type AnalyzerInterventionAction = {
  id: string;
  title: string;
  description: string;
  category: ActionCategoryKey;
  priority: ActionPriority;
  source: "fix" | "ai";
};

export function buildInterventionActions(params: {
  fixSuggestions: FixSuggestion[];
  aiActions?: AnalyzerAiAction[] | null;
}): AnalyzerInterventionAction[] {
  const { fixSuggestions, aiActions } = params;
  const fallbackCategory: ActionCategoryKey = "dynamics";
  const seen = new Set<string>();
  const actions: AnalyzerInterventionAction[] = [];

  const pushAction = (action: AnalyzerInterventionAction) => {
    if (!action.title) return;
    const key = `${action.source}-${action.category}-${action.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    actions.push(action);
  };

  for (const suggestion of fixSuggestions) {
    const category =
      detectCategoryFromStrings([
        suggestion.issue,
        suggestion.analysis,
        ...(suggestion.steps ?? []),
      ]) ?? fallbackCategory;

    pushAction({
      id: `fix-${category}-${suggestion.issue}`,
      title: suggestion.issue,
      description:
        suggestion.analysis ??
        "Approfondisci la sezione Analisi tecnica per i dettagli di intervento.",
      priority: normalizePriority(suggestion.priority),
      category,
      source: "fix",
    });
  }

  if (aiActions) {
    for (const action of aiActions) {
      const category =
        mapAiFocusAreaToCategory(action.focus_area) ??
        detectCategoryFromStrings([action.title, action.description]) ??
        fallbackCategory;

      pushAction({
        id: `ai-${category}-${action.title}`,
        title: action.title,
        description:
          action.description ??
          "Verifica il piano Tekkin AI per ulteriori dettagli operativi.",
        priority: normalizePriority(action.priority),
        category,
        source: "ai",
      });
    }
  }

  return actions;
}
