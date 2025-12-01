"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AnalyzerProPanel } from "@/app/artist/components/AnalyzerProPanel";
import type { AnalyzerMetricsFields } from "@/types/analyzer";

// MAX FILE SIZE (Supabase hard limit)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

type VersionRow = AnalyzerMetricsFields & {
  id: string;
  version_name: string;
  created_at: string;
  audio_url: string | null;
};

type ProjectDetail = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
  mix_type: string | null;
  genre: string | null;
  versions: VersionRow[];
};

// mapping semplice da valore DB -> label
function getProfileLabel(genre: string | null): string | null {
  if (!genre) return null;
  switch (genre) {
    case "minimal_deep_tech":
      return "Minimal / Deep Tech";
    case "tech_house":
      return "Tech House";
    case "house":
      return "House";
    case "altro":
      return "Altro";
    default:
      return genre;
  }
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [latestAudioUrl, setLatestAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [analyzingVersionId, setAnalyzingVersionId] = useState<string | null>(
    null
  );

  // carica project + versions + signed URL audio latest
  const loadProject = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const supabase = createClient();

      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          status,
          created_at,
          mix_type,
          genre,
          project_versions (
            id,
            version_name,
            created_at,
            audio_url,
            lufs,
            sub_clarity,
            hi_end,
            dynamics,
            stereo_image,
            tonality,
            overall_score,
            feedback,
            analyzer_bpm,
            analyzer_spectral_centroid_hz,
            analyzer_spectral_rolloff_hz,
            analyzer_spectral_bandwidth_hz,
            analyzer_spectral_flatness,
            analyzer_zero_crossing_rate
          )
        `
        )
        .eq("id", projectId)
        .single();

      if (error || !data) {
        console.error("Supabase project detail error:", error);
        setErrorMsg("Project non trovato o errore nel caricamento.");
        setProject(null);
        setLatestAudioUrl(null);
        setLoading(false);
        return;
      }

      const projectData = data as any;
      const versionsRaw = (projectData.project_versions ?? []) as any[];

      const profileLabel = getProfileLabel(projectData.genre ?? null);

      const versions: VersionRow[] = versionsRaw
        .map((v: any) => ({
          id: v.id,
          version_name: v.version_name,
          created_at: v.created_at,
          audio_url: v.audio_url ?? null,
          lufs: v.lufs ?? null,
          sub_clarity: v.sub_clarity ?? null,
          hi_end: v.hi_end ?? null,
          dynamics: v.dynamics ?? null,
          stereo_image: v.stereo_image ?? null,
          tonality: v.tonality ?? null,
          overall_score: v.overall_score ?? null,
          feedback: v.feedback ?? null,
          analyzer_bpm: v.analyzer_bpm ?? null,
          analyzer_spectral_centroid_hz: v.analyzer_spectral_centroid_hz ?? null,
          analyzer_spectral_rolloff_hz: v.analyzer_spectral_rolloff_hz ?? null,
          analyzer_spectral_bandwidth_hz: v.analyzer_spectral_bandwidth_hz ?? null,
          analyzer_spectral_flatness: v.analyzer_spectral_flatness ?? null,
          analyzer_zero_crossing_rate: v.analyzer_zero_crossing_rate ?? null,

          analyzer_mode: projectData.mix_type ?? "master",
          analyzer_profile_key: profileLabel ?? "Minimal / Deep Tech",
          analyzer_key: v.analyzer_key ?? null,
          analyzer_key_confidence: v.analyzer_key_confidence ?? null,
        }))
        .sort(
          (a: VersionRow, b: VersionRow) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

      setProject({
        id: projectData.id,
        title: projectData.title,
        status: projectData.status,
        created_at: projectData.created_at,
        mix_type: projectData.mix_type ?? null,
        genre: projectData.genre ?? null,
        versions,
      });

      // signed URL per l'ultima versione (se ha audio_url)
      const latestVersion = versions[0];
      if (latestVersion && latestVersion.audio_url) {
        try {
          const { data: signed, error: signedError } = await supabase.storage
            .from("tracks")
            .createSignedUrl(latestVersion.audio_url, 60 * 60);

          if (signedError || !signed?.signedUrl) {
            console.error("Signed URL latest audio error:", signedError);
            setAudioError("Impossibile caricare l'audio della versione.");
            setLatestAudioUrl(null);
          } else {
            setLatestAudioUrl(signed.signedUrl);
            setAudioError(null);
          }
        } catch (err) {
          console.error("Unexpected signed URL error:", err);
          setAudioError("Impossibile caricare l'audio della versione.");
          setLatestAudioUrl(null);
        }
      } else {
        setLatestAudioUrl(null);
        setAudioError(null);
      }

      setLoading(false);
    } catch (err) {
      console.error("Unexpected project load error:", err);
      setErrorMsg("Errore inatteso nel caricamento del project.");
      setProject(null);
      setLatestAudioUrl(null);
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  // upload nuova versione
  const handleUploadNewVersion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!projectId) return;

    setUploadError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File | null;

    if (!file) {
      setUploadError("Seleziona un file audio.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(
        "File troppo grande. Limite massimo server: 50 MB per file. " +
          "Ti consigliamo di usare MP3 320 kbps per versioni più leggere."
      );
      return;
    }

    formData.append("project_id", projectId);

    try {
      setUploading(true);

      const res = await fetch("/api/projects/add-version", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setUploadError(
          data?.error ?? "Errore durante upload nuova versione."
        );
        return;
      }

      form.reset();
      await loadProject();
    } catch (err) {
      console.error("Upload new version error:", err);
      setUploadError("Errore imprevisto durante upload nuova versione.");
    } finally {
      setUploading(false);
    }
  };

  // analizza una singola versione (anche v2, v3, ecc)
  const handleAnalyzeVersion = async (versionId: string) => {
    if (!projectId) return;

    try {
      setAnalyzingVersionId(versionId);
      setErrorMsg(null);

      const res = await fetch("/api/projects/run-analyzer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version_id: versionId }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Analyze error response:", text);
        throw new Error(text || "Errore avviando l'analisi");
      }

      // ricarico il project per aggiornare metrics e score
      await loadProject();
    } catch (err) {
      console.error("Analyze version error:", err);
      setErrorMsg("Errore durante l'analisi della versione.");
    } finally {
      setAnalyzingVersionId(null);
    }
  };

  const latestVersion = project?.versions[0] ?? null;

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <button
        onClick={() => router.push("/artist/projects")}
        className="mb-4 text-sm text-white/60 hover:text-white"
      >
        ← Back to Projects
      </button>

      {loading && (
        <p className="text-sm text-white/50">Caricamento project...</p>
      )}

      {errorMsg && !loading && (
        <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
      )}

      {!loading && project && (
        <>
          {/* Header project */}
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{project.title}</h1>
              <p className="text-xs text-white/50 mt-1">
                Creato il{" "}
                {new Date(project.created_at).toLocaleDateString("it-IT")}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">
                Mix type: {project.mix_type ?? "master"} · Genere:{" "}
                {getProfileLabel(project.genre) ?? "n.d."}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/80">
              {project.status ?? "UNKNOWN"}
            </span>
          </div>

          {/* New version upload */}
          <div className="mb-6 rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs text-white/60 mb-3 uppercase tracking-wide">
              New version
            </p>
            <form
              onSubmit={handleUploadNewVersion}
              className="flex flex-col gap-3 md:flex-row md:items-center"
            >
              <input
                name="version_name"
                placeholder="Version name (es. v2, Master, Alt mix)"
                className="flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm"
              />

              {/* file input + helper text */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">
                  Carica nuova versione
                </label>
                <input
                  type="file"
                  name="file"
                  accept=".mp3,.wav,.aiff,.flac"
                  required
                  className="block w-full text-sm text-white/70"
                />
                <p className="text-xs text-white/60">
                  Formati consigliati: MP3 320 kbps. Limite massimo server: 50 MB
                  per file.
                </p>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="rounded-full px-4 py-2 text-xs font-medium bg-[var(--accent)] text-black disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload version"}
              </button>
            </form>
            {uploadError && (
              <p className="mt-2 text-xs text-red-400">{uploadError}</p>
            )}
          </div>

          {/* Scheda tecnica ultima versione */}
          {latestVersion && (
            <div className="mb-8 rounded-2xl border border-white/8 bg-black/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide">
                    Latest version
                  </p>
                  <p className="text-sm font-semibold">
                    {latestVersion.version_name} ·{" "}
                    {new Date(latestVersion.created_at).toLocaleString("it-IT")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50 uppercase tracking-wide">
                    Tekkin Score
                  </p>
                  <p className="text-2xl font-semibold">
                    {latestVersion.overall_score != null
                      ? latestVersion.overall_score.toFixed(1)
                      : "n.a."}
                  </p>
                </div>
              </div>

              {latestAudioUrl && (
                <div className="mb-4">
                  <p className="text-xs text-white/50 mb-1">
                    Preview audio
                  </p>
                  <audio
                    controls
                    src={latestAudioUrl}
                    className="w-full"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {audioError && (
                <p className="mb-2 text-xs text-red-400">{audioError}</p>
              )}

              <AnalyzerProPanel version={latestVersion} />
            </div>
          )}

          {/* Lista versioni */}
          <div className="rounded-2xl border border-white/8 bg-black/40 overflow-hidden">
            <div className="border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-white/60">
              Versions history
            </div>
            <table className="w-full text-xs">
              <thead className="bg-white/5 text-white/60">
                <tr>
                  <th className="px-4 py-2 text-left">Version</th>
                  <th className="px-4 py-2 text-left">Score</th>
                  <th className="px-4 py-2 text-left">LUFS</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {project.versions.map((v) => (
                  <tr
                    key={v.id}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="px-4 py-2">{v.version_name}</td>
                    <td className="px-4 py-2">
                      {v.overall_score != null
                        ? v.overall_score.toFixed(1)
                        : "n.a."}
                    </td>
                    <td className="px-4 py-2">
                      {v.lufs != null ? v.lufs.toFixed(1) : "n.a."}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(v.created_at).toLocaleString("it-IT")}
                    </td>
                    <td className="px-4 py-2">
                      {v.overall_score == null ? (
                        <button
                          onClick={() => void handleAnalyzeVersion(v.id)}
                          disabled={analyzingVersionId === v.id}
                          className="rounded-full px-3 py-1 text-xs bg-[var(--accent)] text-black disabled:opacity-60"
                        >
                          {analyzingVersionId === v.id
                            ? "Analyzing..."
                            : "Analyze"}
                        </button>
                      ) : (
                        <span className="text-xs text-white/50">
                          Analyzed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {project.versions.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-4 text-center text-white/40"
                      colSpan={5}
                    >
                      Nessuna versione trovata per questo project.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
