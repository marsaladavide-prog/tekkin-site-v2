import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { ArtistSignupMetadata } from "@/types/supabase";
import { ensureProfileAndArtist } from "@/utils/profile/ensureProfile";

export async function POST() {
  try {
    const supabase = supabaseServer();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const metadata = (user.user_metadata || {}) as ArtistSignupMetadata;

    await ensureProfileAndArtist({
      supabase,
      userId: user.id,
      metadata,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("ensure profile error", err);
    return NextResponse.json(
      { error: err?.message || "Errore ensure profile" },
      { status: 500 }
    );
  }
}
