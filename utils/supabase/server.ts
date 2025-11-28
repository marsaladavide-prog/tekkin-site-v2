// utils/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  // ATTENZIONE: con Next 15 cookies va awaitato
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars on server");
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        // qui usiamo solo lettura, basta questo
        return cookieStore.get(name)?.value;
      },
      set() {
        // no-op: nelle route API non ci serve modificare cookie
      },
      remove() {
        // no-op
      },
    },
  });

  return supabase;
}
