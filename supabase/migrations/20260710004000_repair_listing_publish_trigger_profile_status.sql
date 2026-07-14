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
