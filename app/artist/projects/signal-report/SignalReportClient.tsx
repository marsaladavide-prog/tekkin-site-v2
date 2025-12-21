"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SignalReportItem = {
  request_id: string;
  kind: "collab" | "promo";
  project_id: string;
  project_title: string;
  genre: string | null;
  overall_score: number | null;
  mix_score: number | null;
  master_score: number | null;
  bass_energy: number | null;
  has_vocals: boolean | null;
  bpm: number | null;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | null;
  created_at: string;
};

type SignalReportClientProps = {
  projectId: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettato",
  rejected: "Rifiutato",
};

export default function SignalReportClient({ projectId }: SignalReportClientProps) {
  const [items, setItems] = useState<SignalReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (projectId) {
          params.set("project_id", projectId);
        }
        const query = params.toString();
        const res = await fetch(`/api/discovery/inbox${query ? `?${query}` : ""}`, {
          credentials: "include",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Errore caricando i Signal");
        }
        const data = (await res.json()) as SignalReportItem[];
        if (res.ok) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Signal report load failed", err);
        setError(err instanceof Error ? err.message : "Errore caricando i Signal");
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [projectId]);

  const filtered = useMemo(() => {
    if (!projectId) return items;
    return items.filter((item) => item.project_id === projectId);
  }, [items, projectId]);

  const handleRespond = async (requestId: string, action: "accept" | "reject") => {
    const prevItems = items;

    // optimistic: aggiorna lo stato invece di rimuovere
    setItems((curr) => curr.map((i) => i.request_id === requestId ? { ...i, status: action === "accept" ? "accepted" : "rejected" } : i));

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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/50">Reports</p>
          <h1 className="text-2xl font-semibold text-white">Signal Report</h1>
          <p className="text-sm text-white/60">
            Tutti i Signal correlati al project: mittente, destinatario e stato della richiesta.
          </p>
        </div>
        <Link
          href="/artist/projects"
          className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Torna ai Projects
        </Link>
      </header>

      <section className="rounded-3xl border border-white/10 bg-black/60 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-[0.3em] text-white/60 uppercase">Signal activity</h2>
          <span className="text-[11px] text-white/50">Connected to discovery_requests</span>
        </div>

        {loading && <div className="text-sm text-white/60">Caricamento Signal...</div>}

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-900/60 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
            Nessun Signal disponibile per il project selezionato.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3 text-[11px] text-white/60">
            <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-3 font-semibold uppercase text-white/40 md:grid">
              <span>Project</span>
              <span>Tipo</span>
              <span className="text-center">Score</span>
              <span>Stato / Data</span>
            </div>
            <div className="space-y-3">
              {filtered.map((item) => (
                <div
                  key={item.request_id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm md:grid-cols-[2fr_1fr_1fr_1fr]"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-white">{item.project_title}</p>
                    <p className="text-[10px] text-white/60">ID project {item.project_id}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-white">
                      {item.kind === "collab" ? "Collab" : "Promo"}
                    </p>
                    <p className="text-[10px] text-white/60">Genere: {item.genre ?? "N/D"}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-semibold text-white">
                      {item.overall_score ?? "N/A"}
                    </p>
                    <p className="text-[10px] text-white/60">
                      BPM: {item.bpm ? Math.round(item.bpm) : "N/D"}
                    </p>
                  </div>
                  <div>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white">
                      {STATUS_LABELS[item.status ?? "pending"]}
                    </span>
                    <p className="mt-2 text-[10px] text-white/50">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  {item.message && (
                    <div className="md:col-span-full">
                      <p className="text-[10px] text-white/60">Messaggio</p>
                      <p className="text-sm text-white">“{item.message}”</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
