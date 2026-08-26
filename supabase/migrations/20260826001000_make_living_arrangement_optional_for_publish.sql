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
    select role, is_admin, account_status
    into profile_record
    from public.profiles
    where id = new.user_id;

    if auth.uid() is null or auth.uid() <> new.user_id then
      raise exception 'Only the listing owner can publish this listing.';
    end if;

    if profile_record is null then
      raise exception 'A profile is required before publishing.';
    end if;

    if lower(coalesce(profile_record.account_status, 'active')) in ('banned', 'suspended', 'disabled') then
      raise exception 'This account cannot publish listings.';
    end if;

    if not (
      coalesce(profile_record.is_admin, false)
      or lower(coalesce(profile_record.role, '')) in ('owner', 'landlord', 'host', 'property_manager', 'admin')
    ) then
      raise exception 'Only landlord accounts can publish listings.';
    end if;

    if not public.landlord_account_has_marketplace_access(new.user_id) then
      raise exception 'Complete landlord verification to publish listings.';
    end if;

    if new.fair_housing_acknowledged is not true then
      raise exception 'Acknowledge the fair-housing document notice before publishing.';
    end if;
  end if;

  return new;
end;
$$;
