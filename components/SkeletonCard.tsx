export default function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
      <div className="h-60 animate-pulse bg-zinc-900" />

      <div className="space-y-4 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded-full bg-zinc-800" />
        <div className="h-4 w-1/2 animate-pulse rounded-full bg-zinc-800" />
        <div className="h-6 w-1/3 animate-pulse rounded-full bg-zinc-800" />
      </div>
    </div>
  );
}