"use client";

import React, { useEffect, useState } from "react";
import { MinusCircle, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import SoundCloudLikePlayer from "./SoundCloudLikePlayer";

export default function TracksSection({ userId }: { userId: string }) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [tracks, setTracks] = useState<any[]>([]);
  const [reload, setReload] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tracks")
        .select("id,title,artist,artwork_url,audio_url,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setTracks(data || []);
    })();
  }, [userId, reload]);

  return (
    <section className="rounded-2xl bg-white/90 border border-[#e8ecef] shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-[#eef1f4] bg-white/60 flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-500">Work in progress</div>
          <div className="text-xl font-semibold">Tracce in lavorazione</div>
        </div>
        <button
          onClick={() => setShowPlayer((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          {showPlayer ? <MinusCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showPlayer ? "Chiudi player" : "Aggiungi"}
        </button>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {showPlayer && (
          <div className="rounded-xl border border-[#eef1f4] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-800">Workspace rapido</div>
              <button
                onClick={() => setShowPlayer(false)}
                className="inline-flex items-center gap-1 rounded-md border border-[#e8ecef] bg-white px-2 py-1 text-xs hover:bg-zinc-50"
              >
                <MinusCircle className="h-4 w-4" /> Chiudi
              </button>
            </div>
            <SoundCloudLikePlayer userId={userId} onUploaded={() => setReload((v) => !v)} />
          </div>
        )}

        {tracks.length === 0 ? (
          <div className="text-sm text-zinc-500">
            Nessuna traccia nel database. Apri il workspace con \"Aggiungi\" per caricare una preview oppure inserisci nella tabella <b>tracks</b> in Supabase.
          </div>
        ) : (
          tracks.map((t) => (
            <div key={t.id} className="rounded-xl border border-[#eef1f4] bg-white p-3">
              <SoundCloudLikePlayer
                audioUrl={t.audio_url}
                artworkUrl={t.artwork_url || undefined}
                title={t.title || "Untitled"}
                artist={t.artist || "Unknown"}
                allowRateChange
                allowLoop
              />
            </div>
          ))
        )}
      </div>

    </section>
  );
}
