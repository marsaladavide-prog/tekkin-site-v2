"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SignalReportItem = {
  request_id: string;
  kind: "collab" | "promo";
  project_id: string;
  project_title: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string | null;
  updated_at: string | null;
  revealed_at: string | null;
  receiver: { id: string; artist_name: string | null; avatar_url: string | null };
};

type SignalReportClientProps = {
  projectId: string | null;
};

const STATUS_LABELS: Record<SignalReportItem["status"], string> = {
  pending: "In attesa",
  accepted: "Accettato",
  rejected: "Rifiutato",
};

function formatDateLabel(iso: string | null): string {
  if (!iso) return "N/D";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "N/D";
  return d.toLocaleString();
}

export default function SignalReportClient({ projectId }: SignalReportClientProps) {
  const [items, setItems] = useState<SignalReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      if (!projectId) {
        setItems([]);
        setLoading(false);
        setError("project_id mancante");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/discovery/report?project_id=${encodeURIComponent(projectId)}`,
          {
            credentials: "include",
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "Errore caricando i Signal");
        }

        const data = (await res.json()) as unknown;
        setItems(Array.isArray(data) ? (data as SignalReportItem[]) : []);
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
    // L'endpoint già filtra per project_id, ma teniamolo safe
    if (!projectId) return items;
    return items.filter((item) => item.project_id === projectId);
  }, [items, projectId]);

 return (
  <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.4em] text-white/45">Reports</p>
        <h1 className="text-3xl font-semibold text-white">Signal Report</h1>
        <p className="max-w-[680px] text-sm text-white/60">
          Stato reale delle richieste anonime collegate a questo project.
        </p>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-80" />
          <span>Connected to discovery_requests</span>
        </div>
      </div>

      <Link
        href="/artist/projects"
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        Torna ai Projects
      </Link>
    </header>

    <div className="mt-8 rounded-3xl border border-white/10 bg-black/60 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold tracking-[0.3em] text-white/60 uppercase">Signal activity</h2>
          <p className="text-[12px] text-white/50">
            {projectId ? `Project ID: ${projectId}` : "Project ID mancante"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
            Totale: {filtered.length}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
            Pending: {filtered.filter((x) => x.status === "pending").length}
          </span>
        </div>
      </div>

      <div className="mt-5">
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
            Caricamento Signal...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-900/30 p-5 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 p-8 text-center">
            <p className="text-sm font-semibold text-white/80">Nessun Signal trovato</p>
            <p className="mt-2 text-[12px] text-white/55">
              Invia un Signal da Projects, poi torna qui per vedere lo stato.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="mt-4 space-y-3">
            {filtered.map((item) => {
              const receiverName = item.receiver?.artist_name ?? "N/D";
              const createdLabel = formatDateLabel(item.created_at);

              const status = item.status ?? "pending";
              const statusLabel = STATUS_LABELS[status];
              const statusTone =
                status === "accepted"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : status === "rejected"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-white/15 bg-white/5 text-white/80";

              const kindLabel = item.kind === "collab" ? "Collab" : "Promo";
              const kindTone =
                item.kind === "collab"
                  ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
                  : "border-violet-400/25 bg-violet-400/10 text-violet-100";

              const stepSent = true;
              const stepSeen = !!item.updated_at; // non posso confermare che updated_at significhi "visto", lo uso come proxy
              const stepFinal = status !== "pending";

              return (
                <div
                  key={item.request_id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                    <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-[var(--accent)] blur-3xl opacity-10" />
                    <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-white blur-3xl opacity-[0.04]" />
                  </div>

                  <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-semibold text-white">{item.project_title}</p>

                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${kindTone}`}>
                          {kindLabel}
                        </span>

                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/55">
                        <span className="truncate">Request ID: {item.request_id}</span>
                        <span>Destinatario: {receiverName}</span>
                        <span>Data: {createdLabel}</span>
                      </div>

                      {item.message && (
                        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Messaggio</p>
                          <p className="mt-2 text-[13px] text-white/90">“{item.message}”</p>
                        </div>
                      )}
                    </div>

                    <div className="relative w-full max-w-full md:max-w-[280px]">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Progress</p>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "h-2.5 w-2.5 rounded-full",
                              stepSent ? "bg-[var(--accent)]" : "bg-white/20",
                            ].join(" ")}
                          />
                          <span className="text-[12px] text-white/70">Inviato</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "h-2.5 w-2.5 rounded-full",
                              stepSeen ? "bg-[var(--accent)]" : "bg-white/20",
                            ].join(" ")}
                          />
                          <span className="text-[12px] text-white/70">In lavorazione</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "h-2.5 w-2.5 rounded-full",
                              stepFinal
                                ? status === "accepted"
                                  ? "bg-emerald-400"
                                  : "bg-red-400"
                                : "bg-white/20",
                            ].join(" ")}
                          />
                          <span className="text-[12px] text-white/70">
                            {status === "accepted" ? "Accettato" : status === "rejected" ? "Rifiutato" : "In attesa"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] font-semibold text-white/80">Cosa succede ora</p>
                        <p className="mt-1 text-[11px] text-white/55">
                          Quando lo status cambia, qui vedrai l’esito e potremo notificarti.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
);
}