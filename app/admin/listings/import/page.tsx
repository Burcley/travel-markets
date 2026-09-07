import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import ImportListingsClient, { type ImportLandlordOption } from "./ImportListingsClient";

export default async function AdminListingImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: currentProfile } = await admin
    .from("profiles")
    .select("role, is_admin, account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !currentProfile ||
    (!currentProfile.is_admin && currentProfile.role !== "admin") ||
    ["banned", "suspended", "disabled"].includes(
      String(currentProfile.account_status || "").toLowerCase()
    )
  ) {
    redirect("/dashboard");
  }

  const { data: landlordRows } = await admin
    .from("profiles")
    .select("id, full_name, email, role, is_admin, account_status")
    .in("role", ["owner", "landlord", "host", "property_owner", "property_manager"])
    .order("created_at", { ascending: false })
    .limit(250);

  const eligibleLandlordRows = (landlordRows || []).filter(
    (profile) =>
      !profile.is_admin &&
      !["banned", "suspended", "disabled"].includes(
        String(profile.account_status || "").toLowerCase()
      )
  );

  const landlordIds = eligibleLandlordRows.map((profile) => profile.id);
  const { data: submissions } = landlordIds.length
    ? await admin
        .from("verification_submissions")
        .select("user_id, verification_type, status")
        .eq("verification_type", "property_relationship")
        .in("user_id", landlordIds)
    : { data: [] };

  const statusByUser = new Map<string, string>();
  (submissions || []).forEach((submission) => {
    if (!statusByUser.has(submission.user_id)) {
      statusByUser.set(submission.user_id, submission.status || "not_started");
    }
  });

  const landlords: ImportLandlordOption[] = eligibleLandlordRows.map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    accountStatus: profile.account_status,
    verificationStatus: statusByUser.get(profile.id) || "not_started",
  }));

  return <ImportListingsClient landlords={landlords} />;
}
