"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const TEKKIN_GENRES = [
  "house",
  "deep_house",
  "funky_house",
  "soulful_house",
  "jackin_house",
  "progressive_house",
  "afro_house",
  "organic_house",
  "piano_house",
  "tech_house",
  "peak_time_tech_house",
  "bass_house",
  "tribal_tech_house",
  "minimal_deep_tech",
  "minimal_house",
  "micro_house",
  "minimal_techno",
] as const;

function formatGenreLabel(value: string) {
  const pretty = value.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

type ProfileData = {
  id: string;
  artist_name: string | null;
  main_genres: string[] | null;
  city: string | null;
  country: string | null;
  bio_short: string | null;
  open_to_collab: boolean | null;
  open_to_promo: boolean | null;
};

export default function ArtistProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [artistName, setArtistName] = useState("");
  const [mainGenre, setMainGenre] = useState<string>("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bioShort, setBioShort] = useState("");
  const [openToCollab, setOpenToCollab] = useState(true);
  const [openToPromo, setOpenToPromo] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setErrorMsg(null);
        const res = await fetch("/api/profile/me");
        const data = await res.json();

        if (!res.ok) {
          console.error("Profile GET error:", data);
          setErrorMsg(data?.error ?? "Errore caricando il profilo.");
          return;
        }

        // data è direttamente il record del profilo
        setProfile(data);
        setArtistName(data.artist_name ?? "");
        setMainGenre(data.main_genres?.[0] ?? "");
        setCity(data.city ?? "");
        setCountry(data.country ?? "");
        setBioShort(data.bio_short ?? "");
        setOpenToCollab(
          typeof data.open_to_collab === "boolean"
            ? data.open_to_collab
            : true
        );
        setOpenToPromo(
          typeof data.open_to_promo === "boolean"
            ? data.open_to_promo
            : true
        );
      } catch (err) {
        console.error("Profile GET unexpected:", err);
        setErrorMsg("Errore inatteso caricando il profilo.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
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
      };

      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Profile PUT error:", data);
        setErrorMsg(
          data?.error ??
            data?.detail ??
            "Errore salvando il profilo."
        );
        return;
      }

      // Il backend restituisce il profilo aggiornato
      setProfile(data);
      setSuccessMsg("Profilo aggiornato.");
    } catch (err) {
      console.error("Profile PUT unexpected:", err);
      setErrorMsg("Errore inatteso salvando il profilo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Caricamento profilo...
        </p>
      </div>
    );
  }

  if (errorMsg && !profile) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm text-red-500">{errorMsg}</p>
        <button
          type="button"
          onClick={() => router.push("/artist/discovery")}
          className="text-xs text-muted-foreground hover:underline"
        >
          Torna a Discovery
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Profilo artista</h1>
        <button
          type="button"
          onClick={() => router.push("/artist/discovery")}
          className="text-xs text-muted-foreground hover:underline"
        >
          Torna a Discovery
        </button>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}
      {successMsg && (
        <p className="text-sm text-emerald-500">{successMsg}</p>
      )}

      <form onSubmit={handleSave} className="space-y-4 text-sm">
        <div className="space-y-1">
          <label className="block text-xs font-medium">
            Artist name
          </label>
          <input
            type="text"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1"
            placeholder="Il tuo nome artista"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium">
            Genere principale
          </label>
          <select
            value={mainGenre}
            onChange={(e) => setMainGenre(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1"
          >
            <option value="">Seleziona un genere</option>
            {TEKKIN_GENRES.map((g) => (
              <option key={g} value={g}>
                {formatGenreLabel(g)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">
            Poi lo estendiamo a più generi, per ora teniamo la
            struttura semplice.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium">Città</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1"
              placeholder="Es. Bari"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="block text-xs font-medium">Paese</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1"
              placeholder="Es. IT"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium">Bio corta</label>
          <textarea
            value={bioShort}
            onChange={(e) => setBioShort(e.target.value)}
            rows={3}
            className="w-full rounded-md border bg-background px-2 py-1"
            placeholder="Massimo 2 o 3 righe su di te."
          />
        </div>

        <div className="flex flex-col gap-1 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={openToCollab}
              onChange={(e) => setOpenToCollab(e.target.checked)}
            />
            <span>Aperto a collaborazioni</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={openToPromo}
              onChange={(e) => setOpenToPromo(e.target.checked)}
            />
            <span>Aperto a promo</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Salvataggio..." : "Salva profilo"}
        </button>
      </form>
    </div>
  );
}
