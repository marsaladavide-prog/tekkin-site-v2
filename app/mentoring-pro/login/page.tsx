"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/mentoring-pro";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // se già loggato, vai a next
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(next);
    })();
  }, [router, next]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message || "Login fallito");
      return;
    }
    router.replace(next);
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-3 rounded-xl border border-zinc-800 p-4">
        <h1 className="text-xl font-semibold">Mentoring Pro — Login</h1>
        <input
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          placeholder="Email"
          type="email"
          value={email} onChange={(e)=>setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          placeholder="Password"
          type="password"
          value={password} onChange={(e)=>setPassword(e.target.value)}
          required
        />
        {err && <div className="text-sm text-red-400">{err}</div>}
        <button
          disabled={busy}
          className="w-full rounded-md bg-white text-black px-3 py-2 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Entrando..." : "Entra"}
        </button>
      </form>
    </main>
  );
}
