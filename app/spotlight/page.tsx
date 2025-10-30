"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Instagram } from "lucide-react";

export default function SpotlightPage() {
  const [data, setData] = useState({ live: [], upcoming: [], past: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/spotlight");
      const json = await res.json();
      if (json.success) setData(json);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0b0b0b] text-zinc-400">
        <p>📡 Loading Tekkin Spotlight...</p>
      </main>
    );

  const Section = ({ title, events, color }) => {
    if (!events?.length) return null;

    return (
      <section className="mb-10">
        <h2
          className={`text-xl font-semibold mb-4 border-b pb-2`}
          style={{ borderColor: color }}
        >
          <span style={{ color }}>{title}</span>{" "}
          <span className="text-zinc-500 text-sm">({events.length})</span>
        </h2>

        {/* SCROLL ORIZZONTALE */}
        <div className="flex overflow-x-auto gap-6 pb-2">
          {events.map((event) => (
            <motion.div
              key={event.id}
              whileHover={{ scale: 1.03 }}
              className="min-w-[290px] bg-[#111] border border-zinc-800 rounded-xl overflow-hidden hover:border-[#00ffd0]/50 transition-all shadow-lg hover:shadow-[#00ffd0]/10"
            >
              {/* COVER */}
              <div className="relative w-full h-40 overflow-hidden">
                <img
                  src={event.image}
                  alt={event.artist}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* LIVE BADGE */}
                {title === "LIVE NOW" && (
                  <span className="absolute top-2 left-2 bg-red-600 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    🔴 LIVE
                  </span>
                )}
              </div>

              {/* INFO */}
              <div className="p-4 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <img
                      src={event.image}
                      alt={event.artist}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <a
                      href={`https://instagram.com/${event.instagram || ""}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00ffd0] font-semibold hover:text-white transition truncate"
                    >
                      {event.artist}
                    </a>
                  </div>
                  {event.instagram && (
                    <a
                      href={`https://instagram.com/${event.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#00ffd0] hover:text-white transition"
                    >
                      <Instagram size={14} />
                    </a>
                  )}
                </div>

                <p className="text-zinc-300 text-xs line-clamp-1">
                  {event.title}
                </p>
                <p className="text-zinc-400 text-xs">
                  {event.venue} · {event.location}
                </p>
                <p className="text-zinc-500 text-xs mt-1">
                  📅{" "}
                  {event.date ||
                    (event.startsAt
                      ? new Date(event.startsAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "TBA")}
                </p>

                <a
                  href={event.eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-[11px] px-3 py-1 border border-[#00ffd0]/40 rounded-full text-[#00ffd0] hover:bg-[#00ffd0]/10 transition"
                >
                  View Event
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-zinc-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-[0.25em] text-white mb-3">
            TEKKIN SPOTLIGHT
          </h1>
          <p className="text-zinc-400">
            Discover where your tracks got played — real-time global events.
          </p>
        </div>

        <Section title="LIVE NOW" events={data.live} color="#ff3b3b" />
        <Section title="UPCOMING EVENTS" events={data.upcoming} color="#00ffd0" />
        <Section title="PAST EVENTS" events={data.past} color="#888888" />
      </div>
    </main>
  );
}
