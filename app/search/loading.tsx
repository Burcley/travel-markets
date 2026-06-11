export default function Loading() {
  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 h-6 w-40 animate-pulse rounded-full bg-white/10" />

          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-xl">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_0.8fr_auto]">
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 animate-pulse rounded-2xl bg-white/10"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="h-7 w-44 animate-pulse rounded-xl bg-white/10" />

              <div className="mt-3 h-4 w-28 animate-pulse rounded-lg bg-white/10" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
              >
                <div className="aspect-[4/3] animate-pulse bg-white/10" />

                <div className="space-y-4 p-4">
                  <div className="h-5 w-3/4 animate-pulse rounded-lg bg-white/10" />

                  <div className="h-4 w-1/2 animate-pulse rounded-lg bg-white/10" />

                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-10 animate-pulse rounded-xl bg-white/10" />
                    <div className="h-10 animate-pulse rounded-xl bg-white/10" />
                    <div className="h-10 animate-pulse rounded-xl bg-white/10" />
                  </div>

                  <div className="h-4 w-2/3 animate-pulse rounded-lg bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-24 h-[calc(100vh-7rem)] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            <div className="relative h-full w-full animate-pulse bg-white/[0.06]">
              <div className="absolute left-10 top-10 h-12 w-24 rounded-full bg-white/10" />
              <div className="absolute right-20 top-32 h-12 w-24 rounded-full bg-white/10" />
              <div className="absolute bottom-24 left-20 h-12 w-24 rounded-full bg-white/10" />
              <div className="absolute bottom-40 right-16 h-12 w-24 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}