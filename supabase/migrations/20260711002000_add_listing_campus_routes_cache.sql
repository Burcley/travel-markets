create table if not exists public.listing_campus_routes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  campus_name text not null,
  travel_mode text not null,
  distance_meters numeric,
  duration_seconds numeric,
  route_geometry jsonb,
  origin_type text not null default 'protected',
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_campus_routes_travel_mode_check
    check (travel_mode in ('transit', 'cycling', 'walking', 'driving')),
  constraint listing_campus_routes_origin_type_check
    check (origin_type in ('protected', 'exact'))
);

create unique index if not exists listing_campus_routes_unique_route_idx
  on public.listing_campus_routes(listing_id, campus_name, travel_mode, origin_type);

create index if not exists listing_campus_routes_listing_id_idx
  on public.listing_campus_routes(listing_id);

alter table public.listing_campus_routes enable row level security;
