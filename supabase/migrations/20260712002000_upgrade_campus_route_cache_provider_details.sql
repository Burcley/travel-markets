alter table public.listing_campus_routes
  add column if not exists provider text,
  add column if not exists profile text,
  add column if not exists route_details jsonb,
  add column if not exists origin_version text,
  add column if not exists expires_at timestamptz;

create index if not exists listing_campus_routes_expires_at_idx
  on public.listing_campus_routes(expires_at);

create index if not exists listing_campus_routes_provider_idx
  on public.listing_campus_routes(provider);

do $$
begin
  alter table public.listing_campus_routes
    drop constraint if exists listing_campus_routes_provider_check;

  alter table public.listing_campus_routes
    add constraint listing_campus_routes_provider_check
    check (
      provider is null
      or provider in ('mapbox_directions', 'google_routes', 'stored_estimate')
    );
exception
  when undefined_table then null;
end $$;
