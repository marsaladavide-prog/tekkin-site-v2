import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeTrackPath(p: string) {
  let path = p.trim();
  if (!path) return null;
  if (path.startsWith("tracks/")) path = path.slice("tracks/".length);
  if (path.startsWith("/")) path = path.slice(1);
  return path || null;
}

export async function signTrackUrl(
  supabaseAdmin: SupabaseClient,
  audioPath: string | null,
  expiresInSeconds = 60 * 30
): Promise<string | null> {
  if (!audioPath) return null;

  const path = normalizeTrackPath(audioPath);
  if (!path) return null;

  const { data, error } = await supabaseAdmin.storage
    .from("tracks")
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("[signTrackUrl] error:", error.message, { audioPath, path });
    return null;
  }

  return data?.signedUrl ?? null;
}
