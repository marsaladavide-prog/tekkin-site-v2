// app/artist/discovery/components/Scanner.tsx
"use client";

import { useEffect, useState } from "react";

type ScannerTrack = {
  id: string;
  owner_id: string;
  project_id: string;
  genre: string;
  overall_score: number | null;
  master_score: number | null;
  bass_energy: number | null;
  has_vocals: boolean | null;
  bpm: number | null;
};

export function Scanner() {
  const [tracks, setTracks] = useState<ScannerTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [genreFilter, setGenreFilter] = useState("");
  const [minScore, setMinScore] = useState<string>("");
  const [vocals, setVocals] = useState<"" | "with" | "without">("");
  const [bpmFrom, setBpmFrom] = useState<string>("");
  const [bpmTo, setBpmTo] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();

        if (genreFilter) params.set("genre", genreFilter);
        if (minScore) params.set("min_score", minScore);
        if (vocals) params.set("vocals", vocals);
        if (bpmFrom) params.set("bpm_from", bpmFrom);
        if (bpmTo) params.set("bpm_to", bpmTo);

        const res = await fetch(`/api/scanner/tracks?${params.toString()}`);
        const data = await res.json();
        setTracks(data);
      } catch (err) {
        console.error("Scanner load error", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [genreFilter, minScore, vocals, bpmFrom, bpmTo]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Scanner</h2>
        <p className="text-xs text-muted-foreground">
          Tracce abilitate a Discovery filtrabili per score, BPM, vocals ed energia.
        </p>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <input
          type="text"
          placeholder="Genere"
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="w-full max-w-[180px] rounded-md border bg-background px-2 py-1"
        />
        <input
          type="number"
          placeholder="Min score"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          className="w-full max-w-[100px] rounded-md border bg-background px-2 py-1"
        />
        <select
          value={vocals}
          onChange={(e) => setVocals(e.target.value as any)}
          className="w-full max-w-[140px] rounded-md border bg-background px-2 py-1"
        >
          <option value="">Vocals: tutti</option>
          <option value="with">Solo con vocals</option>
          <option value="without">Solo senza vocals</option>
        </select>
        <input
          type="number"
          placeholder="BPM da"
          value={bpmFrom}
          onChange={(e) => setBpmFrom(e.target.value)}
          className="w-full max-w-[90px] rounded-md border bg-background px-2 py-1"
        />
        <input
          type="number"
          placeholder="BPM a"
          value={bpmTo}
          onChange={(e) => setBpmTo(e.target.value)}
          className="w-full max-w-[90px] rounded-md border bg-background px-2 py-1"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Scan in corso...</p>}

      {!loading && tracks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nessuna traccia trovata con questi filtri.
        </p>
      )}

      {!loading && tracks.length > 0 && (
        <div className="space-y-3">
          {tracks.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border bg-background p-4 text-sm space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-muted-foreground">
                  Project: {t.project_id.slice(0, 8)}...
                </span>
                <span className="text-[10px] uppercase text-muted-foreground">
                  {t.genre}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t.master_score != null && <> · Master: {t.master_score}</>}
                {t.bass_energy != null && <> · Bass: {t.bass_energy}</>}
                {t.has_vocals != null && (
                  <> · Vocals: {t.has_vocals ? "Sì" : "No"}</>
                )}
                {t.bpm != null && <> · {Math.round(t.bpm)} BPM</>}
              </div>
              {/* Qui più avanti: pulsante "Invia Signal" a un artista specifico */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
