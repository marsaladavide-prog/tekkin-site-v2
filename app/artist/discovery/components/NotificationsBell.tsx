"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function safeText(v: unknown, fallback = "n.d.") {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}
function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function Signals() {
  const [items, setItems] = useState<DiscoveryInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const respondingRef = useRef<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      setErrorMsg(null);
      setLoading(true);

      const res = await fetch("/api/discovery/inbox", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Signals inbox error:", text);
        setErrorMsg("Errore caricando i Signals.");
        return;
      }

      const data = (await res.json().catch(() => null)) as unknown;
      setItems(Array.isArray(data) ? (data as DiscoveryInboxItem[]) : []);
    } catch (err) {
      console.error("Signals inbox unexpected:", err);
      setErrorMsg("Errore inatteso caricando i Signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const handleRespond = useCallback(
    async (requestId: string, action: "accept" | "reject") => {
      // guard anti doppio click
      if (respondingRef.current) return;
      respondingRef.current = requestId;
      setRespondingId(requestId);

      const prevItems = items;

      // optimistic remove
      setItems((curr) => curr.filter((i) => i.request_id !== requestId));

      // usa id unico e aggiornalo SOLO una volta per esito
      const tId = toast.loading(action === "accept" ? "Accetto il Signal..." : "Rifiuto il Signal...");

      try {
        const res = await fetch("/api/discovery/respond", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: requestId, action }),
        });

        const data = (await res.json().catch(() => null)) as any;

        if (!res.ok) {
          // rollback UI
          setItems(prevItems);

          const msg = safeText(data?.error, "Richiesta non trovata o già gestita");
          toast.error(msg, { id: tId });
          return;
        }

        if (action === "accept") {
          const name = safeText(data?.sender?.artist_name, "Artista");
          toast.success(`Signal accettato. Identità sbloccata: ${name}`, { id: tId });
        } else {
          toast.success("Signal rifiutato", { id: tId });
        }

        // riallinea lista dal server
        void loadInbox();
      } catch (err) {
        console.error("Signals respond unexpected:", err);

        // rollback UI
        setItems(prevItems);

        toast.error("Errore inatteso gestendo il Signal.", { id: tId });
      } finally {
        respondingRef.current = null;
        setRespondingId(null);
      }
    },
    [items, loadInbox]
  );

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
          {items.map((item) => {
            const overall = safeNum(item.overall_score);
            const mix = safeNum(item.mix_score);
            const master = safeNum(item.master_score);
            const bass = safeNum(item.bass_energy);
            const bpm = safeNum(item.bpm);

            return (
              <div key={item.request_id} className="rounded-lg border bg-background p-4 text-sm space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium capitalize">
                    {item.kind === "collab" ? "Collab Signal" : "Promo Signal"}
                  </span>
                  <span className="text-xs text-muted-foreground">Genere: {safeText(item.genre)}</span>
                </div>

                <p className="text-sm text-white/80">Progetto: {safeText(item.project_title, "Project")}</p>

                <div className="text-xs text-muted-foreground">
                  Score: {overall ?? "N/A"}
                  {mix != null && <> · Mix: {mix}</>}
                  {master != null && <> · Master: {master}</>}
                  {bass != null && <> · Bass: {bass}</>}
                  {typeof item.has_vocals === "boolean" && <> · Vocals: {item.has_vocals ? "Sì" : "No"}</>}
                  {bpm != null && <> · {Math.round(bpm)} BPM</>}
                </div>

                {item.message && <p className="text-xs italic text-muted-foreground">“{item.message}”</p>}

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
            );
          })}
        </div>
      )}
    </div>
  );
}