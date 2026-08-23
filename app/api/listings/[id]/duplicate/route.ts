import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COPY_COLUMNS =
  "title, description, price, city, location, campus, address_line, unit, province, postal_code, country, safety_instructions, bedrooms, bathrooms, guests, roommates, amenities, latitude, longitude, public_latitude, public_longitude, location_privacy_radius_meters, public_location_generated_at, nearest_campus_name, nearest_campus_address, campus_id, campus_destination_label, campus_coordinate_source, campus_latitude, campus_longitude, distance_to_campus_km, walking_time_minutes, cycling_time_minutes, driving_time_minutes, transit_time_minutes, distance_last_calculated_at, utilities_details, amenities_details, lease_conditions, verification_disclaimer_acknowledged, fair_housing_acknowledged, owner_occupies_property, owner_family_occupies_property, shared_kitchen_with_owner, shared_bathroom_with_owner, private_bedroom, self_contained_unit, other_occupants_present, estimated_other_occupant_count, occupancy_notes";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: source, error: sourceError } = await supabase
    .from("listings")
    .select(`id, user_id, ${COPY_COLUMNS}`)
    .eq("id", id)
    .maybeSingle();

  if (sourceError) {
    console.error("LISTING DUPLICATE SOURCE ERROR:", sourceError);
    return NextResponse.json(
      { error: "We could not load that listing." },
      { status: 500 }
    );
  }

  if (!source || source.user_id !== user.id) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const { id: _id, user_id: _userId, ...copyFields } = source;
  void _id;
  void _userId;

  const { data: duplicate, error } = await supabase
    .from("listings")
    .insert({
      ...copyFields,
      user_id: user.id,
      title: `${source.title || "Untitled listing"} copy`,
      status: "draft",
      creation_idempotency_key: `${user.id}:duplicate:${id}:${crypto.randomUUID()}`,
      is_featured: false,
      featured_until: null,
      featured_rank: 0,
      is_boosted: false,
      boost_until: null,
      boost_rank: 0,
    })
    .select("id")
    .single();

  if (error || !duplicate) {
    console.error("LISTING DUPLICATE CREATE ERROR:", error);
    return NextResponse.json(
      { error: "We could not duplicate this listing." },
      { status: 400 }
    );
  }

  return NextResponse.json({ id: duplicate.id });
}
