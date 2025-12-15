import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/artist");

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <LoginForm />
    </div>
  );
}
