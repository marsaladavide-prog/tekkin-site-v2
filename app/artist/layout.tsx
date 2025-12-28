import type { ReactNode } from "react";
import AppShell from "@/components/ui/AppShell";
import ArtistSidebar from "@/components/nav/ArtistSidebar";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ArtistLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: access } = user
    ? await supabase
        .from("artist_access")
        .select("access_status, plan")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const accessStatus = access?.access_status ?? "inactive";
  const plan = access?.plan ?? "free";
  const isActive = Boolean(user && accessStatus === "active");
  const isUnauthenticated = !user;

  const heroTitle = isUnauthenticated ? "Tekkin Artist è riservato" : "Upgrade Tekkin Artist";
  const heroDescription = isUnauthenticated
    ? "Entra nella community Tekkin per gestire progetti, versioni e Tekkin Rank. Registrati o accedi per sbloccare strumenti e signals."
    : "L'accesso artista è inattivo. Attiva un piano o usa un codice invito per riaccendere Projects, Analyzer e Signals.";

  const primaryCta = isUnauthenticated
    ? { href: "/register", label: "Registrati gratis" }
    : { href: "/pricing", label: "Vai a pricing" };

  const secondaryCtas = isUnauthenticated
    ? [
        { href: "/login", label: "Ho già un account" },
        { href: "/pricing", label: "Oppure usa un codice" },
      ]
    : [
        { href: "/charts", label: "Vai a charts" },
        { href: "/discovery", label: "Vai a discovery" },
      ];

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black font-sans transition-colors">
      <ArtistSidebar />

      <main className="relative flex-1 overflow-y-auto">
        <AppShell className="bg-transparent" innerClassName="gap-6 px-0 py-8" maxWidth="full" fullHeight>
          {isActive ? (
            children
          ) : (
            <section className="relative mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-8 shadow-soft-xl">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[var(--muted)]">
                  Tekkin Artist
                </p>
                <h1 className="text-2xl font-semibold text-[var(--text)]">{heroTitle}</h1>
                <p className="text-sm text-[var(--muted)]">{heroDescription}</p>
              </div>

              {!isUnauthenticated && (
                <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4 text-xs text-[var(--muted)]">
                  <div className="flex items-center justify-between">
                    <span>Stato accesso</span>
                    <span className="text-[var(--text)]">{accessStatus}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Piano</span>
                    <span className="text-[var(--text)]">{plan}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Link
                  href={primaryCta.href}
                  className="inline-flex items-center justify-center rounded-pill bg-[var(--accent)] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-black shadow-[0_12px_40px_rgba(249,115,22,0.25)] transition hover:bg-[#ff8b3c]"
                >
                  {primaryCta.label}
                </Link>
                {secondaryCtas.map((cta) => (
                  <Link
                    key={cta.href}
                    href={cta.href}
                    className="inline-flex items-center justify-center rounded-pill border border-[var(--border)] bg-[var(--panel-soft)] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--text)] transition hover:border-[var(--accent)]"
                  >
                    {cta.label}
                  </Link>
                ))}
              </div>

              {isUnauthenticated && (
                <p className="text-xs text-[var(--muted)]">
                  Non hai ancora un account? Crea la tua crew Tekkin per pubblicare progetti, ricevere Signals e partecipare al ranking.
                </p>
              )}
            </section>
          )}
        </AppShell>
      </main>
    </div>
  );
}
