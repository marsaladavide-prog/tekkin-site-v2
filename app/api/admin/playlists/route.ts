import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/admin/auth";

export const runtime = "nodejs";

const PLAYLISTS_TABLE = "tekkin_charts_curated_playlists";

async function authAdmin() {
  return ensureAdmin();
}

export async function GET() {
  try {
    const auth = await authAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    const { data, error } = await auth.admin
      .from(PLAYLISTS_TABLE)
      .select("id, title, slug, description, cover_url, order_index, is_active, filters")
      .order("order_index", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const payload = {
      title: typeof body.title === "string" ? body.title.trim() || null : null,
      slug: typeof body.slug === "string" ? body.slug.trim() : "",
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      cover_url: typeof body.cover_url === "string" ? body.cover_url.trim() || null : null,
      order_index:
        typeof body.order_index === "number"
          ? body.order_index
          : typeof body.order_index === "string" && body.order_index !== ""
          ? Number(body.order_index)
          : null,
      is_active: body.is_active ?? true,
      filters: body.filters ?? null,
    };
    const { data, error } = await auth.admin.from(PLAYLISTS_TABLE).insert(payload).select("*");
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await authAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const updates = { ...body.updates };
    delete updates.id;
    const { error } = await auth.admin.from(PLAYLISTS_TABLE).update(updates).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
