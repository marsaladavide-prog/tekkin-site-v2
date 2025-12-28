import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { code } = await req.json().catch(() => ({}));

  const raw = typeof code === "string" ? code : "";
  const cleaned = raw.trim().toUpperCase();

  if (!cleaned) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("tekkin_redeem_invite_code_v1", {
    p_code: cleaned,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: "rpc_error" }, { status: 500 });
  }

  return NextResponse.json(data);
}
