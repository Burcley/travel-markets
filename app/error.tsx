"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <div className="mb-5 text-6xl">⚠️</div>

        <h1 className="text-3xl font-bold">
          Something went wrong
        </h1>

        <p className="mt-4 leading-7 text-zinc-400">
          Travel Markets encountered an unexpected problem while loading this
          page.
        </p>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => reset()}
            className="rounded-2xl bg-white px-6 py-4 font-bold text-black hover:bg-zinc-200"
          >
            Try Again
          </button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <pre className="mt-6 overflow-auto rounded-2xl border border-zinc-800 bg-black p-4 text-left text-xs text-red-400">
            {error.message}
          </pre>
        )}
      </div>
    </main>
  );
}