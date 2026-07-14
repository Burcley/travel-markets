alter table public.listings
  add column if not exists nearest_campus_name text,
  add column if not exists nearest_campus_address text,
  add column if not exists campus_latitude double precision,
  add column if not exists campus_longitude double precision,
  add column if not exists distance_to_campus_km numeric,
  add column if not exists walking_time_minutes integer,
  add column if not exists cycling_time_minutes integer,
  add column if not exists driving_time_minutes integer,
  add column if not exists transit_time_minutes integer,
  add column if not exists distance_last_calculated_at timestamptz,
  add column if not exists utilities_details jsonb not null default '{}'::jsonb,
  add column if not exists amenities_details jsonb not null default '{}'::jsonb,
  add column if not exists lease_conditions jsonb not null default '{}'::jsonb;

create index if not exists listings_nearest_campus_name_idx
  on public.listings(nearest_campus_name);
