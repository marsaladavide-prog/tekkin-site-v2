"use client";
import { ReactNode, useEffect } from "react";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { supabase } from "@/lib/supabaseClient";

// opzionale ma utile: re-render quando cambia lo stato auth
export default function SupabaseProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, _session) => {
      // forza un re-render su cambio auth (utile in dev)
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return <SessionContextProvider supabaseClient={supabase}>{children}</SessionContextProvider>;
}
