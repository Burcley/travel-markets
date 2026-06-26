const steps = [
  ["1", "Search student housing", "Browse rentals near your school or city."],
  ["2", "Message landlords", "Ask questions and confirm important details."],
  ["3", "Book a viewing", "Schedule property viewings directly online."],
  ["4", "Choose your home", "Move forward with confidence."],
];

export default function HowItWorks() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-3xl font-black sm:text-5xl">How it works</h2>

        <div className="mt-10 grid gap-5 md:grid-cols-4">
          {steps.map(([num, title, text]) => (
            <div key={num} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 font-black">
                {num}
              </div>
              <h3 className="mt-5 text-xl font-black">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}