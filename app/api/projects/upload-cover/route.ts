import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// bucket che hai già in Supabase
const BUCKET_NAME = "project_covers";

// 5 MB = 5 * 1024 * 1024 = 5 * 1024 * 1024 = 5 * 1_048_576 = 5_242_880 bytes
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Estensioni concesse
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

// Mime types concessi
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !serviceRoleKey) {
      console.error("[upload-cover] missing env for storage service");
      return NextResponse.json(
        {
          ok: false,
          error: "Configurazione storage mancante",
        },
        { status: 500 }
      );
    }
    const storageClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[upload-cover] auth error:", authError);
      return NextResponse.json(
        {
          ok: false,
          error: "Non autenticato",
          supabaseError: authError?.message ?? null,
        },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const projectId = formData.get("projectId");

    if (!(file instanceof File) || typeof projectId !== "string") {
      console.error("[upload-cover] file o projectId mancanti", {
        hasFile: file instanceof File,
        projectId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "File o projectId mancanti",
        },
        { status: 400 }
      );
    }

    // 1) VALIDAZIONE PESO
    // file.size è in byte
    if (file.size > MAX_FILE_SIZE_BYTES) {
      console.warn("[upload-cover] file troppo pesante", {
        size: file.size,
        max: MAX_FILE_SIZE_BYTES,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "L'immagine è troppo pesante. Massimo 5 MB.",
          details: {
            size: file.size,
            max: MAX_FILE_SIZE_BYTES,
          },
        },
        { status: 400 }
      );
    }

    // 2) VALIDAZIONE ESTENSIONE E MIME
    const originalName = file.name || "cover";
    const ext = originalName.split(".").pop()?.toLowerCase() || "png";

    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      console.warn("[upload-cover] estensione non valida", { ext });

      return NextResponse.json(
        {
          ok: false,
          error: "Formato immagine non supportato. Usa PNG, JPG, JPEG o WEBP.",
          details: { ext },
        },
        { status: 400 }
      );
    }

    if (
      file.type &&
      !ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())
    ) {
      console.warn("[upload-cover] mime type non valido", {
        type: file.type,
      });

      return NextResponse.json(
        {
          ok: false,
          error: "Tipo di file non valido.",
          details: { mime: file.type },
        },
        { status: 400 }
      );
    }

    // 3) STRUTTURA CARTELLE
    // covers/<userId>/<projectId>/cover.<ext>
    const safeUserId = user.id; // puoi usare users_profile se preferisci
    const filePath = `covers/${safeUserId}/${projectId}/cover.${ext}`;

    console.log("[upload-cover] uploading file", {
      bucket: BUCKET_NAME,
      path: filePath,
      size: file.size,
      type: file.type,
    });

    // 4) UPLOAD CON UPSERT = true
    // Se l'utente ricarica la cover, questa sovrascrive la precedente
    const { data: uploadData, error: uploadError } = await storageClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type || "image/png",
      });

    if (uploadError) {
      console.error("[upload-cover] errore upload storage:", uploadError);

      const errAny = uploadError as any;

      return NextResponse.json(
        {
          ok: false,
          error: "Errore durante il caricamento su Storage",
          supabaseError: {
            message: errAny?.message ?? "Storage upload error",
            code: errAny?.code ?? errAny?.statusCode ?? null,
            details: errAny,
          },
        },
        { status: 500 }
      );
    }


    // 5) URL pubblico della cover
    const { data: publicUrlData } = await storageClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path);

    const coverUrl = publicUrlData.publicUrl;
    console.log("[upload-cover] coverUrl", coverUrl);

    // 6) Aggiorna la tabella projects con la nuova cover
    const { error: updateError } = await supabase
      .from("projects")
      .update({
        cover_url: coverUrl,
        cover_path: uploadData.path,
      })
      .eq("id", projectId)
      .eq("user_id", user.id);


    if (updateError) {
      console.error("[upload-cover] errore update projects:", updateError);

      return NextResponse.json(
        {
          ok: false,
          error: "Errore aggiornando il progetto con la cover",
          supabaseError: {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
          },
          coverUrl,
          storagePath: uploadData.path,
        },
        { status: 500 }
      );
    }

    // 7) Risposta sempre JSON e utile
    return NextResponse.json(
      {
        ok: true,
        error: null,
        coverUrl,
        storagePath: uploadData.path,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("[upload-cover] errore imprevisto:", err);

    return NextResponse.json(
      {
        ok: false,
        error: "Errore imprevisto durante l'upload della cover",
        details:
          err instanceof Error
            ? { message: err.message, stack: err.stack }
            : { message: String(err) },
      },
      { status: 500 }
    );
  }
}
