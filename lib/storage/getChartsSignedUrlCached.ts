import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

function normPath(raw: string) {
  let p = raw.trim();
  if (p.startsWith("tracks/")) p = p.slice("tracks/".length);
  if (p.startsWith("/")) p = p.slice(1);
  return p;
}

async function signOnce(
  supabase: SupabaseClient,
  bucket: string,
  rawPath: string,
  expiresIn: number
) {
  const path = normPath(rawPath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function getChartsSignedUrlCached(
  supabase: SupabaseClient,
  bucket: string,
  rawPath: string
) {
  const expiresIn = 60 * 60; // 60 min
  const revalidate = 60 * 20; // 20 min

  const key = `charts:signed:${bucket}:${rawPath}`;

  return unstable_cache(
    () => signOnce(supabase, bucket, rawPath, expiresIn),
    [key],
    { revalidate }
  )();
}
