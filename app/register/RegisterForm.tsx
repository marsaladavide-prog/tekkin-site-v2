"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function RegisterForm() {
  const sp = useSearchParams() ?? new URLSearchParams();
  const next = sp.get("next") ?? "/pricing";
  const redeemFromUrl = sp.get("redeem") ?? "";

  const [artistName, setArtistName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState(redeemFromUrl);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signupComplete, setSignupComplete] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const name = artistName.trim();
    const mail = email.trim();

    if (!name) {
      setErrorMsg("Inserisci il tuo nome artista");
      return;
    }

    if (!mail) {
      setErrorMsg("Inserisci una email");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("La password deve avere almeno 6 caratteri");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMsg("Le password non coincidono");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const code = inviteCode.trim().toUpperCase();
      const redirectTo = code
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&redeem=${encodeURIComponent(code)}`
        : `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: {
          data: { artist_name: name },
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setErrorMsg(error.message || "Registrazione non riuscita");
        return;
      }

      if (data) setSignupComplete(true);
    } catch (err) {
      console.error("Signup error", err);
      setErrorMsg("Si è verificato un errore durante la registrazione");
    } finally {
      setLoading(false);
    }
  }

  const loginHref =
    next || inviteCode
      ? `/login?next=${encodeURIComponent(next)}&redeem=${encodeURIComponent(inviteCode.trim().toUpperCase())}`
      : "/login";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black px-4">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-[0.04]" />
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-20 -left-10 h-56 w-56 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--sidebar-bg)]/80 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.25em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Tekkin Artist
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Crea il tuo profilo Tekkin
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Un unico accesso per sbloccare dashboard, Tekkin Rank e collegare i tuoi canali.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar-bg)]/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          {signupComplete ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
                <p className="font-semibold">Controlla la tua email</p>
                <p className="mt-1 text-xs text-emerald-100/80">
                  Ti abbiamo inviato un link di conferma a{" "}
                  <span className="font-mono">{email}</span>. Clicca il link per
                  attivare il tuo account Tekkin Artist.
                </p>
                <p className="mt-2 text-[11px] text-emerald-100/70">
                  Dopo il click verrai portato alla pagina pricing. Se hai inserito un codice, verrà applicato automaticamente.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSignupComplete(false);
                  setPassword("");
                  setPasswordConfirm("");
                }}
                className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-black/40 px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]/70 hover:text-[var(--accent)]"
              >
                Torna alla registrazione
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                  Nome artista
                </label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setArtistName(e.target.value)}
                  placeholder="Es. Davide Marsala"
                  className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  placeholder="tuo@email.com"
                  className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                  Codice invito (opzionale)
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteCode(e.target.value)}
                  placeholder="Es. FRIENDS"
                  className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    placeholder="Minimo 6 caratteri"
                    className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">
                    Conferma password
                  </label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordConfirm(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-black/60 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/60 outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/70"
                  />
                </div>
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
                {loading ? "Creo il tuo profilo..." : "Crea profilo Tekkin"}
              </button>

              <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Hai già un account</span>
                <Link href={loginHref} className="font-medium text-[var(--accent)] hover:opacity-80">
                  Vai al login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
