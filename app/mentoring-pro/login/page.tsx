"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const gridPattern =
  // griglia grigio/nero stile manifesto pixel
  "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'%3e%3crect width='14' height='14' fill='rgb(5,5,5)'/%3e%3crect x='1' y='1' width='12' height='12' fill='rgba(62,62,62,0.92)'/%3e%3c/svg%3e";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const nextRoute = params.get("next") || "/mentoring-pro";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [statusHint, setStatusHint] = useState<string | null>(null);

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
  const canSubmit = emailValid && password.length >= 6 && !busy;

  // se gia loggato, vai a next
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setStatusHint("Sessione gia attiva, ti porto dentro...");
        router.replace(nextRoute);
      } else {
        setStatusHint("Nessuna sessione attiva, procedi con il login.");
      }
    })();
  }, [router, nextRoute]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setEmailTouched(true);
      return;
    }
    setBusy(true);
    setErr(null);
    setStatusHint("Invio credenziali a Supabase...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setBusy(false);

    if (error) {
      setErr(error.message || "Login fallito");
      setStatusHint("Qualcosa non va, controlla i dati.");
      return;
    }
    setStatusHint("Accesso riuscito, sto reindirizzando.");
    router.replace(nextRoute);
  }

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setErr(null);
    setEmailTouched(false);
    setStatusHint("Modulo resettato.");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#080808] to-[#050505]" />
        <div
          className="absolute inset-0 animate-[pixelFlow_16s_linear_infinite] opacity-95"
          style={{
            backgroundImage: `url("${gridPattern}")`,
            backgroundSize: "14px 14px",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 mix-blend-multiply opacity-9 [background-size:42px_42px,64px_64px] [background-image:radial-gradient(circle,rgba(0,0,0,0.88) 45%,transparent 46%),radial-gradient(circle,rgba(0,0,0,0.65) 42%,transparent 43%)] animate-[pixelate_18s_steps(20)_infinite]" />
        <div className="absolute inset-0 mix-blend-multiply opacity-[0.88] [background-image:radial-gradient(circle_at_20%_25%,rgba(0,0,0,0.78),transparent_52%),radial-gradient(circle_at_78%_18%,rgba(0,0,0,0.72),transparent_55%),radial-gradient(circle_at_55%_70%,rgba(0,0,0,0.72),transparent_60%),radial-gradient(ellipse_at_40%_45%,rgba(0,0,0,0.6),transparent_58%)] animate-[maskDrift_22s_ease-in-out_infinite]" />
        <div className="absolute inset-0 mix-blend-screen opacity-28 [background-image:radial-gradient(circle_at_40%_50%,rgba(110,110,110,0.12),transparent_45%),radial-gradient(circle_at_75%_65%,rgba(90,90,90,0.08),transparent_48%)] animate-[glowShift_18s_ease-in-out_infinite]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
        <section className="relative z-10 space-y-5 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-lime-200 shadow-[0_0_30px_rgba(190,255,120,0.25)]">
            <Sparkles className="h-3 w-3" />
            Underground Access
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-[1.05] text-white md:text-5xl">
              Login bunker, mood club chiuso, zero fronzoli.
            </h1>
            <p className="text-base text-slate-300 md:text-lg">
              Pixel che si muovono come un visualizer a bassa risoluzione, copy asciutto, feedback immediati. Tutto quello che serve per entrare.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-lime-500/30 bg-lime-900/10 p-4 shadow-[0_15px_50px_rgba(190,255,120,0.15)]">
              <div className="flex items-center gap-2 text-lime-200">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Chiarezza immediata</span>
              </div>
              <p className="mt-1 text-sm text-slate-200">
                Email valida, min 6 char, badge errore nitido. Se sei gia loggato ti porto subito a {nextRoute}.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-700/70 bg-neutral-900/60 p-4 shadow-[0_15px_50px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-2 text-sky-200">
                <Rocket className="h-4 w-4" />
                <span className="text-sm font-medium">Flow rapido</span>
              </div>
              <p className="mt-1 text-sm text-slate-200">
                Toggle mostra password, reminder redirect, reset veloce. Tastiera pronta: Tab e Enter.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[12px] uppercase tracking-[0.18em] text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Crew only</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Night ride</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Analog glitch</span>
          </div>
          <div className="max-w-md rounded-2xl border border-white/5 bg-white/5 px-4 py-3 backdrop-blur shadow-[0_0_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/60 shadow-inner shadow-lime-500/10">
                <LockKeyhole className="h-4 w-4 text-lime-300" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[13px] uppercase tracking-[0.2em] text-lime-200">
                  Stato
                </div>
                <div className="text-slate-100">
                  {statusHint || "Controllo sessione in corso..."}
                </div>
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleLogin}
          className="relative z-10 w-full max-w-lg justify-self-end overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/85 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.7)] backdrop-blur"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-400/50 to-transparent" />
            <div className="absolute inset-x-10 top-10 h-[280px] translate-x-6 rotate-3 rounded-full bg-[radial-gradient(circle,rgba(190,255,120,0.14),transparent_55%)] blur-2xl" />
          </div>

          <div className="relative flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-lime-200">
                Access Hub
              </div>
              <h2 className="text-2xl font-semibold text-white">Mentoring Pro</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-lime-500/40 bg-lime-500/10 px-3 py-1.5 text-[12px] text-lime-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Supabase ready
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-lime-300" />
                  Email
                </span>
                {emailTouched && !emailValid && (
                  <span className="text-xs text-amber-300">Formato non valido</span>
                )}
              </div>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-white/10 bg-[#0f0f0f]/80 px-4 py-3 text-[15px] text-white outline-none ring-0 transition focus:border-lime-400/70 focus:bg-black focus:shadow-[0_0_0_4px_rgba(190,255,120,0.09)]"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  required
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                  {email ? (emailValid ? "ok" : "fix") : "req"}
                </div>
              </div>
            </label>

            <label className="block space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-200">
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-lime-300" />
                  Password
                </span>
                <span className="text-xs text-slate-400">Min 6 caratteri</span>
              </div>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-white/10 bg-[#0f0f0f]/80 px-4 py-3 text-[15px] text-white outline-none ring-0 transition focus:border-lime-400/70 focus:bg-black focus:shadow-[0_0_0_4px_rgba(190,255,120,0.09)]"
                  placeholder="********"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-2 flex items-center rounded-md p-2 text-slate-300 hover:bg-white/5"
                  title={showPassword ? "Nascondi" : "Mostra"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-200">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={e => setRememberDevice(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black text-lime-400 accent-lime-400"
              />
              <span>Ricorda questo dispositivo</span>
            </label>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span>Redirect:</span>
              <code className="rounded bg-white/5 px-2 py-1 text-[11px] text-lime-200">
                {nextRoute}
              </code>
            </div>
          </div>

          {err && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              <span className="h-2 w-2 rounded-full bg-red-300" />
              {err}
            </div>
          )}

          <div className="mt-6 flex">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-lime-400 to-slate-200 px-4 py-3 text-[15px] font-semibold text-black shadow-[0_20px_60px_rgba(190,255,120,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  Entra ora
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={clearForm}
              className="underline-offset-4 hover:text-slate-200 hover:underline"
            >
              Reset modulo
            </button>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_0_6px_rgba(190,255,120,0.25)]" />
              Supabase Auth online
            </div>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes pixelFlow {
          0% {
            background-position: 0 0;
          }
          50% {
            background-position: 10px 8px;
          }
          100% {
            background-position: 0 0;
          }
        }
        @keyframes maskDrift {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          40% {
            transform: translate3d(6px, -6px, 0) scale(1.02);
          }
          70% {
            transform: translate3d(-8px, 5px, 0) scale(1.015);
          }
          100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes glowShift {
          0% {
            opacity: 0.18;
          }
          50% {
            opacity: 0.32;
          }
          100% {
            opacity: 0.18;
          }
        }
        @keyframes pixelate {
          0% {
            background-position: 0 0, 0 0;
          }
          40% {
            background-position: 6px 4px, -8px 7px;
          }
          80% {
            background-position: -10px -6px, 12px -8px;
          }
          100% {
            background-position: 0 0, 0 0;
          }
        }
      `}</style>
    </main>
  );
}
