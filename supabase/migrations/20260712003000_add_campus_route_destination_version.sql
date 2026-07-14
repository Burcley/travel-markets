alter table public.listing_campus_routes
  add column if not exists destination_version text;

create index if not exists listing_campus_routes_origin_destination_version_idx
  on public.listing_campus_routes(origin_version, destination_version);
