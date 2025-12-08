// app/api/projects/update-info/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type UpdateInfoBody = {
  projectId?: string;
  coverLink?: string | null;
  description?: string | null;
};

type UpdateInfoResponse = {
  ok: boolean;
  error?: string | null;
  project?: any;
  supabaseError?: {
    message: string;
    code: string | null;
    details: unknown;
  } | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[update-info] auth error:", authError);
      return NextResponse.json<UpdateInfoResponse>(
        {
          ok: false,
          error: "Non autenticato",
          supabaseError: authError
            ? {
                message: authError.message,
                code: authError.name,
                details: null,
              }
            : null,
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | UpdateInfoBody
      | null;

    const projectId = body?.projectId;
    const coverLink = body?.coverLink;
    const description = body?.description;

    if (!projectId) {
      console.error("[update-info] projectId mancante nel body", body);
      return NextResponse.json<UpdateInfoResponse>(
        {
          ok: false,
          error: "projectId mancante",
        },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {};

    if (typeof coverLink === "string") {
      updatePayload.cover_link = coverLink.trim();
    }

    if (typeof description === "string") {
      updatePayload.description = description.trim();
    }

    if (Object.keys(updatePayload).length === 0) {
      console.warn("[update-info] nessun campo da aggiornare", body);
      return NextResponse.json<UpdateInfoResponse>(
        {
          ok: false,
          error: "Nessun campo da aggiornare",
        },
        { status: 400 }
      );
    }

    const { data, error: updateError } = await supabase
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("[update-info] errore update projects:", updateError);
      const errAny = updateError as any;

      return NextResponse.json<UpdateInfoResponse>(
        {
          ok: false,
          error: "Errore aggiornando le info del progetto",
          supabaseError: {
            message: errAny?.message ?? "Supabase update error",
            code: errAny?.code ?? null,
            details: errAny,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json<UpdateInfoResponse>(
      {
        ok: true,
        error: null,
        project: data,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("[update-info] errore imprevisto:", err);

    return NextResponse.json<UpdateInfoResponse>(
      {
        ok: false,
        error: "Errore imprevisto durante l'aggiornamento del progetto",
        supabaseError: null,
      },
      { status: 500 }
    );
  }
}
