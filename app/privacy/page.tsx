export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold">Privacy Policy</h1>

        <div className="mt-8 space-y-6 text-zinc-300">
          <p>
            Travel Markets respects your privacy and only collects information
            necessary to operate the platform.
          </p>

          <h2 className="text-2xl font-semibold text-white">
            Information We Collect
          </h2>

          <p>
            Account information, listing information, messages, inquiries,
            appointments, and payment records.
          </p>

          <h2 className="text-2xl font-semibold text-white">
            How We Use Information
          </h2>

          <p>
            To provide housing marketplace services, improve user experience,
            and maintain platform security.
          </p>

          <h2 className="text-2xl font-semibold text-white">
            Third-Party Services
          </h2>

          <p>
            We use Supabase, Stripe, Mapbox, and Resend to operate portions of
            the platform.
          </p>

          <p className="text-sm text-zinc-500">
            Last updated: {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}