
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AnalyzerProPanel } from "@/components/analyzer/AnalyzerProPanel";
import { createClient } from "@/utils/supabase/server";

const PROJECT_FIELDS = `
  *,
  projects (
    id,
    user_id
  )
`;

export default async function AnalyzerVersionPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const resolvedParams = params ? await params : undefined;
  const versionId = resolvedParams?.versionId;
  if (!versionId) {
    notFound();
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user ?? null;

  if (!user) {
    redirect("/login");
  }

  const { data: versionRow, error } = await supabase
    .from("project_versions")
    .select(PROJECT_FIELDS)
    .eq("id", versionId)
    .maybeSingle();

  if (!versionRow || error) {
    notFound();
  }

  const project = versionRow.projects;
  if (!project || project.user_id !== user.id) {
    notFound();
  }

  const projectId = versionRow.project_id ?? project.id;
  if (!projectId) {
    notFound();
  }

  let parsedArrays: Record<string, unknown> | null = null;
  const arraysBlobPath =
    typeof versionRow.arrays_blob_path === "string" ? versionRow.arrays_blob_path : null;

  if (arraysBlobPath) {
    try {
      const { data: arraysData, error: arraysError } = await supabase
        .storage
        .from("analyzer")
        .download(arraysBlobPath);

      if (!arraysError && arraysData) {
        const text = await arraysData.text();
        parsedArrays = JSON.parse(text);
      }
    } catch {
      parsedArrays = null;
    }
  }

  const { projects: _projects, ...versionForPanel } = versionRow;
  const versionWithArrays = {
    ...versionForPanel,
    analyzer_arrays: parsedArrays,
  };

  return (
    <div className="w-full">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">Report</p>
            <h1 className="text-3xl font-semibold text-white">Analyzer</h1>
          </div>
          <Link
            href={`/artist/projects/${projectId}`}
            className="text-sm font-semibold text-white/70 hover:text-white"
          >
            Torna al project
          </Link>
        </div>

        <AnalyzerProPanel version={versionWithArrays} />
      </div>
    </div>
  );
}
