import { BadgeCheck } from "lucide-react";

export default function FoundingLandlordBadge({
  number,
  compact = false,
}: {
  number?: number | null;
  compact?: boolean;
}) {
  if (!number) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/30 bg-pink-500/15 px-3 py-1 text-xs font-bold text-pink-100 shadow-sm">
      <BadgeCheck size={compact ? 13 : 15} />
      {compact ? `Founder #${number}` : `Founding Landlord #${number} of 30`}
    </span>
  );
}
