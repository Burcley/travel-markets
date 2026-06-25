import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && !profile?.is_admin) {
    redirect("/dashboard");
  }

  const { data: tickets, error } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("ADMIN SUPPORT TICKETS ERROR:", error);
  }

  async function respondToTicket(formData: FormData) {
    "use server";

    const supabaseAdmin = createAdminClient();

    const ticketId = String(formData.get("ticketId") || "");
    const email = String(formData.get("email") || "");
    const name = String(formData.get("name") || "");
    const subject = String(formData.get("subject") || "Support Response");
    const response = String(formData.get("response") || "");

    if (!ticketId || !email || !response.trim()) {
      return;
    }

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Travel Markets <onboarding@resend.dev>",
      to: email,
      subject: `Travel Markets Support: ${subject}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Support Response</h2>
          <p>Hi ${name || "there"},</p>
          <p>${response.replace(/\n/g, "<br />")}</p>
          <p>Thank you for contacting Travel Markets Support.</p>
        </div>
      `,
    });

    await supabaseAdmin
      .from("support_tickets")
      .update({
        status: "responded",
        admin_response: response,
        responded_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    revalidatePath("/admin/support");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-black">Support Tickets</h1>
        <p className="mt-3 text-zinc-400">
          View and respond to support requests submitted through the contact
          page.
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

                {ticket.admin_response && (
                  <div className="mt-5 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                    <p className="text-sm font-bold text-blue-300">
                      Admin Response
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">
                      {ticket.admin_response}
                    </p>
                  </div>
                )}

                <form action={respondToTicket} className="mt-6 space-y-3">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="email" value={ticket.email || ""} />
                  <input type="hidden" name="name" value={ticket.name || ""} />
                  <input
                    type="hidden"
                    name="subject"
                    value={ticket.subject || "Support Response"}
                  />

                  <textarea
                    name="response"
                    required
                    rows={4}
                    placeholder="Write your support response..."
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-blue-500"
                  />

                  <button className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500">
                    Send Response Email
                  </button>
                </form>

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