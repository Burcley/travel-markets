import { redirect } from "next/navigation";

export default async function BoostListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/dashboard/boosts?listing=${id}`);
}
