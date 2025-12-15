"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type FormEvent,
  type TouchEvent,
} from "react";
import { Download, MoreVertical, Pause, Play, Search, Send, Settings, Trash2 } from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { TEKKIN_MIX_TYPES, TekkinMixType } from "@/lib/constants/genres";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import type { WaveformBands } from "@/types/analyzer";

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
  waveform_bands?: WaveformBands | null;
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

const buildProjectsSelectQuery = (includeProjectInfo: boolean, includeWaveformBands: boolean) => {
  const versionFields = [
  "id",
  "version_name",
  "created_at",
  "overall_score",
  "lufs",
  "mix_type",
  "audio_url",
  // "audio_path", // TOGLI
  "waveform_peaks",
  "waveform_duration",
  includeWaveformBands ? "waveform_bands" : null,
].filter(Boolean).join(",\n    ");

  return `
    id,
    title,
    status,
    created_at,
    project_versions (
      ${versionFields}
    )${includeProjectInfo ? `,
    cover_url,
    description` : ""}
  `;
};

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

type WaveformCanvasProps = {
  peaks: number[];
  progressRatio: number;
  height?: number;
};

const WaveformBandsContext = createContext<WaveformBands | null>(null);
WaveformBandsContext.displayName = "WaveformBandsContext";

function WaveformCanvas({ peaks, progressRatio, height = 70 }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformBands = useContext(WaveformBandsContext);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const cssWidth = Math.max(1, parent?.clientWidth ?? canvas.getBoundingClientRect().width ?? 1);
    const cssHeight = Math.max(1, height);

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    if (cssWidth <= 0 || cssHeight <= 0) return;

    const dpr = typeof window !== "undefined" ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const deviceWidth = Math.max(1, Math.round(cssWidth * dpr));
    const deviceHeight = Math.max(1, Math.round(cssHeight * dpr));

    canvas.width = deviceWidth;
    canvas.height = deviceHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, deviceWidth, deviceHeight);

    if (!peaks.length) return;

    const widthSteps = Math.max(1, Math.round(cssWidth));
    const progressRatioClamped = Math.max(0, Math.min(1, progressRatio));
    const progressLimit = Math.max(0, Math.min(widthSteps, Math.round(widthSteps * progressRatioClamped)));
    const cssStep = cssWidth / widthSteps;
    const halfHeight = deviceHeight / 2;

    type ColumnData = {
      amplitude: number;
      baseColor: string;
      progressColor: string;
    };

    const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
    const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
    const mixRgb = (a: [number, number, number], b: [number, number, number], t: number) => {
      const ratio = clamp01(t);
      return [
        a[0] * (1 - ratio) + b[0] * ratio,
        a[1] * (1 - ratio) + b[1] * ratio,
        a[2] * (1 - ratio) + b[2] * ratio,
      ] as [number, number, number];
    };

    const RED: [number, number, number] = [239, 68, 68];
    const YELLOW: [number, number, number] = [250, 204, 21];
    const MAGENTA: [number, number, number] = [168, 85, 247];

    const hasBandData =
      waveformBands &&
      Array.isArray(waveformBands.sub) &&
      waveformBands.sub.length > 0 &&
      Array.isArray(waveformBands.mid) &&
      waveformBands.mid.length > 0 &&
      Array.isArray(waveformBands.high) &&
      waveformBands.high.length > 0;

    const sampleCount = peaks.length;
    const mapBandValue = (band: number[] | undefined, sampleIndex: number) => {
      if (!band || !band.length || sampleCount <= 0) {
        return 0;
      }
      const ratio = sampleCount > 1 ? sampleIndex / (sampleCount - 1) : 0;
      const idx = Math.min(band.length - 1, Math.floor(ratio * (band.length - 1)));
      return clamp01(band[idx] ?? 0);
    };

    const buildSpectrumColor = (
      energies: { sub: number; mid: number; high: number },
      opacity: number,
      darken: boolean
    ) => {
      const totalSubHigh = Math.max(1e-6, energies.sub + energies.high);
      const highWeight = energies.high / totalSubHigh;
      const baseMix = mixRgb(RED, YELLOW, highWeight);
      const midInfluence = clamp01(energies.mid) * 0.65;
      const midMix = mixRgb(baseMix, MAGENTA, midInfluence);
      const brightness = darken ? 0.55 : 1;
      const finalRgb: [number, number, number] = [
        clampByte(midMix[0] * brightness),
        clampByte(midMix[1] * brightness),
        clampByte(midMix[2] * brightness),
      ];
      return `rgba(${finalRgb[0]}, ${finalRgb[1]}, ${finalRgb[2]}, ${opacity})`;
    };

    const columns: ColumnData[] = [];
    for (let i = 0; i < widthSteps; i += 1) {
      const sampleIndex =
        sampleCount > 1
          ? Math.min(sampleCount - 1, Math.floor((i / widthSteps) * sampleCount))
          : 0;
      const peakValue = peaks[sampleIndex] ?? 0;
      const amplitude = Math.min(1, Math.max(0, Math.abs(peakValue)));

      let baseColor = "rgba(107, 114, 128, 0.35)";
      let progressColor = "#22d3ee";
      if (hasBandData && waveformBands) {
        const energies = {
          sub: mapBandValue(waveformBands.sub, sampleIndex),
          mid: mapBandValue(waveformBands.mid, sampleIndex),
          high: mapBandValue(waveformBands.high, sampleIndex),
        };
        baseColor = buildSpectrumColor(energies, 0.35, true);
        progressColor = buildSpectrumColor(energies, 1, false);
      }

      columns.push({ amplitude, baseColor, progressColor });
    }

    const drawRange = (limit: number, useProgressColors: boolean) => {
      const safeLimit = Math.min(limit, columns.length);
      ctx.lineWidth = Math.max(1, dpr);
      ctx.lineCap = "round";

      for (let i = 0; i < safeLimit; i += 1) {
        const column = columns[i];
        const lineHeight = Math.max(1, column.amplitude * deviceHeight);
        const startY = halfHeight - lineHeight / 2;
        const endY = halfHeight + lineHeight / 2;
        const cssX = (i + 0.5) * cssStep;
        const drawX = cssX * dpr;
        ctx.beginPath();
        ctx.strokeStyle = useProgressColors ? column.progressColor : column.baseColor;
        ctx.moveTo(drawX, startY);
        ctx.lineTo(drawX, endY);
        ctx.stroke();
      }
    };

    drawRange(widthSteps, false);
    if (progressLimit > 0) {
      drawRange(progressLimit, true);
    }
  }, [height, peaks, progressRatio, waveformBands]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frameId: number | null = null;

    const scheduleDraw = () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(drawWaveform);
    };

    scheduleDraw();

    const cleanup: (() => void)[] = [];

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(scheduleDraw);
      observer.observe(canvas.parentElement ?? canvas);
      cleanup.push(() => observer.disconnect());
    } else if (typeof window !== "undefined") {
      const handleResize = () => scheduleDraw();
      window.addEventListener("resize", handleResize);
      cleanup.push(() => window.removeEventListener("resize", handleResize));
    }

    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      cleanup.forEach((fn) => fn());
    };
  }, [drawWaveform]);

  return <canvas ref={canvasRef} className="h-full w-full block" style={{ height }} aria-hidden />;
}

type WaveformPreviewLiteProps = {
  peaks?: number[] | null;
  progressRatio: number;
  isPlaying: boolean;
  timeLabel: string;
  onTogglePlay: () => void;
  onSeekRatio: (ratio: number) => void;
  bands?: WaveformBands | null;
};

function WaveformPreviewLite({
  peaks,
  progressRatio,
  isPlaying,
  timeLabel,
  onTogglePlay,
  onSeekRatio,
  bands,
}: WaveformPreviewLiteProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasPeaks = Array.isArray(peaks) && peaks.length > 0;
  const normalizedProgress = Math.max(0, Math.min(1, progressRatio));

  const seekFromPointer = (clientX: number | null) => {
    const container = containerRef.current;
    if (!container || clientX === null) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    onSeekRatio(ratio);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    seekFromPointer(event.clientX);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    seekFromPointer(event.touches[0]?.clientX ?? null);
  };

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
          ref={containerRef}
          className="relative flex-1 min-w-0 overflow-hidden rounded-[18px] bg-[#0a0c12] cursor-pointer"
          style={{ height: 70 }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          title="Clicca per spostarti nella traccia"
        >
          {hasPeaks ? (
            <WaveformBandsContext.Provider value={bands ?? null}>
              <WaveformCanvas peaks={peaks as number[]} progressRatio={normalizedProgress} height={70} />
            </WaveformBandsContext.Provider>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-white/40">
              waveform non pronta
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



export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [confirmProject, setConfirmProject] = useState<ProjectRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [signalPanelProjectId, setSignalPanelProjectId] = useState<string | null>(null);
  const [signalProjectId, setSignalProjectId] = useState<string | null>(null);
  const [signalArtists, setSignalArtists] = useState<{ id: string; artist_name: string | null }[]>([]);
  const [signalArtistId, setSignalArtistId] = useState<string>("");
  const [signalArtistError, setSignalArtistError] = useState<string | null>(null);
  const [signalLoadingArtists, setSignalLoadingArtists] = useState(false);
  const [signalKind, setSignalKind] = useState<"collab" | "promo">("collab");
  const [signalMessage, setSignalMessage] = useState("");
  const [signalFeedback, setSignalFeedback] = useState<string | null>(null);
  const [signalSending, setSignalSending] = useState(false);

  const allowProjectInfoSelectRef = useRef(true);
  const waveformBandsSelectableRef = useRef(true);
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

        const { data: auth } = await supabase.auth.getUser();
        console.log("projects: user id =", auth.user?.id);

        const fetchProjects = async (includeProjectInfo: boolean, includeWaveformBands: boolean) =>
          supabase
            .from("projects")
            .select(buildProjectsSelectQuery(includeProjectInfo, includeWaveformBands))
            .order("created_at", { ascending: false });

        let includeProjectInfo = allowProjectInfoSelectRef.current;
        let includeWaveformBands = waveformBandsSelectableRef.current;
        let selectResult = await fetchProjects(includeProjectInfo, includeWaveformBands);

        if (selectResult.error) {
          const message = `${selectResult.error.message ?? ""} ${selectResult.error.details ?? ""}`.toLowerCase();
          if (includeWaveformBands && message.includes("waveform_bands")) {
            includeWaveformBands = false;
            waveformBandsSelectableRef.current = false;
            selectResult = await fetchProjects(includeProjectInfo, includeWaveformBands);
          }
        }

        if (selectResult.error && includeProjectInfo && shouldExcludeProjectInfo(selectResult.error)) {
          includeProjectInfo = false;
          allowProjectInfoSelectRef.current = false;
          selectResult = await fetchProjects(includeProjectInfo, includeWaveformBands);
        }

        const { data, error } = selectResult;

        if (error) {
          const e = error as unknown;

          const asErr = e instanceof Error ? e : null;
          const asObj = e && typeof e === "object" ? (e as Record<string, unknown>) : null;

          console.error("Supabase load projects error:", {
            name: asErr?.name ?? (asObj?.["name"] as string | undefined),
            message: asErr?.message ?? (asObj?.["message"] as string | undefined),
            stack: asErr?.stack,
            code: asObj?.["code"],
            details: asObj?.["details"],
            hint: asObj?.["hint"],
            status: asObj?.["status"],
            statusText: asObj?.["statusText"],
            raw: e,
          });

          return;
        }


        const mapped = await Promise.all(
          (data ?? []).map(async (p: any) => {
            const rawVersions = (p.project_versions ?? []) as any[];

            const sortedVersions: ProjectVersionRow[] = await Promise.all(
              [...rawVersions]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(async (version) => {
                  const rawUrl = typeof version.audio_url === "string" ? version.audio_url : null;
                  const durationRaw = version.waveform_duration;
                  const durationNum =
                    typeof durationRaw === "number"
                      ? durationRaw
                      : typeof durationRaw === "string"
                      ? Number.parseFloat(durationRaw)
                      : null;

                  const safeDuration =
                    typeof durationNum === "number" && Number.isFinite(durationNum) && durationNum > 0
                      ? durationNum
                      : null;

                  return {
  id: version.id,
  version_name: version.version_name ?? null,
  created_at: version.created_at,
  overall_score: typeof version.overall_score === "number" ? version.overall_score : null,
  lufs: typeof version.lufs === "number" ? version.lufs : null,
  mix_type: normalizeMixType(version.mix_type ?? null),

  audio_path: null,
  audio_url: rawUrl,

  waveform_peaks: Array.isArray(version.waveform_peaks) ? version.waveform_peaks : null,
  waveform_duration: safeDuration,
  waveform_bands: version.waveform_bands ?? null,
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

  useEffect(() => {
    const shouldLoadArtists =
      !!signalPanelProjectId && !signalLoadingArtists && signalArtists.length === 0;
    if (!shouldLoadArtists) return;

    const fetchArtists = async () => {
      try {
        setSignalLoadingArtists(true);
        setSignalArtistError(null);
        const supabase = createClient();
        const { data, error } = await supabase
          .from("users_profile")
          .select("id, artist_name")
          .eq("role", "artist")
          .order("artist_name", { ascending: true })
          .limit(100);

        if (error) {
          console.error("Signal artists load error:", error);
          setSignalArtistError("Errore caricando gli artisti Tekkin.");
          return;
        }

        const list = (data ?? []).map((row) => ({
          id: row.id,
          artist_name: row.artist_name ?? "Artista Tekkin",
        }));

        setSignalArtists(list);
        setSignalArtistId((prev) => prev || list[0]?.id || "");
      } catch (err) {
        console.error("Signal artists load unexpected:", err);
        setSignalArtistError("Errore inatteso caricando gli artisti Tekkin.");
      } finally {
        setSignalLoadingArtists(false);
      }
    };

    void fetchArtists();
  }, [signalArtists.length, signalLoadingArtists, signalPanelProjectId]);

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

  const handleOpenSignal = (projectId: string, canOpen: boolean) => {
    if (!canOpen) return;
    setSignalFeedback(null);
    setSignalArtistError(null);
    setSignalMessage("");
    setSignalKind("collab");
    setSignalPanelProjectId((current) => (current === projectId ? null : projectId));
    setSignalProjectId(projectId);
  };

  const handleSendSignal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signalArtistId) {
      setSignalArtistError("Seleziona un artista.");
      return;
    }

    const targetProjectId = signalProjectId ?? signalPanelProjectId;
    if (!targetProjectId) {
      setSignalFeedback("Nessun project selezionato.");
      return;
    }

    try {
      setSignalSending(true);
      setSignalFeedback(null);
      const res = await fetch("/api/discovery/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiver_id: signalArtistId,
          project_id: targetProjectId,
          kind: signalKind,
          message: signalMessage.trim() || null,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setSignalFeedback(payload?.error ?? "Errore inviando il Signal.");
        return;
      }

      setSignalMessage("");
      setSignalKind("collab");
      setSignalFeedback(null);
      setSignalPanelProjectId(null);
    } catch (err) {
      console.error("Send signal error:", err);
      setSignalFeedback("Errore inatteso inviando il Signal.");
    } finally {
      setSignalSending(false);
    }
  };

  const isSuccessFeedback =
    signalFeedback && /successo|inviato/.test(signalFeedback.toLowerCase());

  return (
    <div className="w-full max-w-6xl mx-auto pt-8 pb-28">
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

            const isActive =
              !!audioForPreview &&
              player.audioUrl === audioForPreview &&
              player.versionId === previewVersionId;

            const progressRatio =
              isActive && Number.isFinite(player.duration) && player.duration > 0
                ? player.currentTime / player.duration
                : 0;
            const durationForLabel =
              typeof serverDuration === "number" &&
              Number.isFinite(serverDuration) &&
              serverDuration > 0
                ? serverDuration
                : isActive && Number.isFinite(player.duration) && player.duration > 0
                ? player.duration
                : null;
            const timeLabel = durationForLabel ? formatTime(durationForLabel) : "--:--";

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

            const canSignal = !!audioForPreview;

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
                          <Link
                            href={`/artist/projects/${p.id}`}
                            className="truncate text-lg font-semibold text-white hover:underline"
                          >
                            {p.title}
                          </Link>
                          <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                            {p.status ?? "IN PROGRESS"}
                          </span>
                        </div>

                        {parameterChips.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            {parameterChips.map((chip) => (
                              <span
                                key={chip}
                                className="rounded-full border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-200"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}

                        {statChips.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/65">
                            {statChips.map((chip) => (
                              <span
                                key={chip}
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]"
                              >
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
                    {audioForPreview ? (
                      <WaveformPreviewLite
                        peaks={serverPeaks}
                        progressRatio={progressRatio}
                        isPlaying={isActive && player.isPlaying}
                        timeLabel={timeLabel}
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
                        onSeekRatio={(r) => {
                          if (!audioForPreview || !previewVersionId) return;

                          if (isActive) {
                            player.seekToRatio(r);
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
                            r
                          );
                        }}
                        bands={previewVersion?.waveform_bands ?? null}
                      />
                    ) : (
                      <div className="p-1 text-xs text-white/60">Audio non disponibile.</div>
                    )}

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
                        onClick={() => handleOpenSignal(p.id, canSignal)}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/60 px-3 py-1 text-[11px] text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50 disabled:hover:bg-transparent"
                        disabled={!canSignal}
                        title={canSignal ? undefined : "Carica una versione con audio per inviare un Signal"}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Signal Tekkin
                      </button>

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

                    {signalPanelProjectId === p.id && (
  <div className="mt-4">
    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-[#06080f]/80 via-[#070a12]/60 to-[#05070d]/80 p-5 shadow-[0_0_0_1px_rgba(34,211,238,0.06),0_20px_60px_-40px_rgba(34,211,238,0.35)] backdrop-blur-xl">
      {/* glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[520px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-[-120px] h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[13px] font-semibold tracking-wide text-white">
            Invia Signal
            <span className="ml-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
              anonimo
            </span>
          </p>
          <p className="text-[12px] leading-5 text-white/60">
            Contatta un artista Tekkin per collab o promo, legando la richiesta a questo project.
          </p>
        </div>

        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70">
          <Send className="h-4 w-4" />
        </div>
      </div>

      <form onSubmit={handleSendSignal} className="relative mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-white/60">Artista</label>
            <select
              value={signalArtistId}
              onChange={(e) => setSignalArtistId(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/15"
              disabled={signalLoadingArtists || !signalArtists.length}
            >
              {signalArtists.length === 0 ? (
                <option value="">Nessun artista disponibile</option>
              ) : (
                signalArtists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.artist_name}
                  </option>
                ))
              )}
            </select>
            {signalArtistError && <p className="text-[11px] text-red-300">{signalArtistError}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-white/60">Tipo</label>
            <select
              value={signalKind}
              onChange={(e) => setSignalKind(e.target.value as "collab" | "promo")}
              className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/15"
            >
              <option value="collab">Collab</option>
              <option value="promo">Promo</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-white/60">Project</label>
            <input
              value={p.title}
              readOnly
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white/70"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-white/60">Messaggio</label>
          <textarea
            value={signalMessage}
            onChange={(e) => setSignalMessage(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/15"
            placeholder="Esempio: traccia pronta, cerco collab o support promo. 130 BPM, minimal deep tech."
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/40">Suggerimento: scrivi 1 frase chiara + BPM + vibe.</p>
            <p className="text-[11px] text-white/40">{signalMessage.trim().length}/240</p>
          </div>
        </div>

        {signalFeedback && (
          <div
            className={`rounded-xl border px-3 py-2 text-[12px] ${
              isSuccessFeedback
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                : "border-red-400/25 bg-red-400/10 text-red-200"
            }`}
          >
            {signalFeedback}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSignalPanelProjectId(null)}
            className="h-10 rounded-full border border-white/12 bg-white/5 px-4 text-xs font-semibold text-white/75 hover:border-white/20 hover:bg-white/10"
            disabled={signalSending}
          >
            Chiudi
          </button>

          <button
            type="submit"
            className="h-10 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-semibold text-black shadow-[0_12px_35px_-18px_rgba(34,211,238,0.9)] hover:opacity-95 disabled:opacity-60"
            disabled={signalSending || !signalArtistId}
            onClick={() => setSignalProjectId(p.id)}
          >
            <Send className="h-4 w-4" />
            {signalSending ? "Invio..." : "Invia Signal"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

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
