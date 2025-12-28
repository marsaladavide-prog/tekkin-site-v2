"use client";

import { useState } from "react";

export default function RedeemCodeForm() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/access/redeem-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Errore redeem");

      setMsg("Accesso attivato. Ti porto nell'area artista.");
      window.location.href = "/artist";
    } catch (err: any) {
      setMsg(err?.message || "Errore");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Inserisci codice"
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          disabled={loading || !code.trim()}
          type="submit"
          className="rounded-pill bg-[var(--accent)] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-black transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "..." : "Sblocca"}
        </button>
      </div>
      {msg ? <p className="text-xs text-[var(--muted)]">{msg}</p> : null}
    </form>
  );
}
