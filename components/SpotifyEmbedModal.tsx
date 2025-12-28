"use client";

import { useEffect, useMemo, useState } from "react";

function ensureEmbed(url: string | null | undefined) {
  const s = (url ?? "").trim();
  if (!s) return null;
  // accetta solo embed spotify
  if (!s.startsWith("https://open.spotify.com/embed/")) return null;
  return s;
}

export default function SpotifyEmbedModal({
  open,
  onClose,
  embedUrl,
  title = "Spotify",
}: {
  open: boolean;
  onClose: () => void;
  embedUrl: string | null;
  title?: string;
}) {
  const src = useMemo(() => ensureEmbed(embedUrl), [embedUrl]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) setLoaded(false);
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        // click fuori chiude
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-xs uppercase tracking-[0.18em] text-white/70">
            {title}
          </div>
          <button
            onClick={onClose}
            className="text-xs text-white/60 hover:text-white"
          >
            CHIUDI
          </button>
        </div>

        <div className="relative bg-white">
          {/* loader sopra, ma NON deve bloccare i click */}
          {!loaded && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="text-sm text-black/50">Caricamento...</div>
            </div>
          )}

          {src ? (
            <iframe
              key={src}
              className="relative z-10 w-full pointer-events-auto"
              src={src}
              height={480}
              frameBorder={0}
              loading="eager"
              onLoad={() => setLoaded(true)}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          ) : (
            <div className="h-[480px] flex items-center justify-center text-sm text-black/60">
              Anteprima Spotify non disponibile.
            </div>
          )}

          {/* ring estetico sopra, ma non deve catturare click */}
          <div className="pointer-events-none absolute inset-0 z-30 ring-1 ring-black/10" />
        </div>
      </div>
    </div>
  );
}
