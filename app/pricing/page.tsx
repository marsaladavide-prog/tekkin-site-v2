import AppShell from "@/components/ui/AppShell";
import RedeemCodeForm from "./RedeemCodeForm";

export default function PricingPage() {
  return (
    <AppShell className="bg-[var(--bg)]">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--muted)]">
          Tekkin Artist
        </p>
        <h1 className="text-3xl font-semibold text-[var(--text)]">Pricing</h1>
        <p className="text-sm text-[var(--muted)]">
          Per usare Projects, Analyzer e Signals serve l'accesso artista.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-soft-xl">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--text)]">Pro</h2>
            <p className="text-sm text-[var(--muted)]">
              Tutti i tool Tekkin in un unico piano.
            </p>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <div className="text-3xl font-semibold text-[var(--text)]">4EUR</div>
              <div className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                al mese
              </div>
            </div>
            <button
              type="button"
              disabled
              className="rounded-pill bg-white/10 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/60"
            >
              Abbonati (Stripe prossimamente)
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-6 shadow-soft-xl">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--text)]">Hai un codice?</h2>
            <p className="text-sm text-[var(--muted)]">
              Riscatta un invito per attivare subito l'area artista.
            </p>
          </div>
          <div className="mt-5">
            <RedeemCodeForm />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
