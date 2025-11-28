"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Se sei già loggato, manda diretto alla dashboard artist
  useEffect(() => {
    const supabase = createClient();

    async function checkSession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          router.replace("/artist");
        }
      } catch {
        // ignoriamo, non blocchiamo la pagina
      }
    }

    checkSession();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg("Inserisci una email");
      return;
    }

    if (!password.trim()) {
      setErrorMsg("Inserisci la password");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message || "Login non riuscito");
        return;
      }

      if (data) {
        router.replace("/artist");
      }
    } catch (err) {
      console.error("Login error", err);
      setErrorMsg("Si è verificato un errore durante il login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black px-4">
      {/* Sfondo coerente con Artist/Register */}
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-[0.04]" />
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-20 -left-10 h-56 w-56 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header Tekkin style */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--sidebar-bg)]/80 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.25em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Tekkin Artist
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Accedi al tuo profilo
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Entra nella tua dashboard Tekkin, Tekkin Rank e collegamenti già configurati.
          </p>
        </div>

        {/* Card form */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar-bg)]/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tuo@email.com"
                className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
              />
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-[var(--accent)]/40 transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entro nel profilo..." : "Accedi a Tekkin"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Non hai ancora un account</span>
            <Link
              href="/register"
              className="font-medium text-[var(--accent)] hover:opacity-80"
            >
              Crea il tuo profilo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
