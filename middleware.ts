import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_DISABLED_PATHS = ["/account-disabled"];
const ONBOARDING_ALLOWED_PATHS = [
  "/",
  "/auth",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/verify-email",
  "/support",
  "/help",
  "/privacy",
  "/terms",
  "/safety",
  "/about",
  "/faq",
  "/contact",
];

const PROTECTED_ONBOARDING_PATHS = [
  "/admin",
  "/availability",
  "/billing",
  "/dashboard",
  "/inquiries",
  "/listings",
  "/messages",
  "/my-listings",
  "/notifications",
  "/post",
  "/profile",
  "/recently-viewed",
  "/reports",
  "/saved-listings",
  "/saved-searches",
  "/settings",
  "/users",
  "/viewings",
];

function startsWithAny(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function hasRequiredProfile(profile: {
  role?: string | null;
  full_name?: string | null;
  phone?: string | null;
  country?: string | null;
  preferred_language?: string | null;
  school?: string | null;
  program?: string | null;
  institution_id?: string | null;
  institution_not_listed?: boolean | null;
  unlisted_institution_name?: string | null;
  campus_id?: string | null;
  campus_not_listed?: boolean | null;
  unlisted_campus_name?: string | null;
  program_name?: string | null;
  expected_graduation?: string | null;
  host_type?: string | null;
}) {
  const role = String(profile.role || "").toLowerCase();
  const host = ["owner", "host", "landlord"].includes(role);
  const roleSelected = role === "student" || host || role === "admin";

  if (!roleSelected) return false;
  if (!profile.full_name?.trim()) return false;
  if (!profile.phone?.trim()) return false;
  if (!profile.country?.trim()) return false;
  if (!profile.preferred_language?.trim()) return false;

  if (role === "student") {
    const hasInstitution = Boolean(
      profile.institution_id?.trim() ||
        profile.school?.trim() ||
        (profile.institution_not_listed && profile.unlisted_institution_name?.trim())
    );
    const hasCampus = Boolean(
      profile.campus_id?.trim() ||
        (profile.campus_not_listed && profile.unlisted_campus_name?.trim())
    );
    const hasProgram = Boolean(
      profile.program_name?.trim() || profile.program?.trim()
    );

    return Boolean(
      hasInstitution &&
        hasCampus &&
        hasProgram &&
        profile.expected_graduation
    );
  }

  if (host) {
    return Boolean(profile.host_type?.trim());
  }

  return true;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();

  const accountStatus = profile?.account_status || "active";

  const isDisabled =
    accountStatus === "suspended" || accountStatus === "banned";

  const canDisabledUserAccess = ALLOWED_DISABLED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isDisabled && !canDisabledUserAccess) {
    const url = request.nextUrl.clone();
    url.pathname = "/account-disabled";
    return NextResponse.redirect(url);
  }

  if (!isDisabled && pathname === "/account-disabled") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const canAccessDuringOnboarding = startsWithAny(
    pathname,
    ONBOARDING_ALLOWED_PATHS
  );
  const needsOnboardingGuard = startsWithAny(pathname, PROTECTED_ONBOARDING_PATHS);

  if (!needsOnboardingGuard || canAccessDuringOnboarding) {
    return response;
  }

  const { data: onboardingProfile, error: onboardingProfileError } = await supabase
    .from("profiles")
    .select(
      "role, full_name, phone, country, preferred_language, school, program, institution_id, institution_not_listed, unlisted_institution_name, campus_id, campus_not_listed, unlisted_campus_name, program_name, expected_graduation, host_type, onboarding_completed, onboarding_completed_at, verification_intro_viewed_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (onboardingProfileError) {
    console.error("ONBOARDING GUARD PROFILE ERROR:", onboardingProfileError);
    return response;
  }

  const onboardingComplete = Boolean(
    onboardingProfile?.onboarding_completed_at ||
      onboardingProfile?.onboarding_completed
  );

  if (onboardingComplete) {
    return response;
  }

  const role = String(onboardingProfile?.role || "").toLowerCase();
  const roleSelected =
    role === "student" ||
    role === "owner" ||
    role === "host" ||
    role === "landlord" ||
    role === "admin";

  const url = request.nextUrl.clone();

  if (!user.email_confirmed_at) {
    url.pathname = "/onboarding/verify-email";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!roleSelected) {
    url.pathname = "/onboarding";
    url.search = "?step=role";
    return NextResponse.redirect(url);
  }

  if (!onboardingProfile || !hasRequiredProfile(onboardingProfile)) {
    url.pathname = "/onboarding";
    url.search = "?step=profile";
    return NextResponse.redirect(url);
  }

  if (!onboardingProfile.verification_intro_viewed_at) {
    url.pathname = "/onboarding/verifications";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
