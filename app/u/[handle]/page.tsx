// app/u/[handle]/page.tsx
import { createClient } from "@/utils/supabase/server";
import type { TrackItem } from "@/lib/tracks/types";
import PublicArtistClient from "./PublicArtistClient";

export const dynamic = "force-dynamic";

export default async function UserPage({
  params,
}: {
  params: { handle: string };
}) {
  const supabase = await createClient();

  const { data: artist, error } = await supabase
    .from("artists")
    .select("id, artist_name, slug, ig_profile_picture, main_genre")
    .eq("slug", params.handle)
    .eq("is_public", true)
    .maybeSingle();

  if (error) {
    console.error(error);
  }

  if (!artist) {
    return <div>Artista non trovato</div>;
  }

  // 1B) Chiamata RPC aggiornata
  const { data: rows } = await supabase.rpc("tekkin_artist_public_tracks_v1", {
    p_slug: params.handle,
  });

  // 3C) Mappa tracce in TrackItem[]
  const items: TrackItem[] = (rows ?? []).map((row: any) => ({
    versionId: row.version_id,
    title: row.track_title ?? "Untitled",
    artistName: row.artist_name ?? null,
    coverUrl: row.cover_url ?? null,
    audioUrl: row.audio_url ?? "",
    audioPath: row.audio_path ?? null,
    likesCount: Number(row.likes_count ?? 0),
    likedByMe: Boolean(row.liked_by_me ?? false),
    // ...altri campi se servono...
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{artist.artist_name}</h1>
        <p className="text-sm text-[var(--muted)]">@{artist.slug}</p>
      </div>

      {/* Tekkin DNA card (placeholder) */}
      <div className="mb-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xs tracking-widest text-[var(--muted)]">TEKKIN DNA</div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          Qui metti fingerprint e highlights (A)
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[var(--muted)]">
          Nessuna traccia pubblica. Pubblica una versione master dal tuo workspace per apparire qui e in /charts.
        </div>
      ) : (
        <div className="space-y-2">
          <PublicArtistClient initialItems={items} />
        </div>
      )}
    </div>
  );
}
