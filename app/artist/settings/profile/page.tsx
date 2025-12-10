"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { TEKKIN_GENRES, TekkinGenreId } from "@/lib/constants/genres";

type ProfileData = {
  id: string;
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
  beatport_url?: string | null;
  beatstats_url?: string | null;
  apple_music_url?: string | null;
};

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function safeBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export default function ArtistProfileSettingsPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[] | null>(null);

  const [artistName, setArtistName] = useState("");
  const [mainGenre, setMainGenre] = useState<TekkinGenreId | "">("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bioShort, setBioShort] = useState("");
  const [openToCollab, setOpenToCollab] = useState(true);
  const [openToPromo, setOpenToPromo] = useState(true);

  const [photoUrl, setPhotoUrl] = useState("");

  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");
  const [beatportUrl, setBeatportUrl] = useState("");
  const [beatstatsUrl, setBeatstatsUrl] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      try {
        setErrorMsg(null);
        setSuccessMsg(null);
        setLoading(true);

        const res = await fetch("/api/profile/me");
        const raw = await res.json().catch(() => null) as any;

        if (!res.ok || !raw) {
          if (isActive) {
            const message = raw?.error ?? "Errore caricando il profilo.";
            setErrorMsg(message);
            setLoading(false);
          }
          return;
        }

        if (!isActive) return;

        const data = raw as ProfileData;
        setProfile(data);

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

        setPhotoUrl(safeString(data.photo_url));

        setSpotifyUrl(safeString(data.spotify_url));
        setInstagramUrl(safeString(data.instagram_url));
        setSoundcloudUrl(safeString(data.soundcloud_url));
        setBeatportUrl(safeString(data.beatport_url));
        setBeatstatsUrl(safeString(data.beatstats_url));
        setAppleMusicUrl(safeString(data.apple_music_url));

        setLoading(false);
      } catch (err) {
        console.error("Profile GET unexpected:", err);
        if (isActive) {
          setErrorMsg("Errore inatteso caricando il profilo.");
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const payload = {
        artist_name: artistName.trim() || null,
        main_genres: mainGenre ? [mainGenre] : null,
        city: city.trim() || null,
        country: country.trim() || null,
        bio_short: bioShort.trim() || null,
        open_to_collab: openToCollab,
        open_to_promo: openToPromo,
        photo_url: photoUrl.trim() || null,
        spotify_url: spotifyUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        soundcloud_url: soundcloudUrl.trim() || null,
        beatport_url: beatportUrl.trim() || null,
        beatstats_url: beatstatsUrl.trim() || null,
        apple_music_url: appleMusicUrl.trim() || null,
      };

      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await res.json().catch(() => null) as any;

      if (!res.ok || !raw) {
        console.error("Profile PUT error:", raw);
        setErrorMsg(raw?.error ?? "Errore salvando il profilo.");
        return;
      }

      const data = raw as ProfileData;
      setProfile(data);
      setSuccessMsg("Profilo aggiornato.");
    } catch (err) {
      console.error("Profile PUT unexpected:", err);
      setErrorMsg("Errore inatteso salvando il profilo.");
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
        setErrorMsg(data?.error ?? "Errore durante la scansione Spotify.");
        return;
      }

      setScanLogs(Array.isArray(data.logs) ? data.logs : []);
      setSuccessMsg("Scan Spotify completato. Profilo e metriche aggiornati.");
    } catch (err) {
      console.error("Scan Spotify unexpected", err);
      setErrorMsg("Errore inatteso durante la scansione Spotify.");
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen bg-tekkin-bg px-4 py-8 md:px-10">
        <div className="w-full max-w-3xl mx-auto text-sm text-muted-foreground">
          Caricamento profilo artista...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-tekkin-bg px-4 py-8 md:px-10">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-tekkin-foreground">
              Artist profile
            </h1>
            <p className="text-xs text-muted-foreground">
              Nome, genere, citta e link ufficiali per Tekkin Discovery e Rank.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/artist/discovery")}
            className="text-xs text-muted-foreground hover:underline"
          >
            Torna a Discovery
          </button>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-500 bg-red-950/40 border border-red-900 px-3 py-2 rounded-md">
            {errorMsg}
          </p>
        )}
        {successMsg && (
          <p className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-3 py-2 rounded-md">
            {successMsg}
          </p>
        )}

        <form
          onSubmit={handleSave}
          className="space-y-8 text-xs text-tekkin-foreground"
        >
          {/* Basic info */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Basic info
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Artist name
                </label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="Il tuo nome artista"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Main Tekkin genre
                </label>
                <select
                  value={mainGenre}
                  onChange={(e) =>
                    setMainGenre(e.target.value as TekkinGenreId | "")
                  }
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="">Seleziona un genere</option>
                  {TEKKIN_GENRES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium">Citta</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="Es. Milano"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Paese o area
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="Es. Italia, Norvegia"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium">
                Short bio
              </label>
              <textarea
                value={bioShort}
                onChange={(e) => setBioShort(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-2 text-xs min-h-[80px]"
                placeholder="Due righe che raccontano chi sei come artista."
              />
            </div>
          </section>

          {/* Availability */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Availability
            </h2>
            <div className="flex flex-col gap-2">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={openToCollab}
                  onChange={(e) => setOpenToCollab(e.target.checked)}
                  className="h-3 w-3 rounded border-border bg-background"
                />
                <span>Aperto a collab nella Tekkin Discovery</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={openToPromo}
                  onChange={(e) => setOpenToPromo(e.target.checked)}
                  className="h-3 w-3 rounded border-border bg-background"
                />
                <span>Aperto a promo da altri artisti</span>
              </label>
            </div>
          </section>

          {/* Links and profiles */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Links and profiles
            </h2>

            <p className="text-[11px] text-muted-foreground">
              Aggiungi i tuoi profili ufficiali. Spotify e Beatport serviranno
              per Tekkin Rank e per mostrare le tue top tracks.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Spotify artist URL
                </label>
                <input
                  type="url"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="https://open.spotify.com/artist/..."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Beatport artist URL
                </label>
                <input
                  type="url"
                  value={beatportUrl}
                  onChange={(e) => setBeatportUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="https://www.beatport.com/artist/..."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  SoundCloud URL
                </label>
                <input
                  type="url"
                  value={soundcloudUrl}
                  onChange={(e) => setSoundcloudUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="https://soundcloud.com/..."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="https://instagram.com/..."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Beatstats URL
                </label>
                <input
                  type="url"
                  value={beatstatsUrl}
                  onChange={(e) => setBeatstatsUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="https://beatstats.net/..."
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-medium">
                  Apple Music URL
                </label>
                <input
                  type="url"
                  value={appleMusicUrl}
                  onChange={(e) => setAppleMusicUrl(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  placeholder="https://music.apple.com/artist/..."
                />
              </div>
            </div>
          </section>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvataggio..." : "Salva profilo"}
            </button>

            <button
              type="button"
              disabled={scanning}
              onClick={handleScanFromSpotify}
              className="inline-flex items-center justify-center rounded-md border border-primary/60 px-3 py-2 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              {scanning ? "Scanning Spotify..." : "Scan da Spotify"}
            </button>
          </div>

          {scanLogs && scanLogs.length > 0 && (
            <div className="mt-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
              {scanLogs.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
