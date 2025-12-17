"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type {
  AnalyzerAiAction,
  AnalyzerAiMeta,
  AnalyzerResult,
  ReferenceAi,
} from "@/types/analyzer";
import { AnalyzerProPanel } from "@/components/analyzer/AnalyzerProPanel";
import WaveformPreviewUnified from "@/components/player/WaveformPreviewUnified";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type VersionRecord = {
  id: string;
  project_id: string;

  version_name: string | null;
  created_at: string;
  mix_type: string | null;

  audio_path: string | null;
  audio_url: string | null;

  lufs: number | null;
  overall_score: number | null;

  analyzer_bpm: number | null;
  analyzer_key: string | null;

  analyzer_reference_ai: ReferenceAi | null;
  analyzer_json: AnalyzerResult | null;

  analyzer_ai_summary: string | null;
  analyzer_ai_actions: AnalyzerAiAction[] | null;
  analyzer_ai_meta: AnalyzerAiMeta | null;

  waveform_peaks: number[] | null;
  waveform_duration: number | null;
  waveform_bands: any | null;
};

type ProjectRecord = {
  id: string;
  title: string;
  genre: string | null;
};

async function buildSignedUrlFromStoragePath(path: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("tracks")
    .createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) throw new Error("Signed URL non disponibile");
  return data.signedUrl;
}

function formatTime(secs: number) {
  if (!Number.isFinite(secs) || secs < 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function AnalyzerVersionPage() {
  const params = useParams<{ versionId: string }>();
  const versionId = params?.versionId ?? "";

  const player = useTekkinPlayer();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [version, setVersion] = useState<VersionRecord | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!versionId) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();

      const { data: v, error: vErr } = await supabase
        .from("project_versions")
        .select(
          `
          id, project_id, version_name, created_at, mix_type,
          audio_path, audio_url,
          lufs, overall_score,
          analyzer_bpm, analyzer_key,
          analyzer_reference_ai, analyzer_json,
          analyzer_ai_summary, analyzer_ai_actions, analyzer_ai_meta,
          waveform_peaks, waveform_duration, waveform_bands
        `
        )
        .eq("id", versionId)
        .single();

      if (vErr || !v) throw new Error("Versione non trovata");

      const versionRow = v as unknown as VersionRecord;
      setVersion(versionRow);

      const { data: p, error: pErr } = await supabase
        .from("projects")
        .select("id, title, genre")
        .eq("id", versionRow.project_id)
        .single();

      if (pErr || !p) throw new Error("Project non trovato");
      setProject(p as unknown as ProjectRecord);

      const rawUrl = typeof versionRow.audio_url === "string" ? versionRow.audio_url.trim() : "";
      const rawPath = typeof versionRow.audio_path === "string" ? versionRow.audio_path.trim() : "";

      if (rawUrl && rawUrl.startsWith("http")) {
        setAudioUrl(rawUrl);
      } else if (rawPath || rawUrl) {
        const signed = await buildSignedUrlFromStoragePath(rawPath || rawUrl);
        setAudioUrl(signed);
      } else {
        setAudioUrl(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore caricamento Analyzer";
      setErrorMsg(msg);
      setProject(null);
      setVersion(null);
      setAudioUrl(null);
    } finally {
      setLoading(false);
    }
  }, [versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isActive = useMemo(() => {
    if (!version || !audioUrl) return false;
    return player.versionId === version.id && player.audioUrl === audioUrl;
  }, [player, version, audioUrl]);

  const progressRatio = useMemo(() => {
    if (!isActive) return 0;
    if (!Number.isFinite(player.duration) || player.duration <= 0) return 0;
    return player.currentTime / player.duration;
  }, [isActive, player.currentTime, player.duration]);

  const durationForLabel = useMemo(() => {
    const d1 = version?.waveform_duration;
    if (typeof d1 === "number" && Number.isFinite(d1) && d1 > 0) return d1;
    if (isActive && Number.isFinite(player.duration) && player.duration > 0) return player.duration;
    return null;
  }, [version?.waveform_duration, isActive, player.duration]);

  if (!versionId) {
    return (
      <div className="mx-auto w-full max-w-5xl py-8">
        <p className="text-sm text-white/60">versionId non valido.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl py-8">
      <Link
        href={project?.id ? `/artist/projects/${project.id}` : "/artist/projects"}
        className="mb-4 inline-flex text-sm text-white/60 hover:text-white"
      >
        ← Torna al Project
      </Link>

      {loading && <p className="text-sm text-white/50">Caricamento Analyzer...</p>}
      {errorMsg && !loading && <p className="mb-4 text-sm text-red-400">{errorMsg}</p>}

      {!loading && project && version && (
        <>
          <header className="mb-5 rounded-3xl border border-white/10 bg-black/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl font-semibold text-white truncate">{project.title}</div>
                <div className="mt-1 text-sm text-white/60">
                  Report: {version.version_name ?? "Versione"} · {new Date(version.created_at).toLocaleString("it-IT")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {version.lufs != null && (
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] text-white/75">
                    {version.lufs.toFixed(1)} LUFS
                  </span>
                )}
                {version.overall_score != null && (
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] text-white/75">
                    Tekkin {version.overall_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </header>

          <div className="mb-6 rounded-3xl border border-white/10 bg-black/55 p-5">
            {audioUrl ? (
              <WaveformPreviewUnified
                peaks={version.waveform_peaks ?? null}
                bands={version.waveform_bands ?? null}
                duration={durationForLabel}
                progressRatio={progressRatio}
                isPlaying={isActive && player.isPlaying}
                timeLabel={durationForLabel ? formatTime(durationForLabel) : "--:--"}
                onTogglePlay={() => {
                  if (!audioUrl) return;

                  if (isActive) {
                    useTekkinPlayer.getState().toggle();
                    return;
                  }

                  player.play({
                    projectId: project.id,
                    versionId: version.id,
                    title: project.title,
                    subtitle: version.version_name ?? undefined,
                    audioUrl,
                    duration: version.waveform_duration ?? undefined,
                  });
                }}
                onSeekRatio={(r) => {
                  if (!audioUrl) return;

                  if (isActive) {
                    player.seekToRatio(r);
                    return;
                  }

                  player.playAtRatio(
                    {
                      projectId: project.id,
                      versionId: version.id,
                      title: project.title,
                      subtitle: version.version_name ?? undefined,
                      audioUrl,
                      duration: version.waveform_duration ?? undefined,
                    },
                    r
                  );
                }}
              />
            ) : (
              <p className="text-sm text-white/60">Audio non disponibile.</p>
            )}
          </div>

          <AnalyzerProPanel
            version={{
              ...(version as any),
              version_name: version.version_name ?? "Versione",
              reference_ai: version.analyzer_reference_ai ?? null,
              analyzer_json: version.analyzer_json ?? null,
            }}
            analyzerResult={version.analyzer_json ?? null}
            referenceAi={version.analyzer_reference_ai ?? null}
            aiSummary={version.analyzer_ai_summary ?? null}
            aiActions={version.analyzer_ai_actions ?? null}
            aiMeta={version.analyzer_ai_meta ?? null}
          />
        </>
      )}
    </div>
  );
}
