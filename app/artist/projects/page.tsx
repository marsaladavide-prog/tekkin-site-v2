"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, MoreVertical, Pause, Play, Search, Settings, Trash2 } from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { TEKKIN_MIX_TYPES, TekkinMixType } from "@/lib/constants/genres";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type ProjectVersionRow = {
  id: string;
  version_name: string | null;
  created_at: string;
  overall_score: number | null;
  lufs: number | null;
  mix_type: TekkinMixType | null;

  audio_url: string | null;
  audio_path: string | null;

  waveform_peaks?: number[] | null;
  waveform_duration?: number | null;
};

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  version_name: string | null;
  latestVersionId: string | null;
  created_at: string;
  cover_url: string | null;
  description: string | null;
  latestVersionCreatedAt: string | null;
  version_count: number;
  versions: ProjectVersionRow[];
};

const buildProjectsSelectQuery = (includeProjectInfo: boolean) => `
  id,
  title,
  status,
  created_at,
  project_versions (
    id,
    version_name,
    created_at,
    overall_score,
    lufs,
    mix_type,
    audio_url,
    waveform_peaks,
    waveform_duration
  )${includeProjectInfo ? `,
  cover_url,
  description` : ""}
`;

const shouldExcludeProjectInfo = (error: { message?: string | null; details?: string | null } | null) => {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("cover_url") || message.includes("description");
};

const MIX_TYPE_LABELS: Record<TekkinMixType, string> = {
  master: "MASTER",
  premaster: "PREMASTER",
};

const normalizeMixType = (value?: string | null): TekkinMixType | null => {
  if (value && TEKKIN_MIX_TYPES.includes(value as TekkinMixType)) return value as TekkinMixType;
  return null;
};

const formatTime = (secs: number) => {
  if (!Number.isFinite(secs) || secs < 0) return "00:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

type CachedPeaks = { peaks: number[]; duration: number; ts: number };
const waveformPeaksCache = new Map<string, CachedPeaks>();
const MAX_IN_MEMORY = 40;
const PEAKS_STORAGE_PREFIX = "tekkin:wavesurfer:peaks:v2:";

const hashKey = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};
const storageKey = (k: string) => PEAKS_STORAGE_PREFIX + hashKey(k);

const readPeaksFromStorage = (key: string): CachedPeaks | null => {
  const mem = waveformPeaksCache.get(key);
  if (mem) return mem;

  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPeaks;
    if (!parsed?.peaks?.length || !Number.isFinite(parsed.duration)) return null;
    waveformPeaksCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const writePeaksToStorage = (key: string, value: CachedPeaks) => {
  waveformPeaksCache.set(key, value);

  if (waveformPeaksCache.size > MAX_IN_MEMORY) {
    const oldest = [...waveformPeaksCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) waveformPeaksCache.delete(oldest[0]);
  }

  try {
    localStorage.setItem(storageKey(key), JSON.stringify(value));
  } catch {
    // ignore
  }
};

function WaveformPreview(props: {
  audioUrl?: string | null;
  cacheKey: string;
  serverPeaks?: number[] | null;
  serverDuration?: number | null;

  isActive: boolean;
  isPlaying: boolean;
  progressRatio: number; // 0..1

  onTogglePlay: () => void;
  onSeekRatio: (ratio: number) => void;
}) {
  const {
    audioUrl,
    cacheKey,
    serverPeaks,
    serverDuration,
    isPlaying,
    progressRatio,
    onTogglePlay,
    onSeekRatio,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const waveRef = useRef<any>(null);

  const [trackDuration, setTrackDuration] = useState(0);
  const [ready, setReady] = useState(false);

  const applyFit = useCallback(() => {
    const wave = waveRef.current;
    const wrap = wrapRef.current;
    if (!wave || !wrap) return;

    const d = wave.getDuration?.() ?? 0;
    if (!d) return;

    const pxPerSec = Math.max(1, Math.floor(wrap.clientWidth / d));
    try {
      wave.zoom(pxPerSec);
      const drawer = wave.drawer;
      if (drawer?.wrapper) drawer.wrapper.scrollLeft = 0;
    } catch {
      // ignore
    }
  }, []);

  const ensureWave = useCallback(async () => {
    if (waveRef.current) return;
    if (!audioUrl || !containerRef.current) return;

    const cached = readPeaksFromStorage(cacheKey);

    const hasServerPeaks =
      Array.isArray(serverPeaks) &&
      serverPeaks.length > 0 &&
      typeof serverDuration === "number" &&
      Number.isFinite(serverDuration) &&
      serverDuration > 0;

    const initialPeaks =
      cached ||
      (hasServerPeaks ? { peaks: serverPeaks as number[], duration: serverDuration as number, ts: Date.now() } : null);

    if (!cached && hasServerPeaks && initialPeaks) writePeaksToStorage(cacheKey, initialPeaks);

    containerRef.current.replaceChildren();

    const WaveSurfer = (await import("wavesurfer.js")).default;

    // tipizzazione wavesurfer spesso non combacia con la versione reale, qui teniamo tutto safe con any
    const wave = (WaveSurfer as any).create({
      container: containerRef.current,
      height: 96,
      waveColor: "#6b7280",
      progressColor: "#6b7280",
      cursorColor: "transparent",
      cursorWidth: 0,
      normalize: false,
      interact: false,
      dragToSeek: false,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
    } as any);

    waveRef.current = wave;

    // wavesurfer load peaks: spesso vuole array di canali, quindi incapsuliamo
    try {
      if (initialPeaks) {
        wave.load(audioUrl, [initialPeaks.peaks] as any, initialPeaks.duration as any);
      } else {
        wave.load(audioUrl);
      }
    } catch {
      wave.load(audioUrl);
    }

    wave.on("ready", () => {
      const d = wave.getDuration?.() || 0;
      setTrackDuration(d);
      setReady(true);
      requestAnimationFrame(applyFit);

      if (!cached && !hasServerPeaks) {
        try {
          const d2 = wave.getDuration?.() || 0;
          const exported = (wave as any).exportPeaks?.(1500) as number[][] | number[] | undefined;
          const flat = Array.isArray(exported) && Array.isArray((exported as any)[0]) ? (exported as any)[0] : exported;
          if (Array.isArray(flat) && flat.length && d2 > 0) {
            writePeaksToStorage(cacheKey, { peaks: flat, duration: d2, ts: Date.now() });
          }
        } catch {
          // ignore
        }
      }
    });
  }, [audioUrl, cacheKey, serverPeaks, serverDuration, applyFit]);

  useEffect(() => {
    void ensureWave();
    const container = containerRef.current;

    return () => {
      if (waveRef.current) {
        waveRef.current.destroy?.();
        waveRef.current = null;
      }
      if (container) container.replaceChildren();
      setTrackDuration(0);
      setReady(false);
    };
  }, [ensureWave]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => applyFit());
    ro.observe(el);

    window.addEventListener("orientationchange", applyFit);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", applyFit);
    };
  }, [applyFit]);

  const ratio = Number.isFinite(progressRatio) ? Math.max(0, Math.min(1, progressRatio)) : 0;
  const timeLabel = trackDuration ? `${formatTime(ratio * trackDuration)} / ${formatTime(trackDuration)}` : "00:00 / --:--";

  if (!audioUrl) return <div className="p-1 text-xs text-white/60">Audio non disponibile.</div>;

  return (
    <div className="p-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onTogglePlay}
          className="h-12 w-12 shrink-0 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center"
          aria-label={isPlaying ? "Pause preview" : "Play preview"}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
        </button>

        <div
          ref={wrapRef}
          className="relative flex-1 min-w-0 overflow-hidden rounded-[18px] bg-[#0a0c12]"
          onMouseDown={(e) => {
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const nextRatio = Math.max(0, Math.min(1, x / Math.max(1, rect.width)));
            onSeekRatio(nextRatio);
          }}
          title="Clicca per spostarti nella traccia"
        >
          <div ref={containerRef} className="h-24 w-full pointer-events-none" />

          {/* overlay progresso (VERO) */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-cyan-400/20"
            style={{ width: `${ratio * 100}%` }}
          />
          <div
            className="pointer-events-none absolute inset-y-2 w-[2px] bg-cyan-300/80"
            style={{ left: `${ratio * 100}%` }}
          />

          {!ready && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-white/40">
              loading waveform...
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-[#0a0c12]" />
        </div>

        <div className="w-24 shrink-0 text-right text-[11px] text-white/70">{timeLabel}</div>
      </div>

      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/55">Stream preview</p>
    </div>
  );
}

const getSignedAudioUrl = async (supabase: ReturnType<typeof createClient>, path: string | null) => {
  if (!path) return null;
  const lower = path.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return path;

  const { data, error } = await supabase.storage.from("tracks").createSignedUrl(path, 3600);
  return error || !data?.signedUrl ? null : data.signedUrl;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [confirmProject, setConfirmProject] = useState<ProjectRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const allowProjectInfoSelectRef = useRef(true);
  const [q, setQ] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "score">("recent");

  const player = useTekkinPlayer();

  const filteredProjects = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const withScores = projects.map((p) => {
      const latest = p.versions[0] ?? null;
      const score = latest?.overall_score ?? null;
      return { p, score, latestDate: latest?.created_at ?? p.created_at };
    });

    let list = withScores.filter(({ p }) => {
      if (!needle) return true;
      return p.title.toLowerCase().includes(needle) || (p.description ?? "").toLowerCase().includes(needle);
    });

    if (sortMode === "score") list = list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    else list = list.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

    return list.map(({ p }) => p);
  }, [projects, q, sortMode]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const supabase = createClient();

        const fetchProjects = async (includeProjectInfo: boolean) =>
          supabase.from("projects").select(buildProjectsSelectQuery(includeProjectInfo)).order("created_at", { ascending: false });

        let includeProjectInfo = allowProjectInfoSelectRef.current;
        let selectResult = await fetchProjects(includeProjectInfo);

        if (selectResult.error && includeProjectInfo && shouldExcludeProjectInfo(selectResult.error)) {
          includeProjectInfo = false;
          allowProjectInfoSelectRef.current = false;
          selectResult = await fetchProjects(includeProjectInfo);
        }

        const { data, error } = selectResult;
        if (error) {
          console.error("Supabase load projects error:", error);
          setErrorMsg("Errore nel caricamento dei projects.");
          setProjects([]);
          setLoading(false);
          return;
        }

        const mapped = await Promise.all(
          (data ?? []).map(async (p: any) => {
            const rawVersions = (p.project_versions ?? []) as any[];

            const sortedVersions: ProjectVersionRow[] = await Promise.all(
              [...rawVersions]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(async (version) => {
                  const rawPath = typeof version.audio_url === "string" ? version.audio_url : null;

                  return {
                    id: version.id,
                    version_name: version.version_name ?? null,
                    created_at: version.created_at,
                    overall_score: typeof version.overall_score === "number" ? version.overall_score : null,
                    lufs: typeof version.lufs === "number" ? version.lufs : null,
                    mix_type: normalizeMixType(version.mix_type ?? null),

                    audio_path: rawPath,
                    audio_url: await getSignedAudioUrl(supabase, rawPath),

                    waveform_peaks: Array.isArray(version.waveform_peaks) ? version.waveform_peaks : null,
                    waveform_duration: typeof version.waveform_duration === "number" ? version.waveform_duration : null,
                  } as ProjectVersionRow;
                })
            );

            const latestVersion = sortedVersions[0] ?? null;

            return {
              id: p.id,
              title: p.title,
              status: p.status,
              version_name: latestVersion?.version_name ?? null,
              latestVersionId: latestVersion?.id ?? null,
              created_at: p.created_at,
              cover_url: p.cover_url ?? null,
              description: p.description ?? null,
              latestVersionCreatedAt: latestVersion?.created_at ?? null,
              version_count: sortedVersions.length,
              versions: sortedVersions,
            } as ProjectRow;
          })
        );

        setProjects(mapped);
        setLoading(false);
      } catch (err) {
        console.error("Unexpected load projects error:", err);
        setErrorMsg("Errore inatteso nel caricamento dei projects.");
        setProjects([]);
        setLoading(false);
      }
    };

    void load();
  }, []);

  async function handleDeleteProject(project: ProjectRow) {
    setDeleteError(null);
    setDeletingId(project.id);

    try {
      const res = await fetch("/api/projects/delete-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Impossibile eliminare il project.");
      }

      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setConfirmProject(null);
    } catch (err) {
      console.error("Delete project error:", err);
      const message = err instanceof Error ? err.message : "Eliminazione non riuscita, riprova tra poco.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-xs text-white/60">Workspace per versioni, Tekkin Analyzer e decisioni finali.</p>
        </div>

        <Link
          href="/artist/projects/new"
          className="rounded-full px-4 py-2 text-sm font-semibold bg-[var(--accent)] text-black shadow-[0_10px_35px_-18px_var(--accent)] hover:opacity-90"
        >
          Nuovo project
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-xs text-white/50">
          Visualizza {projects.length} progetti attivi · ordina per {sortMode === "recent" ? "recenti" : "Tekkin Score"}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca project..."
              className="h-9 w-60 rounded-full bg-black/60 border border-white/15 pl-8 pr-3 text-sm text-white placeholder:text-white/40 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="inline-flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setSortMode("recent")}
              className={`rounded-full px-3 py-1 border ${
                sortMode === "recent"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                  : "border-white/15 text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              Recenti
            </button>
            <button
              type="button"
              onClick={() => setSortMode("score")}
              className={`rounded-full px-3 py-1 border ${
                sortMode === "score"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                  : "border-white/15 text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }`}
            >
              Tekkin Score
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
          Caricamento dei tuoi projects in corso...
        </div>
      )}

      {errorMsg && !loading && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/50 p-4 text-sm text-red-200 mb-4">
          {errorMsg}
        </div>
      )}

      {!loading && filteredProjects.length > 0 && (
        <div className="space-y-4">
          {filteredProjects.map((p) => {
            const versions = p.versions;
            const latestVersion = versions[0] ?? null;

            const previewVersion = versions.find((v) => v.audio_url) ?? latestVersion;
            const audioForPreview = previewVersion?.audio_url ?? null;
            const previewVersionId = previewVersion?.id ?? null;

            const serverPeaks = previewVersion?.waveform_peaks ?? null;
            const serverDuration = previewVersion?.waveform_duration ?? null;
            const cacheKey = previewVersion?.audio_path ?? previewVersion?.id ?? p.id;

            const isActive = !!audioForPreview && player.audioUrl === audioForPreview && player.versionId === previewVersionId;
            const progressRatio =
              isActive && Number.isFinite(player.duration) && player.duration > 0
                ? player.currentTime / player.duration
                : 0;

            const versionCountLabel = `${versions.length} versione${versions.length === 1 ? "" : "i"}`;

            const statChips = [
              latestVersion?.lufs != null ? `${latestVersion.lufs.toFixed(1)} LUFS` : null,
              latestVersion?.overall_score != null ? `Tekkin ${latestVersion.overall_score.toFixed(1)}` : null,
              versionCountLabel,
            ].filter(Boolean) as string[];

            const parameterChips = [
              latestVersion?.mix_type ? MIX_TYPE_LABELS[latestVersion.mix_type] ?? latestVersion.mix_type : null,
            ].filter(Boolean) as string[];

            const latestVersionHref = latestVersion
              ? `/artist/projects/${p.id}?version_id=${latestVersion.id}`
              : `/artist/projects/${p.id}`;

            return (
              <article
                key={p.id}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/60 via-black/40 to-black/60 p-4 shadow-[0_0_30px_rgba(0,0,0,0.35)]"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl">
                    {p.cover_url ? (
                      <img src={p.cover_url} alt={`Cover ${p.title}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-white/60 text-xs">
                        <span>Cover</span>
                        <span>mancante</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <Link href={`/artist/projects/${p.id}`} className="truncate text-lg font-semibold text-white hover:underline">
                            {p.title}
                          </Link>
                          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                            {p.status ?? "IN PROGRESS"}
                          </span>
                        </div>

                        {parameterChips.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            {parameterChips.map((chip) => (
                              <span key={chip} className="rounded-full border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-200">
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}

                        {statChips.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/65">
                            {statChips.map((chip) => (
                              <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="h-9 w-9 rounded-full bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                          aria-label="Impostazioni progetto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Settings className="h-4 w-4 mx-auto" />
                        </button>

                        <button
                          type="button"
                          className="h-9 w-9 rounded-full bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                          aria-label="Scarica ultima versione"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="h-4 w-4 mx-auto" />
                        </button>

                        <button
                          type="button"
                          className="h-9 w-9 rounded-full bg-white/5 text-white/70 hover:bg-white/10 border border-white/10"
                          aria-label="Altre azioni"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4 mx-auto" />
                        </button>
                      </div>
                    </div>

                    <WaveformPreview
                      audioUrl={audioForPreview}
                      cacheKey={cacheKey}
                      serverPeaks={serverPeaks}
                      serverDuration={serverDuration}
                      isActive={isActive}
                      isPlaying={isActive && player.isPlaying}
                      progressRatio={progressRatio}
                      onTogglePlay={() => {
                        if (!audioForPreview || !previewVersionId) return;

                        if (isActive) {
                          if (player.isPlaying) player.pause();
                          else player.play();
                          return;
                        }

                        player.play({
                          projectId: p.id,
                          versionId: previewVersionId,
                          title: p.title,
                          subtitle: previewVersion?.version_name ?? undefined,
                          audioUrl: audioForPreview,
                          duration: serverDuration ?? undefined,
                        });
                      }}
                      onSeekRatio={(ratio) => {
                        if (!audioForPreview || !previewVersionId) return;

                        if (isActive) {
                          player.seekToRatio(ratio);
                          return;
                        }

                        player.playAtRatio(
                          {
                            projectId: p.id,
                            versionId: previewVersionId,
                            title: p.title,
                            subtitle: previewVersion?.version_name ?? undefined,
                            audioUrl: audioForPreview,
                            duration: serverDuration ?? undefined,
                          },
                          ratio
                        );
                      }}
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Link
                        href={`/artist/projects/${p.id}`}
                        className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        Apri project
                      </Link>

                      <Link
                        href={latestVersionHref}
                        className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        Apri report versione
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmProject(p);
                        }}
                        className="flex items-center justify-center rounded-full border border-red-500/40 px-3 py-1 text-[11px] text-red-400 hover:bg-red-500/10"
                        aria-label={`Elimina ${p.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {confirmProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--sidebar-bg)] p-5 shadow-2xl">
            <p className="text-sm font-semibold text-white">Elimina “{confirmProject.title}”?</p>
            <p className="mt-2 text-xs text-white/70">Verranno rimossi anche i file collegati. L’azione è definitiva.</p>

            {deleteError && <p className="mt-2 text-xs text-red-300">{deleteError}</p>}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmProject(null)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/80 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                disabled={!!deletingId}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProject(confirmProject)}
                className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                disabled={deletingId === confirmProject.id}
              >
                {deletingId === confirmProject.id ? "Elimino..." : "Conferma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
