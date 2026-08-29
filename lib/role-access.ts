export type AppRole = "student" | "landlord" | "admin";

export type RoleProfile = {
  role?: string | null;
  is_admin?: boolean | null;
};

const LANDLORD_ROLES = new Set([
  "owner",
  "landlord",
  "host",
  "property_owner",
  "property_manager",
]);

export function normalizeAppRole(profile?: RoleProfile | null): AppRole {
  if (profile?.is_admin) return "admin";

  const role = String(profile?.role || "").trim().toLowerCase();

  if (role === "admin") return "admin";
  if (LANDLORD_ROLES.has(role)) return "landlord";

  return "student";
}

export function isStudentRole(profile?: RoleProfile | null) {
  return normalizeAppRole(profile) === "student";
}

export function isLandlordRole(profile?: RoleProfile | null) {
  return normalizeAppRole(profile) === "landlord";
}

export function isAdminRole(profile?: RoleProfile | null) {
  return normalizeAppRole(profile) === "admin";
}

export function canAccessLandlordTools(profile?: RoleProfile | null) {
  const role = normalizeAppRole(profile);
  return role === "landlord" || role === "admin";
}

export function canAccessStudentTools(profile?: RoleProfile | null) {
  const role = normalizeAppRole(profile);
  return role === "student" || role === "admin";
}

export function canAccessAdminTools(profile?: RoleProfile | null) {
  return normalizeAppRole(profile) === "admin";
}

export function canCreateListing(profile?: RoleProfile | null) {
  return canAccessLandlordTools(profile);
}

export function canManageListings(profile?: RoleProfile | null) {
  return canAccessLandlordTools(profile);
}

