import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export default async function AdminSupportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: tickets, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("ADMIN SUPPORT TICKETS ERROR:", error);
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-black">Support Tickets</h1>
        <p className="mt-3 text-zinc-400">
          View support requests submitted through the contact page.
        </p>

        <div className="mt-8 space-y-4">
          {!tickets || tickets.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-zinc-400">
              No support tickets yet.
            </div>
          ) : (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-3xl border border-white/10 bg-zinc-950 p-6"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">
                      {ticket.category || "support"}
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      {ticket.subject}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-500">
                      {ticket.name} • {ticket.email}
                    </p>
                  </div>

                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300">
                    {ticket.status || "open"}
                  </span>
                </div>

                <p className="mt-5 whitespace-pre-wrap text-zinc-300">
                  {ticket.message}
                </p>

                <p className="mt-5 text-xs text-zinc-600">
                  Submitted:{" "}
                  {ticket.created_at
                    ? new Date(ticket.created_at).toLocaleString()
                    : "Unknown"}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}