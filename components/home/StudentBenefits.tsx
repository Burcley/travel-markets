const benefits = [
  {
    title: "Avoid random Facebook searching",
    text: "Find student rentals in one focused marketplace instead of scrolling through scattered posts.",
  },
  {
    title: "Message landlords safely",
    text: "Keep conversations inside Travel Markets with built-in messaging.",
  },
  {
    title: "Book viewings faster",
    text: "Request viewing appointments without endless back-and-forth.",
  },
  {
    title: "Search near campus",
    text: "Filter by city, campus, price, bedrooms, bathrooms, guests, and more.",
  },
];

export default function StudentBenefits() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          For Students
        </p>

        <h2 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">
          A better way to find your next student home.
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="text-xl font-black">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}