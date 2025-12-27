import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

function normalizeTrackPath(p: string) {
  let path = p.trim();
  if (!path) return null;
  if (path.startsWith("tracks/")) path = path.slice("tracks/".length);
  if (path.startsWith("/")) path = path.slice(1);
  return path || null;
}

type Mode = "signed" | "public";

async function _getTrackUrl(
  supabase: SupabaseClient,
  bucket: string,
  rawPath: string,
  mode: Mode,
  expiresInSeconds: number
): Promise<string | null> {
  const path = normalizeTrackPath(rawPath);
  if (!path) return null;

  if (mode === "public") {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl ?? null;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// Cache per path, così non rigeneri signed URL 100 volte a refresh pagina.
// revalidate va tenuto < expiresInSeconds.
export function getTrackUrlCached(
  supabase: SupabaseClient,
  bucket: string,
  rawPath: string,
  opts?: { mode?: Mode; expiresInSeconds?: number; revalidateSeconds?: number }
) {
  const mode = opts?.mode ?? "signed";
  const expiresInSeconds = opts?.expiresInSeconds ?? 60 * 60;
  const revalidateSeconds = opts?.revalidateSeconds ?? 60 * 20;

  const norm = normalizeTrackPath(rawPath);
  if (!norm) return Promise.resolve(null);

  const safeRevalidate = Math.max(1, Math.min(revalidateSeconds, expiresInSeconds - 5));

  const key = `track-url:${bucket}:${mode}:${norm}`;

  const cachedFn = unstable_cache(
    async () => _getTrackUrl(supabase, bucket, norm, mode, expiresInSeconds),
    [key],
    { revalidate: safeRevalidate }
  );

  return cachedFn();
}
