import Link from "next/link";

type AnalyzerCtaCardProps = {
  projectId: string | null;
};

export default function AnalyzerCtaCard({ projectId }: AnalyzerCtaCardProps) {
  const targetHref = projectId ? `/artist/projects/${projectId}` : "/artist/projects";

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/60 to-black/20 p-6 shadow-lg shadow-black/60">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--muted)]">Tekkin Analyzer PRO</p>
          <h2 className="text-2xl font-semibold text-white">
            Analizza una versione per sbloccare il report
          </h2>
        </div>
        <p className="text-sm text-white/70">
          Carica una master o un premaster, poi premi <span className="font-semibold">Analyze</span> per
          ottenere il Tekkin Score, il match % sul profilo scelto e i suggerimenti concreti.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
          <li>Tekkin Score e LUFS calibrati per la tua traccia.</li>
          <li>Match % con il profilo Tekkin selezionato.</li>
          <li>Piano d'azione basato sulle discrepanze più forti.</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link
            href={targetHref}
            className="rounded-2xl bg-teal-400 px-4 py-2 text-sm font-semibold text-black transition hover:bg-teal-300"
          >
            Vai al progetto
          </Link>
          <Link
            href="/artist/projects"
            className="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40"
          >
            Crea o aggiorna una versione
          </Link>
        </div>
      </div>
    </section>
  );
}
