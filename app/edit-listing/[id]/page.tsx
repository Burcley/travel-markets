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
    .single();

  if (error || !listing) {
    return (
      <main style={{ maxWidth: "700px", margin: "40px auto", padding: "20px" }}>
        <h1>Edit Listing</h1>
        <p>Listing not found or you do not have permission to edit it.</p>
      </main>
    );
  }

  return <EditListingForm listing={listing} />;
}