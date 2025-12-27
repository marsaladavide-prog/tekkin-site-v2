import { Scanner } from "@/app/artist/discovery/components/Scanner";

export default function DiscoveryScannerPage() {
  return (
    <main className="flex-1 min-h-screen bg-tekkin-bg px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-3 text-center md:text-left">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">
            Tekkin Discovery
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-tekkin-text">
            Scanner
          </h1>
          <p className="text-sm text-tekkin-muted">
            Analizza tracce Tekkin e filtra per score, energia e bpm.
          </p>
        </header>

        <section className="space-y-6">
          <Scanner />
        </section>
      </div>
    </main>
  );
}
