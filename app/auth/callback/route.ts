import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");
  const error = url.searchParams.get("error") || url.searchParams.get("error_code");
  const errorDescription = url.searchParams.get("error_description");
  const origin = url.origin;

  if (error) {
    const redirectUrl = new URL("/verify-email", origin);
    redirectUrl.searchParams.set(
      "error",
      errorDescription || "This verification link is invalid or expired."
    );
    return NextResponse.redirect(redirectUrl);
  }

  if (!code && !tokenHash) {
    const redirectUrl = new URL("/verify-email", origin);
    redirectUrl.searchParams.set("error", "Missing verification token.");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();
  const { error: exchangeError } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: (type || "email") as "email",
      });

  if (exchangeError) {
    const redirectUrl = new URL("/verify-email", origin);
    redirectUrl.searchParams.set(
      "error",
      exchangeError.message || "We could not verify this email link."
    );
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id && user.email_confirmed_at) {
    await supabase
      .from("profiles")
      .update({
        email_verified_at: user.email_confirmed_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  if (type === "recovery") {
    return NextResponse.redirect(new URL("/reset-password", origin));
  }

  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/verify-email/success", origin));
}
