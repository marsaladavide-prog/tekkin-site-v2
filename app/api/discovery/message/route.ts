import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = (await req.json().catch(() => null)) as {
      request_id?: string;
      message?: string;
      receiver_id?: string | null;
    };
    const { request_id, message, receiver_id } = payload ?? {};

    if (!request_id || !message?.trim()) {
      return NextResponse.json(
        { error: "request_id_message_missing" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { error: insertError } = await supabase.from("discovery_messages").insert({
      request_id,
      sender_id: user.id,
      receiver_id: receiver_id ?? null,
      message: message.trim(),
    });

    if (insertError) {
      console.error("[discovery][message] insert err", insertError);
      return NextResponse.json(
        { error: "message_insert_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[discovery][message] unexpected", err);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
