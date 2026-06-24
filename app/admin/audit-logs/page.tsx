import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AuditLogsPage() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && !profile?.is_admin) {
    redirect("/dashboard");
  }

  const { data: logs, error } = await supabaseAdmin
    .from("admin_audit_logs")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/50">Travel Markets Admin</p>
            <h1 className="text-3xl font-bold">Audit Logs</h1>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-white/10 px-5 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            Back to Admin
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
            {error.message}
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/[0.03]">
          {logs && logs.length > 0 ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="border-b border-white/10 p-5 last:border-b-0"
              >
                <p className="font-bold">{log.action}</p>
                <p className="mt-1 text-sm text-white/50">
                  Target User: {log.target_user_id || "N/A"}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  Admin: {log.admin_id}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  Reason: {log.reason || "No reason"}
                </p>
                <p className="mt-2 text-xs text-white/35">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-white/50">
              No audit logs yet.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}