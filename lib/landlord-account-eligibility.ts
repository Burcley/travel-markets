import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLandlordAccountEligibility as getCoreLandlordAccountEligibility,
} from "./landlord-account-eligibility-core.mjs";

type ProfileRow = {
  id?: string | null;
  role?: string | null;
  is_admin?: boolean | null;
  account_status?: string | null;
  status?: string | null;
  identity_verified?: boolean | null;
  is_verified?: boolean | null;
  identity_verification_status?: string | null;
};

type SubmissionRow = {
  verification_type?: string | null;
  status?: string | null;
};

type LandlordAccountEligibilityResult = {
  canPublishListings: boolean;
  reason:
    | "PROFILE_REQUIRED"
    | "ACCOUNT_BLOCKED"
    | "ADMIN"
    | "LANDLORD_ROLE_REQUIRED"
    | "LANDLORD_VERIFICATION_REQUIRED"
    | "VERIFIED_LANDLORD";
  identityApproved: boolean;
  landlordApproved: boolean;
  landlordPending: boolean;
};

export type LandlordAccountEligibility = ReturnType<
  typeof getLandlordAccountEligibility
>;

export function getLandlordAccountEligibility(input: {
  profile?: ProfileRow | Record<string, unknown> | null;
  submissions?: Array<SubmissionRow | Record<string, unknown>>;
}): LandlordAccountEligibilityResult {
  const getCoreEligibility = getCoreLandlordAccountEligibility as (input: {
    profile?: Record<string, unknown> | null;
    submissions?: Array<Record<string, unknown>>;
  }) => LandlordAccountEligibilityResult;

  return getCoreEligibility({
    profile: input.profile || null,
    submissions: (input.submissions || []) as Array<Record<string, unknown>>,
  });
}

export async function getLandlordAccountEligibilityForUser(userId: string) {
  const admin = createAdminClient();
  const [{ data: profile, error: profileError }, { data: submissions, error }] =
    await Promise.all([
      admin
        .from("profiles")
        .select(
          "id, role, is_admin, account_status, status, identity_verified, is_verified, identity_verification_status"
        )
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("verification_submissions")
        .select("verification_type, status")
        .eq("user_id", userId),
    ]);

  if (profileError) {
    throw new Error(
      profileError.message || "Unable to load landlord account profile."
    );
  }

  if (error) {
    throw new Error(error.message || "Unable to load landlord verification.");
  }

  return getLandlordAccountEligibility({
    profile: (profile || null) as ProfileRow | null,
    submissions: (submissions || []) as SubmissionRow[],
  });
}
