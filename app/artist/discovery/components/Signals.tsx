"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { useTekkinPlayer } from "@/lib/player/useTekkinPlayer";

type DiscoveryMessage = {
  id: string;
  request_id: string;
  sender_id: string | null;
  receiver_id: string | null;
  message: string;
  created_at: string;
};

type DiscoveryInboxItem = {
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
  key?: string | null;
  status: "pending" | "accepted" | "rejected" | string;
  sender_id: string | null;
  sender_name: string | null;
  sender_avatar: string | null;
  message: string | null;
  audio_url: string | null;
  messages: DiscoveryMessage[];
  version_count?: number;
  project_cover_url?: string | null;
};

type DiscoveryOutboxItem = DiscoveryInboxItem & {
  receiver_id: string;
  receiver_name: string | null;
  receiver_avatar: string | null;
};

type IdentityReveal = {
  senderName: string;
  senderAvatar: string | null;
  projectTitle: string;
  projectCoverUrl: string | null;
  versionCount: number;
  genre: string | null;
  overallScore: number | null;
  mixScore: number | null;
  masterScore: number | null;
  bpm: number | null;
  kind: "collab" | "promo";
};

const statusTabs = [
  { key: "pending", label: "Pendenti" },
  { key: "accepted", label: "Accettati" },
  { key: "rejected", label: "Rifiutati" },
] as const;

type StatusKey = (typeof statusTabs)[number]["key"];

function safeText(v: unknown, fallback = "n.d.") {
  if (typeof v === "string" && v.trim()) return v.trim();
  return fallback;
}

function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function levelFromScore(v: number | null) {
  if (v === null) return null;
  if (v >= 80) return "Top tier";
  if (v >= 65) return "Alto potenziale";
  if (v >= 50) return "Solido";
  if (v >= 35) return "Promettente";
  return "In crescita";
}

function formatMetricValue(v: number | null | undefined) {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v.toFixed(1);
  }
  return "—";
}

export function Signals() {
  const [receivedItems, setReceivedItems] = useState<DiscoveryInboxItem[]>([]);
  const [sentItems, setSentItems] = useState<DiscoveryOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeArea, setActiveArea] = useState<"received" | "sent">("received");
  const [receivedStatusTab, setReceivedStatusTab] = useState<StatusKey>("pending");
  const [sentStatusTab, setSentStatusTab] = useState<StatusKey>("pending");
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [identityReveal, setIdentityReveal] = useState<IdentityReveal | null>(null);
  const player = useTekkinPlayer((s) => s);

  const receivedLists = useMemo(
    () => ({
      pending: receivedItems.filter((item) => item.status === "pending"),
      accepted: receivedItems.filter((item) => item.status === "accepted"),
      rejected: receivedItems.filter((item) => item.status === "rejected"),
    }),
    [receivedItems]
  );

  const sentLists = useMemo(
    () => ({
      pending: sentItems.filter((item) => item.status === "pending"),
      accepted: sentItems.filter((item) => item.status === "accepted"),
      rejected: sentItems.filter((item) => item.status === "rejected"),
    }),
    [sentItems]
  );

  const receivedActiveList = receivedLists[receivedStatusTab];
  const sentActiveList = sentLists[sentStatusTab];

  const loadSignals = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [inboxRes, outboxRes] = await Promise.all([
        fetch("/api/discovery/inbox", { credentials: "include", cache: "no-store" }),
        fetch("/api/discovery/outbox", { credentials: "include", cache: "no-store" }),
      ]);

      if (!inboxRes.ok || !outboxRes.ok) {
        const text = await inboxRes.text().catch(() => "");
        console.error("Signals inbox error:", text);
        setErrorMsg("Errore caricando i Signals.");
        return;
      }

      const inboxData = (await inboxRes.json().catch(() => null)) as unknown;
      const outboxData = (await outboxRes.json().catch(() => null)) as unknown;

      setReceivedItems(Array.isArray(inboxData) ? (inboxData as DiscoveryInboxItem[]) : []);
      setSentItems(Array.isArray(outboxData) ? (outboxData as DiscoveryOutboxItem[]) : []);
    } catch (err) {
      console.error("Signals error:", err);
      setErrorMsg("Errore inatteso caricando i Signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSignals();
  }, [loadSignals]);

  useEffect(() => {
    if (!identityReveal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIdentityReveal(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [identityReveal]);

  const getCardClasses = (status: StatusKey) => {
    if (status === "accepted") return "border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20";
    if (status === "rejected") return "border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20";
    return "border-white/10 bg-white/5 hover:bg-white/7";
  };

  const handleRespond = useCallback(
    async (item: DiscoveryInboxItem, action: "accept" | "reject") => {
      const toastId = toast.loading(action === "accept" ? "Accetto il Signal..." : "Rifiuto il Signal...");
      try {
        const res = await fetch("/api/discovery/respond", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request_id: item.request_id, action }),
        });

        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          toast.error(safeText(data?.error, "Richiesta non trovata"), { id: toastId });
          return;
        }

        if (action === "accept") {
          const name = safeText(data?.sender?.artist_name, "Artista");
          setIdentityReveal({
            senderName: name,
            senderAvatar: data?.sender?.avatar_url ?? item.sender_avatar ?? null,
            projectTitle: item.project_title,
            projectCoverUrl: item.project_cover_url ?? null,
            versionCount: item.version_count ?? 0,
            genre: item.genre,
            overallScore: item.overall_score,
            mixScore: item.mix_score,
            masterScore: item.master_score,
            bpm: item.bpm,
            kind: item.kind,
          });
          toast.success("Signal accettato", { id: toastId });
        } else {
          toast.success("Signal rifiutato", { id: toastId });
        }

        void loadSignals();
      } catch (err) {
        console.error("Signals respond error:", err);
        toast.error("Errore gestendo il Signal", { id: toastId });
      }
    },
    [loadSignals]
  );

  const playSignal = useCallback(
    (item: DiscoveryInboxItem | DiscoveryOutboxItem, subtitle?: string) => {
      const audioUrl = typeof item.audio_url === "string" ? item.audio_url : null;
      if (!audioUrl) {
        toast.error("Anteprima audio in arrivo.");
        return;
      }
      player.play({
        projectId: item.project_id,
        versionId: item.request_id,
        title: safeText(item.project_title, "Signal"),
        subtitle: subtitle ?? (item.kind === "promo" ? "Promo Signal" : "Collab Signal"),
        audioUrl,
      });
    },
    [player]
  );

  const handleDownload = useCallback((url: string) => {
    if (!url) {
      toast.error("Download non disponibile.");
      return;
    }
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "";
      anchor.click();
      toast.success("Download avviato.");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Impossibile avviare il download.");
    }
  }, []);

  const handleSendMessage = useCallback(
    async (item: DiscoveryInboxItem | DiscoveryOutboxItem, role: "received" | "sent") => {
      const key = `${role}-${item.request_id}`;
      const text = (messageInputs[key] ?? "").trim();
      if (!text) {
        toast.error("Inserisci un messaggio.");
        return;
      }
      const toastId = toast.loading("Invio messaggio...");
      try {
        const res = await fetch("/api/discovery/message", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_id: item.request_id,
            message: text,
            receiver_id:
              role === "received"
                ? item.sender_id
                : (item as DiscoveryOutboxItem).receiver_id,
          }),
        });
        if (!res.ok) {
          toast.error("Errore inviando il messaggio.", { id: toastId });
          return;
        }
        setMessageInputs((prev) => ({ ...prev, [key]: "" }));
        toast.success("Messaggio inviato.", { id: toastId });
        void loadSignals();
      } catch (err) {
        console.error("Message send error:", err);
        toast.error("Errore invio messaggio.", { id: toastId });
      }
    },
    [loadSignals, messageInputs]
  );

  const renderMessages = (item: DiscoveryInboxItem) => (
    <div className="space-y-2">
      {(item.messages ?? []).map((msg) => (
        <div
          key={msg.id}
          className="space-y-1 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs text-white/70"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
            {msg.sender_id === item.sender_id ? safeText(item.sender_name, "Mittente") : "Tu"}
          </p>
          <p>{msg.message}</p>
          <p className="text-[10px] text-white/40">
            {new Date(msg.created_at).toLocaleString("it-IT")}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">Artist Signals</p>
          <h2 className="text-3xl font-semibold">Signals</h2>
          <p className="text-sm text-white/60">Gestisci richieste in entrata e in uscita, con la chat sempre accessibile.</p>
        </div>
        <div className="flex gap-2">
          {(["received", "sent"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setActiveArea(option)}
              className={`rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.3em] transition ${
                activeArea === option ? "border-white bg-white text-black" : "border-white/30 text-white/60"
              }`}
            >
              {option === "received" ? "Ricevuti" : "Mandati"}
            </button>
          ))}
        </div>
      </div>

      {identityReveal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setIdentityReveal(null)}
          />
          <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-white/10 bg-black/80 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  {identityReveal.kind === "collab" ? "Collab Signal" : "Promo Signal"}
                </p>
                <h3 className="text-2xl font-semibold text-white">{identityReveal.projectTitle}</h3>
                <p className="text-[12px] text-white/60">
                  {safeText(identityReveal.genre, "Genere n.d.")} · versioni {identityReveal.versionCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIdentityReveal(null)}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/30"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
              <div className="relative h-64 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <img
                  src={identityReveal.projectCoverUrl ?? "/img/cover-placeholder.png"}
                  alt={`${identityReveal.projectTitle} cover`}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/60">Track</p>
                  <p className="text-base font-semibold text-white">Versioni {identityReveal.versionCount}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={identityReveal.senderAvatar ?? "/img/avatar-placeholder.png"}
                    alt={safeText(identityReveal.senderName, "Artista")}
                    className="h-12 w-12 rounded-full border border-white/15 object-cover"
                    loading="lazy"
                  />
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50">Da</p>
                    <p className="text-lg font-semibold text-white">{identityReveal.senderName}</p>
                    <p className="text-[11px] text-white/60">Tu</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white">
                    <p className="text-[11px] text-white/60">Overall score</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetricValue(identityReveal.overallScore)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white">
                    <p className="text-[11px] text-white/60">Mix score</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetricValue(identityReveal.mixScore)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white">
                    <p className="text-[11px] text-white/60">Master score</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetricValue(identityReveal.masterScore)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white">
                    <p className="text-[11px] text-white/60">BPM</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetricValue(identityReveal.bpm)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/70">
                  <p>Tekkin Analyze</p>
                  <dl className="mt-2 grid gap-2">
                    <div className="flex items-center justify-between">
                      <span>Genre</span>
                      <span>{safeText(identityReveal.genre, "—")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Versioni</span>
                      <span>{identityReveal.versionCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Segnale</span>
                      <span>{identityReveal.kind === "collab" ? "Collab" : "Promo"}</span>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-white/60">Caricamento Signals...</p>}
      {errorMsg && <p className="text-sm text-rose-400">{errorMsg}</p>}

      {!loading && !errorMsg && activeArea === "received" && (
        <section className="space-y-4">
          <div className="flex gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setReceivedStatusTab(tab.key)}
                className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em] transition ${
                  receivedStatusTab === tab.key ? "border-white bg-white text-black" : "border-white/30 text-white/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/60">
            {receivedActiveList.length} signal{receivedActiveList.length === 1 ? "" : "s"} visualizzati
          </p>
          {receivedActiveList.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
              Nessun Signal per questa categoria.
            </div>
          )}
          <div className="space-y-3">
            {receivedActiveList.map((item, index) => {
              const overall = safeNum(item.overall_score);
              const bpm = safeNum(item.bpm);
              const scoreLabel = levelFromScore(overall);
              const shortId = item.request_id.slice(0, 6).toUpperCase();
              const cardClass = getCardClasses(receivedStatusTab);
              const sharedContent = (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-6 text-right text-sm text-white/50 tabular-nums">{index + 1}</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/60">
                      <span>{item.kind === "promo" ? "Promo Signal" : "Collab Signal"}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/60">{safeText(item.genre)}</span>
                      {scoreLabel && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/60">{scoreLabel}</span>
                      )}
                      {item.key && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/60">Key {item.key}</span>
                      )}
                    </div>
                    <div className="truncate text-lg font-semibold text-white">{safeText(item.project_title, "Project")}</div>
                    <div className="text-xs text-white/60">
                      Codice {shortId}
                      {bpm ? ` · ${Math.round(bpm)} BPM` : ""}
                      {typeof item.has_vocals === "boolean" ? ` · Vocals ${item.has_vocals ? "Si" : "No"}` : ""}
                    </div>
                  </div>
                </div>
              );

              if (receivedStatusTab === "accepted") {
                return (
                  <article key={item.request_id} className={`rounded-2xl border px-4 py-4 transition ${cardClass}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.sender_avatar ?? "/img/avatar-placeholder.png"}
                          alt={safeText(item.sender_name, "Artista")}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-12 w-12 rounded-full border border-white/20 object-cover"
                        />

                        <div>
                          <p className="text-[11px] uppercase tracking-[0.5em] text-white/60">Signal ACCETTATO</p>
                          <h3 className="text-xl font-semibold">
                            {safeText(item.sender_name, "Artista")} – {safeText(item.project_title, "Project")}
                          </h3>
                          <p className="text-xs text-white/60">
                            {safeText(item.genre)} · Key {safeText(item.key ?? "n.d.")}
                          </p>
                          <p className="text-[11px] text-white/60">Codice {shortId}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => playSignal(item)}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 ${
                            item.audio_url ? "bg-white/10 text-white" : "bg-white/5 text-white/40"
                          }`}
                          aria-label="Play"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                        {item.audio_url && (
                          <button
                            type="button"
                            onClick={() => handleDownload(item.audio_url!)}
                            className="rounded-full border border-white/40 px-4 py-1 uppercase tracking-[0.2em]"
                          >
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-white/70">
                      <p className="font-semibold uppercase tracking-[0.35em] text-white/60">Chat</p>
                      {renderMessages(item)}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Scrivi un messaggio..."
                            value={messageInputs[`received-${item.request_id}`] ?? ""}
                            onChange={(event) =>
                              setMessageInputs((prev) => ({
                                ...prev,
                                [`received-${item.request_id}`]: event.target.value,
                              }))
                            }
                            className="flex-1 rounded-full border border-white/30 bg-black/40 px-4 py-2 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendMessage(item, "received")}
                            disabled={!((messageInputs[`received-${item.request_id}`] ?? "").trim())}
                            className="rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white/60 disabled:border-white/10 disabled:text-white/30 disabled:opacity-50"
                          >
                            Invia
                          </button>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
                      <span className="rounded-full border border-white/20 px-3 py-1">Chiuso cronologicamente</span>
                    </div>
                  </article>
                );
              }

              return (
                <article key={item.request_id} className={`rounded-2xl border px-4 py-3 transition ${cardClass}`}>
                  {sharedContent}
                  <div className="mt-3 flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => playSignal(item)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 ${
                        item.audio_url ? "bg-white/10 text-white" : "bg-white/5 text-white/40"
                      }`}
                      aria-label="Play"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    {receivedStatusTab === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespond(item, "accept")}
                          className="rounded-full border border-emerald-400/70 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200"
                        >
                          Accetta
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespond(item, "reject")}
                          className="rounded-full border border-white/30 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60"
                        >
                          Rifiuta
                        </button>
                      </div>
                    )}
                  </div>
                  {item.message && <p className="mt-3 text-xs text-white/60">{item.message}</p>}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!loading && !errorMsg && activeArea === "sent" && (
        <section className="space-y-4">
          <div className="flex gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSentStatusTab(tab.key)}
                className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em] transition ${
                  sentStatusTab === tab.key ? "border-white bg-white text-black" : "border-white/30 text-white/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {sentActiveList.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
              Nessun Signal inviato in questa categoria.
            </div>
          )}
          <div className="space-y-3">
            {sentActiveList.map((item, index) => {
              const overall = safeNum(item.overall_score);
              const bpm = safeNum(item.bpm);
              const scoreLabel = levelFromScore(overall);
              const shortId = item.request_id.slice(0, 6).toUpperCase();
              const cardClass = getCardClasses(sentStatusTab);
              const sharedContent = (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-6 text-right text-sm text-white/50 tabular-nums">{index + 1}</div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/60">
                      <span>{item.kind === "promo" ? "Promo Signal" : "Collab Signal"}</span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/60">{safeText(item.genre)}</span>
                      {scoreLabel && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/60">{scoreLabel}</span>
                      )}
                      {item.key && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/60">Key {item.key}</span>
                      )}
                    </div>
                    <div className="truncate text-lg font-semibold text-white">{safeText(item.project_title, "Project")}</div>
                    <div className="text-xs text-white/60">
                      Destinatario: {safeText(item.receiver_name)} · Codice {shortId}
                      {bpm ? ` · ${Math.round(bpm)} BPM` : ""}
                    </div>
                  </div>
                </div>
              );

              return (
                <article key={item.request_id} className={`rounded-2xl border px-4 py-3 transition ${cardClass}`}>
                  {sharedContent}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => playSignal(item, `Inviato a ${safeText(item.receiver_name, "Destinatario")}`)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 ${
                          item.audio_url ? "bg-white/10 text-white" : "bg-white/5 text-white/40"
                        }`}
                        aria-label="Play"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-xs text-white/70">
                      <p className="font-semibold uppercase tracking-[0.35em] text-white/60">Chat</p>
                      {renderMessages(item)}
                        <div className="mt-2 flex gap-2">
                          <input
                            type="text"
                            placeholder="Scrivi un messaggio..."
                            value={messageInputs[`sent-${item.request_id}`] ?? ""}
                            onChange={(event) =>
                              setMessageInputs((prev) => ({
                                ...prev,
                                [`sent-${item.request_id}`]: event.target.value,
                              }))
                            }
                            className="flex-1 rounded-full border border-white/30 bg-black/40 px-4 py-2 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendMessage(item, "sent")}
                            disabled={!((messageInputs[`sent-${item.request_id}`] ?? "").trim())}
                            className="rounded-full border border-white/30 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white/60 disabled:border-white/10 disabled:text-white/30 disabled:opacity-50"
                          >
                            Invia
                          </button>
                        </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
