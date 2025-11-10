"use client";
import { useEffect, useState } from "react";

type EventRow = {
  id: string;
  provider: string;
  provider_event_id: string;
  artist: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  event_date: string | null;
  raw: any | null;
};

function parseDate(ev: EventRow): Date | null {
  if (ev.event_date) {
    const d = new Date(ev.event_date);
    if (!isNaN(d.getTime())) return d;
  }
  const iso =
    ev.raw?.datetime ||
    ev.raw?.date ||
    ev.raw?.startsAt ||
    ev.raw?.start_time;
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function bucketize(events: EventRow[]) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const live: EventRow[] = [];
  const upcoming: EventRow[] = [];
  const past: EventRow[] = [];

  for (const e of events) {
    const d = parseDate(e);
    if (!d) {
      upcoming.push(e);
      continue;
    }
    if (d >= start && d < end) live.push(e);
    else if (d >= end) upcoming.push(e);
    else past.push(e);
  }

  const byDateAsc = (a: EventRow, b: EventRow) =>
    (parseDate(a)?.getTime() ?? 0) - (parseDate(b)?.getTime() ?? 0);

  live.sort(byDateAsc);
  upcoming.sort(byDateAsc);
  past.sort((a, b) => (parseDate(b)?.getTime() ?? 0) - (parseDate(a)?.getTime() ?? 0));

  return { live, upcoming, past };
}

export default function SpotlightPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/spotlight/events");
      const j = await r.json();
      setEvents(j.events ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6">Caricamento...</div>;

  const { live, upcoming, past } = bucketize(events);

  const Card = ({ e }: { e: EventRow }) => {
    const d = parseDate(e);
    const when = d ? d.toLocaleString() : "TBA";
    const img = e.raw?.image_url || e.raw?.image || null;
    const link = e.raw?.eventUrl || e.raw?.event_url || e.raw?.url || null;
    const ig = e.raw?.artist_url || e.raw?.instagram || null;

    return (
      <div className="rounded-2xl border border-zinc-800 p-4 flex gap-4 items-center">
        {img ? <img src={img} alt="" className="w-16 h-16 rounded object-cover" /> : <div className="w-16 h-16 rounded bg-zinc-800" />}
        <div className="flex-1">
          <div className="text-lg font-semibold">{e.artist ?? "Unknown Artist"}</div>
          <div className="text-sm text-zinc-400">{e.venue ?? "TBA"} · {e.city ?? ""} {e.country ? `(${e.country})` : ""}</div>
          <div className="text-sm">{when}</div>
          <div className="flex gap-3 mt-1 text-sm">
            {link && <a className="underline" href={link} target="_blank" rel="noreferrer">Event</a>}
            {ig && <a className="underline" href={ig} target="_blank" rel="noreferrer">Instagram</a>}
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, items }: { title: string; items: EventRow[] }) => (
    <section className="mb-8">
      <h2 className="text-xl font-bold mb-3">{title} ({items.length})</h2>
      <div className="grid gap-3">
        {items.map(e => <Card key={e.id} e={e} />)}
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-zinc-100 p-6">
      <h1 className="text-2xl font-bold mb-6">Tekkin Spotlight</h1>
      <Section title="Live" items={live} />
      <Section title="Upcoming" items={upcoming} />
      <Section title="Past" items={past} />
    </main>
  );
}
