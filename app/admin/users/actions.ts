"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const supabaseAdmin = createAdminClient();

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && !profile?.is_admin) {
    redirect("/dashboard");
  }

  return user;
}

async function protectTargetUser(userId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_admin")
    .eq("id", userId)
    .single();

  if (error || !profile) throw new Error("User not found");

  if (profile.role === "admin" || profile.is_admin) {
    throw new Error("You cannot moderate or delete an admin account");
  }

  return profile;
}

async function createAuditLog({
  adminId,
  targetUserId,
  action,
  reason,
}: {
  adminId: string;
  targetUserId: string;
  action: string;
  reason: string;
}) {
  await supabaseAdmin.from("admin_audit_logs").insert({
    admin_id: adminId,
    target_user_id: targetUserId,
    action,
    reason,
  });
}

export async function suspendUser(formData: FormData) {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") || "");
  await protectTargetUser(userId);

  const reason = "Suspended by admin";

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      account_status: "suspended",
      suspended_at: new Date().toISOString(),
      banned_at: null,
      moderation_reason: reason,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  await createAuditLog({
    adminId: admin.id,
    targetUserId: userId,
    action: "suspend_user",
    reason,
  });

  revalidatePath("/admin/users");
}

export async function reactivateUser(formData: FormData) {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") || "");
  await protectTargetUser(userId);

  const reason = "Reactivated by admin";

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      account_status: "active",
      suspended_at: null,
      banned_at: null,
      moderation_reason: null,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  await createAuditLog({
    adminId: admin.id,
    targetUserId: userId,
    action: "reactivate_user",
    reason,
  });

  revalidatePath("/admin/users");
}

export async function banUser(formData: FormData) {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") || "");
  await protectTargetUser(userId);

  const reason = "Banned by admin";

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      account_status: "banned",
      banned_at: new Date().toISOString(),
      suspended_at: null,
      moderation_reason: reason,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  await createAuditLog({
    adminId: admin.id,
    targetUserId: userId,
    action: "ban_user",
    reason,
  });

  revalidatePath("/admin/users");
}

export async function deleteUserByAdmin(formData: FormData) {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") || "");
  await protectTargetUser(userId);

  await createAuditLog({
    adminId: admin.id,
    targetUserId: userId,
    action: "delete_user",
    reason: "Deleted by admin",
  });

  await supabaseAdmin.from("profiles").delete().eq("id", userId);

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, true);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/users");
}