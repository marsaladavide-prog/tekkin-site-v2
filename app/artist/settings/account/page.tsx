"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

import ArtistSettingsHeader from "@/components/settings/ArtistSettingsHeader";

export default function ArtistAccountSettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState("Free");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          throw error;
        }
        if (!data?.user) {
          throw new Error("Utente non autenticato");
        }

        if (!mounted) return;

        setEmail(data.user.email ?? null);
        const metadataPlan =
          data.user.app_metadata?.plan ??
          data.user.user_metadata?.plan ??
          "Free";
        setPlan(typeof metadataPlan === "string" ? metadataPlan : "Free");
      } catch (err) {
        console.error("Account load error", err);
        if (mounted) {
          setErrorMessage("Non riesco a leggere il tuo account Tekkin.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleLogout = async () => {
    setLogoutError(null);
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut();
    if (error) {
      setLogoutError("Impossibile disconnettersi, riprova.");
      setIsLoggingOut(false);
      return;
    }

    router.push("/login");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/70">
        Recupero informazioni account...
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <ArtistSettingsHeader
        title="Account Tekkin"
        description="Email, piano attivo e accesso sicuro."
      />

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 shadow-xl backdrop-blur">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
              Email
            </p>
            <p className="text-sm text-white">
              {email ?? (
                <span className="text-white/40">Email non disponibile</span>
              )}
            </p>
            <p className="text-[11px] text-white/50">
              Letta da Supabase auth. Nessuna mail sensibile viene salvata in chiaro.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
              Piano attivo
            </p>
            <p className="text-sm text-white">{plan}</p>
            <p className="text-[11px] text-white/50">
              TODO: collegare la logica di upgrade per mostrare Pro/Free reale.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {logoutError ? (
          <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
            {logoutError}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-full border border-white/10 bg-black/60 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 hover:text-white disabled:opacity-60"
          >
            {isLoggingOut ? "Disconnessione..." : "Logout"}
          </button>
        </div>
      </div>
    </section>
  );
}
