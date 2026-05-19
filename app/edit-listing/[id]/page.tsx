import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditListingForm from "@/components/EditListingForm";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !listing) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/30 bg-red-950/20 p-8">
          <h1 className="text-2xl font-bold">Edit Listing</h1>
          <p className="mt-3 text-red-200">
            Listing not found or you do not have permission to edit it.
          </p>
        </div>
      </main>
    );
  }

  return <EditListingForm listing={listing} />;
}