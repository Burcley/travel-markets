export default function ListingLoading() {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="h-5 w-32 animate-pulse rounded-full bg-zinc-800" />

        <div className="space-y-3">
          <div className="h-10 w-96 max-w-full animate-pulse rounded-full bg-zinc-800" />
          <div className="h-5 w-72 animate-pulse rounded-full bg-zinc-900" />
        </div>

        <div className="h-[420px] animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950" />

        <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <div className="h-56 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950" />
            <div className="h-44 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950" />
            <div className="h-64 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950" />
          </div>

          <div className="h-96 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-950" />
        </div>
      </div>
    </main>
  );
}