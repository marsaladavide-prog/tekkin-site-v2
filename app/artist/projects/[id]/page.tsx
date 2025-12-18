//C:\Users\marsa\Desktop\tekkin-site-v2\app\artist\projects\[id]\page.tsx

"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";
import { TEKKIN_MIX_TYPES, type TekkinMixType, type TekkinGenreId, getTekkinGenreLabel } from "@/lib/constants/genres";
import type { AnalyzerMetricsFields, AnalyzerRunResponse, AnalyzerResult, FixSuggestion, ReferenceAi, AnalyzerAiAction, AnalyzerAiCoach, AnalyzerAiMeta } from "@/types/analyzer";
import type { WaveformBands } from "@/types/analyzer";
import WaveformPreviewUnified from "@/components/player/WaveformPreviewUnified";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const MIX_TYPE_LABELS: Record<TekkinMixType, string> = {
  master: "MASTER",
  premaster: "PREMASTER",
};

type AnalyzerStatus = "idle" | "starting" | "analyzing" | "saving" | "done" | "error";

type ProjectVersionRow = AnalyzerMetricsFields & {
  id: string;
  created_at: string;
  version_name: string | null;
  mix_type: TekkinMixType | null;

  // IMPORTANT: nel tuo DB audio_url contiene la path storage nel bucket tracks
audio_url: string | null;   // può essere URL http firmato (se usato) oppure null
audio_path: string | null;  // path nel bucket tracks



  analyzer_json?: AnalyzerResult | null;
  analyzer_reference_ai?: ReferenceAi | null;

  analyzer_ai_summary?: string | null;
  analyzer_ai_actions?: AnalyzerAiAction[] | null;
  analyzer_ai_meta?: AnalyzerAiMeta | null;
  analyzed_at?: string | null;

  waveform_peaks?: number[] | null;
  waveform_duration?: number | null;
  waveform_bands?: WaveformBands | null;
};

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
  genre: TekkinGenreId | null;
  mix_type: TekkinMixType | null;
  cover_url: string | null;
  description: string | null;
  project_versions: ProjectVersionRow[];
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

async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", enc);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extFromName(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  return ext.toLowerCase();
}

function guessContentType(file: File) {
  if (file.type) return file.type;
  const ext = extFromName(file.name);
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "flac") return "audio/flac";
  if (ext === "m4a") return "audio/mp4";
  return "application/octet-stream";
}

async function buildSignedUrlFromStoragePath(path: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("tracks").createSignedUrl(path, 60 * 30);

  if (error || !data?.signedUrl) {
    const msg = String((error as any)?.message ?? "");
    if (msg.toLowerCase().includes("object not found")) return null;
    throw new Error("Signed URL non disponibile");
  }

  return data.signedUrl;
}

/* ------------------------------ Page ------------------------------ */

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const projectId = params?.id ?? "";
  const initialVersionId = search?.get("version_id");

  const player = useTekkinPlayer();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [versionName, setVersionName] = useState("");
  const [versionMixType, setVersionMixType] = useState<TekkinMixType>("master");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [analyzingVersionId, setAnalyzingVersionId] = useState<string | null>(null);
  const [analyzerStatus, setAnalyzerStatus] = useState<AnalyzerStatus>("idle");

  const [audioPreviewByVersionId, setAudioPreviewByVersionId] = useState<Record<string, string | null>>({});
  const [fixSuggestionsByVersion, setFixSuggestionsByVersion] = useState<Record<string, FixSuggestion[] | null>>({});
  const [aiByVersion, setAiByVersion] = useState<Record<string, AnalyzerAiCoach | null>>({});
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState<ProjectVersionRow | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
  const [deleteVersionError, setDeleteVersionError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const supabase = createClient();

      const url = new URL(window.location.href);
      const pageProjectId = url.pathname.split("/").pop() ?? null;
      console.log("[loadProject] pageProjectId:", pageProjectId);

      const { data: sessionData } = await supabase.auth.getSession();
      console.log("[loadProject] session user id:", sessionData?.session?.user?.id ?? null);

      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          id, title, status, created_at, genre, mix_type, cover_url, description,
          project_versions (
            id, created_at, version_name, mix_type,
            audio_url,
              audio_path,
            lufs, sub_clarity, hi_end, dynamics, stereo_image, tonality, overall_score, feedback,
            analyzer_bpm, analyzer_key,
            analyzer_reference_ai, analyzer_json,
            analyzer_ai_summary, analyzer_ai_actions, analyzer_ai_meta,
            waveform_peaks, waveform_duration, waveform_bands
          )
        `
        )
        .eq("id", pageProjectId)
        .maybeSingle();

      if (error || !data) {
        const errObj = error
          ? {
              name: (error as any).name,
              message: (error as any).message,
              code: (error as any).code,
              details: (error as any).details,
              hint: (error as any).hint,
              status: (error as any).status,
            }
          : null;

        console.error(
          "[loadProject] failed pageProjectId=" +
            String(pageProjectId) +
            " hasError=" +
            String(Boolean(error)) +
            " dataIsNull=" +
            String(data == null)
        );
        console.error("[loadProject] error=" + JSON.stringify(errObj));
        console.error("[loadProject] data=" + JSON.stringify(data));
        setProject(null);
        setLoading(false);
        setErrorMsg("Project non trovato o errore nel caricamento.");
        return;
      }


      const p = data as unknown as ProjectRow;
      p.project_versions = Array.isArray(p.project_versions) ? p.project_versions : [];
      p.project_versions = [...p.project_versions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // normalizza mix_type versioni
      p.project_versions = p.project_versions.map((v) => ({ ...v, mix_type: normalizeMixType(v.mix_type ?? p.mix_type) }));

      setProject(p);
      setLoading(false);
    } catch (e) {
      console.error("loadProject unexpected:", e);
      setLoading(false);
      setErrorMsg("Errore nel caricamento.");
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const versions = project?.project_versions ?? [];
  const latestVersion = versions[0] ?? null;

  const selectedVersion = useMemo(() => {
    if (!versions.length) return null;
    if (initialVersionId) {
      const found = versions.find((v) => v.id === initialVersionId);
      if (found) return found;
    }
    return latestVersion;
  }, [versions, latestVersion, initialVersionId]);

  const profileLabel = getTekkinGenreLabel(project?.genre ?? null) ?? "Minimal / Deep Tech";

  const ensurePreviewUrl = useCallback(
  async (v: ProjectVersionRow) => {
    const rawUrl = typeof v.audio_url === "string" ? v.audio_url.trim() : "";
    const rawPath = typeof v.audio_path === "string" ? v.audio_path.trim() : "";

    // cache
    if (audioPreviewByVersionId[v.id] !== undefined) {
      return audioPreviewByVersionId[v.id];
    }

    // 1) se ho già un URL http, uso quello
    if (rawUrl && rawUrl.startsWith("http")) {
      setAudioPreviewByVersionId((prev) => ({ ...prev, [v.id]: rawUrl }));
      return rawUrl;
    }

    // 2) altrimenti firmo una path: preferisco audio_path, fallback audio_url (legacy path)
    // 2) altrimenti firmo SOLO audio_path
const path = rawPath;

    if (!path) {
      setAudioPreviewByVersionId((prev) => ({ ...prev, [v.id]: null }));
      return null;
    }

    try {
      const signed = await buildSignedUrlFromStoragePath(path);
      setAudioPreviewByVersionId((prev) => ({ ...prev, [v.id]: signed }));
      return signed;
    } catch (e) {
      console.error("ensurePreviewUrl error:", e);
      setAudioPreviewByVersionId((prev) => ({ ...prev, [v.id]: null }));
      return null;
    }
  },
  [audioPreviewByVersionId]
);


  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
  };

  const handleUploadVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setErrorMsg(null);

    if (!file) {
      setErrorMsg("Seleziona un file audio.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg("File troppo grande (max 50MB).");
      return;
    }

    try {
      setUploading(true);

      // 1) Upload diretto a Storage
      const supabase = createClient();
      const ext = extFromName(file.name) || "mp3";
      const contentType = guessContentType(file);

      // path stabile e pulita
      const seed = `${projectId}:${file.name}:${file.size}:${file.lastModified}:${Date.now()}`;
      const hash = await sha1Hex(seed);
      const storagePath = `${projectId}/${hash}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("tracks")
        .upload(storagePath, file, {
          contentType,
          upsert: true,
          cacheControl: "3600",
        });

      if (upErr) {
        console.error("upload storage error:", upErr);
        throw new Error("Errore upload su Storage");
      }

      // 2) Crea versione nel DB via JSON (audio_path è il path nel bucket)
      const addVersionRes = await fetch("/api/projects/add-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          version_name: versionName?.trim() || null,
          mix_type: versionMixType,
          audio_path: storagePath,
        }),
      });

      const addVersionPayload = (await addVersionRes.json().catch(() => null)) as { version_id?: string; version?: { id?: string } | null; error?: string } | null;
      if (!addVersionRes.ok) throw new Error(addVersionPayload?.error ?? "Errore add-version");

      const createdVersionId = addVersionPayload?.version?.id ?? addVersionPayload?.version_id;
      if (!createdVersionId) throw new Error("add-version: version_id mancante");

      // 3) Lancia analyzer per popolare waveform/metriche
      const runRes = await fetch("/api/projects/run-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: createdVersionId }),
      });

      if (!runRes.ok) {
        const t = await runRes.text().catch(() => "");
        throw new Error(t || "Errore run-analyzer");
      }

      // 4) reload
      setVersionName("");
      setFile(null);
      await loadProject();
    } catch (err) {
      console.error("handleUploadVersion error:", err);
      const msg = err instanceof Error ? err.message : "Errore upload versione.";
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

    const handleAnalyzeVersion = async (versionId: string) => {
      setErrorMsg(null);
      setAnalyzingVersionId(versionId);
      setAnalyzerStatus("starting");

    try {
      const res = await fetch("/api/projects/run-analyzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setAnalyzerStatus("error");
        throw new Error(text || "Errore avviando l'analisi");
      }

      setAnalyzerStatus("analyzing");
      const runData = (await res.json().catch(() => null)) as AnalyzerRunResponse | null;

      setFixSuggestionsByVersion((prev) => ({
        ...prev,
        [versionId]: runData?.analyzer_result?.fix_suggestions ?? null,
      }));

      setAnalyzerStatus("saving");
      await loadProject();

      setAnalyzerStatus("done");
      window.setTimeout(() => setAnalyzerStatus("idle"), 1200);
      } catch (err) {
        console.error("Analyze version error:", err);
        setErrorMsg("Errore durante l'analisi della versione.");
        setAnalyzerStatus("error");
      } finally {
        setAnalyzingVersionId(null);
      }
    };

    const handleDeleteVersion = useCallback(
      async (version: ProjectVersionRow) => {
        if (!version?.id) return;

        setDeleteVersionError(null);
        setDeletingVersionId(version.id);

        try {
          const res = await fetch("/api/projects/delete-version", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version_id: version.id }),
          });

          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!res.ok) throw new Error(payload?.error ?? "Impossibile eliminare la versione.");

          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (url.searchParams.get("version_id") === version.id) {
              url.searchParams.delete("version_id");
              window.history.replaceState({}, "", url.toString());
            }
          }

          await loadProject();
          setConfirmDeleteVersion(null);
        } catch (err) {
          console.error("Delete version error:", err);
          const msg = err instanceof Error ? err.message : "Errore eliminando la versione.";
          setDeleteVersionError(msg);
        } finally {
          setDeletingVersionId(null);
        }
      },
      [loadProject]
    );

  const previewAudioUrl = useMemo(() => {
    if (!selectedVersion) return null;
    return audioPreviewByVersionId[selectedVersion.id] ?? null;
  }, [selectedVersion, audioPreviewByVersionId]);

  useEffect(() => {
    if (!selectedVersion) return;
    void ensurePreviewUrl(selectedVersion);
  }, [selectedVersion, ensurePreviewUrl]);

  const isActive = useMemo(() => {
    if (!selectedVersion) return false;
    return player.versionId === selectedVersion.id;
  }, [player.versionId, selectedVersion]);

  const progressRatio = useMemo(() => {
    if (!isActive) return 0;
    if (!Number.isFinite(player.duration) || player.duration <= 0) return 0;
    return player.currentTime / player.duration;
  }, [isActive, player.currentTime, player.duration]);

  const durationForLabel = useMemo(() => {
    const d1 = selectedVersion?.waveform_duration;
    if (typeof d1 === "number" && Number.isFinite(d1) && d1 > 0) return d1;
    if (isActive && Number.isFinite(player.duration) && player.duration > 0) return player.duration;
    return null;
  }, [selectedVersion?.waveform_duration, isActive, player.duration]);

  const timeLabel = durationForLabel ? formatTime(durationForLabel) : "--:--";

  if (!projectId) {
    return (
      <div className="w-full max-w-5xl mx-auto py-8">
        <p className="text-sm text-white/60">Project id non valido.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <Link href="/artist/projects" className="mb-4 inline-flex text-sm text-white/60 hover:text-white">
        ← Back to Projects
      </Link>

      {loading && <p className="text-sm text-white/50">Caricamento project.</p>}
      {errorMsg && !loading && <p className="text-sm text-red-400 mb-4">{errorMsg}</p>}

      {!loading && project && (
        <>
          <header className="mb-6 rounded-3xl border border-white/10 bg-black/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xl font-semibold text-white truncate">{project.title}</div>
                <div className="mt-1 text-sm text-white/60">
                  {profileLabel} · {versions.length} versione{versions.length === 1 ? "" : "i"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {latestVersion?.lufs != null && (
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] text-white/75">
                    {latestVersion.lufs.toFixed(1)} LUFS
                  </span>
                )}
                {latestVersion?.overall_score != null && (
                  <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] text-white/75">
                    Tekkin {latestVersion.overall_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* Upload new version */}
          <section className="rounded-3xl border border-white/10 bg-black/55 p-5 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">New version</div>
                <div className="text-sm text-white/60">Carica una nuova versione per avere il report Tekkin Analyzer e il piano d’azione.</div>
              </div>
            </div>

            <form onSubmit={handleUploadVersion} className="mt-4 grid gap-3 lg:grid-cols-[1fr_200px_1fr_auto] items-end">
              <div>
                <label className="block text-[11px] text-white/60 mb-1">Version name (es. v2, Master, Alt Mix)</label>
                <input
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  placeholder="v2"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">Version mix type</label>
                <select
                  value={versionMixType}
                  onChange={(e) => setVersionMixType(normalizeMixType(e.target.value) ?? "master")}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  {TEKKIN_MIX_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {MIX_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-white/60 mb-1">Carica nuova versione</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={onFileChange}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/80"
                />
                <div className="mt-1 text-[11px] text-white/45">Formati consigliati: MP3 320 kbps. Limite massimo: 50 MB per file.</div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="h-[46px] rounded-full bg-cyan-400/90 px-6 text-sm font-semibold text-black hover:bg-cyan-300 disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload version"}
              </button>
            </form>
          </section>

          {/* Selected version preview + actions */}
          {selectedVersion && (
            <section className="rounded-3xl border border-white/10 bg-black/55 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white truncate">{selectedVersion.version_name ?? "Versione"}</div>
                    <span className="rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[11px] text-white/75">
                      {selectedVersion.mix_type ? MIX_TYPE_LABELS[selectedVersion.mix_type] : "MIX"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-white/55">Creata: {new Date(selectedVersion.created_at).toLocaleString()}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAnalyzeVersion(selectedVersion.id)}
                    disabled={analyzingVersionId === selectedVersion.id}
                    className="rounded-full bg-cyan-400/90 px-4 py-2 text-[12px] font-semibold text-black hover:bg-cyan-300 disabled:opacity-60"
                  >
                    {analyzingVersionId === selectedVersion.id ? "Analyze..." : "Analyze"}
                  </button>

                  <span className="text-[11px] text-white/50">
                    {analyzerStatus !== "idle" ? `Status: ${analyzerStatus}` : ""}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                {previewAudioUrl ? (
                  <WaveformPreviewUnified
                    peaks={selectedVersion.waveform_peaks ?? null}
                    bands={selectedVersion.waveform_bands ?? null}
                    duration={durationForLabel}
                    progressRatio={progressRatio}
                    isPlaying={isActive && player.isPlaying}
                    timeLabel={timeLabel}
                    onTogglePlay={async () => {
                      if (!previewAudioUrl) return;

                      if (isActive) {
                        useTekkinPlayer.getState().toggle();
                        return;
                      }

                      player.play({
                        projectId: project.id,
                        versionId: selectedVersion.id,
                        title: project.title,
                        subtitle: selectedVersion.version_name ?? undefined,
                        audioUrl: previewAudioUrl,
                        duration: selectedVersion.waveform_duration ?? undefined,
                      });
                    }}
                    onSeekRatio={(r) => {
                      if (!previewAudioUrl) return;

                      if (isActive) {
                        player.seekToRatio(r);
                        return;
                      }

                      player.playAtRatio(
                        {
                          projectId: project.id,
                          versionId: selectedVersion.id,
                          title: project.title,
                          subtitle: selectedVersion.version_name ?? undefined,
                          audioUrl: previewAudioUrl,
                          duration: selectedVersion.waveform_duration ?? undefined,
                        },
                        r
                      );
                    }}
                  />
                ) : (
                  <div className="text-sm text-white/60">Audio non disponibile.</div>
                )}
              </div>

              {/* Versions history */}
              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] uppercase tracking-[0.2em] text-white/55">Versions history</div>
                </div>

                <div className="mt-3 grid gap-2">
                  {versions.map((v) => {
                    const isSel = v.id === selectedVersion.id;
                    const versionLabel = v.version_name ?? "Versione";
                    const isAnalyzed = Boolean(v.analyzer_json) || v.lufs != null;

                    return (
                      <div key={v.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            // cambiamo versione "selezionata" via URL (così resta shareable)
                            const url = new URL(window.location.href);
                            url.searchParams.set("version_id", v.id);
                            window.history.replaceState({}, "", url.toString());
                            // trigger preview url load
                            void ensurePreviewUrl(v);
                            // forza re-render con loadProject light: qui basta setProject con copia (ma keep simple)
                            setProject((prev) => (prev ? { ...prev } : prev));
                          }}
                          className={[
                            "w-full text-left rounded-2xl border px-4 py-3 transition",
                            isSel ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-black/30 hover:bg-white/5",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm text-white truncate">{versionLabel}</div>
                              <div className="mt-1 text-[11px] text-white/55">
                                {v.mix_type ? MIX_TYPE_LABELS[v.mix_type] : "MIX"} · {new Date(v.created_at).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 text-[11px] text-white/60">
                                {v.lufs != null ? <span>{v.lufs.toFixed(1)} LUFS</span> : null}
                                {v.overall_score != null ? <span>Tekkin {v.overall_score.toFixed(1)}</span> : null}
                              </div>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={`Elimina versione ${versionLabel}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setDeleteVersionError(null);
                                  setConfirmDeleteVersion(v);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setDeleteVersionError(null);
                                    setConfirmDeleteVersion(v);
                                  }
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-white/60 transition hover:border-red-400 hover:text-red-300 hover:bg-red-400/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </span>
                            </div>
                          </div>
                        </button>
                        {isAnalyzed && (
  <div className="flex justify-end">
    <Link
      href={`/artist/analyzer/${v.id}`}
      className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition hover:border-cyan-400/60 hover:bg-cyan-400/20"
    >
      Analyzer Report
    </Link>
  </div>
)}

                      </div>
                    );
                  })}
                  {!versions.length && <div className="text-sm text-white/60">Nessuna versione.</div>}
                </div>
              </div>
            </section>
          )}
        </>
      )}
      {confirmDeleteVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--sidebar-bg)] p-5 shadow-2xl">
            <p className="text-sm font-semibold text-white">
              Elimina {confirmDeleteVersion.version_name ?? "versione"}
            </p>
            <p className="mt-2 text-xs text-white/70">
              L'operazione rimuove definitivamente la versione e i file associati dal project.
            </p>

            {deleteVersionError && <p className="mt-2 text-xs text-red-300">{deleteVersionError}</p>}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteVersion(null)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/80 hover:border-white/20 hover:text-white"
                disabled={deletingVersionId === confirmDeleteVersion.id}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => handleDeleteVersion(confirmDeleteVersion)}
                className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                disabled={deletingVersionId === confirmDeleteVersion.id}
              >
                {deletingVersionId === confirmDeleteVersion.id ? "Eliminando..." : "Conferma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
