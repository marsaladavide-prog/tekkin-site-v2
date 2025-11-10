import { createClient } from "@supabase/supabase-js";

type Story = {
  id: string;
  event_id: string;
  media_url: string | null;   // url immagine o video
  media_type: "image" | "video" | null;
  author_handle: string | null; // @dj o @venue
  captured_at: string | null;   // timestamptz
};

export default async function EventDetail({ params }: { params: { id: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [{ data: ev }, { data: stories }] = await Promise.all([
    supabase.from("spotlight_events").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("spotlight_stories").select("*").eq("event_id", params.id).order("captured_at", { ascending: false })
  ]);

  if (!ev) return <div className="p-6 text-zinc-200">Evento non trovato</div>;

  // info base
  const d = ev.raw?.datetime ? new Date(ev.raw.datetime) : null;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-zinc-100 p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="text-zinc-400">{d ? d.toLocaleString() : "N/D"}</div>
        <h1 className="text-2xl font-bold">{ev.artist}</h1>
        <div className="text-sm">{ev.venue}</div>
        <div className="text-sm text-zinc-400">{[ev.city, ev.country].filter(Boolean).join(", ")}</div>
        {ev.raw?.url ? (
          <a href={ev.raw.url} target="_blank" className="text-sky-400 underline text-sm mt-2 inline-block">
            Evento ufficiale
          </a>
        ) : null}
      </div>

      <h2 className="text-xl font-semibold mb-3">Stories</h2>
      {stories && stories.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stories.map((s: Story) => (
            <div key={s.id} className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 p-2">
              {s.media_type === "video" ? (
                <video src={s.media_url ?? ""} controls className="w-full h-auto" />
              ) : (
                <img src={s.media_url ?? ""} alt="" className="w-full h-auto" />
              )}
              <div className="text-xs text-zinc-400 mt-2 flex justify-between">
                <span>{s.author_handle ?? ""}</span>
                <span>{s.captured_at ? new Date(s.captured_at).toLocaleString() : ""}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-zinc-400">Nessuna storia collegata ancora.</div>
      )}
    </main>
  );
}
