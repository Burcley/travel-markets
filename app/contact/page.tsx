export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">Contact Us</h1>

        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-zinc-300">
            Need help with Travel Markets?
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <p className="font-semibold">Support Email</p>
              <p className="text-zinc-400">
                support@travelmarkets.ca
              </p>
            </div>

            <div>
              <p className="font-semibold">Business Inquiries</p>
              <p className="text-zinc-400">
                info@travelmarkets.ca
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}