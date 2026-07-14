import { CheckCircle2, Circle } from "lucide-react";

export type TrustSetupProgressItem = {
  label: string;
  complete: boolean;
};

export default function TrustSetupProgress({
  items,
  className = "",
}: {
  items: TrustSetupProgressItem[];
  className?: string;
}) {
  const allComplete = items.every((item) => item.complete);

  return (
    <section
      aria-label="Listing trust setup progress"
      className={`rounded-3xl border border-white/10 bg-black/50 p-4 sm:p-5 ${className}`}
    >
      <h2 className="text-lg font-black text-white">Listing trust setup</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            {item.complete ? (
              <CheckCircle2
                size={18}
                className="shrink-0 text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <Circle
                size={18}
                className="shrink-0 text-zinc-600"
                aria-hidden="true"
              />
            )}
            <span
              className={`text-sm font-semibold ${
                item.complete ? "text-zinc-100" : "text-zinc-500"
              }`}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <p
        className={`mt-4 rounded-2xl border p-3 text-sm leading-6 ${
          allComplete
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100/80"
            : "border-white/10 bg-white/[0.03] text-zinc-400"
        }`}
        aria-live="polite"
      >
        {allComplete
          ? "Ready to submit for verification and publish."
          : "Complete the remaining required items before publishing."}
      </p>
    </section>
  );
}
