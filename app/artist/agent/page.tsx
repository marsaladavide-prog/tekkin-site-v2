export default function ArtistAgentPage() {
  return (
    <main className="flex-1 min-h-screen bg-tekkin-bg px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/50 p-10 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          <div className="pointer-events-none absolute -top-24 right-0 h-52 w-52 rounded-full bg-emerald-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-0 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

          <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">
            Work in progress
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-tekkin-text">
            Agent
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-tekkin-muted">
            Stiamo costruendo un agente intelligente che filtra i contatti, suggerisce
            risposte e mette in priorita i collab migliori. Qui vedrai la tua inbox
            potenziata.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Match immediati",
                desc: "Scopri richieste compatibili con il tuo sound.",
              },
              {
                title: "Auto-priorita",
                desc: "Una coda dinamica che mette avanti le opportunita forti.",
              },
              {
                title: "Risposte smart",
                desc: "Template e suggerimenti per chiudere piu in fretta.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-white/70">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/60">
            Preview in arrivo • restiamo on 🔥
          </div>
        </section>
      </div>
    </main>
  );
}
