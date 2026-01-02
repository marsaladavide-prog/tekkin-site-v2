import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function parseAllowlist(raw: string): string[] {
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS = parseAllowlist(
  process.env.NEXT_PUBLIC_TEKKIN_ADMIN_EMAILS ?? ""
);
const ADMIN_USER_IDS = parseAllowlist(
  process.env.NEXT_PUBLIC_TEKKIN_ADMIN_USER_IDS ?? ""
);

function isAdminUser(user: User): boolean {
  const email = user.email?.toLowerCase();
  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const role = metadata.role ?? appMetadata.role;
  const isAdminFlag = metadata.is_admin === true || appMetadata.is_admin === true;

  if (email && ADMIN_EMAILS.includes(email)) return true;
  if (ADMIN_USER_IDS.includes(user.id.toLowerCase())) return true;
  if (role === "admin") return true;
  if (isAdminFlag) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminUser(data.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const secret = process.env.TEKKIN_CRON_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Missing TEKKIN_CRON_SECRET" },
        { status: 500 }
      );
    }

    const rebuildUrl = new URL("/api/charts/rebuild", req.url);
    rebuildUrl.searchParams.set("secret", secret);

    const res = await fetch(rebuildUrl.toString(), { method: "POST" });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { error: payload?.error ?? payload ?? "Rebuild failed" },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, result: payload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
