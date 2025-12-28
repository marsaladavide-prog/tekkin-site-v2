"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type RedeemResult =
  | { ok: true; plan: string; current_period_end: string }
  | { ok: false; error: string };

function formatDateIT(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function humanRedeemError(code: string) {
  switch (code) {
    case "not_authenticated":
      return "Devi effettuare l’accesso per usare un codice.";
    case "invalid_code":
      return "Codice non valido.";
    case "code_inactive":
      return "Codice disattivato.";
    case "code_expired":
      return "Codice scaduto.";
    case "code_max_uses_reached":
      return "Codice già utilizzato.";
    case "code_already_used_by_you":
      return "Hai già usato questo codice.";
    default:
      return "Qualcosa non ha funzionato. Riprova.";
  }
}

export default function PricingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const plans = useMemo(
    () => [
      {
        name: "Free",
        price: "0€",
        note: "Per esplorare Tekkin",
        features: [
          "Charts pubblici",
          "Preview del profilo artista",
          "Accesso limitato al workspace",
        ],
        cta: { label: "Crea account", href: "/login" },
        highlighted: false,
      },
      {
        name: "Pro",
        price: "4€",
        note: "al mese",
        features: [
          "Workspace Projects + Versions",
          "Analyzer completo con report e consigli",
          "Upload e gestione tracce private e pubbliche",
          "Accesso alle classifiche come artista",
        ],
        cta: { label: "Attiva Pro", href: "/api/billing/checkout" },
        highlighted: true,
      },
    ],
    []
  );

  async function redeem() {
    const c = code.trim().toUpperCase();
    if (!c) return toast.error("Inserisci un codice.");
    setRedeeming(true);

    try {
      const res = await fetch("/api/access/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c }),
      });

      // se non autenticato: porta a login e preserva il codice
      if (res.status === 401) {
        const next = encodeURIComponent("/pricing");
        const redeem = encodeURIComponent(c);
        router.push(`/login?next=${next}&redeem=${redeem}`);
        return;
      }

      const data = await res.json();

      if (!data?.ok) {
        toast.error(humanRedeemError(data?.error ?? "unknown"));
        return;
      }

      toast.success(
        `Accesso attivato fino al ${formatDateIT(data.current_period_end)}`
      );
      router.push("/artist");
      router.refresh();
    } catch {
      toast.error("Errore di rete. Riprova.");
    } finally {
      setRedeeming(false);
    }
  }

  useEffect(() => {
    const redeemQ = searchParams?.get("redeem");
    if (!redeemQ) return;

    // precompila campo e tenta redeem una sola volta
    const cleaned = redeemQ.trim().toUpperCase();
    if (!cleaned) return;

    setCode(cleaned);

    // rimuovi query subito per evitare loop (push senza redeem)
    router.replace("/pricing");
    // tenta redeem
    void (async () => {
      setRedeeming(true);
      try {
        const res = await fetch("/api/access/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: cleaned }),
        });
        const data = await res.json();
        if (!data?.ok) {
          toast.error(humanRedeemError(data?.error ?? "unknown"));
          return;
        }
        toast.success(
          `Accesso attivato fino al ${formatDateIT(data.current_period_end)}`
        );
        router.push("/artist");
        router.refresh();
      } catch {
        toast.error("Errore di rete. Riprova.");
      } finally {
        setRedeeming(false);
      }
    })();
  }, [searchParams, router]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-10">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          Tekkin Artist
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Sblocca Tekkin Artist
        </h1>
        <p className="mt-2 max-w-2xl text-base text-white/70">
          Carica, analizza e migliora le tue tracce con un percorso chiaro. Meno caos, più crescita.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-sm text-white/70">
          <span className="rounded-full bg-white/5 px-3 py-1">Analyzer leggibile</span>
          <span className="rounded-full bg-white/5 px-3 py-1">Projects + Versions</span>
          <span className="rounded-full bg-white/5 px-3 py-1">Charts e ranking</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <div
            key={p.name}
            className={[
              "rounded-2xl border p-5",
              p.highlighted
                ? "border-white/20 bg-white/7 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                : "border-white/10 bg-white/5",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">{p.name}</div>
                <div className="mt-1 text-sm text-white/60">{p.note}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-semibold text-white">{p.price}</div>
                <div className="text-xs text-white/60">{p.name === "Pro" ? "al mese" : ""}</div>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-white/75">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-white/10" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <a
                href={p.cta.href}
                className={[
                  "inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition",
                  p.highlighted
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/10 text-white hover:bg-white/15",
                ].join(" ")}
              >
                {p.cta.label}
              </a>
              {p.highlighted ? (
                <div className="mt-2 text-xs text-white/55">
                  Accesso immediato al workspace. Se hai un codice, puoi attivare senza pagamento.
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-base font-semibold text-white">Hai un codice?</div>
        <div className="mt-1 text-sm text-white/65">
          Inseriscilo qui per attivare l’accesso.
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Es. FRIENDS"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/25"
            autoCapitalize="characters"
          />
          <button
            onClick={redeem}
            disabled={redeeming}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:opacity-60"
          >
            {redeeming ? "Attivazione..." : "Attiva"}
          </button>
        </div>

        <div className="mt-3 text-xs text-white/55">
          I codici hanno una durata limitata e possono essere monouso o multiuso.
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-base font-semibold text-white">FAQ</div>
          <div className="mt-4 space-y-4 text-sm text-white/70">
            <div>
              <div className="font-medium text-white">Cosa succede se scade il periodo?</div>
              <div className="mt-1">
                Perdi l’accesso al workspace finché non riattivi un piano.
              </div>
            </div>
            <div>
              <div className="font-medium text-white">Posso condividere una traccia?</div>
              <div className="mt-1">
                Sì, puoi tenerla privata o condividerla con link segreto. Le tracce pubbliche possono finire in classifica.
              </div>
            </div>
            <div>
              <div className="font-medium text-white">Cosa include l’Analyzer?</div>
              <div className="mt-1">
                Report leggibile con metriche e consigli pratici per migliorare mix e master.
              </div>
            </div>
            <div>
              <div className="font-medium text-white">Posso passare a Pro più avanti?</div>
              <div className="mt-1">
                Sì, in qualsiasi momento.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-base font-semibold text-white">Cosa ottieni con Pro</div>
          <div className="mt-4 grid gap-3 text-sm text-white/70">
            <div className="rounded-xl bg-black/25 p-4">Un posto unico per progetti, versioni e file.</div>
            <div className="rounded-xl bg-black/25 p-4">Analisi che porta a decisioni, non solo numeri.</div>
            <div className="rounded-xl bg-black/25 p-4">Sistema di ranking e crescita misurabile.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
