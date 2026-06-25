import { createClient } from "@/lib/supabase/server";

export default async function VerifyEmailPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-3xl font-bold">Verify Your Email</h1>

        <p className="mt-4 text-zinc-400">
          Please verify your email before posting listings on Travel Markets.
        </p>

        <p className="mt-3 text-sm text-zinc-500">
          Signed in as: {user?.email}
        </p>
      </div>
    </main>
  );
}