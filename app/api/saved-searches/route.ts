import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ savedSearches: data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const title = body.title || body.name || "Saved Search";

  const payload = {
    user_id: user.id,
    title,
    name: body.name || title,
    query: body.query || body.q || null,
    city: body.city || null,
    campus: body.campus || null,
    min_price: body.min_price ? Number(body.min_price) : null,
    max_price: body.max_price ? Number(body.max_price) : null,
    bedrooms: body.bedrooms ? Number(body.bedrooms) : null,
    bathrooms: body.bathrooms ? Number(body.bathrooms) : null,
    guests: body.guests ? Number(body.guests) : null,
    sort: body.sort || "newest",
    alerts_enabled: body.alerts_enabled ?? true,
  };

  const { data, error } = await supabase
    .from("saved_searches")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ savedSearch: data });
}