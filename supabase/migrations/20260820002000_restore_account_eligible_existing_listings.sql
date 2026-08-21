do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'listings_enforce_publish_verification'
      and tgrelid = 'public.listings'::regclass
  ) then
    alter table public.listings disable trigger listings_enforce_publish_verification;
  end if;
end $$;

with reconciliation_targets as (
  select *
  from (values
    (
      'c97ee863-ef1b-4746-9e9d-3c183300ace2'::uuid,
      'restore_testing_3_marketplace_example'::text
    ),
    (
      '931c5a5f-e1db-4504-95f5-58b7afd3ac2a'::uuid,
      'restore_verified_landlord_existing_listing'::text
    )
  ) as target(listing_id, reason)
),
eligible_existing_listings as (
  select
    l.id,
    l.user_id,
    l.status as previous_status,
    t.reason
  from public.listings l
  join reconciliation_targets t on t.listing_id = l.id
  where l.status in ('draft', 'pending')
    and public.landlord_account_has_marketplace_access(l.user_id)
),
restored_listings as (
  update public.listings l
  set status = 'available'
  from eligible_existing_listings e
  where l.id = e.id
  returning
    l.id,
    l.user_id,
    e.previous_status,
    e.reason
)
insert into public.listing_verification_audit_events (
  listing_id,
  verification_id,
  actor_id,
  event_type,
  metadata
)
select
  id,
  null,
  user_id,
  'listing_restored_by_account_level_reconciliation',
  jsonb_build_object(
    'previous_status', previous_status,
    'new_status', 'available',
    'reason', reason,
    'account_level_landlord_flow', true
  )
from restored_listings;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'listings_enforce_publish_verification'
      and tgrelid = 'public.listings'::regclass
  ) then
    alter table public.listings enable trigger listings_enforce_publish_verification;
  end if;
end $$;
