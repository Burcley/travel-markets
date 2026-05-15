import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#ff385c] shadow-lg shadow-[#ff385c]/20 transition group-hover:scale-105">
        <div className="h-5 w-5 rotate-45 rounded-tl-full rounded-br-full border-2 border-white" />
      </div>

      <div className="leading-tight">
        <p className="text-base font-bold tracking-tight text-white">
          Travel Markets
        </p>
        <p className="text-[11px] font-medium text-zinc-500">
          Stay • Rent • Explore
        </p>
      </div>
    </Link>
  );
}