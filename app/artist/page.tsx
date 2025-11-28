"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

type ProjectRow = {
  id: string;
  title: string;
  status: string | null;
  version_name: string | null;
  created_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
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
        return;
      }

      const mapped: ProjectRow[] =
        data?.map((p: any) => {
          const latestVersion = p.project_versions?.[0] ?? null;
          return {
            id: p.id,
            title: p.title,
            status: p.status,
            version_name: latestVersion?.version_name ?? "v1",
            created_at: p.created_at,
          };
        }) ?? [];

      setProjects(mapped);
    };

    void load();
  }, [supabase]);

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

      <div className="overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Track name</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Version</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, index) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3 font-medium">{p.title}</td>
                <td className="px-4 py-3">{p.status}</td>
                <td className="px-4 py-3">{p.version_name}</td>
                <td className="px-4 py-3">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-white/40" colSpan={5}>
                  Nessun project ancora. Crea il primo con "New Project".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
