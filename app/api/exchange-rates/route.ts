import { NextResponse } from "next/server";

export const revalidate = 21600;

export async function GET() {
  const res = await fetch("https://open.er-api.com/v6/latest/CAD", {
    next: { revalidate: 60 * 60 * 6 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch rates" }, { status: 500 });
  }

  const data = await res.json();

  return NextResponse.json({
    base: "CAD",
    rates: data.rates,
    updatedAt: data.time_last_update_unix,
  });
}
