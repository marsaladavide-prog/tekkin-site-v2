"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type Artist = {
  id: string;
  artist_name: string;
  spotify_url?: string | null;
  beatstats_url?: string | null;
  beatport_url?: string | null;
  instagram_url?: string | null;
  soundcloud_url?: string | null;
  traxsource_url?: string | null;
  songstats_url?: string | null;
  resident_advisor_url?: string | null;
  songkick_url?: string | null;
  apple_music_url?: string | null;
  tidal_url?: string | null;
};

export default function ArtistAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [artist, setArtist] = useState<Artist | null>(null);

  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [beatstatsUrl, setBeatstatsUrl] = useState("");
  const [beatportUrl, setBeatportUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");
  const [otherLinksOpen, setOtherLinksOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function loadArtist() {
      try {
        setLoading(true);
        setErrorMsg(null);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setNeedsLogin(true);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("artists")
          .select("*")
          .eq("user_id", user.id)
          .single<Artist>();

        if (error) {
          console.warn("Artist account - no artist row", error);
          setErrorMsg("Non trovo il tuo profilo artist nella tabella. Completa prima la registrazione da Tekkin Artist.");
          setLoading(false);
          return;
        }

        setArtist(data);

        setSpotifyUrl(data.spotify_url ?? "");
        setBeatstatsUrl(data.beatstats_url ?? "");
        setBeatportUrl(data.beatport_url ?? "");
        setInstagramUrl(data.instagram_url ?? "");
        setSoundcloudUrl(data.soundcloud_url ?? "");

        setLoading(false);
      } catch (err) {
        console.error("ArtistAccount load error", err);
        setErrorMsg("Errore nel caricamento del profilo artist. Riprova piu tardi.");
        setLoading(false);
      }
    }

    loadArtist();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!artist) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("artists")
        .update({
          spotify_url: spotifyUrl.trim() || null,
          beatstats_url: beatstatsUrl.trim() || null,
          beatport_url: beatportUrl.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          soundcloud_url: soundcloudUrl.trim() || null,
        })
        .eq("id", artist.id);

      if (error) {
        console.error("ArtistAccount save error", error);
        setErrorMsg("Salvataggio non riuscito. Controlla i link o riprova.");
        return;
      }

      setSuccessMsg("Collegamenti aggiornati. La dashboard usera questi link alla prossima lettura.");
    } catch (err) {
      console.error("ArtistAccount save exception", err);
      setErrorMsg("Errore imprevisto durante il salvataggio.");
    } finally {
      setSaving(false);
    }
  }

  if (needsLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar-bg)]/95 px-6 py-5 text-center shadow-xl backdrop-blur-xl">
          <p className="text-sm font-semibold">Serve il login Tekkin Artist</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Per gestire i collegamenti del tuo profilo devi accedere al tuo account.
          </p>
          <div className="mt-4 flex justify-center gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 font-medium text-black hover:opacity-90"
            >
              Vai al login
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-[var(--border)] px-4 py-1.5 font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Crea un profilo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Carico il tuo profilo artist...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-[0.04]" />
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 -left-10 h-56 w-56 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-emerald-300">
              Tekkin Artist - Account
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              Collegamenti profilo Artist
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Questi link vengono usati dalla dashboard Tekkin Artist, da Tekkin Rank e dai moduli
              di analisi. Puoi aggiornarli in qualsiasi momento.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/artist")}
            className="mt-2 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-black/40 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] sm:mt-0"
          >
            Torna alla dashboard
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar-bg)]/95 p-5 shadow-xl backdrop-blur-xl space-y-5"
        >
          <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Canali principali
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Inserisci le URL complete. Esempio:{" "}
              <span className="font-mono text-[11px]">
                https://www.beatstats.net/artist/tuo-nome
              </span>
            </p>
          </div>

          {/* Spotify */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Spotify artist URL
            </label>
            <input
              type="url"
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              placeholder="https://open.spotify.com/artist/..."
              className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Usato per Tekkin Rank, follower e main releases (insieme allo scan automatico).
            </p>
          </div>

          {/* Beatstats */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Beatstats URL
            </label>
            <input
              type="url"
              value={beatstatsUrl}
              onChange={(e) => setBeatstatsUrl(e.target.value)}
              placeholder="https://beatstats.net/artist/..."
              className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Questo link viene usato dal modulo Beatstats per recuperare charts e posizionamenti.
            </p>
          </div>

          {/* Beatport */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Beatport artist URL
            </label>
            <input
              type="url"
              value={beatportUrl}
              onChange={(e) => setBeatportUrl(e.target.value)}
              placeholder="https://www.beatport.com/artist/..."
              className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Per ora usato solo come link informativo nella dashboard. In futuro puo alimentare altre analisi.
            </p>
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Instagram URL
            </label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://www.instagram.com/tuonome"
              className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              Se colleghi anche Instagram via OAuth, questo link rimane come riferimento pubblico.
            </p>
          </div>

          {/* SoundCloud */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              SoundCloud URL
            </label>
            <input
              type="url"
              value={soundcloudUrl}
              onChange={(e) => setSoundcloudUrl(e.target.value)}
              placeholder="https://soundcloud.com/tuonome"
              className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
            />
          </div>

          {/* Altri link - collapsible */}
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-black/40 p-3">
            <button
              type="button"
              onClick={() => setOtherLinksOpen((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-medium text-[var(--text-muted)]"
            >
              <span>Altri collegamenti (Traxsource, Songstats, RA, ecc)</span>
              <span className="text-[var(--accent)]">
                {otherLinksOpen ? "Chiudi" : "Apri"}
              </span>
            </button>

            {otherLinksOpen && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Per ora questi li teniamo come placeholder. Possiamo aggiungere i campi reali quando definiamo
                  la logica definitiva di Tekkin Rank su queste piattaforme.
                </p>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {successMsg}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 text-xs text-[var(--text-muted)]">
            <span>Queste info alimentano solo la tua Tekkin dashboard.</span>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-black shadow-lg shadow-[var(--accent)]/40 transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Salvo..." : "Salva collegamenti"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
