import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isAdminUser } from "@/lib/admin/isAdmin";

export type AdminAuthResult =
  | { ok: true; admin: ReturnType<typeof createAdminClient>; user: Parameters<typeof isAdminUser>[0]; status?: 200 }
  | { ok: false; status: number; message: string };

export async function ensureAdmin(): Promise<AdminAuthResult> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  if (!isAdminUser(data.user)) {
    return { ok: false, status: 403, message: "Forbidden" };
  }
  return { ok: true, admin: createAdminClient(), user: data.user };
}
