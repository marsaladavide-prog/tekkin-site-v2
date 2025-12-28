import SignalReportClient from "./SignalReportClient";

type SignalReportPageProps = {
  searchParams: Promise<{ project_id?: string }>;
};

export default async function SignalReportPage({ searchParams }: SignalReportPageProps) {
  const params = await searchParams;
  const projectId = params?.project_id ?? null;

  return (
    <main className="w-full max-w-5xl mx-auto py-8">
      <SignalReportClient projectId={projectId} />
    </main>
  );
}
