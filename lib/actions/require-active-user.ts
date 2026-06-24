import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireActiveUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profile?.account_status === "suspended" ||
    profile?.account_status === "banned"
  ) {
    redirect("/account-disabled");
  }

  return { user, profile };
}