alter table public.listings
  add column if not exists public_latitude double precision,
  add column if not exists public_longitude double precision,
  add column if not exists location_privacy_radius_meters integer,
  add column if not exists public_location_generated_at timestamptz;

create index if not exists listings_public_latitude_idx
  on public.listings(public_latitude);

create index if not exists listings_public_longitude_idx
  on public.listings(public_longitude);

create table if not exists public.listing_location_privacy_repairs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  old_privacy_distance_meters numeric,
  new_privacy_distance_meters numeric,
  repaired_at timestamptz not null default now(),
  reason text not null default 'public_location_repair'
);

create or replace function public.tm_location_privacy_distance_meters(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
) returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 2 * 6371000 * asin(
      least(
        1,
        sqrt(
          power(sin(radians((lat2 - lat1) / 2)), 2) +
          cos(radians(lat1)) *
          cos(radians(lat2)) *
          power(sin(radians((lon2 - lon1) / 2)), 2)
        )
      )
    )
  end;
$$;

create or replace function public.tm_generate_public_listing_coordinate(
  exact_latitude double precision,
  exact_longitude double precision,
  seed text,
  min_offset_meters integer default 75,
  max_offset_meters integer default 150
) returns table (
  public_latitude double precision,
  public_longitude double precision,
  radius_meters integer
)
language plpgsql
immutable
as $$
declare
  bearing_seed bigint;
  radius_seed bigint;
  bearing double precision;
  radius double precision;
  lat_delta double precision;
  lng_delta double precision;
begin
  if exact_latitude is null or exact_longitude is null then
    public_latitude := null;
    public_longitude := null;
    radius_meters := null;
    return next;
    return;
  end if;

  bearing_seed := (('x' || substr(md5(coalesce(seed, '') || ':bearing'), 1, 8))::bit(32)::bigint);
  radius_seed := (('x' || substr(md5(coalesce(seed, '') || ':radius'), 1, 8))::bit(32)::bigint);

  bearing := (bearing_seed::double precision / 4294967295.0) * 2 * pi();
  radius := min_offset_meters +
    (radius_seed::double precision / 4294967295.0) *
    greatest(0, max_offset_meters - min_offset_meters);

  lat_delta := (radius * cos(bearing)) / 111320.0;
  lng_delta := (radius * sin(bearing)) /
    greatest(1, 111320.0 * cos(radians(exact_latitude)));

  public_latitude := exact_latitude + lat_delta;
  public_longitude := exact_longitude + lng_delta;
  radius_meters := round(radius)::integer;
  return next;
end;
$$;

create or replace function public.tm_listing_public_location_needs_repair(
  exact_latitude double precision,
  exact_longitude double precision,
  public_latitude double precision,
  public_longitude double precision,
  campus_latitude double precision,
  campus_longitude double precision
) returns boolean
language sql
immutable
as $$
  select
    exact_latitude is not null
    and exact_longitude is not null
    and (
      public_latitude is null
      or public_longitude is null
      or public_latitude < -90
      or public_latitude > 90
      or public_longitude < -180
      or public_longitude > 180
      or coalesce(
        public.tm_location_privacy_distance_meters(
          exact_latitude,
          exact_longitude,
          public_latitude,
          public_longitude
        ),
        999999
      ) < 50
      or coalesce(
        public.tm_location_privacy_distance_meters(
          exact_latitude,
          exact_longitude,
          public_latitude,
          public_longitude
        ),
        999999
      ) > 300
      or (
        campus_latitude is not null
        and campus_longitude is not null
        and coalesce(
          public.tm_location_privacy_distance_meters(
            public_latitude,
            public_longitude,
            campus_latitude,
            campus_longitude
          ),
          999999
        ) < 10
      )
    );
$$;

create or replace function public.tm_set_listing_public_location()
returns trigger
language plpgsql
as $$
declare
  generated record;
begin
  if new.latitude is null or new.longitude is null then
    new.public_latitude := null;
    new.public_longitude := null;
    new.location_privacy_radius_meters := null;
    new.public_location_generated_at := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    select *
    into generated
    from public.tm_generate_public_listing_coordinate(
      new.latitude,
      new.longitude,
      new.id::text,
      75,
      150
    );

    new.public_latitude := generated.public_latitude;
    new.public_longitude := generated.public_longitude;
    new.location_privacy_radius_meters := generated.radius_meters;
    new.public_location_generated_at := now();
    return new;
  end if;

  if new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or public.tm_listing_public_location_needs_repair(
      new.latitude,
      new.longitude,
      new.public_latitude,
      new.public_longitude,
      new.campus_latitude,
      new.campus_longitude
    )
  then
    select *
    into generated
    from public.tm_generate_public_listing_coordinate(
      new.latitude,
      new.longitude,
      new.id::text,
      75,
      150
    );

    new.public_latitude := generated.public_latitude;
    new.public_longitude := generated.public_longitude;
    new.location_privacy_radius_meters := generated.radius_meters;
    new.public_location_generated_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_listing_public_location on public.listings;

create trigger set_listing_public_location
before insert or update of latitude, longitude, public_latitude, public_longitude, campus_latitude, campus_longitude
on public.listings
for each row
execute function public.tm_set_listing_public_location();

with candidates as (
  select
    id,
    latitude,
    longitude,
    public_latitude as old_public_latitude,
    public_longitude as old_public_longitude,
    public.tm_location_privacy_distance_meters(
      latitude,
      longitude,
      public_latitude,
      public_longitude
    ) as old_privacy_distance_meters
  from public.listings
  where public.tm_listing_public_location_needs_repair(
    latitude,
    longitude,
    public_latitude,
    public_longitude,
    campus_latitude,
    campus_longitude
  )
),
generated as (
  select
    candidates.*,
    generated_public.public_latitude as next_public_latitude,
    generated_public.public_longitude as next_public_longitude,
    generated_public.radius_meters as next_radius_meters
  from candidates
  cross join lateral public.tm_generate_public_listing_coordinate(
    candidates.latitude,
    candidates.longitude,
    candidates.id::text,
    75,
    150
  ) as generated_public
),
updated as (
  update public.listings
  set
    public_latitude = generated.next_public_latitude,
    public_longitude = generated.next_public_longitude,
    location_privacy_radius_meters = generated.next_radius_meters,
    public_location_generated_at = now()
  from generated
  where public.listings.id = generated.id
  returning
    public.listings.id,
    generated.old_privacy_distance_meters,
    generated.next_radius_meters
)
insert into public.listing_location_privacy_repairs (
  listing_id,
  old_privacy_distance_meters,
  new_privacy_distance_meters,
  reason
)
select
  id,
  old_privacy_distance_meters,
  next_radius_meters,
  'initial_backfill_or_excessive_offset_repair'
from updated;

do $$
begin
  alter table public.listing_campus_routes
    drop constraint if exists listing_campus_routes_origin_type_check;

  alter table public.listing_campus_routes
    add constraint listing_campus_routes_origin_type_check
    check (origin_type in ('protected', 'protected_public_v2', 'exact'));
exception
  when undefined_table then null;
end $$;
