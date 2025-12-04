"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { TEKKIN_GENRES } from "@/lib/constants/genres";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mixType, setMixType] = useState("master");
  const [genre, setGenre] = useState("minimal_deep_tech");

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg("Inserisci un nome per la traccia.");
      return;
    }

    try {
      setSubmitting(true);

      const supabase = createClient();

      // prendo utente per associarlo al project
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("New project auth error:", authError);
        setErrorMsg("Devi essere loggato per creare un project.");
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .insert({
          title: trimmedTitle,
          status: "DRAFT",
          user_id: user.id,
          mix_type: mixType,
          genre,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error("Insert project error:", error);
        setErrorMsg("Errore creando il project. Riprova tra poco.");
        setSubmitting(false);
        return;
      }

      // redirect diretto al dettaglio project
      router.push(`/artist/projects/${data.id}`);
    } catch (err) {
      console.error("Unexpected new project error:", err);
      setErrorMsg("Errore inatteso creando il project.");
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto py-10">
      <button
        type="button"
        onClick={() => router.push("/artist/projects")}
        className="mb-4 text-sm text-white/60 hover:text-white"
      >
        ← Back to projects
      </button>

      <div className="rounded-3xl border border-white/10 bg-black/50 p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        <h1 className="text-xl font-semibold text-white">
          Crea un nuovo project
        </h1>
        <p className="mt-1 text-xs text-white/60">
          Dai un nome alla traccia che vuoi analizzare. Dopo la creazione
          potrai caricare la prima versione audio e lanciare Tekkin Analyzer.
        </p>

        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="title"
              className="text-sm font-medium text-white/80"
            >
              Nome traccia
            </label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="Es. Kryptomania, Minimal Roller v1..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl bg-black/70 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <p className="text-[11px] text-white/50">
              Puoi sempre cambiare il nome dopo. Ti serve solo per riconoscere la traccia
              nella lista dei projects.
            </p>
          </div>

          {/* Mix Type */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-white/70">Mix type</label>
            <select
              name="mix_type"
              value={mixType}
              onChange={(e) => setMixType(e.target.value)}
              className="rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-sm"
            >
              <option value="master">Master</option>
              <option value="premaster">Premaster</option>
            </select>
          </div>

          {/* Genre */}
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium text-zinc-200">
  Genre
</label>
<select
  value={genre}
  onChange={(e) => setGenre(e.target.value)}
  className="mt-1 w-full rounded-lg bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-700 focus:ring-teal-500"
>
  {TEKKIN_GENRES.map((g) => (
    <option key={g.id} value={g.id}>
      {g.label}
    </option>
  ))}
</select>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-100">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-white/50">
              Step successivo: carica file audio e lancia Analyze.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Creazione in corso..." : "Crea project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
