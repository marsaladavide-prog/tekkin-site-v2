"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export default function ArtistPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!error && user) {
          setIsLoggedIn(true);
          // utente loggato: lo mandiamo direttamente ai projects
          router.push("/artist/projects");
        } else {
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("ArtistPage auth check error:", err);
        setIsLoggedIn(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    void checkAuth();
  }, [router]);

  // mentre controlliamo auth, solo un piccolo placeholder
  if (checkingAuth) {
    return (
      <div className="w-full max-w-5xl mx-auto py-10 text-sm text-white/60">
        Verifica accesso in corso...
      </div>
    );
  }

  // se è loggato, non renderizziamo nulla perché lo stiamo già redirigendo
  if (isLoggedIn) {
    return null;
  }

  // non loggato: pagina “landing” di Tekkin Artist
  return (
    <div className="w-full max-w-5xl mx-auto py-10">
      <div className="rounded-3xl border border-white/10 bg-black/60 px-6 py-8 shadow-[0_0_40px_rgba(0,0,0,0.8)]">
        <h1 className="text-2xl font-semibold text-white">
          Tekkin Artist Dashboard
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Carica le tue tracce, lancia Tekkin Analyzer PRO e tieni
          traccia delle versioni in un unico posto. Per continuare ti
          serve un account Tekkin.
        </p>

        <ul className="mt-5 text-xs text-white/70 space-y-1.5">
          <li>• Crea projects per ogni traccia o EP</li>
          <li>• Carica versioni diverse (mix, master, alternative)</li>
          <li>• Analizza con Tekkin Analyzer PRO e leggi il report</li>
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium bg-[var(--accent)] text-black hover:opacity-90"
          >
            Crea il tuo profilo
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium border border-white/25 text-white hover:bg-white/5"
          >
            Accedi
          </Link>
        </div>

        <p className="mt-3 text-[11px] text-white/50">
          Dopo il login verrai portato direttamente alla pagina Projects,
          dove potrai creare il tuo primo project.
        </p>
      </div>
    </div>
  );
}
