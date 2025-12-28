import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env for admin");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  data?: Record<string, unknown>;
};

export async function notify(input: NotifyInput) {
  const admin = getAdmin();
  const { error } = await admin.from("user_notifications").insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    data: input.data ?? {},
  });

  if (error) {
    console.error("[notify] insert error", error);
  }
}
