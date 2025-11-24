"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Login non riuscito");
      return;
    }

    router.push("/artist");
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (err: any) {
      setError(err?.message || "Accesso con Google non riuscito");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-tekkin-border bg-black/60 p-6 shadow-xl">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-white">Accedi</h1>
        <p className="text-sm text-gray-400">
          Entra con email e password oppure usa Google.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleLogin}>
        <div className="space-y-1">
          <label className="text-xs font-mono text-gray-400 uppercase">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-tekkin-border bg-black/50 px-3 py-3 text-sm text-white outline-none focus:border-tekkin-primary focus:ring-1 focus:ring-tekkin-primary"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-mono text-gray-400 uppercase">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-tekkin-border bg-black/50 px-3 py-3 text-sm text-white outline-none focus:border-tekkin-primary focus:ring-1 focus:ring-tekkin-primary"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-tekkin-primary px-4 py-3 text-sm font-semibold text-black transition hover:bg-tekkin-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Accesso in corso..." : "Login"}
        </button>
      </form>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-tekkin-border bg-black/40 px-4 py-3 text-sm font-medium text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 533.5 544.3"
            aria-hidden="true"
          >
            <path
              fill="#4285f4"
              d="M533.5 278.4c0-17.4-1.6-34.1-4.6-50.4H272v95.4h146.9c-6.3 34-25.1 62.8-53.4 82l86.4 67c50.4-46.5 81.6-115 81.6-194z"
            />
            <path
              fill="#34a853"
              d="M272 544.3c72.6 0 133.6-24 178.1-65.5l-86.4-67c-24 16.1-54.7 25.6-91.7 25.6-70.5 0-130.2-47.5-151.6-111.5l-89.9 69.2c44.7 88.5 136.3 149.2 241.5 149.2z"
            />
            <path
              fill="#fbbc04"
              d="M120.4 325.9c-10.6-31.8-10.6-66 0-97.8l-89.9-69.2c-39.4 78.2-39.4 158 0 236.2l89.9-69.2z"
            />
            <path
              fill="#ea4335"
              d="M272 107.7c39.5-.6 77.4 13.9 106.4 40.7l79.4-79.4C405.4 24.5 339.1-2.8 272 0 166.8 0 75.2 60.7 30.5 149.2l89.9 69.2C141.8 155.2 201.5 107.7 272 107.7z"
            />
          </svg>
          Continua con Google
        </button>
      </div>

      <p className="mt-3 text-center text-sm text-gray-400">
        Non hai un account?
        <Link href="/register" className="text-tekkin hover:underline">
          {" "}
          Registrati
        </Link>
      </p>
    </div>
  );
}
