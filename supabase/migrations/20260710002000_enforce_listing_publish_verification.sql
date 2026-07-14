alter table public.listings
  add column if not exists verification_required_at timestamptz,
  add column if not exists verification_disclaimer_acknowledged boolean not null default false,
  add column if not exists fair_housing_acknowledged boolean not null default false;

alter table public.listing_verifications
  add column if not exists other_relationship_explanation text;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.listings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.listings drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.listings
  add constraint listings_status_check
  check (status is null or status in ('draft', 'available', 'pending', 'rented'));

create table if not exists public.listing_verification_audit_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  verification_id uuid references public.listing_verifications(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists listing_verification_audit_events_listing_id_idx
  on public.listing_verification_audit_events(listing_id);

alter table public.listing_verification_audit_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'listing_verification_audit_events'
      and policyname = 'Listing verification audit visible to owners and admins'
  ) then
    create policy "Listing verification audit visible to owners and admins"
      on public.listing_verification_audit_events
      for select
      using (
        public.current_user_is_admin()
        or exists (
          select 1 from public.listings
          where listings.id = listing_id
            and listings.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'listing_verification_audit_events'
      and policyname = 'Listing verification audit insert for owners and admins'
  ) then
    create policy "Listing verification audit insert for owners and admins"
      on public.listing_verification_audit_events
      for insert
      with check (
        actor_id = auth.uid()
        and (
          public.current_user_is_admin()
          or exists (
            select 1 from public.listings
            where listings.id = listing_id
              and listings.user_id = auth.uid()
          )
        )
      );
  end if;
end $$;

create or replace function public.listing_has_publish_verification(target_listing_id uuid, target_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.listing_verifications v
    where v.listing_id = target_listing_id
      and v.owner_id = target_owner_id
      and v.relationship_type is not null
      and v.status in ('pending', 'more_information_required', 'verified')
      and exists (
        select 1
        from public.listing_verification_documents d
        where d.verification_id = v.id
          and d.uploader_id = target_owner_id
          and d.storage_path is not null
          and d.review_status in ('pending', 'accepted')
      )
  );
$$;

create or replace function public.listing_living_arrangement_complete(
  owner_occupies boolean,
  family_occupies boolean,
  shared_kitchen boolean,
  shared_bathroom boolean,
  has_private_bedroom boolean,
  is_self_contained boolean,
  has_other_occupants boolean
)
returns boolean
language sql
immutable
as $$
  select owner_occupies is not null
    and family_occupies is not null
    and shared_kitchen is not null
    and shared_bathroom is not null
    and has_private_bedroom is not null
    and is_self_contained is not null
    and has_other_occupants is not null;
$$;

create or replace function public.enforce_listing_publish_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_record record;
begin
  if new.verification_required_at is null then
    new.verification_required_at = now();
  end if;

  if coalesce(new.status, 'draft') in ('available', 'pending')
    and new.verification_required_at is not null then
    select role, is_admin, account_status, status
    into profile_record
    from public.profiles
    where id = new.user_id;

    if auth.uid() is null or auth.uid() <> new.user_id then
      raise exception 'Only the listing owner can publish this listing.';
    end if;

    if profile_record is null then
      raise exception 'A profile is required before publishing.';
    end if;

    if lower(coalesce(profile_record.account_status, profile_record.status, 'active')) in ('banned', 'suspended', 'disabled') then
      raise exception 'This account cannot publish listings.';
    end if;

    if not (
      coalesce(profile_record.is_admin, false)
      or lower(coalesce(profile_record.role, '')) in ('owner', 'landlord', 'admin')
    ) then
      raise exception 'Only landlord accounts can publish listings.';
    end if;

    if new.verification_disclaimer_acknowledged is not true then
      raise exception 'Acknowledge the property verification disclaimer before publishing.';
    end if;

    if new.fair_housing_acknowledged is not true then
      raise exception 'Acknowledge the fair-housing document notice before publishing.';
    end if;

    if not public.listing_living_arrangement_complete(
      new.owner_occupies_property,
      new.owner_family_occupies_property,
      new.shared_kitchen_with_owner,
      new.shared_bathroom_with_owner,
      new.private_bedroom,
      new.self_contained_unit,
      new.other_occupants_present
    ) then
      raise exception 'Complete the living-arrangement questions before publishing.';
    end if;

    if not public.listing_has_publish_verification(new.id, new.user_id) then
      raise exception 'Property verification is required before this listing can be published. Upload at least one document showing your ownership, management authority or authorization to advertise this property.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists listings_enforce_publish_verification on public.listings;
create trigger listings_enforce_publish_verification
before insert or update of status, user_id, city, address, address_line, unit, postal_code, verification_disclaimer_acknowledged, fair_housing_acknowledged, owner_occupies_property, owner_family_occupies_property, shared_kitchen_with_owner, shared_bathroom_with_owner, private_bedroom, self_contained_unit, other_occupants_present
on public.listings
for each row execute function public.enforce_listing_publish_verification();
