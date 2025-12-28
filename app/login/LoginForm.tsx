"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function isValidEmail(v: string) {
  const s = v.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function LoginForm() {
  const router = useRouter();

  const sp = useSearchParams() ?? new URLSearchParams();
  const next = sp.get("next") ?? "";
  const redeem = sp.get("redeem") ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const emailNormalized = useMemo(() => email.trim().toLowerCase(), [email]);
  const canSubmit = useMemo(
    () => isValidEmail(emailNormalized) && password.length >= 1,
    [emailNormalized, password]
  );

  function buildTarget() {
    if (next) {
      if (redeem) return `${next}?redeem=${encodeURIComponent(redeem)}`;
      return next;
    }
    return "/artist";
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!canSubmit) {
      setError("Inserisci una email valida e la password.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: emailNormalized,
        password,
      });

      if (error) {
        setError(error.message || "Login non riuscito");
        return;
      }

      router.replace(buildTarget());
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redeem || next
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/pricing")}&redeem=${encodeURIComponent(redeem)}`
            : `${window.location.origin}/auth/callback`,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Accesso con Google non riuscito";
      setError(message);
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError(null);
    setInfo(null);

    if (!isValidEmail(emailNormalized)) {
      setError("Scrivi prima la tua email, poi clicca su Password dimenticata.");
      return;
    }

    setResetLoading(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(emailNormalized, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (error) {
        setError(error.message || "Reset password non riuscito");
        return;
      }

      setInfo("Ti ho inviato un link via email per reimpostare la password.");
    } finally {
      setResetLoading(false);
    }
  }

  const registerHref =
    next || redeem
      ? `/register?next=${encodeURIComponent(next || "/pricing")}&redeem=${encodeURIComponent(redeem)}`
      : "/register";

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--sidebar-bg)]/80 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.25em] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Tekkin Artist
        </div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Bentornato
        </h1>

        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Accedi per gestire progetti, versioni e Tekkin Rank.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar-bg)]/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.75)] backdrop-blur-xl">
        {(error || info) && (
          <div
            className={[
              "mb-4 rounded-lg border px-3 py-2 text-xs",
              error
                ? "border-red-500/40 bg-red-500/10 text-red-200"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
            ].join(" ")}
          >
            {error ?? info}
          </div>
        )}

        {redeem ? (
          <div className="mb-4 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-xs text-[var(--text-muted)]">
            Codice rilevato:{" "}
            <span className="font-mono text-[var(--text-primary)]">{redeem}</span>
            <div className="mt-1 text-[11px] text-[var(--text-muted)]/80">
              Dopo l’accesso verrà applicato automaticamente.
            </div>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
              placeholder="tuo@email.com"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-medium text-[var(--text-muted)]">
                Password
              </label>

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading || loading}
                className="text-[11px] font-medium text-[var(--accent)] hover:opacity-80 disabled:opacity-50"
              >
                {resetLoading ? "Invio link..." : "Password dimenticata"}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 pr-12 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
                placeholder="La tua password"
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[var(--border)] bg-black/30 px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] bg-black/60"
              />
              Ricordami
            </label>

            <Link href={registerHref} className="text-xs font-medium text-[var(--accent)] hover:opacity-80">
              Crea account
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-[var(--accent)]/40 transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            oppure
          </span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-black/40 px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]/70 hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continua con Google
        </button>

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Accedendo accetti i Termini e la Privacy.
        </p>
      </div>
    </div>
  );
}
