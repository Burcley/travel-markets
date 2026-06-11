export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold">Terms of Service</h1>

        <div className="mt-8 space-y-6 text-zinc-300">
          <p>
            Travel Markets is a marketplace that connects property owners and
            students seeking housing.
          </p>

          <h2 className="text-2xl font-semibold text-white">
            User Responsibilities
          </h2>

          <p>
            Users must provide accurate information and use the platform
            lawfully.
          </p>

          <h2 className="text-2xl font-semibold text-white">
            Listings & Content
          </h2>

          <p>
            Property owners are responsible for all information posted in their
            listings.
          </p>

          <h2 className="text-2xl font-semibold text-white">
            Limitation of Liability
          </h2>

          <p>
            Travel Markets does not own or manage properties and is not
            responsible for agreements made between users.
          </p>

          <p className="text-sm text-zinc-500">
            Last updated: {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}