// app/artist/discovery/components/Signals.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type DiscoveryInboxItem = {
  request_id: string;
  kind: "collab" | "promo";
  project_id: string;
  project_title: string;
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
        setLoading(true);

        const res = await fetch("/api/discovery/inbox", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("Signals inbox error:", text);
          setErrorMsg("Errore caricando i Signals.");
          return;
        }

        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Signals inbox unexpected:", err);
        setErrorMsg("Errore inatteso caricando i Signals.");
      } finally {
        setLoading(false);
      }
    };

    void loadInbox();
  }, []);

  const handleRespond = async (requestId: string, action: "accept" | "reject") => {
    const prevItems = items;

    // optimistic: rimuovo subito dalla UI
    setItems((curr) => curr.filter((i) => i.request_id !== requestId));

    const tId = toast.loading(action === "accept" ? "Accetto il Signal..." : "Rifiuto il Signal...");

    try {
      setRespondingId(requestId);
      setErrorMsg(null);

      const res = await fetch("/api/discovery/respond", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, action }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // rollback UI
        setItems(prevItems);

        const msg = data?.error ?? "Errore gestendo il Signal.";
        setErrorMsg(msg);
        toast.error(msg, { id: tId });
        return;
      }

      if (action === "accept") {
        const name = data?.sender?.artist_name ?? "Artista";
        toast.success(`Signal accettato. Identità sbloccata: ${name}`, { id: tId });
      } else {
        toast.success("Signal rifiutato", { id: tId });
      }
    } catch (err) {
      console.error("Signals respond unexpected:", err);

      // rollback UI
      setItems(prevItems);

      setErrorMsg("Errore inatteso gestendo il Signal.");
      toast.error("Errore inatteso gestendo il Signal.", { id: tId });
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
                  Genere: {item.genre ?? "n.d."}
                </span>
              </div>

              <p className="text-sm text-white/80">Progetto: {item.project_title}</p>

              <div className="text-xs text-muted-foreground">
                Score: {item.overall_score ?? "N/A"}
                {item.mix_score != null && <> · Mix: {item.mix_score}</>}
                {item.master_score != null && <> · Master: {item.master_score}</>}
                {item.bass_energy != null && <> · Bass: {item.bass_energy}</>}
                {item.has_vocals != null && <> · Vocals: {item.has_vocals ? "Sì" : "No"}</>}
                {item.bpm != null && <> · {Math.round(item.bpm)} BPM</>}
              </div>

              {item.message && (
                <p className="text-xs italic text-muted-foreground">“{item.message}”</p>
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
