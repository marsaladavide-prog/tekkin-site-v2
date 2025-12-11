"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AnalyzerProPanel } from "@/app/artist/components/AnalyzerProPanel";
import type {
  AnalyzerMetricsFields,
  AnalyzerResult,
  AnalyzerRunResponse,
  FixSuggestion,
  ReferenceAi,
  AnalyzerV1Result,
  AnalyzerAiCoach,
  AnalyzerAiAction,
  AnalyzerAiMeta,
} from "@/types/analyzer";
import {
  getTekkinGenreLabel,
  TEKKIN_MIX_TYPES,
  TekkinGenreId,
  TekkinMixType,
} from "@/lib/constants/genres";

// MAX FILE SIZE (Supabase hard limit)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function normalizeMixType(
  value?: string | null,
  fallback: TekkinMixType = "premaster"
): TekkinMixType {
  if (value && TEKKIN_MIX_TYPES.includes(value as TekkinMixType)) {
    return value as TekkinMixType;
  }
  return fallback;
}

function getMixTypeLabel(
  value?: string | null | TekkinMixType,
  fallback: TekkinMixType = "premaster"
): string {
  const normalized = normalizeMixType(value, fallback);
  return normalized === "master" ? "Master" : "Premaster";
}

type UploadCoverResponse = {
  ok: boolean;
  coverUrl?: string | null;
  storagePath?: string | null;
  error?: string | null;
};

type UpdateInfoResponse = {
  ok: boolean;
  error?: string | null;
  project?: any;
  supabaseError?: {
    message: string;
    code: string | null;
    details: unknown;
  } | null;
};

const buildProjectSelectQuery = (
  includeAnalyzerKey: boolean,
  includeProjectInfo: boolean
) => `
  id,
  title,
  status,
  created_at,
  mix_type,
  genre,
  ${includeProjectInfo ? "cover_url,\n  cover_link,\n  description," : ""}
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
    analyzer_zero_crossing_rate,
    analyzer_reference_ai,
    analyzer_mix_v1,
    mix_type,
    analyzer_ai_summary,
    analyzer_ai_actions,
    analyzer_ai_meta,
    analyzer_json${includeAnalyzerKey ? ",\n    analyzer_key" : ""}
  )
`;

const shouldExcludeAnalyzerKey = (error: {
  message?: string | null;
  details?: string | null;
 } | null) => {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("analyzer_key");
};

const shouldExcludeProjectInfo = (error: {
  message?: string | null;
  details?: string | null;
} | null) => {
  if (!error) return false;
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("cover_url") || message.includes("description");
};

type VersionRow = AnalyzerMetricsFields & {
  id: string;
  version_name: string;
  created_at: string;
  audio_url: string | null;
  mix_type: TekkinMixType;
  mix_v1?: AnalyzerV1Result | null;
  analyzer_ai_summary?: string | null;
  analyzer_ai_actions?: AnalyzerAiAction[] | null;
  analyzer_ai_meta?: AnalyzerAiMeta | null;
  analyzer_key?: string | null;
  analyzer_json?: AnalyzerResult | null;
  reference_ai?: ReferenceAi | null;
  analyzer_reference_ai?: ReferenceAi | null;
};

type AudioPreviewState = {
  url: string | null;
  error: string | null;
  loading: boolean;
};
type ProjectVersionRecord = AnalyzerMetricsFields & {
  id: string;
  version_name: string;
  created_at: string;
  audio_url: string | null;
  reference_ai?: ReferenceAi | null;
  analyzer_reference_ai?: ReferenceAi | null;
  analyzer_mix_v1?: AnalyzerV1Result | null;
  analyzer_json?: AnalyzerResult | null;
  mix_type?: string | null;
  analyzer_key?: string | null;

  // nuovi campi che stai leggendo
  analyzer_ai_summary?: string | null;
  analyzer_ai_actions?: AnalyzerAiAction[] | null;
  analyzer_ai_meta?: AnalyzerAiMeta | null;
};


type SupabaseProjectRecord = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
  mix_type: TekkinMixType | null;
  genre: TekkinGenreId | null;
  cover_url?: string | null;
  cover_link?: string | null;
  description?: string | null;
  project_versions: ProjectVersionRecord[];
};

type ProjectDetail = {
  id: string;
  title: string;
  status: string | null;
  created_at: string;
  mix_type: TekkinMixType | null;
  genre: TekkinGenreId | null;
  cover_url?: string | null;
  cover_link?: string | null;
  description?: string | null;
  versions: VersionRow[];
};

// mapping semplice da valore DB -> label
function normalizeAiMeta(meta?: AnalyzerAiMeta | null): AnalyzerAiMeta {
  const rawRiskFlags = meta?.risk_flags;
  return {
    artistic_assessment: meta?.artistic_assessment ?? "",
    risk_flags: Array.isArray(rawRiskFlags) ? rawRiskFlags : [],
    predicted_rank_gain: meta?.predicted_rank_gain ?? null,
    label_fit: meta?.label_fit ?? null,
    structure_feedback: meta?.structure_feedback ?? null,
  };
}

type AnalyzerStatus = "idle" | "starting" | "analyzing" | "saving" | "done" | "error";

export default function ProjectDetailPage() {
const params = useParams<{ id: string }>();
  const projectId = params?.id as string;
  const [analyzerStatus, setAnalyzerStatus] = useState<AnalyzerStatus>("idle");

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [titleFeedback, setTitleFeedback] = useState<string | null>(null);

  const [versionNameDrafts, setVersionNameDrafts] = useState<
    Record<string, string>
  >({});
  const [versionNameFeedback, setVersionNameFeedback] = useState<
    Record<string, { error: string | null; success: string | null }>
  >({});

  const [versionToDelete, setVersionToDelete] = useState<VersionRow | null>(
    null
  );
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(
    null
  );
  const [versionDeleteError, setVersionDeleteError] = useState<string | null>(
    null
  );

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [analyzingVersionId, setAnalyzingVersionId] = useState<string | null>(
    null
  );
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [coverDraft, setCoverDraft] = useState("");
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoFeedback, setInfoFeedback] = useState<string | null>(null);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [coverUploadMessage, setCoverUploadMessage] = useState<string | null>(
    null
  );
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [tempCoverPreview, setTempCoverPreview] = useState<string | null>(null);
  const tempCoverUrlRef = useRef<string | null>(null);

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState(false);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [audioStates, setAudioStates] = useState<Record<string, AudioPreviewState>>({});
  const [fixSuggestionsByVersion, setFixSuggestionsByVersion] = useState<
    Record<string, FixSuggestion[] | null>
  >({});
  const [mixV1ByVersion, setMixV1ByVersion] = useState<
    Record<string, AnalyzerV1Result | null>
  >({});
  const [versionMixType, setVersionMixType] = useState<TekkinMixType>(
    TEKKIN_MIX_TYPES[0]
  );
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [aiByVersion, setAiByVersion] = useState<
    Record<string, AnalyzerAiCoach>
  >({});
    const [aiLoadingVersionId, setAiLoadingVersionId] = useState<string | null>(
      null
    );
    const [aiErrorByVersion, setAiErrorByVersion] = useState<
      Record<string, string | null>
    >({});
  const allowAnalyzerKeySelectRef = useRef(true);
  const allowProjectInfoSelectRef = useRef(true);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const versionsWithFixes = useMemo(() => {
    if (!project) return [];
    return project.versions.map((version) => ({
      ...version,
      fix_suggestions:
        fixSuggestionsByVersion[version.id] ?? version.fix_suggestions ?? null,
      // Qui agganci il risultato V1, se lo vuoi dentro la versione
      mix_v1: mixV1ByVersion[version.id] ?? (version as any).mix_v1 ?? null,
    }));
  }, [project, fixSuggestionsByVersion, mixV1ByVersion]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFileName(null);
      setSelectedFileSize(null);
      setFileTooLarge(false);
      return;
    }

    const isTooLarge = file.size > MAX_FILE_SIZE_BYTES;
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    setFileTooLarge(isTooLarge);
    if (isTooLarge) {
      setUploadError(
        "File troppo grande. Limite massimo server: 50 MB per file."
      );
    } else {
      setUploadError(null);
    }
  };

  const fetchAudioPreviewForVersion = useCallback(
    async (version: VersionRow) => {
      if (!version.audio_url) {
        setAudioStates((prev) => ({
          ...prev,
          [version.id]: { url: null, error: null, loading: false },
        }));
        return;
      }

      setAudioStates((prev) => ({
        ...prev,
        [version.id]: { url: null, error: null, loading: true },
      }));

      try {
        const supabase = createClient();
        const { data: signed, error: signedError } = await supabase.storage
          .from("tracks")
          .createSignedUrl(version.audio_url, 60 * 60);

        if (signedError || !signed?.signedUrl) {
          throw signedError ?? new Error("Signed URL non disponibile");
        }

        setAudioStates((prev) => ({
          ...prev,
          [version.id]: {
            url: signed.signedUrl,
            error: null,
            loading: false,
          },
        }));
      } catch (err) {
        console.error("Signed URL preview error:", err);
        setAudioStates((prev) => ({
          ...prev,
          [version.id]: {
            url: null,
            error: "Impossibile caricare l'audio della versione.",
            loading: false,
          },
        }));
      }
    },
    []
  );

  // carica project + versions + signed URL audio latest
  const loadProject = useCallback(async () => {
    if (!projectId) return;

      try {
        setLoading(true);
        setErrorMsg(null);
        setAiByVersion({});
        setAiErrorByVersion({});
        setVersionMixType(TEKKIN_MIX_TYPES[0]);

      const supabase = createClient();

      const fetchProject = async (
        includeAnalyzerKey: boolean,
        includeProjectInfo: boolean
      ) =>
        supabase
          .from("projects")
          .select(buildProjectSelectQuery(includeAnalyzerKey, includeProjectInfo))
          .eq("id", projectId)
          .single();

      let includeAnalyzerKey = allowAnalyzerKeySelectRef.current;
      let includeProjectInfo = allowProjectInfoSelectRef.current;
      let selectResult = await fetchProject(
        includeAnalyzerKey,
        includeProjectInfo
      );

      if (
        selectResult.error &&
        includeAnalyzerKey &&
        shouldExcludeAnalyzerKey(selectResult.error)
      ) {
        includeAnalyzerKey = false;
        allowAnalyzerKeySelectRef.current = false;
        selectResult = await fetchProject(
          includeAnalyzerKey,
          includeProjectInfo
        );
      }

      if (
        selectResult.error &&
        includeProjectInfo &&
        shouldExcludeProjectInfo(selectResult.error)
      ) {
        includeProjectInfo = false;
        allowProjectInfoSelectRef.current = false;
        selectResult = await fetchProject(
          includeAnalyzerKey,
          includeProjectInfo
        );
      }

      const { data, error } = selectResult;

      if (error || !data) {
        console.error("Supabase project detail error:", error);
        setErrorMsg("Project non trovato o errore nel caricamento.");
        setProject(null);
        setLoading(false);
        return;
      }

      const projectData = data as unknown as SupabaseProjectRecord;

      const versionsRaw = projectData.project_versions ?? [];

      const profileLabel =
        getTekkinGenreLabel(projectData.genre ?? null) ??
        "Minimal / Deep Tech";

      const versions: VersionRow[] = versionsRaw
        .map((v: ProjectVersionRecord) => {
          const versionMixType = normalizeMixType(
            v.mix_type ?? projectData.mix_type ?? null
          );

          return {
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
            analyzer_ai_summary: v.analyzer_ai_summary ?? null,
            analyzer_ai_actions: v.analyzer_ai_actions ?? null,
            analyzer_ai_meta: v.analyzer_ai_meta ?? null,
            analyzer_key: v.analyzer_key ?? null,
            reference_ai: v.analyzer_reference_ai ?? null,
            mix_v1: v.analyzer_mix_v1 ?? null,
            analyzer_json: v.analyzer_json ?? null,
            mix_type: versionMixType,

            analyzer_mode: versionMixType,
            analyzer_profile_key: profileLabel ?? "Minimal / Deep Tech",
          };
        })
        .sort(
          (a: VersionRow, b: VersionRow) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );

      const aiFromDb: Record<string, AnalyzerAiCoach> = {};
      versions.forEach((version) => {
        if (!version.analyzer_ai_summary) return;
        aiFromDb[version.id] = {
          summary: version.analyzer_ai_summary,
          actions: version.analyzer_ai_actions ?? [],
          meta: normalizeAiMeta(version.analyzer_ai_meta ?? null),
        };
      });

      setAiByVersion(aiFromDb);

      setProject({
        id: projectData.id,
        title: projectData.title,
        status: projectData.status,
        created_at: projectData.created_at,
        mix_type: projectData.mix_type ?? null,
        genre: projectData.genre ?? null,
        cover_url: projectData.cover_url ?? null,
        cover_link: projectData.cover_link ?? null,
        description: projectData.description ?? null,
        versions,
      });

      setLoading(false);
    } catch (err) {
      console.error("Unexpected project load error:", err);
      setErrorMsg("Errore inatteso nel caricamento del project.");
      setProject(null);
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (project) {
      setTitleDraft(project.title);
    } else {
      setTitleDraft("");
    }
  }, [project?.title]);

  useEffect(() => {
    if (!project) {
      setVersionNameDrafts({});
      return;
    }

    const drafts: Record<string, string> = {};
    project.versions.forEach((version) => {
      drafts[version.id] = version.version_name;
    });
    setVersionNameDrafts(drafts);
  }, [project?.versions]);

  useEffect(() => {
    if (!project) {
      setCoverDraft("");
      setDescriptionDraft("");
      return;
    }

    setCoverDraft(project.cover_link ?? project.cover_url ?? "");
    setDescriptionDraft(project.description ?? "");
    setCoverUrl(project.cover_url ?? null);
  }, [project?.cover_link, project?.cover_url, project?.description]);

  useEffect(() => {
    return () => {
      if (tempCoverUrlRef.current) {
        URL.revokeObjectURL(tempCoverUrlRef.current);
      }
    };
  }, []);

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
    formData.append("mix_type", versionMixType);

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
        setSelectedFileName(null);
        setSelectedFileSize(null);
        setFileTooLarge(false);
        setVersionMixType(TEKKIN_MIX_TYPES[0]);
        await loadProject();
      } catch (err) {
      console.error("Upload new version error:", err);
      setUploadError("Errore imprevisto durante upload nuova versione.");
    } finally {
      setUploading(false);
    }
  };

  const startEditingTitle = () => {
    setTitleFeedback(null);
    setTitleError(null);
    setEditingTitle(true);
    setTitleDraft(project?.title ?? "");
  };

  const cancelEditingTitle = () => {
    setTitleError(null);
    setTitleDraft(project?.title ?? "");
    setEditingTitle(false);
  };

  const handleSaveProjectTitle = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!project) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleError("Il nome project non può essere vuoto.");
      return;
    }

    setTitleSaving(true);
    setTitleError(null);
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
        throw new Error(data?.error ?? "Errore aggiornando il nome project.");
      }

      const data = (await res.json()) as {
        project?: { title?: string };
      };

      if (data.project?.title) {
        setProject((prev) =>
          prev
            ? {
                ...prev,
                title: data.project?.title ?? prev.title,
              }
            : prev
        );
        setTitleDraft(data.project.title);
        setTitleFeedback("Nome aggiornato correttamente.");
      }

      setEditingTitle(false);
    } catch (err) {
      console.error("Update project title error:", err);
      const message =
        err instanceof Error ? err.message : "Errore aggiornando il nome.";
      setTitleError(message);
    } finally {
      setTitleSaving(false);
    }
  };

  const handleSaveProjectInfo = async () => {
    const routeId = params?.id;
    const projectId =
      project?.id ??
      (typeof routeId === "string"
        ? routeId
        : Array.isArray(routeId)
        ? routeId[0]
        : undefined);

    if (!projectId) {
      console.error("[handleSaveProjectInfo] projectId assente", {
        projectId,
        project,
        params,
      });
      throw new Error("projectId mancante lato client");
    }

    const payload = {
      projectId,
      coverLink: coverDraft || null,
      description: descriptionDraft || null,
    };

    console.log("[handleSaveProjectInfo] payload", payload);

    setIsSavingInfo(true);
    setInfoError(null);
    setInfoFeedback(null);

    let data: UpdateInfoResponse | null = null;

    try {
      const res = await fetch("/api/projects/update-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      try {
        data = (await res.json()) as UpdateInfoResponse;
      } catch (err) {
        console.error("[handleSaveProjectInfo] errore parse JSON:", err);
      }

      console.log("[handleSaveProjectInfo] HTTP", res.status, data);

      if (!res.ok || !data?.ok) {
        const msg =
          data?.error ?? `Errore aggiornando le info (status ${res.status})`;
        setInfoError(msg);
        throw new Error(msg);
      }

      const projectPayload = data?.project;
      if (projectPayload) {
        setProject((prev) => {
          const next = projectPayload ?? {};
          if (prev) {
            return {
              ...prev,
              ...next,
              cover_url: next.cover_url ?? prev.cover_url,
              description: next.description ?? prev.description,
              versions: prev.versions,
            };
          }
          return {
            ...next,
            versions: [],
          };
        });
      }

      setCoverDraft(payload.coverLink ?? "");
      setDescriptionDraft(payload.description ?? "");
      setCoverUrl(payload.coverLink ?? null);
      setInfoFeedback("Copertina e descrizione aggiornate.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Errore aggiornando info.";
      console.error("[handleSaveProjectInfo] unexpected error:", err);
      setInfoError(message);
      throw err;
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handleCoverFileUpload = async (
    file: File,
    projectId: string
  ): Promise<UploadCoverResponse> => {
    setIsUploadingCover(true);
    setCoverUploadError(null);
    setCoverUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);

    let payload: UploadCoverResponse | null = null;

    try {
      const res = await fetch("/api/projects/upload-cover", {
        method: "POST",
        body: formData,
      });

      try {
        payload = (await res.json()) as UploadCoverResponse;
      } catch (err) {
        console.error("[handleCoverFileUpload] errore parse JSON:", err);
      }

      console.log("[handleCoverFileUpload] HTTP", res.status, payload);

      if (!res.ok || !payload?.ok) {
        const message =
          payload?.error ??
          `Errore caricando la cover. Status ${res.status}`;
        setCoverUploadError(message);
        throw new Error(message);
      }

      const nextCoverUrl = payload.coverUrl ?? null;

      setCoverUrl(nextCoverUrl);
      setCoverDraft(nextCoverUrl ?? "");
      setProject((prev) =>
        prev ? { ...prev, cover_url: nextCoverUrl } : prev
      );
      setCoverUploadMessage("Cover caricata correttamente.");

      if (tempCoverUrlRef.current) {
        URL.revokeObjectURL(tempCoverUrlRef.current);
        tempCoverUrlRef.current = null;
      }
      setTempCoverPreview(null);

      return payload;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Errore nel caricamento della cover.";
      setCoverUploadError(message);
      throw err;
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleCoverFileChange = (
    event: ChangeEvent<HTMLInputElement>,
    projectId: string
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);

    if (tempCoverUrlRef.current) {
      URL.revokeObjectURL(tempCoverUrlRef.current);
    }
    tempCoverUrlRef.current = objectUrl;
    setTempCoverPreview(objectUrl);

    handleCoverFileUpload(file, projectId).catch((err) => {
      console.error("[handleCoverFileChange] upload fallito:", err);

      if (tempCoverUrlRef.current) {
        URL.revokeObjectURL(tempCoverUrlRef.current);
        tempCoverUrlRef.current = null;
      }
      setTempCoverPreview(null);
    });
    event.target.value = "";
  };

  const openCoverEditor = () => {
    setCoverEditorOpen(true);
    setCoverUploadError(null);
    setCoverUploadMessage(null);
    setInfoError(null);
    setInfoFeedback(null);
  };

  const closeCoverEditor = () => {
    setCoverEditorOpen(false);
    setCoverUploadError(null);
    setCoverUploadMessage(null);
  };

  const handleVersionNameChange = (versionId: string, value: string) => {
    setVersionNameDrafts((prev) => ({
      ...prev,
      [versionId]: value,
    }));
  };

  const handleSaveVersionName = async (versionId: string) => {
    const nextName = (versionNameDrafts[versionId] ?? "").trim();
    if (!nextName) {
      setVersionNameFeedback((prev) => ({
        ...prev,
        [versionId]: {
          error: "Il nome versione non può essere vuoto.",
          success: null,
        },
      }));
      return;
    }

    setVersionNameFeedback((prev) => ({
      ...prev,
      [versionId]: { error: null, success: null },
    }));

    try {
      const res = await fetch("/api/projects/update-version", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version_id: versionId,
          version_name: nextName,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error ?? "Errore durante l'aggiornamento della versione."
        );
      }

      setVersionNameFeedback((prev) => ({
        ...prev,
        [versionId]: {
          error: null,
          success: "Nome versione aggiornato.",
        },
      }));
      await loadProject();
    } catch (err) {
      console.error("Update version name error:", err);
      const message =
        err instanceof Error ? err.message : "Errore aggiornando la versione.";
      setVersionNameFeedback((prev) => ({
        ...prev,
        [versionId]: { error: message, success: null },
      }));
    }
  };

  const handleDeleteVersion = async () => {
    if (!versionToDelete) return;
    setVersionDeleteError(null);
    setDeletingVersionId(versionToDelete.id);

    try {
      const res = await fetch("/api/projects/delete-version", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version_id: versionToDelete.id }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error ?? "Errore durante l'eliminazione della versione."
        );
      }

      setVersionToDelete(null);
      setExpandedVersionId(null);
      await loadProject();
    } catch (err) {
      console.error("Delete version error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Errore eliminando la versione.";
      setVersionDeleteError(message);
    } finally {
      setDeletingVersionId(null);
    }
  };

  // analizza una singola versione (anche v2, v3, ecc)
  const handleAnalyzeVersion = async (versionId: string) => {
    if (!projectId) return;

    setErrorMsg(null);
    setAnalyzingVersionId(versionId);
    setAnalyzerStatus("starting");

    try {
      const res = await fetch("/api/projects/run-analyzer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version_id: versionId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Analyze error response:", text);
        setAnalyzerStatus("error");
        throw new Error(text || "Errore avviando l'analisi");
      }

      setAnalyzerStatus("analyzing");

      const runData = (await res.json()) as AnalyzerRunResponse | null;

      // fix_suggestions dal backend
      setFixSuggestionsByVersion((prev) => ({
        ...prev,
        [versionId]: runData?.analyzer_result?.fix_suggestions ?? null,
      }));

      // Tekkin Analyzer V1
      const mixV1 = runData?.analyzer_result
        ?.mix_v1 as AnalyzerV1Result | null;

      setMixV1ByVersion((prev) => ({
        ...prev,
        [versionId]: mixV1,
      }));

      setAnalyzerStatus("saving");
      await loadProject();

      setAnalyzerStatus("done");
      // dopo un attimo torniamo idle
      setTimeout(() => {
        setAnalyzerStatus("idle");
      }, 1500);
    } catch (err) {
      console.error("Analyze version error:", err);
      setErrorMsg("Errore durante l'analisi della versione.");
      setAnalyzerStatus("error");
    } finally {
      setAnalyzingVersionId(null);
    }
  };


  const handleGenerateAiForVersion = async (versionId: string) => {
    try {
      setAiLoadingVersionId(versionId);
      setAiErrorByVersion((prev) => ({ ...prev, [versionId]: null }));

      const res = await fetch("/api/analyzer/ai-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version_id: versionId, force: true }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[AI coach] error response:", text);
        throw new Error(text || "Errore Tekkin AI");
      }

      const data = (await res.json()) as {
        ok: boolean;
        version_id: string;
        ai: AnalyzerAiCoach;
      };

      if (!data.ok || !data.ai) {
        throw new Error("Risposta Tekkin AI non valida");
      }

      setAiByVersion((prev) => ({
        ...prev,
        [versionId]: data.ai,
      }));
    } catch (err: unknown) {
      console.error("[AI coach] unexpected error:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Errore Tekkin AI";
      setAiErrorByVersion((prev) => ({
        ...prev,
        [versionId]: message,
      }));
    } finally {
      setAiLoadingVersionId((prev) =>
        prev === versionId ? null : prev
      );
    }
  };

  const latestVersion = versionsWithFixes[0] ?? null;

  const latestVersionId = latestVersion?.id ?? null;
  const latestVersionRef = useRef<string | null>(null);

  useEffect(() => {
    const prevLatestId = latestVersionRef.current;
    const shouldAutoExpand =
      latestVersionId &&
      (expandedVersionId === null || expandedVersionId === prevLatestId);

    if (shouldAutoExpand) {
      setExpandedVersionId(latestVersionId);
    }

    latestVersionRef.current = latestVersionId;
  }, [expandedVersionId, latestVersionId]);

  const expandedVersion =
    versionsWithFixes.find((v) => v.id === expandedVersionId) ?? null;

  const previewCoverUrl =
    tempCoverPreview ??
    coverUrl ??
    project?.cover_url ??
    project?.cover_link ??
    null;
  const effectiveCover =
    coverUrl ?? project?.cover_url ?? project?.cover_link ?? null;

  useEffect(() => {
    if (!expandedVersion) return;
    const state = audioStates[expandedVersion.id];
    if (
      expandedVersion.audio_url &&
      !state?.url &&
      !state?.loading
    ) {
      void fetchAudioPreviewForVersion(expandedVersion);
    }
  }, [expandedVersion, audioStates, fetchAudioPreviewForVersion]);

  const handleToggleVersion = useCallback((version: VersionRow) => {
    setExpandedVersionId((prev) => (prev === version.id ? null : version.id));
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto py-8">
      <Link
        href="/artist/projects"
        className="mb-4 inline-flex text-sm text-white/60 hover:text-white"
      >
        ← Back to Projects
      </Link>

      {loading && (
        <p className="text-sm text-white/50">Caricamento project...</p>
      )}

      {errorMsg && !loading && (
        <p className="text-sm text-red-400 mb-4">{errorMsg}</p>
      )}

        {!loading && project && (
          <>
            <section className="space-y-6 mb-6">
              <div className="rounded-3xl border border-white/10 bg-black/60 p-5 grid gap-5 lg:grid-cols-[280px_1fr]">
                <div className="group relative overflow-hidden rounded-2xl">
                  <div className="relative h-56 w-full shadow-lg">
                    {effectiveCover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={effectiveCover}
                        alt={`Cover ${project.title}`}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-900 to-black text-[11px] uppercase tracking-[0.4em] text-white/40">
                        <span>Artwork mancante</span>
                        <span>Tekkin Projects</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/90"></div>
                <div className="absolute inset-x-4 bottom-4 flex flex-col gap-3 rounded-2xl bg-gradient-to-t from-black/80 to-transparent px-3 py-3">
                  <p className="text-sm text-white/80 line-clamp-3">
                    {project.description ??
                      "Aggiorna cover e descrizione per far risaltare il tuo progetto Tekkin."}
                  </p>
                  <button
                    type="button"
                    onClick={openCoverEditor}
                    className="self-start rounded-full border border-white/30 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-white/70 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    Modifica cover & descrizione
                  </button>
                </div>
                </div>
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-2">
                      {editingTitle ? (
                        <form
                          onSubmit={handleSaveProjectTitle}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            className="min-w-[220px] flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm text-white"
                            placeholder="Nome project"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={titleSaving}
                              className="rounded-full px-4 py-1.5 text-[11px] font-semibold text-white bg-[var(--accent)] disabled:opacity-60"
                            >
                              {titleSaving ? "Salvataggio..." : "Salva"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingTitle}
                              className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            >
                              Annulla
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <h1 className="text-2xl font-semibold">{project.title}</h1>
                          <button
                            type="button"
                            onClick={startEditingTitle}
                            className="text-xs text-white/70 underline-offset-2 transition hover:text-[var(--accent)]"
                          >
                            Rinomina
                          </button>
                        </div>
                      )}
                      {titleError && (
                        <p className="text-xs text-red-400">{titleError}</p>
                      )}
                      {titleFeedback && !editingTitle && (
                        <p className="text-xs text-emerald-300">{titleFeedback}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-white/80">
                      {project.status ?? "UNKNOWN"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[11px] text-white/60">
                    <span>
                      Creato il {new Date(project.created_at).toLocaleDateString("it-IT")}
                    </span>
                    <span>
                      Ultima versione: {latestVersion
                        ? new Date(latestVersion.created_at).toLocaleDateString("it-IT")
                        : "ancora nessuna"}
                    </span>
                    <span>Versioni: {project.versions.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-[11px] text-white/50">
                    <span>Mix type: {getMixTypeLabel(project.mix_type, "master")}</span>
                    <span>Genere: {getTekkinGenreLabel(project.genre) ?? "n.d."}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.3em]">
                      {latestVersion ? `Score ${latestVersion.overall_score?.toFixed(1) ?? "n.d."}` : "Score n.d."}
                    </span>
                    <span className="rounded-full border border-white/15 px-3 py-1 uppercase tracking-[0.3em]">
                      {latestVersion ? `LUFS ${latestVersion.lufs?.toFixed(1) ?? "n.d."}` : "LUFS n.d."}
                    </span>
                  </div>
                </div>
              </div>
            </section>
              <div className="mb-6 rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
                <div>
                  <p className="text-xs text-white/60 mb-1 uppercase tracking-wide">
                    New version
                  </p>
                  <p className="text-sm text-white/80">
                    Carica una nuova versione per avere il report Tekkin Analyzer e
                    il piano d’azione.
                  </p>
                </div>
                <form
                  onSubmit={handleUploadNewVersion}
                  className="grid gap-3 md:grid-cols-[minmax(0,auto)_auto_auto] md:items-end"
                >
                  <input
                    name="version_name"
                    placeholder="Version name (es. v2, Master, Alt Mix)"
                    className="min-w-0 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm text-white"
                  />

                  <div className="flex flex-col gap-1 text-sm">
                    <label className="text-sm text-white/70">Version mix type</label>
                    <select
                      name="mix_type"
                      value={versionMixType}
                      onChange={(e) =>
                        setVersionMixType(e.target.value as TekkinMixType)
                      }
                      className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm"
                    >
                      {TEKKIN_MIX_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getMixTypeLabel(type, type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white/80">Carica nuova versione</p>
                    <label
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                        fileTooLarge
                          ? "border-red-400 bg-red-500/10 text-red-100"
                          : "border-white/15 bg-black/60 text-white/80 hover:border-[var(--accent)]"
                      }`}
                    >
                      <span className="font-semibold">
                        {selectedFileName ? "File selezionato" : "Scegli file"}
                      </span>
                      <span className="text-[11px] text-white/60">
                        {selectedFileName
                          ? `${selectedFileName} ${
                              selectedFileSize ? `• ${formatBytes(selectedFileSize)}` : ""
                            }`
                          : "MP3 · WAV · FLAC"}
                      </span>
                      <input
                        type="file"
                        name="file"
                        accept=".mp3,.wav,.aiff,.flac"
                        required
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                    {fileTooLarge && (
                      <p className="text-xs text-red-400">
                        File troppo grande (max 50 MB)
                      </p>
                    )}
                    {selectedFileName && !fileTooLarge && (
                      <p className="text-xs text-white/60">
                        {selectedFileSize ? `${formatBytes(selectedFileSize)} selezionati` : ""}
                      </p>
                    )}
                    <p className="text-xs text-white/60">
                      Formati consigliati: MP3 320 kbps. Limite massimo server: 50 MB per file.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-medium text-black disabled:opacity-60"
                  >
                    {uploading ? "Uploading..." : "Upload version"}
                  </button>
                </form>
                {uploadError && (
                  <p className="text-xs text-red-400">{uploadError}</p>
                )}
              </div>

          {/* Lista versioni */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
              <span>Versions history</span>
              <span className="text-[10px] text-white/40">
                Agruppati per data, lancia Analyze dopo ogni upload
              </span>
            </div>
            {versionsWithFixes.length === 0 && (
  <div className="rounded-2xl border border-white/10 bg-black/60 p-4 text-xs text-white/80 space-y-2">
    <p className="text-sm font-semibold">Nessuna versione ancora.</p>
    <p>
      Carica qui sopra il tuo <span className="font-semibold">master</span> o
      <span className="font-semibold"> premaster</span> e lancia{" "}
      <span className="font-semibold">Analyze</span>.
    </p>
    <ul className="list-disc pl-4 space-y-1">
      <li>Consigliato: MP3 320 kbps o WAV 24 bit.</li>
      <li>Per il premaster, lascia 4–6 dB di headroom senza limiter brickwall.</li>
      <li>Dopo l’analisi vedrai Tekkin Score, match di genere e piano d’azione.</li>
    </ul>
  </div>
)}

            <div className="flex flex-col gap-3">
              {versionsWithFixes.map((v, index) => {
                const isLatestVersion = index === 0;
                const isExpanded = expandedVersionId === v.id;
                const audioState = audioStates[v.id];
                const hasAudio = Boolean(v.audio_url);
                const ai = aiByVersion[v.id];
                return (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-white/10 bg-black/60 p-4 space-y-4 transition hover:border-white/20"
                  >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              {editingVersionId === v.id ? (
                                <input
                                  value={
                                    versionNameDrafts[v.id] ?? v.version_name ?? ""
                                  }
                                  onChange={(event) =>
                                    handleVersionNameChange(v.id, event.target.value)
                                  }
                                  onBlur={() => {
                                    void handleSaveVersionName(v.id);
                                    setEditingVersionId(null);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                      event.preventDefault();
                                      void handleSaveVersionName(v.id);
                                      (event.target as HTMLInputElement).blur();
                                      setEditingVersionId(null);
                                    }
                                  }}
                                  className="min-w-[180px] flex-1 rounded-xl bg-black/70 border border-white/15 px-3 py-2 text-sm text-white focus:border-[var(--accent)] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60"
                                />
                              ) : (
                                <span className="text-base font-semibold text-white">
                                  {v.version_name}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVersionId(editingVersionId === v.id ? null : v.id);
                                }}
                                className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60 hover:text-white/90"
                              >
                                {editingVersionId === v.id ? "Chiudi" : "Rinomina"}
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70">
                                {getMixTypeLabel(v.mix_type)}
                              </span>
                              {isLatestVersion && (
                                <span className="inline-flex items-center rounded-full border border-white/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/70">
                                  Latest
                                </span>
                              )}
                            </div>
                            {versionNameFeedback[v.id]?.error && (
                              <p className="text-[11px] text-red-400">
                                {versionNameFeedback[v.id]?.error}
                              </p>
                            )}
                            {versionNameFeedback[v.id]?.success && (
                              <p className="text-[11px] text-emerald-300">
                                {versionNameFeedback[v.id]?.success}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-4 text-xs text-white/60">
                              <span>
                                Score:{" "}
                                {v.overall_score != null
                                  ? v.overall_score.toFixed(1)
                                  : "n.a."}
                              </span>
                              <span>
                                LUFS: {v.lufs != null ? v.lufs.toFixed(1) : "n.a."}
                              </span>
                              <span>
                                {new Date(v.created_at).toLocaleString("it-IT")}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => void handleAnalyzeVersion(v.id)}
                              disabled={analyzingVersionId === v.id}
                              className="rounded-full px-4 py-1 text-xs font-semibold bg-[var(--accent)] text-black disabled:opacity-60"
                            >
                              {analyzingVersionId === v.id
                                ? "Analyzing..."
                                : v.overall_score == null
                                ? "Analyze"
                                : "Re-analyze"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setVersionToDelete(v)}
                              className="rounded-full border border-white/20 px-4 py-1 text-xs text-white/70 hover:border-red-400 hover:text-red-200 transition"
                            >
                              Elimina traccia
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleVersion(v)}
                              className="rounded-full border border-white/20 px-4 py-1 text-xs text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? "Nascondi report" : "Mostra report"}
                            </button>
                          </div>
                        </div>
                    {analyzingVersionId === v.id && (
  <p className="mt-1 text-[10px] text-white/60">
    {analyzerStatus === "starting" && "Invio la versione al motore Tekkin Analyzer..."}
    {analyzerStatus === "analyzing" &&
      "Analisi in corso: calcolo loudness, spettro, dinamica e profilo di genere."}
    {analyzerStatus === "saving" &&
      "Sto salvando risultati, Tekkin Score e piano d’azione..."}
    {analyzerStatus === "done" &&
      "Analisi completata. I dati sono stati aggiornati qui sotto."}
    {analyzerStatus === "error" &&
      "Errore durante l’analisi. Controlla la connessione e riprova."}
  </p>
)}

                    {isExpanded && (
                      <div className="space-y-4 border-t border-white/10 pt-4">
                        {hasAudio ? (
                          <>
                            {audioState?.loading && (
                              <p className="text-xs text-white/60 mb-2">
                                Caricamento anteprima audio...
                              </p>
                            )}
                            {audioState?.error && (
                              <p className="text-xs text-red-400 mb-2">
                                {audioState.error}
                              </p>
                            )}
                            {audioState?.url && (
                              <div className="space-y-2">
                                <p className="text-xs text-white/60">
                                  Preview audio
                                </p>
                                <audio
                                  controls
                                  src={audioState.url}
                                  className="w-full"
                                >
                                  Your browser does not support the audio element.
                                </audio>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-white/60">
                            Anteprima audio non disponibile per questa versione.
                          </p>
                        )}
                        <AnalyzerProPanel
                          version={v}
                          mixV1={mixV1ByVersion[v.id] ?? v.mix_v1 ?? null}
                          aiSummary={
                            ai?.summary ?? v.analyzer_ai_summary ?? null
                          }
                          aiActions={
                            ai?.actions ?? v.analyzer_ai_actions ?? null
                          }
                          aiMeta={ai?.meta ?? v.analyzer_ai_meta ?? null}
                          aiLoading={aiLoadingVersionId === v.id}
                          onAskAi={() => void handleGenerateAiForVersion(v.id)}
                          analyzerResult={v.analyzer_json ?? null}
                          referenceAi={v.reference_ai ?? null}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      {coverEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 to-black/90 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.9)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Cover & Description
                </p>
                <h2 className="text-3xl font-semibold text-white">
                  Aggiorna il mood del tuo project
                </h2>
                <p className="text-sm text-white/60">
                  Scegli un’immagine rappresentativa e scrivi una descrizione
                  vintage per raccontare le intenzioni della release.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCoverEditor}
                className="rounded-full border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70 hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Chiudi
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="relative h-24 w-full overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-slate-900 via-black to-black">
                  {previewCoverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewCoverUrl}
                      alt="Anteprima cover progetto"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-[10px] uppercase tracking-[0.4em] text-white/40">
                      Nessuna cover
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-white/60">
                  PNG, JPG, WEBP – max 5 MB
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    id="project-cover-file"
                    className="sr-only"
                    onChange={(event) =>
                      project && handleCoverFileChange(event, project.id)
                    }
                  />
                  <label
                    htmlFor="project-cover-file"
                    className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-black transition hover:bg-white/90"
                  >
                    {isUploadingCover ? "Caricamento..." : "Scegli un file"}
                  </label>
                </div>
                {coverUploadError && (
                  <p className="text-xs text-red-400">{coverUploadError}</p>
                )}
                {coverUploadMessage && (
                  <p className="text-xs text-emerald-300">{coverUploadMessage}</p>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border border-white/5 bg-black/70 p-4">
                <label className="text-xs font-medium uppercase tracking-[0.4em] text-white/60">
                  Descrizione
                </label>
                <textarea
                  value={descriptionDraft}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                  className="min-h-[160px] w-full rounded-2xl border border-transparent bg-black/50 p-4 text-sm text-white placeholder:text-white/40 focus:border-[var(--accent)] focus:outline-none focus:ring-0"
                  placeholder="Racconta il mood e le intenzioni del tuo project..."
                />
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    disabled={isSavingInfo}
                    onClick={() => {
                      handleSaveProjectInfo().catch((err) => {
                        console.error(
                          "[Modal] errore salvataggio info progetto:",
                          err
                        );
                        const message =
                          err instanceof Error
                            ? err.message
                            : "Errore aggiornando info.";
                        setInfoError(message);
                      });
                    }}
                    className="rounded-full px-5 py-2 text-sm font-semibold bg-[var(--accent)] text-black disabled:opacity-60"
                  >
                    {isSavingInfo ? "Salvataggio..." : "Aggiorna cover & descrizione"}
                  </button>
                  {infoFeedback && !infoError && (
                    <p className="text-[11px] text-emerald-300">{infoFeedback}</p>
                  )}
                  {infoError && (
                    <p className="text-[11px] text-red-400">{infoError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {versionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--sidebar-bg)] p-5 shadow-2xl">
            <p className="text-sm font-semibold text-white">
              Elimina versione {versionToDelete.version_name}
            </p>
            <p className="mt-2 text-xs text-white/70">
              L'operazione è irreversibile. Verranno rimossi anche i dati
              dell'analisi.
            </p>
            {versionDeleteError && (
              <p className="mt-2 text-xs text-red-300">{versionDeleteError}</p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setVersionToDelete(null)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/80 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                disabled={!!deletingVersionId}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteVersion()}
                className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                disabled={deletingVersionId === versionToDelete.id}
              >
                {deletingVersionId === versionToDelete.id
                  ? "Elimino..."
                  : "Conferma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
