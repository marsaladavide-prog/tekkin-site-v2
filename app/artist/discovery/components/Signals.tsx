// app/artist/discovery/components/Signals.tsx
"use client";

import { useEffect, useState } from "react";

type DiscoveryInboxItem = {
  request_id: string;
  kind: "collab" | "promo";
  project_id: string;
  genre: string;
  overall_score: number | null;
  mix_score: number | null;
  master_score: number | null;
  bass_energy: number | null;
  has_vocals: boolean | null;
  bpm: number | null;
  message: string | null;
};

export function Signals() {
  const [items, setItems] = useState<DiscoveryInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    const loadInbox = async () => {
      try {
        setErrorMsg(null);
        const res = await fetch("/api/discovery/inbox");
        if (!res.ok) {
          const text = await res.text();
          console.error("Signals inbox error:", text);
          setErrorMsg("Errore caricando i Signals.");
          return;
        }
        const data = await res.json();
        setItems(data);
      } catch (err) {
        console.error("Signals inbox unexpected:", err);
        setErrorMsg("Errore inatteso caricando i Signals.");
      } finally {
        setLoading(false);
      }
    };

    loadInbox();
  }, []);

  const handleRespond = async (requestId: string, action: "accept" | "reject") => {
    try {
      setRespondingId(requestId);
      setErrorMsg(null);

      const res = await fetch("/api/discovery/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, action }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Signals respond error:", data ?? "no body");
        setErrorMsg(data?.error ?? "Errore gestendo il Signal.");
        return;
      }

      setItems((prev) => prev.filter((i) => i.request_id !== requestId));

      if (action === "accept") {
        console.log("Signal accepted, sender revealed:", data?.sender);
        // Per ora alert semplice, poi lo sostituisci con un toast Tekkin style
        alert("Signal accettato. Identità artista sbloccata (vedi console).");
      }
    } catch (err) {
      console.error("Signals respond unexpected:", err);
      setErrorMsg("Errore inatteso gestendo il Signal.");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Signals</h2>
        <p className="text-xs text-muted-foreground">
          Richieste anonime di collab e promo che arrivano al tuo profilo.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Caricamento Signals...</p>}

      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

      {!loading && items.length === 0 && !errorMsg && (
        <p className="text-sm text-muted-foreground">Nessun Signal al momento.</p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.request_id}
              className="rounded-lg border bg-background p-4 text-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">
                  {item.kind === "collab" ? "Collab Signal" : "Promo Signal"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Genere: {item.genre}
                </span>
              </div>

              <div className="text-xs text-muted-foreground">
                Score: {item.overall_score ?? "N/A"}
                {item.mix_score != null && <> · Mix: {item.mix_score}</>}
                {item.master_score != null && <> · Master: {item.master_score}</>}
                {item.bass_energy != null && <> · Bass: {item.bass_energy}</>}
                {item.has_vocals != null && (
                  <> · Vocals: {item.has_vocals ? "Sì" : "No"}</>
                )}
                {item.bpm != null && <> · {Math.round(item.bpm)} BPM</>}
              </div>

              {item.message && (
                <p className="text-xs italic text-muted-foreground">
                  “{item.message}”
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleRespond(item.request_id, "accept")}
                  disabled={respondingId === item.request_id}
                  className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {respondingId === item.request_id ? "Accetto..." : "Accetta"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRespond(item.request_id, "reject")}
                  disabled={respondingId === item.request_id}
                  className="inline-flex items-center justify-center rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {respondingId === item.request_id ? "Rifiuto..." : "Rifiuta"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
