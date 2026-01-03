import type { WaveformBands } from "@/types/analyzer";

export type TrackSnapshot = {
  versionId: string;
  projectId: string;
  title: string | null;
  mixType: string | null;
  overallScore: number | null;
  analyzerBpm: number | null;
  analyzerKey: string | null;
  audioUrl: string | null;
  audioPath: string | null;
  visibility: string | null;
  waveformPeaks: number[] | null;
  waveformBands: WaveformBands | null;
  waveformDuration: number | null;
  createdAt: string | null;
};

type ProjectVersionRow = {
  id: string;
  project_id: string;
  version_name?: string | null;
  mix_type?: string | null;
  overall_score?: number | null;
  analyzer_bpm?: number | null;
  analyzer_key?: string | null;
  audio_url?: string | null;
  audio_path?: string | null;
  visibility?: string | null;
  waveform_peaks?: number[] | null;
  waveform_bands?: WaveformBands | null;
  waveform_duration?: number | null;
  created_at?: string | null;
};

type ChartSnapshotRow = {
  project_id?: string | null;
  version_id?: string | null;
  track_title?: string | null;
  version_name?: string | null;
  mix_type?: string | null;
  overall_score?: number | null;
  analyzer_bpm?: number | null;
  analyzer_key?: string | null;
  audio_url?: string | null;
  audio_path?: string | null;
  visibility?: string | null;
  waveform_peaks?: number[] | null;
  waveform_bands?: WaveformBands | null;
  waveform_duration?: number | null;
  created_at?: string | null;
};

function normalizeWaveformArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}

export function mapProjectVersionRowToTrackSnapshot(row: ProjectVersionRow): TrackSnapshot {
  return {
    versionId: row.id,
    projectId: row.project_id,
    title: row.version_name ?? null,
    mixType: row.mix_type ?? null,
    overallScore: typeof row.overall_score === "number" ? row.overall_score : null,
    analyzerBpm: typeof row.analyzer_bpm === "number" ? row.analyzer_bpm : null,
    analyzerKey: typeof row.analyzer_key === "string" ? row.analyzer_key : null,
    audioUrl: typeof row.audio_url === "string" && row.audio_url.trim() ? row.audio_url.trim() : null,
    audioPath: typeof row.audio_path === "string" && row.audio_path.trim() ? row.audio_path.trim() : null,
    visibility: typeof row.visibility === "string" ? row.visibility : null,
    waveformPeaks: normalizeWaveformArray(row.waveform_peaks ?? null),
    waveformBands: row.waveform_bands ?? null,
    waveformDuration:
      typeof row.waveform_duration === "number" && Number.isFinite(row.waveform_duration)
        ? row.waveform_duration
        : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export function mapChartsRowToTrackSnapshot(row: ChartSnapshotRow): TrackSnapshot {
  return {
    versionId: row.version_id ?? "",
    projectId: row.project_id ?? "",
    title: row.version_name ?? row.track_title ?? null,
    mixType: row.mix_type ?? null,
    overallScore: typeof row.overall_score === "number" ? row.overall_score : null,
    analyzerBpm: typeof row.analyzer_bpm === "number" ? row.analyzer_bpm : null,
    analyzerKey: typeof row.analyzer_key === "string" ? row.analyzer_key : null,
    audioUrl: typeof row.audio_url === "string" && row.audio_url.trim() ? row.audio_url.trim() : null,
    audioPath: typeof row.audio_path === "string" && row.audio_path.trim() ? row.audio_path.trim() : null,
    visibility: typeof row.visibility === "string" ? row.visibility : null,
    waveformPeaks: normalizeWaveformArray(row.waveform_peaks ?? null),
    waveformBands: row.waveform_bands ?? null,
    waveformDuration:
      typeof row.waveform_duration === "number" && Number.isFinite(row.waveform_duration)
        ? row.waveform_duration
        : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}
