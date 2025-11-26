"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { ArtistSignupMetadata } from "@/types/supabase";

type Step = 1 | 2 | "loading";

type ScanArtistResponse = {
  logs?: string[];
  artist?: Partial<ArtistSignupMetadata> & {
    name?: string;
    genre?: string;
    imageUrl?: string;
    instagram?: string;
    beatport?: string;
    traxsource?: string;
    soundcloud?: string;
    songstats?: string;
    beatstatsUrl?: string;
    beatstatsCurrentPositions?: string;
    residentAdvisor?: string;
    songkick?: string;
    appleMusic?: string;
    tidal?: string;
    spotifyId?: string;
    spotifyFollowers?: number | null;
    spotifyPopularity?: number | null;
  };
};

export default function TekkinIdentitySyncPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>(1);

  // input iniziale
  const [artistLink, setArtistLink] = useState("");

  // terminale / scan
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // dati artista
  const [artistName, setArtistName] = useState("Artist");
  const [artistGenre, setArtistGenre] = useState("Minimal / Deep Tech");
  const [artistImage, setArtistImage] = useState(
    "https://ui-avatars.com/api/?name=Artist&background=050505&color=ffffff"
  );

  // piattaforme (tutte modificabili)
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [beatportUrl, setBeatportUrl] = useState("");
  const [traxsourceUrl, setTraxsourceUrl] = useState("");
  const [soundcloudUrl, setSoundcloudUrl] = useState("");
  const [songstatsUrl, setSongstatsUrl] = useState("");
  const [beatstatsUrl, setBeatstatsUrl] = useState("");
  const [residentAdvisorUrl, setResidentAdvisorUrl] = useState("");
  const [songkickUrl, setSongkickUrl] = useState("");
  const [appleMusicUrl, setAppleMusicUrl] = useState("");
  const [tidalUrl, setTidalUrl] = useState("");
  const [scannedSpotifyId, setScannedSpotifyId] = useState<string | null>(null);
  const [scannedSpotifyFollowers, setScannedSpotifyFollowers] = useState<number | null>(null);
  const [scannedSpotifyPopularity, setScannedSpotifyPopularity] = useState<number | null>(null);

  // credenziali Supabase
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // cleanup terminale
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startLogsAnimation(logs: string[], onDone: () => void) {
    setTerminalLogs([]);
    let i = 0;

    intervalRef.current = setInterval(() => {
      setTerminalLogs((prev) => {
        if (i >= logs.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(onDone, 700);
          return prev;
        }
        const next = [...prev, logs[i]];
        i += 1;
        return next;
      });
    }, 280);
  }

  async function handleScanIdentity() {
    if (!artistLink.trim()) {
      alert("Inserisci un link valido (es. profilo Spotify)");
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    setStep("loading");
    setTerminalLogs([]);
    setScannedSpotifyId(null);
    setScannedSpotifyFollowers(null);
    setScannedSpotifyPopularity(null);

    let logsFromApi: string[] | undefined;
    let artistFromApi: ScanArtistResponse["artist"] | undefined;

    try {
      const res = await fetch("/api/scan-artist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: artistLink.trim() }),
      });

      const data = (await res.json()) as ScanArtistResponse;

      if (res.ok) {
        logsFromApi = data.logs;
        artistFromApi = data.artist;
      } else {
        console.error("scan-artist error", data);
      }
    } catch (err) {
      console.error("scan-artist network error", err);
    }

    const fallbackLogs = [
      "> Connessione al gateway musicale...",
      `> URL rilevato: ${artistLink}`,
      "> Analisi ID artista e handle social...",
      "> Generazione link correlati (Instagram, Beatport, Soundcloud, ecc)...",
      "> Inizializzazione profilo artista...",
      "> IDENTITA' PREPARATA. Verifica i dati prima di procedere.",
    ];

    const logsToUse = logsFromApi && logsFromApi.length > 0 ? logsFromApi : fallbackLogs;

    startLogsAnimation(logsToUse, () => {
      const a = artistFromApi ?? {};

      const safeName = a.name && a.name.trim().length > 0 ? a.name : "Artist";
      const safeGenre =
        a.genre && a.genre.trim().length > 0 ? a.genre : "Minimal / Deep Tech";
      const safeImage =
        a.imageUrl && a.imageUrl.trim().length > 0
          ? a.imageUrl
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(
              safeName
            )}&background=050505&color=ffffff`;

      const artistSpotifyId =
        a.spotify_id ||
        a.spotifyId ||
        extractSpotifyId(artistLink.trim()) ||
        null;

      setScannedSpotifyId(artistSpotifyId);
      setScannedSpotifyFollowers(a.spotifyFollowers ?? null);
      setScannedSpotifyPopularity(a.spotifyPopularity ?? null);

      setArtistName(safeName);
      setArtistGenre(safeGenre);
      setArtistImage(safeImage);

      // persisti localmente i dati base per riutilizzarli in /artist anche se i metadata non sono ancora aggiornati
      try {
        localStorage.setItem(
          "tekkin_artist_profile",
          JSON.stringify({
            artist_name: safeName,
            artist_genre: safeGenre,
            artist_photo_url: safeImage,
            spotify_url: artistLink.trim(),
            spotify_id: artistSpotifyId,
            spotify_followers: a.spotifyFollowers ?? null,
            spotify_popularity: a.spotifyPopularity ?? null,
            instagram_url: a.instagram ?? "",
            beatport_url: a.beatport ?? "",
            traxsource_url: a.traxsource ?? "",
            soundcloud_url: a.soundcloud ?? "",
            songstats_url: a.songstats ?? "",
            beatstats_url: a.beatstatsUrl ?? "",
            resident_advisor_url: a.residentAdvisor ?? "",
            songkick_url: a.songkick ?? "",
            apple_music_url: a.appleMusic ?? "",
            tidal_url: a.tidal ?? "",
             // QUI: lista brani / release presa dallo scan Spotify
            spotify_releases: a.spotifyReleases ?? [],
          })
        );
      } catch {
        // ignore storage errors (es. Safari private)
      }

      setSpotifyUrl(artistLink.trim());
      setInstagramUrl(a.instagram ?? "");
      setBeatportUrl(a.beatport ?? "");
      setTraxsourceUrl(a.traxsource ?? "");
      setSoundcloudUrl(a.soundcloud ?? "");
      setSongstatsUrl(a.songstats ?? "");
      setBeatstatsUrl(a.beatstatsUrl ?? "");
      setResidentAdvisorUrl(a.residentAdvisor ?? "");
      setSongkickUrl(a.songkick ?? "");
      setAppleMusicUrl(a.appleMusic ?? "");
      setTidalUrl(a.tidal ?? "");

      setStep(2);
    });
  }
function extractSpotifyId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/artist\/([A-Za-z0-9]+)(\?|$)/);
  return m ? m[1] : null;
}
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!email || !password) {
      setSubmitError("Inserisci email e password.");
      return;
    }

    const spotifyUrlTrimmed = spotifyUrl.trim();
    const artistSpotifyIdDerived =
      scannedSpotifyId || extractSpotifyId(spotifyUrlTrimmed) || null;

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            artist_name: artistName,
            artist_genre: artistGenre,
            artist_link_source: artistLink.trim(),
            artist_image_url: artistImage,
            artist_photo_url: artistImage,
            spotify_url: spotifyUrlTrimmed,
            spotify_id: artistSpotifyIdDerived,
            spotify_followers: scannedSpotifyFollowers,
            spotify_popularity: scannedSpotifyPopularity,
            instagram_url: instagramUrl,
            beatport_url: beatportUrl,
            traxsource_url: traxsourceUrl,
            soundcloud_url: soundcloudUrl,
            songstats_url: songstatsUrl,
            beatstats_url: beatstatsUrl,
            resident_advisor_url: residentAdvisorUrl,
            songkick_url: songkickUrl,
            apple_music_url: appleMusicUrl,
            tidal_url: tidalUrl,
          },
        },
      });

      if (error) {
        console.error("Signup error:", error);
        setSubmitError(error.message || "Errore registrazione Tekkin.");
        setIsSubmitting(false);
        return;
      }

      try {
        await fetch("/api/profile/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (ensureErr) {
        console.warn("ensure profile failed", ensureErr);
      }

      router.push("/artist");
    } catch (err: any) {
      console.error(err);
      setSubmitError("Errore inatteso durante la registrazione.");
      setIsSubmitting(false);
    }
  }

  const isLoading = step === "loading";

  return (
    <div className="bg-tekkin-bg text-gray-300 font-sans min-h-screen flex flex-col overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-[0.03] pointer-events-none z-0" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-tekkin-bg/80 to-tekkin-bg pointer-events-none z-0" />

      {/* Header */}
      <header className="relative z-20 p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-tekkin-primary rounded flex items-center justify-center font-bold text-black font-mono text-xl">
            T
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-tekkin-primary uppercase tracking-[0.2em] font-mono">
              System Access
            </span>
            <h1 className="text-lg font-bold text-white tracking-tight">
              MENTORING <span className="font-light">PRO</span>
            </h1>
          </div>
        </div>
        <div className="text-xs font-mono text-gray-500 flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          SERVER: ONLINE
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* LEFT: Hero Text */}
          <div className="hidden lg:block space-y-8">
            <div className="glitch-wrapper">
              <h1
                className="text-6xl font-black text-white leading-none glitch"
                data-text="IDENTITY_SYNC"
              >
                IDENTITY
                <br />
                _SYNC
              </h1>
            </div>
            <p className="text-gray-400 text-lg leading-relaxed border-l-2 border-tekkin-primary pl-6">
              Benvenuto nel protocollo Tekkin.
              <br />
              Il nostro sistema analizza la tua impronta digitale musicale per
              creare il tuo piano di mentoring personalizzato.
            </p>
            <div className="grid grid-cols-2 gap-4 font-mono text-xs text-gray-500">
              <div className="p-4 border border-tekkin-border bg-tekkin-card/50 rounded">
                &gt; ANALISI BEATPORT
                <br />
                <span className="text-tekkin-primary">READY</span>
              </div>
              <div className="p-4 border border-tekkin-border bg-tekkin-card/50 rounded">
                &gt; TRACKSTACK CONNECT
                <br />
                <span className="text-tekkin-primary">READY</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Card */}
          <div className="relative">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-tekkin-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl" />

            <div
              className="bg-tekkin-card border border-tekkin-border rounded-xl overflow-hidden shadow-2xl relative group"
              id="main-card"
            >
              {/* Scan line */}
              <div
                className={`scan-line z-50 pointer-events-none ${
                  isLoading ? "" : "hidden"
                }`}
              />

              {/* STEP 1 */}
              {step === 1 && (
                <div
                  id="step-1"
                  className="p-8 space-y-6 relative z-10 transition-all duration-500"
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">
                      1. Riconoscimento Artista
                    </h2>
                    <span className="font-mono text-xs text-gray-500">
                      01/02
                    </span>
                  </div>

                  <p className="text-sm text-gray-400">
                    Incolla il link di un tuo profilo (Spotify, Soundcloud o
                    Beatport). Il sistema Tekkin proverà a preparare gli altri
                    link, che potrai sempre modificare.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-mono text-tekkin-primary uppercase">
                      Source Link
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-gray-500">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={artistLink}
                        onChange={(e) => setArtistLink(e.target.value)}
                        placeholder="es. https://open.spotify.com/artist/..."
                        className="w-full bg-black/50 border border-tekkin-border text-white font-mono focus:border-tekkin-primary focus:ring-1 focus:ring-tekkin-primary focus:outline-none transition-all py-3 pl-12 pr-4 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleScanIdentity}
                    className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-tekkin-primary hover:text-white transition-all duration-300 relative overflow-hidden group"
                  >
                    <span className="relative z-10 flex itemsCenter justify-center gap-2">
                      AVVIA SCANSIONE
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </span>
                  </button>
                </div>
              )}

              {/* TERMINAL LOADER */}
              {isLoading && (
                <div
                  id="terminal-loader"
                  className="p-8 h-[300px] bg-black font-mono text-xs text-green-500 flex flex-col justify-end pb-4"
                >
                  <div id="terminal-text" className="space-y-1">
                    {terminalLogs.map((log, idx) => {
                      const isSuccess = log.includes("SUCCESS");
                      const isIdentity = log.includes("IDENTITA");
                      return (
                        <p
                          key={idx}
                          className={
                            isIdentity
                              ? "text-white font-bold blink"
                              : isSuccess
                              ? "text-tekkin-primary"
                              : ""
                          }
                        >
                          {log}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div id="step-2" className="relative">
                  {/* Header artista */}
                  <div className="bg-black/40 p-6 border-b border-tekkin-border flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-tekkin-primary">
                      <img
                        id="artist-img"
                        src={artistImage}
                        alt="Artist"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-tekkin-primary/20" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3
                          id="artist-name"
                          className="text-xl font-bold text-white"
                        >
                          {artistName}
                        </h3>
                        <span className="px-1.5 py-0.5 bg-tekkin-primary/20 text-tekkin-primary text-[10px] font-mono rounded border border-tekkin-primary/50">
                          VERIFIED
                        </span>
                      </div>
                      <p
                        id="artist-genre"
                        className="text-sm text-gray-400 font-mono"
                      >
                        {artistGenre}
                      </p>
                    </div>
                  </div>

                  <form
                    className="p-8 space-y-6"
                    onSubmit={handleSignup}
                    autoComplete="off"
                  >
                    {/* Piattaforme rilevate */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-mono text-gray-500 uppercase">
                          Piattaforme Rilevate
                        </label>
                        <span className="text-[10px] text-tekkin-primary">
                          Puoi modificarle liberamente
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        {/* Spotify */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1DB954] text-[10px] font-bold text-black">
                            SP
                          </div>
                          <input
                            type="text"
                            value={spotifyUrl}
                            onChange={(e) => setSpotifyUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://open.spotify.com/artist/..."
                          />
                          <span className="text-green-500 text-xs">✓</span>
                        </div>

                        {/* Instagram */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <svg
                            className="text-pink-500 shrink-0"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect
                              x="2"
                              y="2"
                              width="20"
                              height="20"
                              rx="5"
                              ry="5"
                            />
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                          </svg>
                          <input
                            type="text"
                            value={instagramUrl}
                            onChange={(e) => setInstagramUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://instagram.com/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Beatport */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <svg
                            className="text-tekkin-primary shrink-0"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="10 8 16 12 10 16 10 8" />
                          </svg>
                          <input
                            type="text"
                            value={beatportUrl}
                            onChange={(e) => setBeatportUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://www.beatport.com/artist/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Traxsource */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-black">
                            TS
                          </div>
                          <input
                            type="text"
                            value={traxsourceUrl}
                            onChange={(e) => setTraxsourceUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://www.traxsource.com/artist/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Soundcloud */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <svg
                            className="text-orange-500 shrink-0"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M17.5 19c0-1.7-1.3-3-3-3h-11c-1.7 0-3 1.3-3 3s1.3 3 3 3h11c1.7 0 3-1.3 3-3z" />
                            <path d="M17.5 16V8.5c0-2.5-2-4.5-4.5-4.5-1.2 0-2.3.5-3.2 1.3C9.3 5.1 8.7 5 8 5c-2.2 0-4 1.8-4 4v7" />
                          </svg>
                          <input
                            type="text"
                            value={soundcloudUrl}
                            onChange={(e) => setSoundcloudUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://soundcloud.com/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Songstats */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
                            SS
                          </div>
                          <input
                            type="text"
                            value={songstatsUrl}
                            onChange={(e) => setSongstatsUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://app.songstats.com/artist/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Beatstats */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-black">
                            BS
                          </div>
                          <input
                            type="text"
                            value={beatstatsUrl}
                            onChange={(e) => setBeatstatsUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://www.beatstats.com/artist/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Resident Advisor */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black">
                            RA
                          </div>
                          <input
                            type="text"
                            value={residentAdvisorUrl}
                            onChange={(e) =>
                              setResidentAdvisorUrl(e.target.value)
                            }
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://ra.co/dj/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Songkick */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-bold text-black">
                            SK
                          </div>
                          <input
                            type="text"
                            value={songkickUrl}
                            onChange={(e) => setSongkickUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://www.songkick.com/artists/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Apple Music */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-black">
                            AM
                          </div>
                          <input
                            type="text"
                            value={appleMusicUrl}
                            onChange={(e) => setAppleMusicUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://music.apple.com/artist/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>

                        {/* Tidal */}
                        <div className="flex items-center gap-3 p-2 rounded border border-tekkin-border bg-black/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-black">
                            TI
                          </div>
                          <input
                            type="text"
                            value={tidalUrl}
                            onChange={(e) => setTidalUrl(e.target.value)}
                            className="bg-transparent text-sm text-gray-300 w-full focus:outline-none font-mono"
                            placeholder="https://listen.tidal.com/artist/..."
                          />
                          <span className="text-xs text-zinc-500">auto</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-tekkin-border w-full my-6" />

                    {/* Supabase credentials */}
                    <div className="space-y-4">
                      <label className="text-xs font-mono text-white uppercase">
                        Crea Accesso Tekkin
                      </label>
                      <div className="grid grid-cols-1 gap-4">
                        <input
                          type="email"
                          placeholder="Email Personale"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-black/50 border border-tekkin-border text-white font-mono focus:border-tekkin-primary focus:ring-1 focus:ring-tekkin-primary focus:outline-none transition-all py-3 px-4 rounded-lg"
                        />
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="Password Sicura"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-tekkin-border text-white font-mono focus:border-tekkin-primary focus:ring-1 focus:ring-tekkin-primary focus:outline-none transition-all py-3 px-4 rounded-lg"
                          />
                          <span className="absolute right-4 top-3.5 text-xs text-gray-500 font-mono">
                            MIN 8 CHARS
                          </span>
                        </div>
                      </div>
                    </div>

                    {submitError && (
                      <p className="text-xs text-red-500">{submitError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 bg-tekkin-primary text-black font-bold rounded-lg hover:bg-tekkin-accent transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting
                        ? "Inizializzazione in corso..."
                        : "INIZIALIZZA PROFILO PRO"}
                    </button>

                    <p className="text-center text-[10px] text-gray-500 mt-4">
                      Cliccando accetti i T&amp;C del protocollo Tekkin.
                      <br />
                      I dati verranno sincronizzati nel database Supabase.
                    </p>
                  </form>
                </div>
              )}
            </div>

            {/* Floating badge */}
            <div className="absolute -right-4 top-20 bg-tekkin-bg border border-tekkin-border p-3 rounded-lg shadow-xl hidden lg:block transform rotate-3">
              <div className="text-[10px] font-mono text-gray-400">
                TEKKIN AGENT
              </div>
              <div className="text-xs text-tekkin-primary font-bold">
                Monitoring Active
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CSS extra per glitch / scan / blink */}
      <style jsx global>{`
        .scan-line {
          width: 100%;
          height: 2px;
          background: #06b6d4;
          box-shadow: 0 0 10px #06b6d4;
          position: absolute;
          top: 0;
          left: 0;
          animation: scan 2.5s linear infinite;
          opacity: 0.5;
        }
        @keyframes scan {
          0% {
            top: 0%;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0;
          }
        }
        .glitch-wrapper {
          position: relative;
        }
        .glitch::before,
        .glitch::after {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .glitch::before {
          left: 2px;
          text-shadow: -1px 0 #ff00c1;
          clip: rect(44px, 450px, 56px, 0);
          animation: glitch-anim 5s infinite linear alternate-reverse;
        }
        .glitch::after {
          left: -2px;
          text-shadow: -1px 0 #00fff9;
          clip: rect(44px, 450px, 56px, 0);
          animation: glitch-anim2 5s infinite linear alternate-reverse;
        }
        @keyframes glitch-anim {
          0% {
            clip: rect(34px, 9999px, 11px, 0);
          }
          20% {
            clip: rect(26px, 9999px, 82px, 0);
          }
          40% {
            clip: rect(54px, 9999px, 47px, 0);
          }
          60% {
            clip: rect(12px, 9999px, 36px, 0);
          }
          80% {
            clip: rect(9px, 9999px, 72px, 0);
          }
          100% {
            clip: rect(67px, 9999px, 14px, 0);
          }
        }
        @keyframes glitch-anim2 {
          0% {
            clip: rect(2px, 9999px, 81px, 0);
          }
          20% {
            clip: rect(65px, 9999px, 12px, 0);
          }
          40% {
            clip: rect(14px, 9999px, 33px, 0);
          }
          60% {
            clip: rect(12px, 9999px, 96px, 0);
          }
          80% {
            clip: rect(39px, 9999px, 42px, 0);
          }
          100% {
            clip: rect(17px, 9999px, 94px, 0);
          }
        }
        .blink {
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
