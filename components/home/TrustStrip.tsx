const items = [
  "Verified listings",
  "Secure messaging",
  "Viewing appointments",
  "Built for students",
];

export default function TrustBar() {
  return (
    <section className="border-y border-white/10 bg-white/[0.03] px-6 py-6">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item} className="rounded-2xl bg-white/5 px-5 py-4 text-sm font-semibold text-white/80">
            ✓ {item}
          </div>
        ))}
      </div>
    </section>
  );
}