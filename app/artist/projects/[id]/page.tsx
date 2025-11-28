"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type VersionRow = {
  id: string;
  version_name: string;
  created_at: string;
  audio_url: string | null;
  lufs: number | null;
  sub_clarity: number | null;
  hi_end: number | null;
  dynamics: number | null;
  stereo_image: number | null;
  tonality: string | null;
  overall_score: number | null;
  feedback: string | null;
};

type ProjectDetail = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
  versions: VersionRow[];
};

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
            feedback
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

    const form = e.currentTarget;
    const formData = new FormData(form);

    formData.append("project_id", projectId);

    try {
      setUploading(true);
      setUploadError(null);

      const res = await fetch("/api/projects/add-version", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Errore upload nuova versione");
      }

      form.reset();

      // ricarico il project (versions + audio latest)
      await loadProject();
    } catch (err) {
      console.error("Upload new version error:", err);
      setUploadError("Errore durante upload nuova versione.");
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

  const latest = project?.versions[0] ?? null;

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
                {new Date(project.created_at).toLocaleDateString()}
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
              <input
                name="audio"
                type="file"
                accept="audio/*"
                required
                className="text-xs text-white/70"
              />
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
          {latest && (
            <div className="mb-8 rounded-2xl border border-white/8 bg-black/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide">
                    Latest version
                  </p>
                  <p className="text-sm font-semibold">
                    {latest.version_name} ·{" "}
                    {new Date(latest.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/50 uppercase tracking-wide">
                    Tekkin Score
                  </p>
                  <p className="text-2xl font-semibold">
                    {latest.overall_score != null
                      ? latest.overall_score
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-white/40">LUFS</p>
                  <p className="mt-1 text-sm font-semibold">
                    {latest.lufs != null ? latest.lufs.toFixed(1) : "n.a."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-white/40">Dynamics</p>
                  <p className="mt-1 text-sm font-semibold">
                    {latest.dynamics != null
                      ? latest.dynamics.toFixed(2)
                      : "n.a."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-white/40">Sub clarity</p>
                  <p className="mt-1 text-sm font-semibold">
                    {latest.sub_clarity != null
                      ? latest.sub_clarity.toFixed(2)
                      : "n.a."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="text-white/40">Hi end</p>
                  <p className="mt-1 text-sm font-semibold">
                    {latest.hi_end != null
                      ? latest.hi_end.toFixed(2)
                      : "n.a."}
                  </p>
                </div>
                <div className="rounded-xl border borderWHITE/10 bg-black/40 p-3">
                  <p className="textWHITE/40">Stereo image</p>
                  <p className="mt-1 text-sm font-semibold">
                    {latest.stereo_image != null
                      ? latest.stereo_image.toFixed(2)
                      : "n.a."}
                  </p>
                </div>
                <div className="rounded-xl border borderWHITE/10 bg-black/40 p-3">
                  <p className="textWHITE/40">Tonality</p>
                  <p className="mt-1 text-sm font-semibold">
                    {latest.tonality ?? "n.a."}
                  </p>
                </div>
              </div>

              {latest.feedback && (
                <div className="mt-5 rounded-xl border borderWHITE/10 bg-black/60 p-4 text-sm">
                  <p className="text-xs text-[var(--accent)] mb-1">
                    Tekkin Feedback
                  </p>
                  <p className="textWHITE/80 whitespace-pre-line">
                    {latest.feedback}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Lista versioni */}
          <div className="rounded-2xl border borderWHITE/8 bg-black/40 overflow-hidden">
            <div className="border-b borderWHITE/10 px-4 py-3 text-xs uppercase tracking-wide textWHITE/60">
              Versions history
            </div>
            <table className="w-full text-xs">
              <thead className="bg-white/5 textWHITE/60">
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
                    className="border-t borderWHITE/5 hover:bgWHITE/5"
                  >
                    <td className="px-4 py-2">{v.version_name}</td>
                    <td className="px-4 py-2">
                      {v.overall_score != null ? v.overall_score : "n.a."}
                    </td>
                    <td className="px-4 py-2">
                      {v.lufs != null ? v.lufs.toFixed(1) : "n.a."}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(v.created_at).toLocaleString()}
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
                        <span className="text-xs textWHITE/50">
                          Analyzed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {project.versions.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-4 text-center textWHITE/40"
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
