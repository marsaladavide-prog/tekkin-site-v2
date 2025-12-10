"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { TEKKIN_MIX_TYPES, TekkinMixType } from "@/lib/constants/genres";

type ProjectVersionRow = {
  id: string;
  version_name: string | null;
  created_at: string;
  overall_score: number | null;
  lufs: number | null;
  mix_type: TekkinMixType | null;
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

type SignalArtist = {
  id: string;
  artist_name: string;
  main_genres: string[] | null;
  open_to_collab: boolean | null;
  open_to_promo: boolean | null;
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
              mix_type
            )${includeProjectInfo ? `,
            cover_url,
            description` : ""}
          `;

const shouldExcludeProjectInfo = (error: {
  message?: string | null;
  details?: string | null;
} | null) => {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("cover_url") || message.includes("description");
};

const MIX_TYPE_LABELS: Record<TekkinMixType, string> = {
  master: "MASTER",
  premaster: "PREMASTER",
};

const getMixTypeBadgeLabel = (mixType?: TekkinMixType | null) => {
  if (!mixType) return null;
  return MIX_TYPE_LABELS[mixType] ?? mixType.toUpperCase();
};

const normalizeMixType = (value?: string | null): TekkinMixType | null => {
  if (value && TEKKIN_MIX_TYPES.includes(value as TekkinMixType)) {
    return value as TekkinMixType;
  }
  return null;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [projectTitleSaving, setProjectTitleSaving] = useState(false);
  const [projectTitleError, setProjectTitleError] = useState<string | null>(null);
  const [editingVersionProjectId, setEditingVersionProjectId] =
    useState<string | null>(null);
  const [versionNameDraft, setVersionNameDraft] = useState("");
  const [versionNameSaving, setVersionNameSaving] = useState(false);
  const [versionNameError, setVersionNameError] = useState<string | null>(null);
  const [confirmProject, setConfirmProject] = useState<ProjectRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [signalArtists, setSignalArtists] = useState<SignalArtist[]>([]);
  const [signalLoadingArtists, setSignalLoadingArtists] = useState(true);
  const [signalArtistError, setSignalArtistError] = useState<string | null>(null);
  const [signalProjectId, setSignalProjectId] = useState<string>("");
  const [signalArtistId, setSignalArtistId] = useState<string>("");
  const [signalKind, setSignalKind] = useState<"collab" | "promo">("collab");
  const [signalMessage, setSignalMessage] = useState("");
  const [signalSending, setSignalSending] = useState(false);
  const [signalFeedback, setSignalFeedback] = useState<string | null>(null);
  const [signalPanelProjectId, setSignalPanelProjectId] = useState<string | null>(null);
  const allowProjectInfoSelectRef = useRef(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const supabase = createClient();

        const fetchProjects = async (includeProjectInfo: boolean) =>
          supabase
            .from("projects")
            .select(buildProjectsSelectQuery(includeProjectInfo))
            .order("created_at", { ascending: false });

        let includeProjectInfo = allowProjectInfoSelectRef.current;
        let selectResult = await fetchProjects(includeProjectInfo);

        if (
          selectResult.error &&
          includeProjectInfo &&
          shouldExcludeProjectInfo(selectResult.error)
        ) {
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

        const mapped: ProjectRow[] =
          data?.map((p: any) => {
            const rawVersions = (p.project_versions ?? []) as any[];
            const sortedVersions: ProjectVersionRow[] = [...rawVersions]
              .sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              )
              .map((version) => ({
                id: version.id,
                version_name: version.version_name ?? null,
                created_at: version.created_at,
                overall_score:
                  typeof version.overall_score === "number"
                    ? version.overall_score
                    : null,
                lufs:
                  typeof version.lufs === "number" ? version.lufs : null,
                mix_type: normalizeMixType(version.mix_type ?? null),
              }));

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
            };
          }) ?? [];

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
    const loadArtists = async () => {
      try {
        setSignalLoadingArtists(true);
        setSignalArtistError(null);
        const res = await fetch("/api/circuit/artists?promo=true&collab=true");
        if (!res.ok) {
          throw new Error("Errore caricando artisti Tekkin.");
        }
        const data = (await res.json()) as SignalArtist[] | null;
        setSignalArtists(data ?? []);
      } catch (err) {
        console.error("Load signal artists error:", err);
        setSignalArtistError("Impossibile caricare gli artisti Tekkin.");
        setSignalArtists([]);
      } finally {
        setSignalLoadingArtists(false);
      }
    };
    void loadArtists();
  }, []);

  useEffect(() => {
    if (!signalProjectId && projects.length > 0) {
      setSignalProjectId(projects[0].id);
    }
  }, [projects, signalProjectId]);

  useEffect(() => {
    if (!projects.length) {
      setSignalProjectId("");
    }
  }, [projects.length]);

  useEffect(() => {
    if (!signalArtistId && signalArtists.length > 0) {
      setSignalArtistId(signalArtists[0].id);
    }
  }, [signalArtists, signalArtistId]);

  useEffect(() => {
    if (!signalArtists.length) {
      setSignalArtistId("");
    }
  }, [signalArtists.length]);

  const hasProjects = projects.length > 0;

  async function handleDeleteProject(project: ProjectRow) {
    setDeleteError(null);
    setDeletingId(project.id);
    try {
      const res = await fetch("/api/projects/delete-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      const message =
        err instanceof Error ? err.message : "Eliminazione non riuscita, riprova tra poco.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  }

  const handleSendSignal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentProjectId = signalProjectId || signalPanelProjectId;
    if (!currentProjectId || !signalArtistId) {
      setSignalFeedback("Seleziona progetto e artista prima di inviare.");
      return;
    }

    setSignalSending(true);
    setSignalFeedback(null);

    try {
      const res = await fetch("/api/discovery/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: currentProjectId,
          receiver_id: signalArtistId,
          kind: signalKind,
          message: signalMessage.trim() || null,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Errore inviando il Signal.");
      }

      setSignalFeedback("Signal inviato con successo.");
      setSignalMessage("");
    } catch (err) {
      console.error("Send signal error:", err);
      const message =
        err instanceof Error ? err.message : "Errore durante l'invio.";
      setSignalFeedback(message);
    } finally {
      setSignalSending(false);
    }
  };

  const startEditProject = (project: ProjectRow) => {
    setProjectTitleError(null);
    setProjectTitleDraft(project.title);
    setEditingProjectId(project.id);
    setVersionNameError(null);
  };

  const cancelEditProject = () => {
    setProjectTitleError(null);
    setEditingProjectId(null);
  };

  const handleProjectTitleSubmit = async (
    event: FormEvent<HTMLFormElement>,
    project: ProjectRow
  ) => {
    event.preventDefault();
    const nextTitle = projectTitleDraft.trim();
    if (!nextTitle) {
      setProjectTitleError("Inserisci un nome valido.");
      return;
    }

    setProjectTitleSaving(true);
    setProjectTitleError(null);

    try {
      const res = await fetch("/api/projects/update-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_id: project.id,
          title: nextTitle,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Errore aggiornamento project.");
      }

      const data = (await res.json()) as {
        project?: { title?: string };
      };

      const updatedTitle = data.project?.title ?? nextTitle;
      setProjects((prev) =>
        prev.map((row) =>
          row.id === project.id ? { ...row, title: updatedTitle } : row
        )
      );
      setEditingProjectId(null);
    } catch (err) {
      console.error("Update project title error:", err);
      const message =
        err instanceof Error ? err.message : "Errore durante l'aggiornamento.";
      setProjectTitleError(message);
    } finally {
      setProjectTitleSaving(false);
    }
  };

  const startEditVersion = (project: ProjectRow) => {
    if (!project.latestVersionId) return;
    setVersionNameError(null);
    setVersionNameDraft(project.version_name ?? "");
    setEditingVersionProjectId(project.id);
    setProjectTitleError(null);
  };

  const cancelEditVersion = () => {
    setVersionNameError(null);
    setEditingVersionProjectId(null);
  };

  const handleVersionNameSubmit = async (
    event: FormEvent<HTMLFormElement>,
    project: ProjectRow
  ) => {
    event.preventDefault();
    if (!project.latestVersionId) return;
    const nextName = versionNameDraft.trim();
    if (!nextName) {
      setVersionNameError("Inserisci un nome valido.");
      return;
    }

    setVersionNameSaving(true);
    setVersionNameError(null);

    try {
      const res = await fetch("/api/projects/update-version", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version_id: project.latestVersionId,
          version_name: nextName,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Errore aggiornamento versione.");
      }

      setProjects((prev) =>
        prev.map((row) =>
          row.id === project.id ? { ...row, version_name: nextName } : row
        )
      );
      setEditingVersionProjectId(null);
    } catch (err) {
      console.error("Update version name error:", err);
      const message =
        err instanceof Error ? err.message : "Errore aggiornando la versione.";
      setVersionNameError(message);
    } finally {
      setVersionNameSaving(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-xs text-white/50 mt-1">
            Qui gestisci le tracce che vuoi analizzare con Tekkin Analyzer.
          </p>
        </div>
        <Link
          href="/artist/projects/new"
          className="rounded-full px-4 py-2 text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90"
        >
          New project
        </Link>
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

      {!loading && !hasProjects && !errorMsg && (
        <div className="rounded-2xl border border-white/10 bg-black/50 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Nessun project ancora creato
            </h2>
            <p className="text-xs text-white/70 mt-1">
              Crea il tuo primo project, carica una versione della traccia
              e lancia Tekkin Analyzer per vedere subito il report.
            </p>
            <ul className="mt-3 text-xs text-white/65 space-y-1.5">
              <li>1. Clicca su "New project"</li>
              <li>2. Dai un nome alla traccia</li>
              <li>3. Carica la prima versione audio e fai Analyze</li>
            </ul>
          </div>
          <Link
            href="/artist/projects/new"
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90"
          >
            Crea il tuo primo project
          </Link>
        </div>
      )}

      {!loading && hasProjects && (
        <div className="space-y-4">
          {projects.map((p, index) => {
            const versions = p.versions;
            const latestVersion = versions[0] ?? null;
            const lastActivityDate =
              latestVersion?.created_at ?? p.created_at;
            const lastActivityLabel = lastActivityDate
              ? new Date(lastActivityDate).toLocaleDateString("it-IT")
              : "n.d.";
            const summaryChunks: string[] = [];
            if (latestVersion?.version_name) {
              summaryChunks.push(latestVersion.version_name);
            }
            if (latestVersion?.lufs != null) {
              summaryChunks.push(`${latestVersion.lufs.toFixed(1)} LUFS`);
            }
            if (latestVersion?.overall_score != null) {
              summaryChunks.push(
                `Tekkin ${latestVersion.overall_score.toFixed(1)}`
              );
            }
            const summaryLine =
              summaryChunks.length > 0
                ? summaryChunks.join(" - ")
                : "Versione piu recente non disponibile";
            const versionCountLabel = `${versions.length} versione${versions.length === 1 ? "" : "i"}`;
            const latestCreatedLabel = latestVersion?.created_at
              ? new Date(latestVersion.created_at).toLocaleDateString("it-IT")
              : "n.d.";

            return (
              <article
                key={p.id}
                className="rounded-2xl border border-white/5 bg-black/40 p-5 shadow-inner"
              >
                <div className="space-y-5">
                  <div className="relative h-36 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-black to-black/80">
                    {p.cover_url ? (
                      <img
                        src={p.cover_url}
                        alt={`Cover ${p.title}`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.3em] text-white/40">
                        <span>Cover mancante</span>
                        <span>Aggiungi un artwork</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/90"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3">
                      <div className="min-w-0 space-y-2">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                          Project #{index + 1}
                        </p>
                        {editingProjectId === p.id ? (
                          <form
                            onSubmit={(event) => handleProjectTitleSubmit(event, p)}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <input
                              value={projectTitleDraft}
                              onChange={(event) =>
                                setProjectTitleDraft(event.target.value)
                              }
                              className="min-w-[220px] flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm text-white"
                              placeholder="Nuovo nome"
                            />
                            <button
                              type="submit"
                              disabled={projectTitleSaving}
                              className="rounded-full px-3 py-1 text-xs font-semibold text-black bg-[var(--accent)] disabled:opacity-60"
                            >
                              {projectTitleSaving ? "Salvando..." : "Salva"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditProject}
                              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            >
                              Annulla
                            </button>
                          </form>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            <Link
                              href={`/artist/projects/${p.id}`}
                              className="text-lg font-semibold text-white hover:underline"
                            >
                              {p.title}
                            </Link>
                            <button
                              type="button"
                              onClick={() => startEditProject(p)}
                              className="text-[11px] text-white/60 hover:text-[var(--accent)]"
                            >
                              Rinomina
                            </button>
                          </div>
                        )}
                        {editingProjectId === p.id && projectTitleError && (
                          <p className="text-[11px] text-red-400">
                            {projectTitleError}
                          </p>
                        )}
                        {p.description && (
                          <p className="text-[12px] text-white/60">
                            {p.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 text-[11px] text-white/60">
                          <span>Ultima attivita: {lastActivityLabel}</span>
                          <span>{versionCountLabel}</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/80">
                        {p.status ?? "UNKNOWN"}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                            Versione piu recente
                          </p>
                          {editingVersionProjectId === p.id ? (
                            <form
                              onSubmit={(event) =>
                                handleVersionNameSubmit(event, p)
                              }
                              className="flex flex-wrap items-center gap-2"
                            >
                              <input
                                value={versionNameDraft}
                                onChange={(event) =>
                                  setVersionNameDraft(event.target.value)
                                }
                                className="min-w-[180px] flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm text-white"
                                placeholder="Nuovo nome versione"
                              />
                              <button
                                type="submit"
                                disabled={versionNameSaving}
                                className="rounded-full px-3 py-1 text-xs font-semibold text-black bg-[var(--accent)] disabled:opacity-60"
                              >
                                {versionNameSaving ? "Salvando..." : "Salva"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditVersion}
                                className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                              >
                                Annulla
                              </button>
                            </form>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-lg font-semibold text-white">
                                {latestVersion?.version_name ?? "n.a."}
                              </span>
                              {latestVersion?.mix_type && (
                                <span className="rounded-full border border-white/15 px-3 py-0.5 text-[10px] uppercase tracking-[0.3em] text-white/70">
                                  {getMixTypeBadgeLabel(latestVersion.mix_type)}
                                </span>
                              )}
                              {p.latestVersionId && (
                                <button
                                  type="button"
                                  onClick={() => startEditVersion(p)}
                                  className="text-[11px] uppercase tracking-[0.3em] text-white/60 hover:text-[var(--accent)]"
                                >
                                  Rinomina versione
                                </button>
                              )}
                            </div>
                          )}
                          {editingVersionProjectId === p.id && versionNameError && (
                            <p className="text-[11px] text-red-400">
                              {versionNameError}
                            </p>
                          )}
                        </div>
                        <div className="text-[11px] text-white/60">
                          {latestVersion
                            ? `Data: ${latestCreatedLabel}`
                            : "Nessuna versione"}
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-white/70">{summaryLine}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
                      <Link
                        href={`/artist/projects/${p.id}`}
                        className="rounded-full border border-white/20 px-4 py-1 text-[11px] text-white/80 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        Apri project
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
                      <button
                        type="button"
                        onClick={() => {
                          setSignalProjectId(p.id);
                          setSignalPanelProjectId((prev) =>
                            prev === p.id ? null : p.id
                          );
                        }}
                        className={`rounded-full px-4 py-1 text-[11px] font-semibold ${
                          signalPanelProjectId === p.id
                            ? "bg-white text-black"
                            : "border border-white/20 text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        }`}
                      >
                        {signalPanelProjectId === p.id
                          ? "Chiudi Signal Tekkin"
                          : "Signal Tekkin"}
                      </button>
                    </div>

                    <details className="group mt-4 rounded-2xl border border-white/10 bg-black/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-white transition hover:text-[var(--accent)]">
                        <span>Versioni ({versions.length})</span>
                        <span className="text-[11px] text-white/60">
                          {versions.length
                            ? "Piu recenti in cima"
                            : "Ancora nessuna versione"}
                        </span>
                      </summary>
                      <div className="space-y-3 px-4 pb-4 pt-2">
                        {versions.length === 0 ? (
                          <p className="text-[11px] text-white/60">
                            Carica una versione per vedere i dati Tekkin.
                          </p>
                        ) : (
                          versions.map((version) => {
                            const versionDate = version.created_at
                              ? new Date(
                                  version.created_at
                                ).toLocaleDateString("it-IT")
                              : "n.d.";
                            const lufsLabel =
                              version.lufs != null
                                ? `${version.lufs.toFixed(1)} LUFS`
                                : "LUFS n.d.";
                            const scoreLabel =
                              version.overall_score != null
                                ? `Tekkin ${version.overall_score.toFixed(1)}`
                                : "Tekkin n.d.";
                            const badge = getMixTypeBadgeLabel(version.mix_type);
                            return (
                              <div
                                key={version.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-[11px] text-white/70"
                              >
                                <div className="min-w-0 space-y-1">
                                  <p className="text-sm font-semibold text-white">
                                    {version.version_name ?? "Versione senza nome"}
                                  </p>
                                  <p className="text-[10px] text-white/50">
                                    {versionDate}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{lufsLabel}</span>
                                  <span>{scoreLabel}</span>
                                  {badge && (
                                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] text-white/70">
                                      {badge}
                                    </span>
                                  )}
                                  <Link
                                    href={`/artist/projects/${p.id}?version_id=${version.id}`}
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/80 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                  >
                                    Apri
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSignalProjectId(p.id);
                                      setSignalPanelProjectId((prev) =>
                                        prev === p.id ? null : p.id
                                      );
                                    }}
                                    className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                  >
                                    Signal Tekkin
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </details>

                    {signalPanelProjectId === p.id && (
                      <form
                        onSubmit={handleSendSignal}
                        className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/10 via-blue-900/20 to-slate-900/70 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                              Signal Tekkin super funzione
                            </p>
                            <p className="text-sm font-semibold text-white">
                              Promo & collab diretti agli artisti Discovery
                            </p>
                            <p className="text-[11px] text-white/50">
                              Project: {p.title}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSignalPanelProjectId(null)}
                            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/60 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            Chiudi
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1 text-[11px] font-semibold text-white/60">
                            Artista Tekkin
                            <select
                              value={signalArtistId}
                              onChange={(event) => setSignalArtistId(event.target.value)}
                              disabled={signalLoadingArtists || signalArtists.length === 0}
                              className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm text-white"
                            >
                              {signalLoadingArtists && (
                                <option value="">Caricamento artisti...</option>
                              )}
                              {!signalLoadingArtists &&
                                signalArtists.length === 0 && (
                                  <option value="">
                                    Nessun artista Tekkin disponibile al momento
                                  </option>
                                )}
                              {signalArtists.map((artist) => (
                                <option key={artist.id} value={artist.id}>
                                  {artist.artist_name}
                                  {artist.main_genres?.[0]
                                    ? ` - ${artist.main_genres[0]}`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex flex-col gap-1 text-[11px] font-semibold text-white/60">
                            <span>Tipo di richiesta</span>
                            <div className="flex gap-2">
                              {(["collab", "promo"] as const).map((kind) => (
                                <button
                                  key={kind}
                                  type="button"
                                  onClick={() => setSignalKind(kind)}
                                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                    signalKind === kind
                                      ? "bg-white text-black"
                                      : "border border-white/20 text-white/60"
                                  }`}
                                >
                                  {kind === "collab" ? "Collab" : "Promo"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <label className="flex flex-col gap-2 text-[11px] font-semibold text-white/60">
                          Messaggio (opzionale)
                          <textarea
                            value={signalMessage}
                            onChange={(event) => setSignalMessage(event.target.value)}
                            className="h-24 rounded-2xl bg-black/60 border border-white/10 p-3 text-sm text-white placeholder:text-white/40"
                            placeholder="Descrivi in poche righe la release o l'opportunita"
                          />
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="submit"
                            disabled={
                              signalSending ||
                              !signalArtistId ||
                              signalLoadingArtists ||
                              signalArtists.length === 0
                            }
                            className="rounded-full px-5 py-2 text-sm font-semibold bg-[var(--accent)] text-black disabled:opacity-60"
                          >
                            {signalSending ? "Invio Signal..." : "Invia Signal"}
                          </button>
                          {signalFeedback && (
                            <p className="text-[11px] text-emerald-300">{signalFeedback}</p>
                          )}
                        </div>
                        {signalArtistError && (
                          <p className="text-[11px] text-red-400">{signalArtistError}</p>
                        )}
                      </form>
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
            <p className="text-sm font-semibold text-white">
              Elimina “{confirmProject.title}”?
            </p>
            <p className="mt-2 text-xs text-white/70">
              Verranno rimossi anche i file collegati. L’azione è definitiva.
            </p>
            {deleteError && (
              <p className="mt-2 text-xs text-red-300">{deleteError}</p>
            )}
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
