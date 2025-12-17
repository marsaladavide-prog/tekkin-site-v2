"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

type ArtistProfileHeaderProps = {
  artistId: string;
  artistName: string;
  mainGenreLabel?: string | null;
  locationLabel?: string | null;
  avatarUrl?: string | null;

  spotifyUrl?: string | null;
  beatportUrl?: string | null;
  instagramUrl?: string | null;
  presskitUrl?: string | null;

  onSendMessage?: () => void;
};

export function ArtistProfileHeader({
  artistId,
  artistName,
  mainGenreLabel,
  locationLabel,
  avatarUrl,
  spotifyUrl,
  beatportUrl,
  instagramUrl,
  presskitUrl,
  onSendMessage,
}: ArtistProfileHeaderProps) {
  const router = useRouter();
  const geo = [mainGenreLabel, locationLabel].filter(Boolean).join(" · ");

  const handleSendMessage = () => {
    if (onSendMessage) {
      onSendMessage();
      return;
    }
    router.push(`/artist/messages?with=${artistId}`);
  };

  return (
    <header className="text-center mb-8">
      {/* pill Tekkin Artist Profile */}
      <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full border border-tekkin-border bg-tekkin-panel/80 text-[11px] font-mono uppercase text-tekkin-muted mb-4 backdrop-blur-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        Tekkin Artist Profile
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* avatar */}
        <div className="relative group">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border border-tekkin-border bg-black transition-transform duration-300 group-hover:scale-110 shadow-lg">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={artistName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-mono text-tekkin-muted">
                {artistName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* nome + geo */}
        <div className="space-y-2 flex flex-col items-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase">
            {artistName}
          </h1>
          {geo && (
            <p className="text-xs md:text-sm font-mono text-tekkin-muted uppercase tracking-[0.18em]">
              {geo}
            </p>
          )}

          {/* actions row */}
          <div className="mt-3 flex items-center gap-3">
            {/* SEND MESSAGE */}
            <button
              type="button"
              onClick={handleSendMessage}
              className="flex items-center gap-2 bg-tekkin-accent hover:bg-tekkin-accent/80 text-black font-bold py-1.5 px-5 rounded-full text-xs transition-all shadow-[0_0_15px_rgba(34,211,238,0.4)]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              SEND MESSAGE
            </button>

            {/* favorite */}
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-tekkin-border text-tekkin-muted hover:border-red-500 hover:text-red-500 transition-colors bg-tekkin-panel"
              title="Add to Favorites"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L4.22 13.45 12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {/* vote */}
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-tekkin-border text-tekkin-muted hover:border-tekkin-accent hover:text-tekkin-accent transition-colors bg-tekkin-panel"
              title="Vote Artist"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </button>

            {/* share */}
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-full border border-tekkin-border text-tekkin-muted hover:border-tekkin-accent hover:text-tekkin-accent transition-colors bg-tekkin-panel"
              title="Share Profile"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
        </div>

        {/* service pills */}
        <div className="flex flex-wrap justify-center gap-2 md:gap-3 text-[11px] font-mono mt-2">
          {spotifyUrl && (
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tekkin-panel border border-tekkin-border text-tekkin-text hover:border-tekkin-accent transition-colors"
            >
              <span className="w-4 h-4 rounded-full bg-[#1DB954] flex items-center justify-center text-[9px] font-bold text-black">
                ♪
              </span>
              <span>Spotify</span>
            </a>
          )}

          {beatportUrl && (
            <a
              href={beatportUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tekkin-panel border border-tekkin-border text-tekkin-text hover:border-tekkin-accent transition-colors"
            >
              <span className="w-4 h-4 rounded-full bg-lime-300 flex items-center justify-center text-[9px] font-bold text-black">
                BP
              </span>
              <span>Beatport</span>
            </a>
          )}

          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tekkin-panel border border-tekkin-border text-tekkin-text hover:border-tekkin-accent transition-colors"
            >
              <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center text-[9px] font-bold text-white">
                IG
              </span>
              <span>Instagram</span>
            </a>
          )}

          {presskitUrl && (
            <a
              href={presskitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tekkin-panel border border-tekkin-border text-tekkin-text hover:border-tekkin-accent transition-colors"
            >
              <span className="w-4 h-4 rounded-full bg-tekkin-accent flex items-center justify-center text-[9px] font-bold text-black">
                PK
              </span>
              <span>Press Kit</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
