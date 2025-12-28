import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ versionId: string }> }
) {
  const { versionId } = await ctx.params;

  if (!versionId) {
    return NextResponse.json({ error: "Missing versionId" }, { status: 400 });
  }

  const supabase = await createClient();

  // Proviamo a leggere sia analyzer_arrays (se esiste) sia arrays_blob_path
  // Se una colonna non esiste nel tuo schema, Supabase potrebbe dare errore.
  // Quindi facciamo 2 tentativi separati.
  let row: any = null;

  // Tentativo A: analyzer_arrays + arrays_blob_path
  {
    const { data, error } = await supabase
      .from("project_versions")
      .select("id, analyzer_arrays, arrays_blob_path")
      .eq("id", versionId)
      .maybeSingle();

    if (!error && data) row = data;
  }

  // Tentativo B: solo arrays_blob_path (se A fallisce o non torna nulla)
  if (!row) {
    const { data, error } = await supabase
      .from("project_versions")
      .select("id, arrays_blob_path")
      .eq("id", versionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "DB error" },
        { status: 500 }
      );
    }
    row = data;
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 1) Se analyzer_arrays esiste ed è già un JSON con loudness_stats, usalo
  const analyzerArrays = (row as any).analyzer_arrays;
  if (isObj(analyzerArrays) && isObj(analyzerArrays.loudness_stats)) {
    return NextResponse.json(analyzerArrays, { status: 200 });
  }

  // 2) Altrimenti prova a scaricare arrays.json dallo storage usando arrays_blob_path
  const path = (row as any).arrays_blob_path;
  if (typeof path !== "string" || path.length === 0) {
    return NextResponse.json({ error: "No arrays data available" }, { status: 404 });
  }

  // Scarica il file dallo storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("tracks")
    .download(path);

  if (downloadError || !fileData) {
    console.error("[arrays] Download error:", downloadError);
    return NextResponse.json(
      { error: "Failed to download arrays data" },
      { status: 500 }
    );
  }

  try {
    const text = await fileData.text();
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: 200 });
  } catch (parseError) {
    console.error("[arrays] Parse error:", parseError);
    return NextResponse.json(
      { error: "Invalid arrays data format" },
      { status: 500 }
    );
  }
}
