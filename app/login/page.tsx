import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; redeem?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const next = sp.next;
  const redeem = sp.redeem;

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

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-black px-4">
      <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-[0.04]" />
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-20 -left-10 h-56 w-56 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
