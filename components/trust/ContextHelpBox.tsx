import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type ContextHelpTone = "info" | "warning" | "success";

const toneStyles: Record<
  ContextHelpTone,
  { shell: string; icon: string; defaultIcon: ReactNode }
> = {
  info: {
    shell: "border-blue-400/20 bg-blue-500/10",
    icon: "text-blue-200",
    defaultIcon: <Info size={18} />,
  },
  warning: {
    shell: "border-amber-400/20 bg-amber-500/10",
    icon: "text-amber-200",
    defaultIcon: <AlertTriangle size={18} />,
  },
  success: {
    shell: "border-emerald-400/20 bg-emerald-500/10",
    icon: "text-emerald-200",
    defaultIcon: <CheckCircle2 size={18} />,
  },
};

export default function ContextHelpBox({
  title,
  description,
  bullets,
  tone = "info",
  icon,
  id,
  className = "",
}: {
  title: string;
  description: string;
  bullets?: string[];
  tone?: ContextHelpTone;
  icon?: ReactNode;
  id?: string;
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <aside
      id={id}
      aria-label={title}
      className={`rounded-3xl border p-4 sm:p-5 ${styles.shell} ${className}`}
    >
      <div className="flex gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 ${styles.icon}`}
          aria-hidden="true"
        >
          {icon || styles.defaultIcon}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{description}</p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span className={styles.icon} aria-hidden="true">
                    •
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
