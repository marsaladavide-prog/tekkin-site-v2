export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import { createClient } from "@/utils/supabase/server";

import TekkinAnalyzerPageClient from "@/components/analyzer/TekkinAnalyzerPageClient";
import { toPreviewDataFromVersion } from "@/lib/analyzer/toPreviewDataFromVersion";
import { mapVersionToAnalyzerCompareModel } from "@/lib/analyzer/v2/mapVersionToAnalyzerCompareModel";
import type { AnalyzerPreviewData } from "@/lib/analyzer/previewAdapter";
import type { AnalyzerCompareModel } from "@/lib/analyzer/v2/types";

type Props = { params: Promise<{ versionId: string }> };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ versionId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { versionId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) redirect("/login");

  const { data: row, error } = await supabase
    .from("project_versions")
    .select(`
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
      analyzer_json,
      analyzer_bands_norm,
      arrays_blob_path,
      project:projects!inner(id,user_id,title,cover_url)
    `)
    .eq("id", versionId)
    .maybeSingle();

  console.log("[ANALYZER PAGE] supabase error:", error);
  console.log("[ANALYZER PAGE] supabase row:", row);

  if (error || !row) notFound();

  const project = Array.isArray(row.project) ? row.project[0] : row.project;
  if (!project) notFound();
  if (project.user_id !== user.id) notFound();

  let arraysJson: any | null = null;

  if (row.arrays_blob_path) {
    const { data: arr } = await supabase.storage
      .from("tracks")
      .download(row.arrays_blob_path);

    if (arr) {
      try {
        arraysJson = JSON.parse(await arr.text());
      } catch {
        arraysJson = null;
      }
    }
  }

  console.log(
    "[ANALYZER PAGE] arrays download:",
    row.arrays_blob_path,
    arraysJson ? "OK" : "NULL",
    arraysJson ? Object.keys(arraysJson) : null
  );

  console.log(
    "[ANALYZER PAGE] analysis_pro keys:",
    arraysJson?.analysis_pro ? Object.keys(arraysJson.analysis_pro) : null
  );

  const versionForPreview = {
    ...(row as any),
    analyzer_arrays: arraysJson ?? null,
  };

  const initialData = toPreviewDataFromVersion({
    version: versionForPreview,
    reference: null,
  }) as AnalyzerPreviewData;

  const v2Model = mapVersionToAnalyzerCompareModel(versionForPreview) as AnalyzerCompareModel;

  let resolvedAudioUrl: string | null = row.audio_url ?? null;

  if (!resolvedAudioUrl && row.audio_path) {
    const { data: signed, error: signedErr } = await supabase.storage
      .from("tracks")
      .createSignedUrl(row.audio_path, 60 * 60);

    if (!signedErr) resolvedAudioUrl = signed?.signedUrl ?? null;
  }

  const track = {
    versionId: row.id as string,
    title: (row.version_name as string) ?? "Untitled",
    artistName: null, // non disponibile qui
    coverUrl: project.cover_url ?? null,
    audioUrl: resolvedAudioUrl,
    artistId: project.user_id ?? null,
    artistSlug: null,
  };

  const ui = sp?.ui === "v2" ? "v2" : "v1";

  // UI v2: usa il client unificato (niente AnalyzerV2Panel/ProPanel/CtaCard qui)
  return (
    <AppShell>
      <TekkinAnalyzerPageClient
        ui={ui}
        versionId={versionId}
        track={track}
        initialData={initialData}
        v2Model={v2Model}
      />
    </AppShell>
  );
}
