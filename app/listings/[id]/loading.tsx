export default function Loading() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="mb-6 h-6 w-40 rounded-full bg-white/10" />

        <div className="h-10 w-3/4 rounded-2xl bg-white/10 sm:w-1/2" />

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          <div className="h-[420px] rounded-3xl bg-white/10 lg:col-span-2" />
          <div className="h-[420px] rounded-3xl bg-white/10" />
          <div className="h-[420px] rounded-3xl bg-white/10" />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          <section className="space-y-6">
            <div className="h-8 w-56 rounded-xl bg-white/10" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="h-4 w-5/6 rounded bg-white/10" />
            <div className="h-4 w-2/3 rounded bg-white/10" />

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="h-24 rounded-3xl bg-white/10" />
              <div className="h-24 rounded-3xl bg-white/10" />
              <div className="h-24 rounded-3xl bg-white/10" />
            </div>

            <div className="mt-8 h-64 rounded-3xl bg-white/10" />
          </section>

          <aside className="h-96 rounded-3xl bg-white/10" />
        </div>
      </div>
    </main>
  );
}