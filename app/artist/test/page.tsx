import TekkinScorePreview from "../components/TekkinScorePreview";

export default function ArtistTestPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Tekkin Score Preview
        </h1>
        <TekkinScorePreview />
      </div>
    </main>
  );
}
