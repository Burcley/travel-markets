import { redirect } from "next/navigation";

type BoostListingPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BoostListingPage({
  params,
}: BoostListingPageProps) {
  const { id } = await params;

  redirect(`/dashboard/boosts?listing=${encodeURIComponent(id)}`);
}