const items = [
  {
    title: "Verified Accounts",
    text: "Travel Markets supports identity verification to build trust between students and landlords.",
  },
  {
    title: "Secure Messaging",
    text: "Students and landlords can communicate directly inside the platform.",
  },
  {
    title: "Protected Addresses",
    text: "Exact addresses stay protected until the right stage of the rental process.",
  },
  {
    title: "Viewing Appointments",
    text: "Students can request viewings and landlords can manage appointments clearly.",
  },
  {
    title: "Reviews & Ratings",
    text: "Public profiles and reviews help both sides make better decisions.",
  },
  {
    title: "Reports & Moderation",
    text: "Users can report listings or accounts, helping keep the marketplace safer.",
  },
];

export default function TrustSafety() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase tracking-widest text-red-400">
          Trust & Safety
        </p>

        <h2 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">
          Built to make student renting feel safer.
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:bg-white/[0.07]"
            >
              <h3 className="text-xl font-black">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/65">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}