import { createClient } from "@/utils/supabase/client";

const cache = new Map<string, string>();

const isSupabaseSignedUrl = (url: string) => url.includes("/object/sign/") && url.includes("token=");

export async function getPlayableUrl(
  versionId: string,
  audioUrl: string | null,
  audioPath: string | null
): Promise<string | null> {
  const cached = cache.get(versionId);
  if (cached) return cached;

  const rawUrl = typeof audioUrl === "string" ? audioUrl.trim() : "";
  const rawPath = typeof audioPath === "string" ? audioPath.trim() : "";
  const pathCandidate = rawPath || (rawUrl && !rawUrl.startsWith("http") ? rawUrl : "");

  if (rawUrl && isSupabaseSignedUrl(rawUrl)) {
    cache.set(versionId, rawUrl);
    return rawUrl;
  }

  if (pathCandidate) {
    const res = await fetch("/api/storage/sign-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    });

    const payload = (await res.json().catch(() => null)) as { audio_url?: string; error?: string } | null;
    if (!res.ok) {
      console.error("[getPlayableUrl] sign-track failed:", payload?.error);
      return null;
    }

    const signed = typeof payload?.audio_url === "string" ? payload.audio_url : null;
    if (signed) cache.set(versionId, signed);
    return signed;
  }

  if (rawUrl) {
    cache.set(versionId, rawUrl);
    return rawUrl;
  }

  return null;
}
