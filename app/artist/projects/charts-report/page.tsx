import Link from "next/link";

export default function ChartsReportPage() {
  return (
    <div className="w-full max-w-5xl mx-auto py-8 space-y-6">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">Reports</p>
            <h1 className="text-2xl font-semibold text-white">Charts Report</h1>
            <p className="text-sm text-white/60">
              Rileva la posizione in classifica, il periodo snapshot e lo score della versione.
            </p>
          </div>
          <Link
            href="/artist/projects"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Torna ai Projects
          </Link>
        </div>
      </header>

      <section className="rounded-3xl border border-white/10 bg-black/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-[0.3em] text-white/60 uppercase">Rank snapshot</h2>
          <span className="text-[11px] text-white/50">TODO: collegare ranking engine</span>
        </div>

        <div className="grid gap-2 text-[11px] text-white/60">
          <div className="flex font-semibold uppercase text-white/40">
            <span className="w-1/3">Posizione</span>
            <span className="w-1/3">Periodo snapshot</span>
            <span>Score</span>
          </div>
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
            Nessun dato di classifica disponibile.
            <div className="mt-2 text-[11px] text-white/50">
              TODO: integrare i dati del ranking per visualizzare posizione attuale, fascia temporale e score associato.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
