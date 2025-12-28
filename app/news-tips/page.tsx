export default function NewsTipsPage() {
  return (
    <main className="min-h-[70vh] rounded-3xl border border-white/10 bg-black/50 p-10 text-white shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
      <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">
        Work in progress
      </p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
        News &amp; Tips
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-white/70">
        Una dashboard leggera con notizie curatissime e tips pratici: release
        che spaccano, trend di club, strategie per far crescere il profilo.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { title: "Trend Pulse", desc: "Cosa sta suonando adesso nei club." },
          { title: "Growth Hacks", desc: "Micro-strategie concrete per crescere." },
          { title: "Tekkin Picks", desc: "Highlight settimanali selezionati dal team." },
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
        Arriva presto, stay tuned
      </div>
    </main>
  );
}
