"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function LoadMoreListings({
  currentPage,
  hasMore,
}: {
  currentPage: number;
  hasMore: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (!hasMore) return null;

  function loadMore() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(currentPage + 1));

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }

  return (
    <div className="mt-8 flex justify-center">
      <button
        onClick={loadMore}
        disabled={isPending}
        className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
      >
        {isPending ? "Loading..." : "Load more"}
      </button>
    </div>
  );
}