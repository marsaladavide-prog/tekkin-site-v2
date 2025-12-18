"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getAnalyzerAvailability, type ProjectVersionLike } from "@/lib/analyzer/getAnalyzerAvailability";
import { TEKKIN_GENRES, getTekkinGenreLabel } from "@/lib/constants/genres";
import { compareBandsToGenre } from "@/lib/reference/compareBandsToGenre";
import type { GenreReference } from "@/lib/reference/types";
import type { ReferenceAi } from "@/types/analyzer";
import AnalyzerCtaCard from "./AnalyzerCtaCard";
import ProReport from "./ProReport";
import QuickReport from "./QuickReport";

type AnalyzerPanelVersion = ProjectVersionLike & {
  id: string;
  project_id?: string | null;
  version_name?: string | null;
  created_at?: string | null;
  analyzer_mode?: string | null;
  analyzer_key?: string | null;
  analyzer_json?: unknown | null;
  reference_ai?: ReferenceAi | null;
  analyzer_reference_ai?: ReferenceAi | null;
  analyzer_profile_key?: string | null;
  reference_model_key?: string | null;
  analyzer_arrays?: {
    momentary_lufs?: number[] | null;
    [key: string]: unknown;
  } | null;
  analyzer_bands_norm?: Record<string, number> | null;
  model_match_percent?: number | null;
  analyzer_bpm?: number | null;
  lufs?: number | null;
  overall_score?: number | null;
};

type AnalyzerProPanelProps = {
  version: AnalyzerPanelVersion;
};

type ProfileKeySaveResult = {
  success: boolean;
  message?: string;
};

const normalizeProfileKey = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
};

const pickReferenceAi = (version: AnalyzerPanelVersion): ReferenceAi | null =>
  version.reference_ai ?? (version.analyzer_reference_ai ?? null);

const formatBandLabel = (input: string) =>
  input.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const buildHighlights = (referenceAi: ReferenceAi | null) => {
  const adjustments = referenceAi?.adjustments?.raw_diffs ?? {};
  return Object.entries(adjustments)
    .map(([key, value]) => ({ key, value }))
    .filter((entry): entry is { key: string; value: number } => typeof entry.value === "number" && Number.isFinite(entry.value))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3)
    .map((entry) => ({
      label: formatBandLabel(entry.key),
      detail: `${Math.abs(entry.value).toFixed(1)} dB ${entry.value > 0 ? "above" : "below"} reference`,
    }));
};

export function AnalyzerProPanel({ version }: AnalyzerProPanelProps) {
  const referenceAi = useMemo(() => pickReferenceAi(version), [version]);

  const resolvedProfileKey = useMemo(() => {
    const analyzerJson = version.analyzer_json as Record<string, unknown> | null;
    const fromAnalyzerJson =
      (analyzerJson?.["analysis_scope"] as Record<string, unknown> | null)?.["profile_key"] ??
      analyzerJson?.["profile_key"];

    const candidate =
      fromAnalyzerJson ??
      referenceAi?.profile_key ??
      version.analyzer_profile_key ??
      null;

    return normalizeProfileKey(typeof candidate === "string" ? candidate : null);
  }, [version, referenceAi]);

  const [profileKey, setProfileKey] = useState<string | null>(resolvedProfileKey);

  useEffect(() => {
    setProfileKey(resolvedProfileKey);
  }, [resolvedProfileKey]);

  const versionForAvailability = useMemo<ProjectVersionLike>(() => {
    return {
      lufs: version.lufs,
      overall_score: version.overall_score,
      bpm: version.analyzer_bpm,
      analyzer_arrays: version.analyzer_arrays,
      analyzer_bands_norm: version.analyzer_bands_norm,
      analyzer_profile_key: profileKey,
      reference_model_key: version.reference_model_key ?? (profileKey ?? null),
    };
  }, [version, profileKey]);

  const availability = useMemo(
    () => getAnalyzerAvailability(versionForAvailability),
    [versionForAvailability]
  );

  const [reference, setReference] = useState<GenreReference | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceLoading, setReferenceLoading] = useState(false);

  useEffect(() => {
    if (!profileKey) {
      setReference(null);
      setReferenceError(null);
      setReferenceLoading(false);
      return;
    }

    let cancelled = false;
    setReferenceLoading(true);
    setReferenceError(null);

    fetch(`/api/reference/${encodeURIComponent(profileKey)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error ?? "Reference not found");
        }
        return res.json() as Promise<GenreReference>;
      })
      .then((data) => {
        if (!cancelled) setReference(data);
      })
      .catch((error) => {
        if (!cancelled) setReferenceError(error?.message ?? "Reference non disponibile");
      })
      .finally(() => {
        if (!cancelled) setReferenceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileKey]);

  const matchPercent = useMemo(() => {
    if (typeof version.model_match_percent === "number") {
      return version.model_match_percent;
    }
    const ratio = referenceAi?.match_ratio ?? referenceAi?.model_match?.match_percent ?? null;
    if (ratio == null) return null;
    return ratio > 1 ? ratio : ratio * 100;
  }, [version.model_match_percent, referenceAi]);

  const highlightItems = useMemo(() => buildHighlights(referenceAi), [referenceAi]);

  const momentaryLufs = useMemo(() => {
    const candidate = version.analyzer_arrays?.momentary_lufs;
    if (!Array.isArray(candidate) || candidate.length === 0) return null;
    const filtered = candidate.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    return filtered.length ? filtered : null;
  }, [version.analyzer_arrays]);

  const bandsCompare = useMemo(() => {
    if (!reference || !version.analyzer_bands_norm) return null;
    return compareBandsToGenre(version.analyzer_bands_norm, reference);
  }, [reference, version.analyzer_bands_norm]);

  const readyLevel = availability.readyLevel;
  const isQuickReady = readyLevel === "quick" || readyLevel === "pro";
  const isProReady = readyLevel === "pro";

  const profileLabel = getTekkinGenreLabel(profileKey ?? undefined);

  const referenceStatusMessage = reference
    ? null
    : referenceError ??
      (referenceLoading ? "Caricamento reference Tekkin..." : "Reference Tekkin non disponibile");

  const handleProfileKeySave = useCallback(
    async (value: string): Promise<ProfileKeySaveResult> => {
      if (!version.id) {
        return { success: false, message: "Versione mancante" };
      }

      try {
        const response = await fetch("/api/projects/update-version-profile-key", {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            versionId: version.id,
            profileKey: value,
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          return {
            success: false,
            message: payload?.error ?? "Impossibile salvare il profilo Tekkin",
          };
        }

        setProfileKey(value);
        return { success: true };
      } catch {
        return {
          success: false,
          message: "Errore di rete durante il salvataggio",
        };
      }
    },
    [version.id]
  );

  return (
    <section className="w-full rounded-3xl border border-white/10 bg-black/70 p-4 md:p-6">
      <div className="space-y-6">
        {!availability.hasProfileKey && (
          <ProfileKeySelector currentKey={profileKey} onSave={handleProfileKeySave} />
        )}

        {isQuickReady ? (
          <>
            <QuickReport
              versionName={version.version_name}
              tekkinScore={version.overall_score ?? 0}
              lufs={version.lufs ?? 0}
              bpm={version.analyzer_bpm ?? 0}
              analyzerKey={version.analyzer_key ?? null}
              matchPercent={matchPercent}
              highlights={highlightItems}
              referenceStatusMessage={referenceStatusMessage}
              profileLabel={profileLabel ?? undefined}
            />

            {isProReady && (
              <ProReport
                momentaryLufs={momentaryLufs}
                reference={reference}
                referenceLoading={referenceLoading}
                referenceError={referenceError}
                bandCompare={bandsCompare}
              />
            )}
          </>
        ) : (
          <AnalyzerCtaCard projectId={version.project_id ?? null} />
        )}
      </div>
    </section>
  );
}

type ProfileKeySelectorProps = {
  currentKey: string | null;
  onSave: (value: string) => Promise<ProfileKeySaveResult>;
};

function ProfileKeySelector({ currentKey, onSave }: ProfileKeySelectorProps) {
  const [selection, setSelection] = useState(currentKey ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelection(currentKey ?? "");
    setStatus("idle");
    setMessage(null);
  }, [currentKey]);

  const handleSave = useCallback(async () => {
    if (!selection) {
      setMessage("Seleziona un genere Tekkin");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setMessage(null);

    const result = await onSave(selection);
    if (result.success) {
      setStatus("success");
      setMessage("Profilo Tekkin salvato");
    } else {
      setStatus("error");
      setMessage(result.message ?? "Errore durante il salvataggio");
    }
  }, [selection, onSave]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Profilo Tekkin</p>
          <p className="text-sm text-white/70">Il riferimento Tekkin dipende dal genere che scegli qui sotto.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            className="flex-1 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white"
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <option value="">Seleziona il genere Tekkin</option>
            {TEKKIN_GENRES.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="min-w-[150px] rounded-2xl bg-teal-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-teal-300 disabled:opacity-60"
            onClick={handleSave}
            disabled={status === "saving" || !selection}
          >
            {status === "saving" ? "Salvataggio..." : "Salva profilo"}
          </button>
        </div>
        {message && (
          <p className={`text-sm ${status === "success" ? "text-emerald-300" : "text-amber-200"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
