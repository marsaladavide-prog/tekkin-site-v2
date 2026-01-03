import type { User } from "@supabase/supabase-js";

const parseAllowlist = (raw: string): string[] =>
  raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const ADMIN_EMAILS = parseAllowlist(process.env.NEXT_PUBLIC_TEKKIN_ADMIN_EMAILS ?? "");
const ADMIN_USER_IDS = parseAllowlist(process.env.NEXT_PUBLIC_TEKKIN_ADMIN_USER_IDS ?? "");

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase() ?? "";
  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const role = metadata.role ?? appMetadata.role;
  const isAdminFlag = metadata.is_admin === true || appMetadata.is_admin === true;

  if (email && ADMIN_EMAILS.includes(email)) return true;
  if (user.id && ADMIN_USER_IDS.includes(user.id.toLowerCase())) return true;
  if (role === "admin") return true;
  if (isAdminFlag) return true;
  return false;
}
