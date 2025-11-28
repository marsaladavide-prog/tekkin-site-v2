"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  version_name: string;
  created_at: string;
  version_id?: string | null;
  overall_score?: number | null;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
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
            overall_score
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase load projects error:", error);
        setErrorMsg("Errore nel caricamento dei projects");
        setLoading(false);
        return;
      }

      const mapped: ProjectRow[] =
        (data ?? []).map((p: any) => {
          const versions = p.project_versions ?? [];
          const latest =
            versions.length > 0
              ? versions.sort(
                  (a: any, b: any) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                )[0]
              : null;

          return {
            id: p.id,
            title: p.title,
            status: p.status,
            version_name: latest?.version_name ?? "v1",
            version_id: latest?.id ?? null,
            overall_score: latest?.overall_score ?? null,
            created_at: p.created_at,
          };
        });

      setProjects(mapped);
      setLoading(false);
    };

    void load();
  }, []);

  const handleAnalyze = async (projectId: string) => {
    const project = projects.find((x) => x.id === projectId);
    if (!project) return;

    const versionId = project.version_id;
    if (!versionId) {
      setErrorMsg("Nessuna versione trovata per questo progetto.");
      return;
    }

    try {
      setAnalyzingId(projectId);
      setErrorMsg(null);

      const res = await fetch("/api/projects/run-analyzer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version_id: versionId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Errore avviando l'analisi");
      }

      const json = await res.json();
      const newScore =
        typeof json.overall_score === "number" ? json.overall_score : null;

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, overall_score: newScore } : p
        )
      );
    } catch (err) {
      console.error("Analyze error:", err);
      setErrorMsg("Errore durante l'analisi.");
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link
          href="/artist/projects/new"
          className="rounded-full px-4 py-2 text-sm font-medium bg-[var(--accent)] text-black"
        >
          New Project
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-white/50">Caricamento projects...</p>
      )}

      {errorMsg && !loading && (
        <p className="mb-4 text-sm text-red-400">{errorMsg}</p>
      )}

      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/40">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Track name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Version</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Actions</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, index) => (
                <tr
                  key={p.id}
                  className="border-t border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">
  <Link
    href={`/artist/projects/${p.id}`}
    className="hover:underline"
  >
    {p.title}
  </Link>
</td>

                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3">{p.version_name}</td>

                  <td className="px-4 py-3">
                    {p.overall_score != null ? p.overall_score : "n.a."}
                  </td>

                  <td className="px-4 py-3">
                    {p.overall_score == null ? (
                      <button
                        onClick={() => handleAnalyze(p.id)}
                        className="rounded-full px-3 py-1 text-xs bg-[var(--accent)] text-black"
                        disabled={analyzingId === p.id}
                      >
                        {analyzingId === p.id ? "Analyzing..." : "Analyze v1"}
                      </button>
                    ) : (
                      <span className="text-xs text-white/50">Analyzed</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}

              {projects.length === 0 && !errorMsg && (
                <tr>
                  <td
                    className="px-4 py-6 text-center text-white/40"
                    colSpan={7}
                  >
                    Nessun project ancora. Crea il primo con "New Project".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
