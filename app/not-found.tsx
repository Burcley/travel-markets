import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-lg text-center">
        <div className="mb-6 text-7xl font-black text-zinc-700">404</div>

        <h1 className="text-4xl font-bold">
          Page not found
        </h1>

        <p className="mt-4 leading-7 text-zinc-400">
          The page you’re looking for doesn’t exist or may have been removed.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="rounded-2xl bg-white px-6 py-4 font-bold text-black hover:bg-zinc-200"
          >
            Back Home
          </Link>

          <Link
            href="/dashboard"
            className="rounded-2xl border border-zinc-700 px-6 py-4 font-bold text-white hover:bg-white/10"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}