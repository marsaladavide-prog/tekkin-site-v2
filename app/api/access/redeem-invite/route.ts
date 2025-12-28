import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/app/api/artist/profile";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code) return NextResponse.json({ error: "Codice mancante" }, { status: 400 });

    const admin = getSupabaseAdmin();

    const { data: inv, error: invErr } = await admin
      .from("invite_codes")
      .select("code, max_uses, used_count, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (invErr || !inv) return NextResponse.json({ error: "Codice non valido" }, { status: 400 });

    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Codice scaduto" }, { status: 400 });
    }

    if ((inv.used_count ?? 0) >= (inv.max_uses ?? 0)) {
      return NextResponse.json({ error: "Codice esaurito" }, { status: 400 });
    }

    await admin.from("invite_redemptions").insert({ code, user_id: user.id }).throwOnError();

    await admin
      .from("invite_codes")
      .update({ used_count: (inv.used_count ?? 0) + 1 })
      .eq("code", code)
      .throwOnError();

    await admin
      .from("artist_access")
      .upsert(
        {
          user_id: user.id,
          plan: "pro",
          access_status: "active",
          source: "invite",
          invite_code: code,
        },
        { onConflict: "user_id" }
      )
      .throwOnError();

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[redeem-invite] unexpected", err);
    return NextResponse.json({ error: "Errore inatteso" }, { status: 500 });
  }
}
