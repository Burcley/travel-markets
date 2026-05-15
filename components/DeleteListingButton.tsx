"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteListingAction } from "@/lib/actions/delete-listing";

type DeleteListingButtonProps = {
  listingId: string;
  listingTitle: string;
  redirectTo?: string;
  className?: string;
};

export default function DeleteListingButton({
  listingId,
  listingTitle,
  redirectTo = "/my-listings",
  className = "",
}: DeleteListingButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${listingTitle}"?\n\nThis will permanently remove the listing and all its images.`
    );

    if (!confirmed) return;

    setError("");

    startTransition(async () => {
      const result = await deleteListingAction(listingId);

      if (!result.success) {
        setError(result.message);
        return;
      }

      router.push(redirectTo);
      router.refresh();
    });
  };

  return (
    <div className="w-full">
      <button
        onClick={handleDelete}
        disabled={isPending}
        className={`rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 ${className}`}
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}