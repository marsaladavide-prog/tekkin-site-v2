import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; redeem?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const next = sp.next ?? "";
  const redeem = sp.redeem ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const target = next
      ? redeem
        ? `${next}?redeem=${encodeURIComponent(redeem)}`
        : next
      : "/artist";
    redirect(target);
  }

  return <RegisterForm />;
}
