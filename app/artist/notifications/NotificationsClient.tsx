"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

type Row = {
  id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  href: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  signal_received: "Signal ricevuto",
  signal_accepted: "Signal accettato",
  signal_rejected: "Signal rifiutato",
};

function formatDateLabel(iso: string | null) {
  if (!iso) return "Data N/D";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Data N/D";
  return d.toLocaleString();
}

type TabKey = "unread" | "signals" | "all";

export default function NotificationsClient() {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("unread");

  const unreadCount = useMemo(
    () => items.filter((x) => x.is_read === false).length,
    [items]
  );

  const filtered = useMemo(() => {
    if (tab === "all") return items;

    if (tab === "signals") {
      return items.filter((x) => (x.type ?? "").startsWith("signal_"));
    }

    // unread
    return items.filter((x) => x.is_read === false);
  }, [items, tab]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications/list", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => []);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Errore caricando notifiche");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    let alive = true;
    let cleanupChannel: (() => void) | null = null;
    let cleanupAuth: (() => void) | null = null;

    const startForUser = async (uid: string) => {
      const channel = supabase
        .channel("tekkin-notifications-page")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => {
            if (!alive) return;
            void load(); // ricarica lista live
          }
        )
        .subscribe();

      cleanupChannel = () => {
        supabase.removeChannel(channel);
      };
    };

    const boot = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;

      if (uid) {
        await startForUser(uid);
        return;
      }

      // sessione non pronta: agganciati ai cambi auth
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const nextUid = session?.user?.id ?? null;
        if (!nextUid) return;

        if (cleanupChannel) cleanupChannel();
        void startForUser(nextUid);
      });

      cleanupAuth = () => {
        sub.subscription.unsubscribe();
      };
    };

    void boot();

    return () => {
      alive = false;
      if (cleanupChannel) cleanupChannel();
      if (cleanupAuth) cleanupAuth();
    };
  }, [supabase]);

  const markRead = async (id: string) => {
    // optimistic
    setItems((curr) => curr.map((n) => (n.id === id ? { ...n, is_read: true } : n)));

    const res = await fetch("/api/notifications/mark-read", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      // rollback
      setItems((curr) => curr.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
      toast.error("Non riesco a segnare come letta");
    }
  };

  const markAllRead = async () => {
    const prev = items;
    setItems((curr) => curr.map((n) => (n.is_read ? n : { ...n, is_read: true })));

    const t = toast.loading("Segno tutte come lette...");
    const res = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
      credentials: "include",
    });

    if (!res.ok) {
      setItems(prev);
      toast.error("Errore segnando tutte come lette", { id: t });
      return;
    }
    toast.success("Tutte segnate come lette", { id: t });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-14 pt-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/45">Inbox</p>
          <h1 className="text-3xl font-semibold text-white">Notifiche</h1>
          <p className="max-w-[680px] text-sm text-white/60">
            Aggiornamenti in tempo reale: Signals, esiti, e azioni importanti.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-80" />
              Unread: {unreadCount}
            </span>

            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
            >
              Segna tutte come lette
            </button>
          </div>
        </div>

        <Link
          href="/artist"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Torna alla Dashboard
        </Link>
      </header>

      <div className="mt-8 rounded-3xl border border-white/10 bg-black/60 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab("unread")}
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                tab === "unread"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20",
              ].join(" ")}
            >
              Da leggere
            </button>

            <button
              type="button"
              onClick={() => setTab("signals")}
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                tab === "signals"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20",
              ].join(" ")}
            >
              Signals
            </button>

            <button
              type="button"
              onClick={() => setTab("all")}
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition",
                tab === "all"
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-white/10 bg-white/5 text-white/70 hover:border-white/20",
              ].join(" ")}
            >
              Tutte
            </button>
          </div>

          <button
            type="button"
            onClick={load}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70 transition hover:border-white/20"
          >
            Aggiorna
          </button>
        </div>

        <div className="mt-5">
          {loading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
              Caricamento notifiche...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/4 p-8 text-center">
              <p className="text-sm font-semibold text-white/80">Nessuna notifica</p>
              <p className="mt-2 text-[12px] text-white/55">
                Quando succede qualcosa, la vedrai qui in tempo reale.
              </p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="mt-4 space-y-3">
              {filtered.map((n) => {
                const isUnread = n.is_read === false;
                const typeKey = (n.type ?? "").trim();
                const typeLabel = TYPE_LABEL[typeKey] ?? "Update";
                const dateLabel = formatDateLabel(n.created_at);

                return (
                  <Link
                    key={n.id}
                    href={n.href ?? "/artist/notifications"}
                    onClick={() => {
                      if (isUnread) void markRead(n.id);
                    }}
                    className={[
                      "group relative block overflow-hidden rounded-2xl border p-4 md:p-5 transition",
                      isUnread
                        ? "border-[var(--accent)]/25 bg-[var(--accent)]/10"
                        : "border-white/10 bg-white/5 opacity-80 hover:opacity-100",
                    ].join(" ")}
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                      <div className="absolute -left-24 top-0 h-64 w-64 rounded-full bg-[var(--accent)] blur-3xl opacity-10" />
                      <div className="absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-white blur-3xl opacity-[0.04]" />
                    </div>

                    <div className="relative flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isUnread && <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
                          <p className="truncate text-[14px] font-semibold text-white">
                            {n.title ?? typeLabel}
                          </p>
                          <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white/60">
                            {typeKey ? typeKey : "update"}
                          </span>
                        </div>

                        <p className="mt-2 text-[12px] text-white/70">
                          {n.body ?? ""}
                        </p>

                        <p className="mt-3 text-[11px] text-white/50">
                          {typeLabel}
                        </p>
                      </div>

                      <div className="shrink-0 text-right text-[11px] text-white/50">
                        {dateLabel}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
