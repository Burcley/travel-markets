import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireVerifiedUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (!user.email_confirmed_at) {
    redirect("/verify-email");
  }

  return user;
}