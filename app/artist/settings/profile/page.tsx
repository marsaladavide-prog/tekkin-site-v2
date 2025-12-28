"use client";

import { FormEvent, useEffect, useState } from "react";

import ArtistSettingsHeader from "@/components/settings/ArtistSettingsHeader";
import { TEKKIN_GENRES, TekkinGenreId } from "@/lib/constants/genres";

type ProfileData = {
  artist_name: string | null;
  main_genres: string[] | null;
  city: string | null;
  country: string | null;
  bio_short: string | null;
  open_to_collab: boolean | null;
  open_to_promo: boolean | null;
  photo_url?: string | null;
  spotify_url?: string | null;
  instagram_url?: string | null;
  soundcloud_url?: string | null;
};

type ScanLog = string;

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function safeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export default function ArtistProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<ScanLog[] | null>(null);

  const [artistName, setArtistName] = useState("");
  const [mainGenre, setMainGenre] = useState<TekkinGenreId | "">("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bioShort, setBioShort] = useState("");
  const [openToCollab, setOpenToCollab] = useState(true);
  const [openToPromo, setOpenToPromo] = useState(true);

  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setErrorMsg(null);
        setLoading(true);

        const res = await fetch("/api/profile/me", { cache: "no-store", credentials: "include" });
        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload) {
          const message = payload?.error ?? "Errore caricando il profilo.";
          throw new Error(message);
        }

        if (!active) return;

        const data = payload as ProfileData;
        setArtistName(safeString(data.artist_name));
        const firstGenre =
          Array.isArray(data.main_genres) && data.main_genres.length > 0
            ? (data.main_genres[0] as TekkinGenreId)
            : "";
        setMainGenre(firstGenre);
        setCity(safeString(data.city));
        setCountry(safeString(data.country));
        setBioShort(safeString(data.bio_short));
        setOpenToCollab(safeBool(data.open_to_collab, true));
        setOpenToPromo(safeBool(data.open_to_promo, true));

        setSpotifyUrl(safeString(data.spotify_url));
        setInstagramUrl(safeString(data.instagram_url));
        setSoundcloudUrl(safeString(data.soundcloud_url));
      } catch (err) {
        console.error("Profile settings load", err);
        if (active) {
          setErrorMsg((err as Error)?.message ?? "Errore inatteso caricando il profilo.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        artist_name: artistName.trim() || null,
        main_genres: mainGenre ? [mainGenre] : null,
        city: city.trim() || null,
        country: country.trim() || null,
        bio_short: bioShort.trim() || null,
        open_to_collab: openToCollab,
        open_to_promo: openToPromo,
        spotify_url: spotifyUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        soundcloud_url: soundcloudUrl.trim() || null,
      };

      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        const msg = data?.error ?? "Errore salvando il profilo.";
        throw new Error(msg);
      }

      setSuccessMsg("Profilo aggiornato.");
    } catch (err) {
      console.error("Profile save", err);
      setErrorMsg((err as Error)?.message ?? "Errore salvando il profilo.");
    } finally {
      setSaving(false);
    }
  };

  const handleScanFromSpotify = async () => {
    if (!spotifyUrl.trim()) {
      setErrorMsg("Inserisci prima il tuo Spotify artist URL.");
      return;
    }

    try {
      setScanning(true);
      setScanLogs(null);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await fetch("/api/scan-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: spotifyUrl.trim() }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? "Errore durante la scansione Spotify.");
      }

      setScanLogs(Array.isArray(data.logs) ? data.logs : []);
      setSuccessMsg("Scan Spotify completato. Profilo aggiornato.");
    } catch (err) {
      console.error("Scan Spotify", err);
      setErrorMsg((err as Error)?.message ?? "Errore inatteso durante la scansione.");
    } finally {
      setScanning(false);
    }
  };

  const loadingState = (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
      Caricamento impostazioni profilo...
    </div>
  );

  return (
    <section className="space-y-6">
      <ArtistSettingsHeader
        title="Profilo Artista"
        description="Dati Tekkin, bio e link ufficiali per Discovery, Signals e ranking."
      />

      {loading ? (
        loadingState
      ) : (
        <form
          onSubmit={handleSave}
          className="space-y-6 rounded-3xl border border-white/10 bg-black/40 p-6 shadow-xl backdrop-blur"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">Avatar</p>
              <p className="text-sm text-white/60">
                Aggiorniamo automaticamente dal tuo profilo Supabase quando usi lo scan Spotify.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60 disabled:opacity-60"
            >
              Cambia foto (coming soon)
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">Artist name</span>
              <input
                type="text"
                value={artistName}
                onChange={(event) => setArtistName(event.target.value)}
                placeholder="Il tuo moniker Tekkin"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">
                Main Tekkin genre
              </span>
              <select
                value={mainGenre}
                onChange={(event) =>
                  setMainGenre(event.target.value as TekkinGenreId | "")
                }
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              >
                <option value="">Seleziona il genere</option>
                {TEKKIN_GENRES.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">City</span>
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Es. Milano"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">Country</span>
              <input
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Es. Italia"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-white/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">Bio breve</span>
            <textarea
              value={bioShort}
              onChange={(event) => setBioShort(event.target.value)}
              placeholder="Due righe che raccontano il tuo sound Tekkin."
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">
                Open to collab
              </span>
              <input
                type="checkbox"
                checked={openToCollab}
                onChange={(event) => setOpenToCollab(event.target.checked)}
                className="h-5 w-5 rounded border-white/20 bg-white/5"
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">
                Open to promo
              </span>
              <input
                type="checkbox"
                checked={openToPromo}
                onChange={(event) => setOpenToPromo(event.target.checked)}
                className="h-5 w-5 rounded border-white/20 bg-white/5"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">Spotify URL</span>
              <input
                type="url"
                value={spotifyUrl}
                onChange={(event) => setSpotifyUrl(event.target.value)}
                placeholder="https://open.spotify.com/artist/..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </label>

            <label className="space-y-2 text-sm text-white/60">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">
                Instagram URL
              </span>
              <input
                type="url"
                value={instagramUrl}
                onChange={(event) => setInstagramUrl(event.target.value)}
                placeholder="https://instagram.com/tuonome"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-white/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">
              SoundCloud URL
            </span>
            <input
              type="url"
              value={soundcloudUrl}
              onChange={(event) => setSoundcloudUrl(event.target.value)}
              placeholder="https://soundcloud.com/tuonome"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
            />
          </label>

          {errorMsg && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
              {successMsg}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleScanFromSpotify}
                disabled={scanning}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/80 transition hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-60"
              >
                {scanning ? "Scanning Spotify..." : "Scan da Spotify"}
              </button>
              <span className="text-[11px] text-white/50">Aggiorna foto e rank</span>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full border border-transparent bg-gradient-to-r from-cyan-400 to-emerald-400 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-black transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Salvataggio..." : "Salva profilo"}
            </button>
          </div>

          {scanLogs && scanLogs.length > 0 && (
            <div className="space-y-1 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-[11px] text-white/60">
              {scanLogs.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          )}
        </form>
      )}
    </section>
  );
}
