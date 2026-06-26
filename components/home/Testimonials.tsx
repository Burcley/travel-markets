const testimonials = [
  {
    quote:
      "The platform has a great look to it, modern and sleek. With stronger positioning, it can be pitch ready for landlords.",
    name: "Early landlord feedback",
  },
  {
    quote:
      "Travel Markets is being built around the real problems students face when searching for housing near campus.",
    name: "Student housing focus",
  },
  {
    quote:
      "The goal is simple: help students find trusted rentals and help landlords reach serious student tenants.",
    name: "Travel Markets mission",
  },
];

export default function Testimonials() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          Early Feedback
        </p>

        <h2 className="mt-3 text-3xl font-black sm:text-5xl">
          Built with feedback from the people it serves.
        </h2>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((item) => (
            <div
              key={item.name}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <p className="text-lg leading-8 text-white/80">
                “{item.quote}”
              </p>
              <p className="mt-6 text-sm font-bold text-red-400">
                {item.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}