create or replace function public.admin_publish_listing_as_owner(
  p_admin_id uuid,
  p_listing_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_record record;
  listing_record record;
begin
  select id, role, is_admin, account_status
  into admin_record
  from public.profiles
  where id = p_admin_id;

  if admin_record is null
    or (
      coalesce(admin_record.is_admin, false) is not true
      and lower(coalesce(admin_record.role, '')) <> 'admin'
    )
    or lower(coalesce(admin_record.account_status, 'active')) in ('banned', 'suspended', 'disabled') then
    raise exception 'Only active admins can publish imported drafts.';
  end if;

  select id, user_id, status
  into listing_record
  from public.listings
  where id = p_listing_id
  for update;

  if listing_record is null then
    raise exception 'Listing not found.';
  end if;

  if coalesce(listing_record.status, 'draft') = 'available' then
    return jsonb_build_object(
      'ok', true,
      'status', 'skipped',
      'listingId', p_listing_id
    );
  end if;

  if coalesce(listing_record.status, 'draft') <> 'draft' then
    raise exception 'Only draft listings can be bulk published.';
  end if;

  perform set_config('request.jwt.claim.sub', listing_record.user_id::text, true);

  update public.listings
  set status = 'available'
  where id = p_listing_id
    and user_id = listing_record.user_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'published',
    'listingId', p_listing_id
  );
end;
$$;

revoke all on function public.admin_publish_listing_as_owner(uuid, uuid) from public;
grant execute on function public.admin_publish_listing_as_owner(uuid, uuid) to service_role;
