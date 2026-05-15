import SkeletonCard from "@/components/SkeletonCard";

export default function Loading() {
  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 space-y-3">
          <div className="h-9 w-72 animate-pulse rounded-full bg-zinc-800" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-zinc-900" />
        </div>

        <div className="mb-8 h-20 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950" />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    </main>
  );
}