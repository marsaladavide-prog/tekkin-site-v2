"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  version_name: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
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
              version_name,
              created_at
            )
          `
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Supabase load projects error:", error);
          setErrorMsg("Errore nel caricamento dei projects.");
          setProjects([]);
          setLoading(false);
          return;
        }

        const mapped: ProjectRow[] =
          data?.map((p: any) => {
            const versions = (p.project_versions ?? []) as any[];

            // se arrivano non ordinati, prendo comunque la piu recente
            const latestVersion =
              versions.length > 0
                ? [...versions].sort(
                    (a, b) =>
                      new Date(b.created_at).getTime() -
                      new Date(a.created_at).getTime()
                  )[0]
                : null;

            return {
              id: p.id,
              title: p.title,
              status: p.status,
              version_name: latestVersion?.version_name ?? null,
              created_at: p.created_at,
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

  const hasProjects = projects.length > 0;

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
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/40">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Track name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Latest version</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, index) => (
                <tr
                  key={p.id}
                  className="border-t border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3 align-middle text-xs text-white/70">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Link
                      href={`/artist/projects/${p.id}`}
                      className="text-sm font-medium text-white hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-middle text-xs">
                    <span className="inline-flex items-center rounded-full border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white/70">
                      {p.status ?? "UNKNOWN"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle text-sm text-white/80">
                    {p.version_name ?? "n.a."}
                  </td>
                  <td className="px-4 py-3 align-middle text-xs text-white/60">
                    {new Date(p.created_at).toLocaleDateString("it-IT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
