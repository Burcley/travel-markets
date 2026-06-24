import Link from "next/link";

export default function AccountDisabledPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-3xl font-bold">Account disabled</h1>

        <p className="mt-4 text-white/70">
          Your Travel Markets account is currently suspended or banned. You
          cannot use the platform until your account is reactivated.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-black"
        >
          Back to homepage
        </Link>
      </div>
    </main>
  );
}