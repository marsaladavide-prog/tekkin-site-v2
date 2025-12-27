import { notFound } from "next/navigation";

import AppShell from "@/components/ui/AppShell";
import TekkinAnalyzerPageClient from "@/components/analyzer/TekkinAnalyzerPageClient";
import { createAdminClient } from "@/utils/supabase/admin";
import { signTrackUrl } from "@/lib/storage/signTrackUrl";
import { toPreviewDataFromVersion } from "@/lib/analyzer/toPreviewDataFromVersion";
import { loadReferenceModel } from "@/lib/reference/loadReferenceModel";
import { mapVersionToAnalyzerV2Model } from "@/lib/analyzer/mapVersionToAnalyzerV2Model";

export const dynamic = "force-dynamic";

const VERSION_FIELDS = `
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
`;

export default async function PublicVersionPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;

  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("project_versions")
    .select(VERSION_FIELDS)
    .eq("id", versionId)
    .maybeSingle();

  if (error || !row) notFound();

  const visibility = (row as any).visibility as string | null;

  // segreto: accesso solo se è public o private_with_secret_link
  if (visibility !== "public" && visibility !== "private_with_secret_link") notFound();

  const project = (row as any).projects as { title?: string | null; cover_url?: string | null } | null;

  // arrays da bucket analyzer (usa service role)
  let parsedArrays: Record<string, unknown> | null = null;
  const arraysBlobPath =
    typeof (row as any).arrays_blob_path === "string" ? (row as any).arrays_blob_path : null;

  if (arraysBlobPath) {
    let arraysData: any = null;

    for (const bucket of ["tracks", "analyzer"]) {
      const res = await supabase.storage.from(bucket).download(arraysBlobPath);
      if (res.data) {
        arraysData = res.data;
        break;
      }
    }

    if (arraysData) {
      try {
        parsedArrays = JSON.parse(await arraysData.text());
      } catch {
        parsedArrays = null;
      }
    }
  }

  const profileKey =
    (row as any).analyzer_profile_key ??
    (typeof (row as any)?.analyzer_json === "object" && (row as any)?.analyzer_json
      ? (row as any).analyzer_json.profile_key
      : null);

  const reference = profileKey ? await loadReferenceModel(String(profileKey)) : null;

  const signedAudioUrl =
    (typeof (row as any).audio_url === "string" && (row as any).audio_url) ||
    (await signTrackUrl(supabase as any, (row as any).audio_path ?? null, 60 * 60));

  const title = project?.title ?? "Track";

  const initial = toPreviewDataFromVersion({
    version: {
      ...(row as any),
      title,
      artist_name: "Tekkin",
      cover_url: project?.cover_url ?? null,
      analyzer_arrays: parsedArrays,
      audio_url: signedAudioUrl,
    },
    reference,
  });
  

 const v2Model = mapVersionToAnalyzerV2Model({
   version: { ...(row as any), analyzer_arrays: parsedArrays },
   project: project ? { title: project.title ?? null } : undefined,
   arrays: parsedArrays,
  });

  return (
    <AppShell maxWidth="default">
      <TekkinAnalyzerPageClient
      versionId={versionId}
        initialData={initial}
        v2Model={v2Model}
        track={{
          versionId,
          title,
          artistName: "Tekkin",
          coverUrl: project?.cover_url ?? null,
          audioUrl: signedAudioUrl,
          waveformPeaks: (row as any)?.waveform_peaks ?? null,
          waveformBands: (row as any)?.waveform_bands ?? null,
          waveformDuration: (row as any)?.waveform_duration ?? null,
          createdAt: (row as any)?.created_at ?? null,
        }}
        sharePath={`/v/${versionId}`}
      />
    </AppShell>
  );
}
