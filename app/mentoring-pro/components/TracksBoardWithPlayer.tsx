"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronRight, Upload } from "lucide-react";

const SoundCloudLikePlayer = dynamic(
  () => import("./SoundCloudLikePlayer"),
  { ssr: false }
);

type Track = {
  id: string;
  title: string;
  artist: string | null;
  audio_url: string | null;
  artwork_url: string | null;
  genre: string | null;
  created_at: string;
};

export default function TracksBoardWithPlayer() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // init
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);

      const { data } = await supabase
        .from("tracks")
        .select("id,title,artist,audio_url,artwork_url,genre,created_at")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });

      setTracks((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const hasTracks = tracks && tracks.length > 0;

  const addLocalTrack = (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const url = URL.createObjectURL(f);
    const t: Track = {
      id: `local-${Date.now()}`,
      title: f.name.replace(/\.[a-z0-9]+$/i, ""),
      artist: null,
      audio_url: url,
      artwork_url: null,
      genre: "Minimal / Deep Tech",
      created_at: new Date().toISOString(),
    };
    setTracks((prev) => [t, ...prev]);
    setOpen((prev) => ({ ...prev, [t.id]: true }));
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-[#1c2628]/10 bg-white/90 p-4">
        <div className="text-sm text-zinc-500">Carico tracce…</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e8ecef] bg-white/90 p-0 overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#eef1f4] bg-white/60">
        <div className="text-sm text-zinc-500">Work in progress</div>
        <div className="text-xl font-semibold">Tracce in lavorazione</div>
      </div>

      <div className="px-4 py-4">
        {/* Add button (local fallback) */}
        <label className="inline-flex items-center gap-2 text-sm rounded-lg border border-[#e8ecef] bg-white px-3 py-2 hover:bg-zinc-50 cursor-pointer">
          <Upload className="h-4 w-4" />
          <span>Aggiungi traccia locale</span>
          <input type="file" accept="audio/*" className="hidden" onChange={(e) => addLocalTrack(e.target.files)} />
        </label>

        {!hasTracks ? (
          <div className="mt-3 text-sm text-zinc-500">
            Nessuna traccia nel database. Carica un file locale per provare il player o aggiungi tracce alla tabella
            <code className="ml-1 mr-1 bg-zinc-100 px-1 rounded">tracks</code> in Supabase.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {tracks.map((t) => {
              const isOpen = !!open[t.id];
              return (
                <div key={t.id} className="rounded-xl border border-[#eef1f4] bg-white overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50"
                    onClick={() => setOpen((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
                  >
                    <div className="text-left">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-zinc-500">
                        {t.artist || "Artist"} • {t.genre || "Genere"}
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  </button>

                  {isOpen && (
                    <div className="px-3 pb-3">
                      <SoundCloudLikePlayer
                        audioUrl={t.audio_url || ""}
                        artworkUrl={t.artwork_url || "/images/your-art.jpg"}
                        title={t.title}
                        artist={t.artist || "You"}
                        genre={t.genre || "Minimal / Deep Tech"}
                        allowLoop
                        allowRateChange
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
