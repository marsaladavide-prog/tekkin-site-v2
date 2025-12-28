export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import { createClient } from "@/utils/supabase/server";

import TekkinAnalyzerPageClient from "@/components/analyzer/TekkinAnalyzerPageClient";
import { toPreviewDataFromVersion } from "@/lib/analyzer/toPreviewDataFromVersion";
import { mapVersionToAnalyzerCompareModel } from "@/lib/analyzer/v2/mapVersionToAnalyzerCompareModel";
import { calculateTekkinVersionRankFromModel } from "@/lib/analyzer/tekkinVersionRank";
import { computeModelMatch } from "@/lib/analyzer/modelMatch";
import fs from "node:fs/promises";
import path from "node:path";
import type { AnalyzerPreviewData } from "@/lib/analyzer/previewAdapter";
import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";
import { loadReferenceModel } from "@/lib/reference/loadReferenceModel";
function extractReferenceBandsNorm(reference: any) {
  const stats = reference?.bands_norm_stats;
  if (!stats || typeof stats !== "object") return null;

  const keys = ["sub", "low", "lowmid", "mid", "presence", "high", "air"] as const;
  const out: Record<string, number> = {};
  let has = false;

  for (const k of keys) {
    const mean = (stats as any)?.[k]?.mean;
    if (typeof mean === "number" && Number.isFinite(mean)) {
      out[k] = mean;
      has = true;
    }
  }

  return has ? out : null;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { versionId } = await params;

  const t0 = Date.now();
  const sp = await searchParams;
  const uiParam = sp?.ui ?? null;

  console.log("[ANALYZER PAGE] start", {
    versionId,
    uiParam,
    at: new Date().toISOString(),
  });

  const supabase = await createClient();

  // AUTH
  const tAuth = Date.now();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  console.log("[ANALYZER PAGE] auth done", {
    ms: Date.now() - tAuth,
    ok: !!auth?.user && !authErr,
    err: authErr?.message ?? null,
    userId: auth?.user?.id ?? null,
  });

  const user = auth?.user;
  if (!user) redirect("/login");

  // DB
  const tDb = Date.now();
  const { data: row, error } = await supabase
    .from("project_versions")
    .select(
      `
      id,
      project_id,
      version_name,
      audio_url,
      audio_path,
      lufs,
      overall_score,
      analyzer_bpm,
      analyzer_key,
      analyzer_profile_key,
      reference_model_key,
      waveform_peaks,
      waveform_bands,
      waveform_duration,
      created_at,
      analyzer_json,
      analyzer_bands_norm,
      arrays_blob_path,
      project:projects!inner(id,user_id,title,cover_url)
    `
    )
    .eq("id", versionId)
    .maybeSingle();

  console.log("[ANALYZER PAGE] db done", {
    ms: Date.now() - tDb,
    totalMs: Date.now() - t0,
    error: error?.message ?? null,
    hasRow: !!row,
    hasProject: !!(row as any)?.project,
    arraysPath: (row as any)?.arrays_blob_path ?? null,
    audioUrl: (row as any)?.audio_url ?? null,
    audioPath: (row as any)?.audio_path ?? null,
  });

  if (error || !row) notFound();

  const project = Array.isArray(row.project) ? row.project[0] : row.project;
  if (!project) notFound();

  // OWNER CHECK
  const isOwner = project.user_id === user.id;
  console.log("[ANALYZER PAGE] ownership", {
    ok: isOwner,
    projectUserId: project.user_id ?? null,
    authUserId: user.id ?? null,
  });
  if (!isOwner) notFound();

  // ARRAYS DOWNLOAD + PARSE
  let arraysJson: any | null = null;

  if (row.arrays_blob_path) {
    const tArr = Date.now();
    const { data: arr, error: arrErr } = await supabase.storage
      .from("tracks")
      .download(row.arrays_blob_path);

    const downloadMs = Date.now() - tArr;

    let bytes: number | null = null;
    let parseMs: number | null = null;

    if (arr && !arrErr) {
      try {
        bytes = typeof arr.size === "number" ? arr.size : null;

        const tParse = Date.now();
        const txt = await arr.text();
        arraysJson = JSON.parse(txt);
        parseMs = Date.now() - tParse;
      } catch {
        arraysJson = null;
      }
    }

    console.log("[ANALYZER PAGE] arrays", {
      downloadMs,
      ok: !!arr && !arrErr,
      err: arrErr?.message ?? null,
      path: row.arrays_blob_path,
      bytes,
      parseMs,
      keys: arraysJson ? Object.keys(arraysJson) : null,
    });
  } else {
    console.log("[ANALYZER PAGE] arrays", {
      skipped: true,
      reason: "no arrays_blob_path",
    });
  }

  const effectiveReferenceKey =
    (row as any)?.reference_model_key ?? (row as any)?.analyzer_profile_key ?? null;

  const reference = effectiveReferenceKey
    ? await loadReferenceModel(String(effectiveReferenceKey))
    : null;

  const referenceModel = reference;

  const referenceBandsNorm = extractReferenceBandsNorm(reference);

  const versionForPreview = {
    ...(row as any),
    analyzer_arrays: arraysJson ?? null,
    reference_model_key: effectiveReferenceKey,
    reference_bands_norm: referenceBandsNorm,
  };

  // MAPPERS
  const tMap = Date.now();
  const initialData = toPreviewDataFromVersion({
    version: versionForPreview,
    reference,
  }) as AnalyzerPreviewData;

  const v2Model = mapVersionToAnalyzerCompareModel(
    versionForPreview,
    referenceModel
  ) as AnalyzerCompareModel;

  console.log("[v2] transients model:", v2Model?.transients);

  const aj = (versionForPreview as any).analyzer_json;
  const parsed = typeof aj === "string" ? (() => { try { return JSON.parse(aj); } catch { return null; } })() : aj;

  const hasTransientsObj = !!arraysJson?.transients && typeof arraysJson.transients === "object";
  console.log("[page] arrays has transients obj:", hasTransientsObj);
  console.log("[page] arrays transients:", arraysJson?.transients ?? null);
  console.log("[page] arrays keys:", arraysJson ? Object.keys(arraysJson) : null);
  console.log("[page] model.transients:", (v2Model as any)?.transients);

  if (!arraysJson) {
    console.log(
      "[page] arrays missing => v2 charts (spectrum/soundfield/levels/transients) will be null"
    );
  }

  console.log("[ANALYZER PAGE] map done", {
    ms: Date.now() - tMap,
    totalMs: Date.now() - t0,
    hasInitial: !!initialData,
    hasV2Model: !!v2Model,
    v2Keys: v2Model ? Object.keys(v2Model as any) : null,
  });

  try {
    v2Model.tekkinRank = calculateTekkinVersionRankFromModel(v2Model);
  } catch (rankErr) {
    console.warn("[ANALYZER PAGE] tekkin rank breakdown failed", rankErr);
  }

  try {
    const metrics = {
      bpm: v2Model.bpm,
      integrated_lufs: v2Model.loudness?.integrated_lufs ?? null,
      stereo_width: v2Model.stereoWidth ?? null,
      spectral_centroid_hz: v2Model.spectral?.spectral_centroid_hz ?? null,
      band_energy_norm: v2Model.bandsNorm ?? null,
    };

    const currentMatch = referenceModel ? computeModelMatch(metrics, referenceModel) : null;
    const currentMatchRatio = currentMatch?.matchRatio ?? 0;

    const modelsDir = path.join(process.cwd(), "reference_models_v3");
    const files = await fs.readdir(modelsDir);
    const profileKeys = files
      .filter((name) => name.endsWith(".json") && name !== "index.json")
      .map((name) => name.replace(/\.json$/, ""));

    let best: { key: string; matchRatio: number } | null = null;

    for (const key of profileKeys) {
      const model = await loadReferenceModel(key);
      if (!model) continue;
      const match = computeModelMatch(metrics, model);
      if (!match) continue;
      if (!best || match.matchRatio > best.matchRatio) {
        best = { key, matchRatio: match.matchRatio };
      }
    }

    if (best && best.key !== v2Model.referenceName && best.matchRatio - currentMatchRatio >= 0.08) {
      v2Model.suggestedReferenceKey = best.key;
      v2Model.suggestedReferenceMatch = best.matchRatio;
      v2Model.suggestedReferenceDelta = best.matchRatio - currentMatchRatio;
    }
  } catch (matchErr) {
    console.warn("[ANALYZER PAGE] suggested reference calc failed", matchErr);
  }

  // AUDIO URL RESOLUTION
  let resolvedAudioUrl: string | null = row.audio_url ?? null;

  if (!resolvedAudioUrl && row.audio_path) {
    const tSigned = Date.now();
    const { data: signed, error: signedErr } = await supabase.storage
      .from("tracks")
      .createSignedUrl(row.audio_path, 60 * 60);

    console.log("[ANALYZER PAGE] signed url", {
      ms: Date.now() - tSigned,
      ok: !signedErr && !!signed?.signedUrl,
      err: signedErr?.message ?? null,
      hadAudioUrl: !!row.audio_url,
      audioPath: row.audio_path ?? null,
    });

    if (!signedErr) resolvedAudioUrl = signed?.signedUrl ?? null;
  } else {
    console.log("[ANALYZER PAGE] signed url", {
      skipped: true,
      reason: resolvedAudioUrl ? "already had audio_url" : "no audio_path",
    });
  }

  const track = {
    versionId: row.id as string,
    title: (row.version_name as string) ?? "Untitled",
    artistName: null,
    coverUrl: project.cover_url ?? null,
    audioUrl: resolvedAudioUrl,
    artistId: row.project_id as string,
    artistSlug: null,
    profileKey: (row.analyzer_profile_key as string) ?? null,
    waveformPeaks: (row as any).waveform_peaks ?? null,
    waveformBands: (row as any).waveform_bands ?? null,
    waveformDuration: (row as any).waveform_duration ?? null,
    createdAt: (row as any).created_at ?? null,
  };

  // UI resolve
  const ui = uiParam === "v1" ? "v1" : "v2";
  const sharePath = `/artist/analyzer/${versionId}?ui=${ui}`;

  console.log("[ANALYZER PAGE] end", {
    ui,
    sharePath,
    totalMs: Date.now() - t0,
    hasAudio: !!resolvedAudioUrl,
    coverOk: !!project.cover_url,
  });

  return (
    <AppShell>
      <TekkinAnalyzerPageClient
        ui={ui}
        versionId={versionId}
        track={track}
        initialData={initialData}
        v2Model={v2Model}
        sharePath={sharePath}
      />
    </AppShell>
  );
}
