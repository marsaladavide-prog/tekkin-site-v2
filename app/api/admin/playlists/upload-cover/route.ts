import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/admin/auth";

const BUCKET_NAME = "playlist-covers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const auth = await ensureAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File mancante" }, { status: 400 });
    }
    const name = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const path = `covers/${Date.now()}_${name}`;
    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await auth.admin.storage
      .from(BUCKET_NAME)
      .upload(path, new Uint8Array(buffer), {
        cacheControl: "3600",
        upsert: true,
      });
    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = await auth.admin
      .storage.from(BUCKET_NAME)
      .getPublicUrl(path);
    if (!urlData?.publicUrl) {
      throw new Error("Impossibile ottenere l'URL pubblico della cover.");
    }
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore upload cover";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
