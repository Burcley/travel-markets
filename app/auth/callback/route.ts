import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function hasValidPublicRole(role?: string | null, isAdmin?: boolean | null) {
  const value = String(role || "").toLowerCase();

  return (
    isAdmin === true ||
    value === "admin" ||
    value === "student" ||
    value === "owner" ||
    value === "landlord" ||
    value === "host"
  );
}

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

function emailOtpType(value: string | null): EmailOtpType {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "signup") return "signup";
  if (normalized === "invite") return "invite";
  if (normalized === "magiclink") return "magiclink";
  if (normalized === "recovery") return "recovery";
  if (normalized === "email_change") return "email_change";

  return "email";
}

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
        type: emailOtpType(type),
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

  if (user?.id && user.email_confirmed_at) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_admin, onboarding_completed, onboarding_completed_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed_at && !profile?.onboarding_completed) {
      if (!hasValidPublicRole(profile?.role, profile?.is_admin)) {
        return NextResponse.redirect(new URL("/onboarding?step=role", origin));
      }

      return NextResponse.redirect(new URL("/onboarding?step=profile", origin));
    }
  }

  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/verify-email/success", origin));
}
