"use client";

import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { isAdminUser } from "@/lib/admin/isAdmin";
import { TEKKIN_GENRES, parseTekkinGenreIds, TekkinGenreId } from "@/lib/constants/genres";

const PLAYLISTS_TABLE = "tekkin_charts_curated_playlists";

type PlaylistFilters = {
  mix_type?: string;
  genre?: string | string[] | TekkinGenreId[];
  min_score?: number;
  artist_name_contains?: string;
};

type PlaylistRow = {
  id: string;
  title: string | null;
  slug: string | null;
  description: string | null;
  cover_url: string | null;
  order_index: number | null;
  active: boolean | null;
  filters: PlaylistFilters | null;
};

type Message = { type: "success" | "error"; text: string };

type EditorState = {
  open: boolean;
  mode: "new" | "edit";
  sourceId?: string;
  title: string;
  slug: string;
  description: string;
  cover_url: string;
  order_index: string;
  active: boolean;
  mix_type: string;
  genreIds: TekkinGenreId[];
  min_score: string;
  artist_name_contains: string;
};

function buildEmptyEditorState(): EditorState {
  return {
    open: false,
    mode: "new",
    title: "",
    slug: "",
    description: "",
    cover_url: "",
    order_index: "",
    active: true,
    mix_type: "",
    genreIds: [],
    min_score: "",
    artist_name_contains: "",
  };
}

export default function AdminPlaylistsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [editor, setEditor] = useState<EditorState>(buildEmptyEditorState());
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);

  useEffect(() => {
    let activeFlag = true;
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!activeFlag) return;
      if (error || !data?.user) {
        setIsAdmin(false);
        setAuthChecked(true);
        return;
      }
      setIsAdmin(isAdminUser(data.user));
      setAuthChecked(true);
    };
    checkAuth();
    return () => {
      activeFlag = false;
    };
  }, [supabase]);

  const callAdminPlaylistsApi = async (method: "GET" | "POST" | "PATCH", body?: unknown) => {
    const res = await fetch("/api/admin/playlists", {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error ?? "Errore");
    }
    return res.json();
  };

  const loadPlaylists = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload = await callAdminPlaylistsApi("GET");
      setPlaylists(
        (payload.data ?? []).map((item: PlaylistRow) => ({
          ...item,
          active: (item as any).is_active ?? item.active ?? null,
          filters: item.filters ?? null,
        }))
      );
    } catch (err) {
      console.error("admin playlists load error:", err);
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Errore caricamento" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadPlaylists();
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const orderIndex = editor.order_index.trim()
      ? Number(editor.order_index)
      : null;
    if (editor.order_index.trim() && Number.isNaN(orderIndex)) {
      setMessage({ type: "error", text: "Order index non valido." });
      setSaving(false);
      return;
    }

    const filters: PlaylistFilters = {};
    if (editor.mix_type.trim()) filters.mix_type = editor.mix_type.trim();
    if (editor.genreIds.length) {
      filters.genre = editor.genreIds.length === 1 ? editor.genreIds[0] : editor.genreIds;
    }
    if (editor.min_score.trim()) {
      const minScore = Number(editor.min_score);
      if (Number.isNaN(minScore)) {
        setMessage({ type: "error", text: "Min score non valido." });
        setSaving(false);
        return;
      }
      filters.min_score = minScore;
    }
    if (editor.artist_name_contains.trim()) {
      filters.artist_name_contains = editor.artist_name_contains.trim();
    }

    const payload = {
      title: editor.title.trim() || null,
      slug: editor.slug.trim(),
      description: editor.description.trim() || null,
      cover_url: editor.cover_url.trim() || null,
      order_index: orderIndex,
      is_active: editor.active,
      filters: Object.keys(filters).length ? filters : null,
    };

    try {
      if (editor.mode === "edit" && editor.sourceId) {
        await callAdminPlaylistsApi("PATCH", { id: editor.sourceId, updates: payload });
        setMessage({ type: "success", text: "Playlist aggiornata." });
      } else {
        await callAdminPlaylistsApi("POST", payload);
        setMessage({ type: "success", text: "Playlist creata." });
      }
      setEditor(buildEmptyEditorState());
      await loadPlaylists();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Errore nel salvataggio" });
    } finally {
      setSaving(false);
    }
  };

  const openEditor = (mode: "new" | "edit", playlist?: PlaylistRow) => {
    if (mode === "new") {
      setEditor({ ...buildEmptyEditorState(), open: true, mode });
      return;
    }
    if (!playlist) return;
    const filters = playlist.filters ?? {};
    setEditor({
      open: true,
      mode,
      sourceId: playlist.id,
      title: playlist.title ?? "",
      slug: playlist.slug ?? "",
      description: playlist.description ?? "",
      cover_url: playlist.cover_url ?? "",
      order_index: playlist.order_index?.toString() ?? "",
      active: Boolean(playlist.active),
      mix_type: filters.mix_type ?? "",
      genreIds: parseTekkinGenreIds(filters.genre ?? null),
      min_score: typeof filters.min_score === "number" ? filters.min_score.toString() : "",
      artist_name_contains: filters.artist_name_contains ?? "",
    });
  };

  const toggleActive = async (playlist: PlaylistRow) => {
    try {
      await callAdminPlaylistsApi("PATCH", {
        id: playlist.id,
        updates: { is_active: !(playlist.active ?? false) },
      });
      setMessage({ type: "success", text: "Stato aggiornato." });
      await loadPlaylists();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Errore" });
    }
  };

  const uploadCoverImage = async (file: File) => {
    setCoverUploading(true);
    setCoverUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/playlists/upload-cover", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Upload fallito");
      }
      const payload = await res.json();
      return payload.url as string;
    } finally {
      setCoverUploading(false);
    }
  };

  const handleCoverFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadCoverImage(file);
      setEditor((prev) => ({ ...prev, cover_url: url }));
    } catch (err) {
      console.error("upload cover error:", err);
      setCoverUploadError(err instanceof Error ? err.message : "Upload fallito");
    }
  };

  const closeEditor = () => {
    setEditor(buildEmptyEditorState());
    setCoverUploadError(null);
    setCoverUploading(false);
  };

  return (
    <>
      <Head>
        <title>Admin Playlists</title>
      </Head>
      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10 text-tekkin-text">
        <div className="rounded-2xl border border-tekkin-border bg-tekkin-panel/60 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Admin Playlists</h1>
              <p className="text-sm text-tekkin-muted">Configura le playlist curate.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={loadPlaylists}
                disabled={loading}
                className="rounded-full border border-tekkin-border px-4 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text disabled:opacity-50"
              >
                {loading ? "Aggiorno..." : "Aggiorna"}
              </button>
              <button
                type="button"
                onClick={() => openEditor("new")}
                className="rounded-full border border-tekkin-border bg-tekkin-text px-4 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-bg transition hover:bg-tekkin-text/90"
              >
                Nuova playlist
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
            Accesso admin richiesto.
          </div>
        )}

        {authChecked && isAdmin && (
          <div className="space-y-4">
            {loading && <p className="text-sm text-tekkin-muted">Caricamento playlist...</p>}
            {!loading && playlists.length === 0 && (
              <p className="text-sm text-tekkin-muted">Nessuna playlist trovata.</p>
            )}

            <div className="grid gap-4">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="rounded-2xl border border-tekkin-border bg-tekkin-panel/60 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-20 w-20 overflow-hidden rounded-lg border border-tekkin-border bg-tekkin-bg">
                        {playlist.cover_url ? (
                          <img
                            src={playlist.cover_url}
                            alt={playlist.title ?? "cover"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-tekkin-muted">
                            Cover
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-tekkin-muted">Playlist</div>
                        <h3 className="text-lg font-semibold">{playlist.title ?? "Unnamed"}</h3>
                        <p className="text-sm text-tekkin-muted">{playlist.description ?? "Nessuna descrizione"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEditor("edit", playlist)}
                        className="rounded-full border border-tekkin-border px-3 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text"
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(playlist)}
                        className="rounded-full border border-tekkin-border px-3 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text"
                      >
                        {playlist.active ? "Disattiva" : "Attiva"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {editor.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
            <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-tekkin-panel/90 p-6 text-tekkin-text shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-tekkin-muted">Modifica playlist</p>
                  <h2 className="text-xl font-semibold">
                    {editor.mode === "new" ? "Nuova playlist" : "Modifica playlist"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="text-xs uppercase tracking-[0.3em] text-tekkin-muted"
                >
                  Chiudi
                </button>
              </div>

              <form
                className="mt-6 grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave();
                }}
              >
                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Titolo</label>
                  <input
                    value={editor.title}
                    onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))}
                    className="rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="grid gap-2 min-w-0">
                    <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Slug</label>
                    <input
                      value={editor.slug}
                      onChange={(event) => setEditor((prev) => ({ ...prev, slug: event.target.value }))}
                      className="rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2 min-w-0">
                    <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Order index</label>
                    <input
                      value={editor.order_index}
                      onChange={(event) => setEditor((prev) => ({ ...prev, order_index: event.target.value }))}
                      inputMode="numeric"
                      className="rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Descrizione</label>
                  <textarea
                    value={editor.description}
                    onChange={(event) => setEditor((prev) => ({ ...prev, description: event.target.value }))}
                    rows={3}
                    className="w-full rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid gap-3">
                  <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Cover</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="h-24 w-24 overflow-hidden rounded-lg border border-tekkin-border bg-tekkin-bg/60">
                      {editor.cover_url ? (
                        <img
                          src={editor.cover_url}
                          alt="cover preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.3em] text-tekkin-muted">
                          <div className="tekkin-glitch-card">
                            <div className="tekkin-glitch-layer" />
                            <div className="tekkin-glitch-noise" />
                          </div>
                          Nessuna cover
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverFileChange}
                        disabled={coverUploading}
                        className="text-xs text-tekkin-muted"
                      />
                      {coverUploading && <p className="text-xs text-tekkin-muted">Sto caricando...</p>}
                      {coverUploadError && (
                        <p className="text-xs text-red-300">{coverUploadError}</p>
                      )}
                      {editor.cover_url && (
                        <button
                          type="button"
                          className="text-xs uppercase tracking-[0.3em] text-red-300 hover:text-red-200"
                          onClick={() => setEditor((prev) => ({ ...prev, cover_url: "" }))}
                        >
                          Rimuovi cover
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Mix type</label>
                      <input
                        value={editor.mix_type}
                        onChange={(event) => setEditor((prev) => ({ ...prev, mix_type: event.target.value }))}
                        placeholder="es. standard"
                        className="rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid gap-3">
                      <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Genere playlist</label>
                      <div className="flex flex-wrap gap-2">
                        {TEKKIN_GENRES.map((genre) => {
                          const active = editor.genreIds.includes(genre.id);
                          return (
                            <button
                              key={genre.id}
                              type="button"
                              onClick={() =>
                                setEditor((prev) => ({
                                  ...prev,
                                  genreIds: prev.genreIds.includes(genre.id)
                                    ? prev.genreIds.filter((id) => id !== genre.id)
                                    : [...prev.genreIds, genre.id],
                                }))
                              }
                              className={`rounded-full border px-3 py-2 text-xs uppercase tracking-[0.25em] transition ${
                                active
                                  ? "border-tekkin-border bg-tekkin-text text-tekkin-bg"
                                  : "border-tekkin-border/60 text-tekkin-muted hover:border-tekkin-text/60"
                              }`}
                            >
                              {genre.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-tekkin-muted">Seleziona uno o più generi Tekkin.</p>
                    </div>
                  </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Min score</label>
                    <input
                      value={editor.min_score}
                      onChange={(event) => setEditor((prev) => ({ ...prev, min_score: event.target.value }))}
                      placeholder="es. 70"
                      inputMode="numeric"
                      className="rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs uppercase tracking-[0.3em] text-tekkin-muted">Artist name contains</label>
                    <input
                      value={editor.artist_name_contains}
                      onChange={(event) =>
                        setEditor((prev) => ({ ...prev, artist_name_contains: event.target.value }))
                      }
                      placeholder="es. marsala"
                      className="rounded-md border border-tekkin-border bg-tekkin-bg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-tekkin-muted">
                  <input
                    type="checkbox"
                    checked={editor.active}
                    onChange={(event) => setEditor((prev) => ({ ...prev, active: event.target.checked }))}
                    className="h-4 w-4"
                  />
                  Attiva
                </label>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving || coverUploading}
                    className="rounded-full border border-tekkin-border px-4 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted transition hover:text-tekkin-text disabled:opacity-50"
                  >
                    {saving ? "Salvo..." : "Salva playlist"}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="rounded-full border border-tekkin-border px-4 py-2 text-xs uppercase tracking-[0.3em] text-tekkin-muted"
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
