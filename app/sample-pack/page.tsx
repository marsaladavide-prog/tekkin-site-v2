export default function SamplePackPage() {
  return (
    <main className="min-h-[70vh] rounded-3xl border border-white/10 bg-black/50 p-10 text-white shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">
        Work in progress
      </p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
        Sample Pack
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-white/70">
        Stiamo preparando una libreria di sample curati per Tekkin: groove,
        tops e one-shot con tag AI e preview rapide. Qui potrai scaricare
        pack esclusivi e ricevere update settimanali.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { title: "Groove Ready", desc: "Loop pronti per il club, mixati con cura." },
          { title: "One-shot Kicks", desc: "Collezione di kick selezionati e puliti." },
          { title: "Vocal Bits", desc: "Hook vocali brevi per accentare il drop." },
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
        Stiamo scaldando i motori
      </div>
    </main>
  );
}
