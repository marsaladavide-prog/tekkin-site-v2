import { notFound } from "next/navigation";

import AppShell from "@/components/ui/AppShell";
import TekkinAnalyzerPageClient from "@/components/analyzer/TekkinAnalyzerPageClient";
import { createAdminClient } from "@/utils/supabase/admin";
import { signTrackUrl } from "@/lib/storage/signTrackUrl";
import { toPreviewDataFromVersion } from "@/lib/analyzer/toPreviewDataFromVersion";
import { buildAnalyzerCardsModel } from "@/lib/analyzer/cards/buildAnalyzerCardsModel";
import { loadReferenceModel } from "@/lib/reference/loadReferenceModel";
import { mapVersionToAnalyzerV2Model } from "@/lib/analyzer/mapVersionToAnalyzerV2Model";

export const dynamic = "force-dynamic";

const VERSION_FIELDS = `
  id,
  project_id,
  visibility,
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

type Props = {
  params: Promise<{ versionId: string }>;
};

type ProjectJoin = {
  id?: string | null;
  user_id?: string | null;
  title?: string | null;
  cover_url?: string | null;
} | null;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export default async function PublicVersionPage({ params }: Props) {
  const { versionId } = await params;

  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("project_versions")
    .select(VERSION_FIELDS)
    .eq("id", versionId)
    .maybeSingle();

  if (error || !row) notFound();

  const visibility =
    typeof (row as any)?.visibility === "string" ? ((row as any).visibility as string) : null;

  if (visibility !== "public" && visibility !== "private_with_secret_link") notFound();

  const projectRaw = (row as any)?.project ?? null;
  const project: ProjectJoin =
    Array.isArray(projectRaw) ? ((projectRaw[0] ?? null) as any) : (projectRaw as any);

  let parsedArrays: Record<string, unknown> | null = null;

  const arraysBlobPath =
    typeof (row as any)?.arrays_blob_path === "string" ? ((row as any).arrays_blob_path as string) : null;

  if (arraysBlobPath) {
    let arraysData: Blob | null = null;

    for (const bucket of ["tracks", "analyzer"]) {
      const res = await supabase.storage.from(bucket).download(arraysBlobPath);
      if (res.data) {
        arraysData = res.data;
        break;
      }
    }

    if (arraysData) {
      try {
        const txt = await arraysData.text();
        const json = JSON.parse(txt);
        parsedArrays = isRecord(json) ? json : null;
      } catch {
        parsedArrays = null;
      }
    }
  }

  const analyzerJson = (row as any)?.analyzer_json;

  const profileKey =
    (typeof (row as any)?.analyzer_profile_key === "string" && (row as any).analyzer_profile_key) ||
    (isRecord(analyzerJson) && typeof analyzerJson.profile_key === "string" ? analyzerJson.profile_key : null);

  const reference = profileKey ? await loadReferenceModel(String(profileKey)) : null;

  const directUrl =
    typeof (row as any)?.audio_url === "string" && (row as any).audio_url ? ((row as any).audio_url as string) : null;

  const signedAudioUrl =
    directUrl || (await signTrackUrl(supabase as any, (row as any)?.audio_path ?? null, 60 * 60));

  if (!signedAudioUrl) notFound();

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

  const versionForCards = {
    ...(row as any),
    analyzer_arrays: parsedArrays,
    reference_model_key: profileKey,
    project,
  };
  const cardsModel = buildAnalyzerCardsModel({
    version: versionForCards,
    referenceModel: reference,
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
        cardsModel={cardsModel}
      />
    </AppShell>
  );
}
