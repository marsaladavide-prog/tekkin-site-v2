import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "@/app/api/projects/helpers";

const SIGNED_URL_TTL = 60 * 5;

function sanitizeFileName(value: string) {
  const safe = value
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "tekkin-audio";
}

function getExtensionFromPath(value: string | null) {
  if (!value) return "mp3";
  const parsed = value.split("?")[0].split("#")[0];
  const parts = parsed.split(".");
  const ext = parts.length > 1 ? parts.pop() : null;
  return ext ? ext.toLowerCase() : "mp3";
}

async function proxyDownload(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Errore fetching audio");
  }

  const headers = new Headers(response.headers);
  headers.set("Content-Disposition", `attachment; filename="${sanitizeFileName(fileName)}"`);
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }
  headers.set("Cache-Control", "no-cache");

  return new NextResponse(response.body, {
    headers,
    status: 200,
  });
}

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { supabase, user, authError } = await getAuthenticatedSupabase();
    if (authError || !user) {
      return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get("project_id");
    if (!projectId) {
      return NextResponse.json({ error: "project_id mancante" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("project_versions")
      .select("id, audio_path, audio_url, projects(id, title, user_id)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[download-latest] fetch versions error", error);
      return NextResponse.json({ error: "Errore recuperando le versioni" }, { status: 500 });
    }

    const version = (data ?? []).find((v) => v.audio_path || v.audio_url) ?? null;
    if (!version) {
      return NextResponse.json({ error: "Nessuna versione con audio disponibile" }, { status: 404 });
    }

    const project = version.projects;
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const extension = getExtensionFromPath(version.audio_path ?? version.audio_url ?? null);
    const baseName = project.title ?? project.id;
    const fileName = `tekkin-${sanitizeFileName(baseName)}-${version.id}.${extension}`;

    if (version.audio_path) {
      const { data: signed, error: signedError } = await supabase.storage
        .from("tracks")
        .createSignedUrl(version.audio_path, SIGNED_URL_TTL);

      if (signedError || !signed?.signedUrl) {
        console.error("[download-latest] signed url error", signedError);
        return NextResponse.json({ error: "Impossibile firmare l'audio" }, { status: 500 });
      }

      return await proxyDownload(signed.signedUrl, fileName);
    }

    if (version.audio_url) {
      return await proxyDownload(version.audio_url, fileName);
    }

    return NextResponse.json({ error: "Audio non disponibile" }, { status: 404 });
  } catch (err) {
    console.error("[download-latest] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
