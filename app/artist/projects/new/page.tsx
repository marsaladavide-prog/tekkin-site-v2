"use client";

import { useState } from "react";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export default function NewProjectPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);

      const file = formData.get("file") as File | null;

      if (!file) {
        setError("Seleziona un file audio.");
        setIsSubmitting(false);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(
          "File troppo grande. Limite massimo server: 50 MB per file. " +
            "Ti consigliamo di usare MP3 320 kbps per versioni più leggere."
        );
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/projects/create-with-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Errore nella creazione del progetto");
      } else {
        form.reset();
      }
    } catch (err) {
      console.error(err);
      setError("Errore imprevisto");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* TITLE */}
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input
          type="text"
          name="title"
          required
          className="w-full rounded-md border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        />
      </div>

      {/* STATUS */}
      <div>
        <label className="block text-sm font-medium mb-1">Status</label>
        <select
          name="status"
          defaultValue="DEMO"
          className="w-full rounded-md border border-neutral-700 bg-black px-3 py-2 text-sm text-white"
        >
          <option value="DEMO">Demo</option>
          <option value="WIP">Work in progress</option>
          <option value="FINAL">Final</option>
        </select>
      </div>

      {/* FILE AUDIO */}
      <div>
        <label className="block text-sm font-medium mb-1">File audio</label>
        <input
          type="file"
          name="file"
          accept="audio/*"
          required
          className="w-full text-sm text-neutral-300"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Formati consigliati: MP3 320 kbps. Limite massimo server: 50 MB per file.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
      >
        {isSubmitting ? "Carico..." : "Crea progetto"}
      </button>
    </form>
  );
}
