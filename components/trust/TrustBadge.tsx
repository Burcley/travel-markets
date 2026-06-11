type Props = {
  score?: number | null;
  level?: string | null;
  verified?: boolean | null;
};

export default function TrustBadge({ score, level, verified }: Props) {
  const safeScore = score ?? 20;
  const safeLevel = level || "new";

  const label =
    safeLevel === "elite"
      ? "Elite Trust"
      : safeLevel === "trusted"
      ? "Trusted"
      : safeLevel === "basic"
      ? "Basic Trust"
      : "New User";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
      <span>{verified ? "✓ Verified" : label}</span>
      <span className="text-emerald-400/70">{safeScore}/100</span>
    </div>
  );
}