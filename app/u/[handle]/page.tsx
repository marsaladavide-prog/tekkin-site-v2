// app/u/[handle]/page.tsx
import { createClient } from "@/utils/supabase/server";
import TrackRow from "@/components/tracks/TrackRow";
import type { TrackItem } from "@/lib/tracks/types";

export const dynamic = "force-dynamic";

export default async function PublicArtistPage({
  params,
}: {
  params: { handle: string };
}) {
  const supabase = await createClient();
  const handle = params.handle;

  // 1) trova artista per handle
  // Non posso confermare i nomi colonna/tabella nel tuo DB: qui devi adattare.
  // Esempio comune: artists.handle oppure profiles.username
  const { data: artist } = await supabase
    .from("artists")
    .select("id, display_name, handle, avatar_url, genre")
    .eq("handle", handle)
    .maybeSingle();

  if (!artist) return <div className="p-8">Artista non trovato</div>;

  // 2) prendi tracce pubbliche Tekkin (latest version only)
  // Consiglio: farlo via RPC/VIEW dedicata per garantire "latest per project".
  const { data: rows } = await supabase
    .rpc("tekkin_artist_public_tracks_v1", { p_handle: handle });

  const items: TrackItem[] = (rows ?? []).map((r: any) => ({
    versionId: r.version_id,
    title: r.track_title ?? "Untitled",
    artistName: artist.display_name ?? null,
    coverUrl: r.cover_url ?? null,
    audioUrl: r.audio_url ?? "",
    likesCount: Number(r.likes_count ?? 0),
    likedByMe: Boolean(r.liked_by_me ?? false),
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{artist.display_name}</h1>
        <p className="text-sm text-[var(--muted)]">@{artist.handle}</p>
      </div>

      {/* Tekkin DNA card (placeholder) */}
      <div className="mb-10 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-xs tracking-widest text-[var(--muted)]">TEKKIN DNA</div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          Qui metti fingerprint e highlights (A)
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <TrackRow key={it.versionId} item={it} />
        ))}
      </div>
    </div>
  );
}
