"use client";

import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { isAdminUser } from "@/lib/admin/isAdmin";

const PROFILE_TABLE = "tekkin_charts_profile_versions";
const DEFAULT_CONFIG = `{
  "analyzer": 0.55,
  "likes": 0.2,
  "plays": 0.15,
  "downloads": 0.1
}`;

type ChartProfileVersion = {
  id: number;
  profile_key: string;
  version: number;
  is_published: boolean | null;
  published_at: string | null;
  config: Record<string, unknown> | string | null;
  created_at: string | null;
};

type Message = {
  type: "success" | "error";
  text: string;
};

function formatConfig(config: ChartProfileVersion["config"]): string {
  if (!config) return DEFAULT_CONFIG;
  if (typeof config === "string") {
    try {
      return JSON.stringify(JSON.parse(config), null, 2);
    } catch {
      return config;
    }
  }
  try {
    return JSON.stringify(config, null, 2);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function safeParseJson(value: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

export default function AdminChartsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ChartProfileVersion[]>([]);
  const [configDrafts, setConfigDrafts] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<Message | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [rebuildBusy, setRebuildBusy] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, ChartProfileVersion[]>();
    rows.forEach((row) => {
      if (!map.has(row.profile_key)) {
        map.set(row.profile_key, []);
      }
      map.get(row.profile_key)?.push(row);
    });
    const entries = Array.from(map.entries()).map(([profileKey, versions]) => ({
      profileKey,
      versions: [...versions].sort((a, b) => b.version - a.version),
    }));
    entries.sort((a, b) => a.profileKey.localeCompare(b.profileKey));
    return entries;
  }, [rows]);

  useEffect(() => {
    let active = true;
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!active) return;
        if (error || !data?.user) {
          setIsAdmin(false);
          setAuthChecked(true);
          return;
        }
        setIsAdmin(isAdminUser(data.user));
        setAuthChecked(true);
      } catch {
        if (!active) return;
        setIsAdmin(false);
        setAuthChecked(true);
      }
    };
    checkAuth();
    return () => {
      active = false;
    };
  }, [supabase]);

  const loadProfiles = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase
        .from(PROFILE_TABLE)
        .select("id, profile_key, version, is_published, published_at, config, created_at")
        .order("profile_key", { ascending: true })
        .order("version", { ascending: false });

      if (error) throw error;
      const normalized = (data ?? []) as ChartProfileVersion[];
      setRows(normalized);
      setConfigDrafts((prev) => {
        const next: Record<number, string> = {};
        normalized.forEach((row) => {
          next[row.id] = prev[row.id] ?? formatConfig(row.config);
        });
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore nel caricamento";
      setMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadProfiles();
  }, [isAdmin]);

  const handleSaveConfig = async (row: ChartProfileVersion) => {
    const draft = configDrafts[row.id] ?? "";
    const parsed = safeParseJson(draft);
    if (!parsed.ok) {
      setMessage({ type: "error", text: "JSON non valido per la config." });
      return;
    }

    setBusyAction(`save-${row.id}`);
    setMessage(null);
    try {
      const { error } = await supabase
        .from(PROFILE_TABLE)
        .update({ config: parsed.value })
        .eq("id", row.id);
      if (error) throw error;
      setMessage({ type: "success", text: "Config salvata." });
      await loadProfiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore nel salvataggio";
      setMessage({ type: "error", text: msg });
    } finally {
      setBusyAction(null);
    }
  };

  const handleActivate = async (row: ChartProfileVersion) => {
    setBusyAction(`publish-${row.id}`);
    setMessage(null);
    try {
      const { error: resetError } = await supabase
        .from(PROFILE_TABLE)
        .update({ is_published: false })
        .eq("profile_key", row.profile_key);
      if (resetError) throw resetError;

      const { error: publishError } = await supabase
        .from(PROFILE_TABLE)
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq("id", row.id);
      if (publishError) throw publishError;

      setMessage({ type: "success", text: "Versione resa attiva." });
      await loadProfiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore nella pubblicazione";
      setMessage({ type: "error", text: msg });
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnpublish = async (row: ChartProfileVersion) => {
    setBusyAction(`unpublish-${row.id}`);
    setMessage(null);
    try {
      const { error } = await supabase
        .from(PROFILE_TABLE)
        .update({ is_published: false, published_at: null })
        .eq("id", row.id);
      if (error) throw error;
      setMessage({ type: "success", text: "Versione disattivata." });
      await loadProfiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore nel toggle pubblicazione";
      setMessage({ type: "error", text: msg });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateVersion = async (profileKey: string) => {
    const profile = grouped.find((entry) => entry.profileKey === profileKey);
    const latest = profile?.versions[0];
    if (!latest) {
      setMessage({ type: "error", text: "Nessuna versione da duplicare." });
      return;
    }

    setBusyAction(`create-${profileKey}`);
    setMessage(null);
    try {
      const nextVersion = latest.version + 1;
      const { error } = await supabase.from(PROFILE_TABLE).insert({
        profile_key: profileKey,
        version: nextVersion,
        is_published: false,
        published_at: null,
        config: latest.config ?? null,
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Nuova versione creata." });
      await loadProfiles();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore nella creazione";
      setMessage({ type: "error", text: msg });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRebuild = async () => {
    setRebuildBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/rebuild-charts", { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg =
          payload?.error?.message ||
          payload?.error ||
          "Rebuild fallito";
        throw new Error(errMsg);
      }
      const result = payload?.result;
      const detail =
        result && typeof result === "object"
          ? ` Rebuild ok: ${JSON.stringify(result)}`
          : "";
      setMessage({ type: "success", text: `Rebuild completato.${detail}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore nel rebuild";
      setMessage({ type: "error", text: msg });
    } finally {
      setRebuildBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Admin Charts</title>
      </Head>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10 text-tekkin-text">
        <div className="rounded-2xl border border-tekkin-border bg-tekkin-panel/60 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Admin Charts</h1>
              <p className="text-sm text-tekkin-muted">
                Gestisci i profili di classifica e le versioni pubblicate.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={loadProfiles}
                disabled={loading}
                className="rounded-full border border-tekkin-border px-4 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text disabled:opacity-50"
              >
                {loading ? "Aggiorno..." : "Aggiorna"}
              </button>
              <button
                type="button"
                onClick={handleRebuild}
                disabled={rebuildBusy}
                className="rounded-full border border-tekkin-border bg-tekkin-text px-4 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-bg transition hover:bg-tekkin-text/90 disabled:opacity-50"
              >
                {rebuildBusy ? "Rebuild..." : "Rebuild Classifiche"}
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/40 bg-red-500/10 text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {!authChecked && (
          <p className="text-sm text-tekkin-muted">Verifica accesso...</p>
        )}

        {authChecked && !isAdmin && (
          <div className="rounded-lg border border-tekkin-border bg-tekkin-panel/60 p-4 text-sm">
            Accesso riservato agli admin.
          </div>
        )}

        {authChecked && isAdmin && (
          <div className="space-y-4">
            {loading && (
              <p className="text-sm text-tekkin-muted">Caricamento profili...</p>
            )}

            {!loading && grouped.length === 0 && (
              <p className="text-sm text-tekkin-muted">Nessun profilo trovato.</p>
            )}

            {!loading &&
              grouped.map((group, index) => (
                <details
                  key={group.profileKey}
                  className="rounded-2xl border border-tekkin-border bg-tekkin-panel/60 p-5"
                  open={index === 0}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-tekkin-border px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
                        Profile
                      </span>
                      <span className="text-base font-semibold uppercase tracking-[0.2em] text-tekkin-text">
                        {group.profileKey}
                      </span>
                      <span className="text-xs text-tekkin-muted">
                        {group.versions.length} versioni
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
                      Apri
                    </span>
                  </summary>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleCreateVersion(group.profileKey)}
                      disabled={busyAction === `create-${group.profileKey}`}
                      className="rounded-full border border-tekkin-border px-3 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text disabled:opacity-50"
                    >
                      {busyAction === `create-${group.profileKey}` ? "Creo..." : "Crea nuova versione"}
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {group.versions.map((row) => {
                      const draft = configDrafts[row.id] ?? formatConfig(row.config);
                      const parsed = safeParseJson(draft);
                      const isValid = parsed.ok;
                      const isPublished = Boolean(row.is_published);

                      return (
                        <div
                          key={row.id}
                          className="rounded-xl border border-tekkin-border/70 bg-tekkin-bg/60 p-5 text-sm"
                        >
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-base font-semibold text-tekkin-text">
                                  Versione {row.version}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.3em] ${
                                    isPublished
                                      ? "border-emerald-500/40 text-emerald-200"
                                      : "border-tekkin-border text-tekkin-muted"
                                  }`}
                                >
                                  {isPublished ? "Attiva" : "Bozza"}
                                </span>
                              </div>
                              <div className="grid gap-1 text-xs text-tekkin-muted">
                                <span>profile_key: {row.profile_key}</span>
                                <span>published_at: {row.published_at ?? "-"}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-start gap-3">
                              <label className="flex items-center gap-2 text-xs text-tekkin-muted">
                                <input
                                  type="checkbox"
                                  checked={isPublished}
                                  onChange={(event) => {
                                    const next = event.target.checked;
                                    if (next) {
                                      handleActivate(row);
                                    } else {
                                      handleUnpublish(row);
                                    }
                                  }}
                                  disabled={
                                    busyAction === `publish-${row.id}` ||
                                    busyAction === `unpublish-${row.id}`
                                  }
                                  className="h-4 w-4"
                                />
                                Pubblicata
                              </label>
                              <button
                                type="button"
                                onClick={() => handleActivate(row)}
                                disabled={isPublished || busyAction === `publish-${row.id}`}
                                className="rounded-full border border-tekkin-border px-3 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text disabled:opacity-50"
                              >
                                {busyAction === `publish-${row.id}` ? "Attivo..." : "Rendi attiva"}
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">
                              Config (JSON)
                            </label>
                            <textarea
                              value={draft}
                              onChange={(event) =>
                                setConfigDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: event.target.value,
                                }))
                              }
                              rows={7}
                              spellCheck={false}
                              className="w-full rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 font-mono text-xs text-tekkin-text"
                            />
                            {!isValid && (
                              <p className="text-xs text-red-300">JSON non valido.</p>
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSaveConfig(row)}
                              disabled={!isValid || busyAction === `save-${row.id}`}
                              className="rounded-full border border-tekkin-border px-3 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text disabled:opacity-50"
                            >
                              {busyAction === `save-${row.id}` ? "Salvo..." : "Salva"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
