import { createClient } from "@/lib/supabase/server";

export default async function AdminSupportPage() {
  const supabase = await createClient();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <h1 className="mb-8 text-4xl font-bold">
        Support Tickets
      </h1>

      <div className="space-y-4">
        {tickets?.map((ticket) => (
          <div
            key={ticket.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
          >
            <h2 className="font-bold text-lg">
              {ticket.subject}
            </h2>

            <p className="mt-2 text-zinc-400">
              {ticket.email}
            </p>

            <p className="mt-2 text-zinc-300">
              {ticket.message}
            </p>

            <div className="mt-4 text-sm text-zinc-500">
              {ticket.category} • {ticket.status}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}