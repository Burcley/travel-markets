import Link from "next/link";
import { redirect } from "next/navigation";
import { Ban, PauseCircle, RotateCcw, Shield, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  banUser,
  deleteUserByAdmin,
  reactivateUser,
  suspendUser,
} from "./actions";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "admin" && !currentProfile?.is_admin) {
    redirect("/dashboard");
  }

  const { data: users } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, email, role, is_admin, account_status, created_at, moderation_reason"
    )
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">Travel Markets Admin</p>
            <h1 className="text-3xl font-bold">User Management</h1>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          <div className="grid grid-cols-12 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-wider text-white/40">
            <div className="col-span-3">User</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Reason</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {users?.map((profile) => {
            const isAdmin = profile.role === "admin" || profile.is_admin;

            return (
              <div
                key={profile.id}
                className="grid grid-cols-12 items-center border-b border-white/5 px-5 py-5 last:border-b-0"
              >
                <div className="col-span-3">
                  <p className="font-semibold">
                    {profile.full_name || "Unnamed user"}
                  </p>
                  <p className="text-xs text-white/40">{profile.email}</p>
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                    {isAdmin && <Shield size={13} />}
                    {isAdmin ? "admin" : profile.role || "user"}
                  </span>
                </div>

                <div className="col-span-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      (profile.account_status || "active") === "active"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : profile.account_status === "suspended"
                        ? "bg-yellow-500/10 text-yellow-300"
                        : "bg-red-500/10 text-red-300"
                    }`}
                  >
                    {profile.account_status || "active"}
                  </span>
                </div>

                <div className="col-span-2 text-sm text-white/50">
                  {profile.moderation_reason || "—"}
                </div>

                <div className="col-span-3 flex justify-end gap-2">
                  {isAdmin ? (
                    <span className="text-xs text-white/35">
                      Protected admin
                    </span>
                  ) : (
                    <>
                      <form action={suspendUser}>
                        <input type="hidden" name="userId" value={profile.id} />
                        <button className="rounded-full bg-yellow-500/10 p-2 text-yellow-300 hover:bg-yellow-500/20">
                          <PauseCircle size={16} />
                        </button>
                      </form>

                      <form action={reactivateUser}>
                        <input type="hidden" name="userId" value={profile.id} />
                        <button className="rounded-full bg-emerald-500/10 p-2 text-emerald-300 hover:bg-emerald-500/20">
                          <RotateCcw size={16} />
                        </button>
                      </form>

                      <form action={banUser}>
                        <input type="hidden" name="userId" value={profile.id} />
                        <button className="rounded-full bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20">
                          <Ban size={16} />
                        </button>
                      </form>

                      <form action={deleteUserByAdmin}>
                        <input type="hidden" name="userId" value={profile.id} />
                        <button className="rounded-full bg-red-600 p-2 text-white hover:bg-red-500">
                          <Trash2 size={16} />
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}