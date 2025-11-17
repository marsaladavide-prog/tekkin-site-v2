"use client";

import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import SoundCloudLikePlayer from "./SoundCloudLikePlayer";

export default function TracksSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
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
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#e8ecef] bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          <Plus className="h-4 w-4" /> Aggiungi
        </button>
      </div>

      <div className="px-4 pb-4 space-y-4">
        {tracks.length === 0 ? (
          <div className="text-sm text-zinc-500">
            Nessuna traccia nel database. Aggiungi una preview con il pulsante sopra oppure inserisci nella tabella <b>tracks</b> in Supabase.
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

      {open && (
        <AddTrackModal onClose={() => setOpen(false)} onSaved={() => setReload((v) => !v)} userId={userId} />
      )}
    </section>
  );
}

function AddTrackModal({ onClose, onSaved, userId }: { onClose: () => void; onSaved: () => void; userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [artwork, setArtwork] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFile = (f: File | null) => {
    setFile(f);
    if (f) {
      setPreviewUrl(URL.createObjectURL(f));
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
    } else {
      setPreviewUrl(null);
    }
  };

  const save = async () => {
    if (!file) return;
    setUploading(true);

    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("tracks").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      setUploading(false);
      return;
    }
    const { data: pub } = supabase.storage.from("tracks").getPublicUrl(path);

    await supabase.from("tracks").insert({
      user_id: userId,
      title: title || file.name,
      artist: artist || null,
      artwork_url: artwork || null,
      audio_url: pub.publicUrl,
    });

    setUploading(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 left-0 top-12 mx-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-[#e8ecef]">
        <div className="px-4 py-3 border-b border-[#eef1f4] flex items-center justify-between">
          <div className="text-sm font-semibold">Aggiungi traccia</div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md hover:bg-zinc-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <label className="text-xs text-zinc-500">File audio</label>
          <input type="file" accept="audio/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />

          {previewUrl && (
            <div className="rounded-xl border border-[#eef1f4] bg-white p-3">
              <SoundCloudLikePlayer audioUrl={previewUrl} title={title || "Preview"} artist={artist || ""} artworkUrl={artwork || undefined} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500">Titolo</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Artista</label>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-500">Artwork URL</label>
              <input value={artwork} onChange={(e) => setArtwork(e.target.value)} className="w-full rounded-lg border border-[#e8ecef] bg-white px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#eef1f4] flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#e8ecef] bg-white px-4 py-2 text-sm hover:bg-zinc-50">Annulla</button>
          <button onClick={save} disabled={!file || uploading} className="rounded-lg bg-black text-white px-4 py-2 text-sm disabled:opacity-60">
            {uploading ? "Carico..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
