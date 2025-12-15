import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/artist");

  return <RegisterForm />;
}
