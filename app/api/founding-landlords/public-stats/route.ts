import { NextResponse } from "next/server";
import { getFoundingPublicStats } from "@/lib/founding-landlords/server";

export async function GET() {
  return NextResponse.json(await getFoundingPublicStats());
}
