alter table public.listings
  add column if not exists creation_idempotency_key text;

create unique index if not exists listings_user_creation_idempotency_key_idx
  on public.listings(user_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

create or replace function public.landlord_account_has_marketplace_access(target_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with owner_profile as (
    select *
    from public.profiles
    where id = target_owner_id
  )
  select exists (
    select 1
    from owner_profile p
    where lower(coalesce(p.account_status, 'active')) not in ('banned', 'suspended', 'disabled')
      and (
        coalesce(p.is_admin, false)
        or lower(coalesce(p.role, '')) in ('owner', 'landlord', 'host', 'property_manager')
      )
      and (
        coalesce(p.is_admin, false)
        or (
          (
            coalesce(p.identity_verified, false)
            or coalesce(p.is_verified, false)
            or lower(coalesce(p.identity_verification_status, '')) in ('approved', 'verified')
            or exists (
              select 1
              from public.verification_submissions s
              where s.user_id = target_owner_id
                and s.verification_type = 'identity'
                and lower(coalesce(s.status, '')) in ('approved', 'verified')
            )
          )
          and exists (
            select 1
            from public.verification_submissions s
            where s.user_id = target_owner_id
              and s.verification_type in (
                'property_relationship',
                'landlord',
                'host',
                'property_manager'
              )
              and lower(coalesce(s.status, '')) in ('approved', 'verified')
          )
        )
      )
  );
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
  end if;

  return new;
end;
$$;

create or replace function public.evaluate_founding_landlord(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row record;
  config_row record;
  active_assignment record;
  has_identity_verification boolean := false;
  has_landlord_verification boolean := false;
  has_verification boolean := false;
  next_status text;
begin
  perform pg_advisory_xact_lock(hashtext('founding_landlord_program'));
  perform public.release_expired_founding_landlord_reservations();

  select *
  into profile_row
  from public.profiles
  where id = p_user_id
  for update;

  if profile_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  if profile_row.founding_status = 'confirmed' then
    return jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'number', profile_row.founding_landlord_number
    );
  end if;

  select *
  into active_assignment
  from public.founding_landlord_number_assignments
  where profile_id = p_user_id
    and status = 'reserved'
    and (
      reservation_expires_at is null
      or reservation_expires_at >= now()
    )
  order by reserved_at desc
  limit 1;

  if active_assignment.id is null then
    return jsonb_build_object('ok', false, 'code', 'NO_ACTIVE_RESERVATION');
  end if;

  select *
  into config_row
  from public.founding_landlord_program_config
  where id = true;

  has_identity_verification :=
    coalesce(profile_row.identity_verified, false)
    or coalesce(profile_row.is_verified, false)
    or lower(coalesce(profile_row.identity_verification_status, '')) in ('approved', 'verified')
    or exists (
      select 1
      from public.verification_submissions s
      where s.user_id = p_user_id
        and s.verification_type = 'identity'
        and lower(coalesce(s.status, '')) in ('approved', 'verified')
    );

  has_landlord_verification := exists (
    select 1
    from public.verification_submissions s
    where s.user_id = p_user_id
      and s.verification_type in (
        'property_relationship',
        'landlord',
        'host',
        'property_manager'
      )
      and lower(coalesce(s.status, '')) in ('approved', 'verified')
  );

  has_verification := has_identity_verification and has_landlord_verification;

  if has_verification then
    update public.founding_landlord_number_assignments
    set
      status = 'confirmed',
      confirmed_at = now(),
      updated_at = now()
    where id = active_assignment.id;

    update public.profiles
    set
      is_founding_landlord = true,
      founding_status = 'confirmed',
      founding_landlord_number = active_assignment.founding_number,
      founding_confirmed_at = now(),
      founding_benefits_started_at = now(),
      founding_free_fee_period_ends_at =
        now() + make_interval(months => config_row.free_fee_months),
      founding_discount_percentage = config_row.discount_percentage,
      founding_referral_code = coalesce(
        nullif(founding_referral_code, ''),
        public.generate_founding_referral_code(p_user_id)
      )
    where id = p_user_id;

    update public.founding_landlord_referrals r
    set
      status = 'rewarded',
      reward_boosts_awarded = 1,
      rewarded_at = now(),
      updated_at = now()
    where r.referred_id = p_user_id
      and r.status in ('pending', 'qualified')
      and exists (
        select 1
        from public.profiles p
        where p.id = r.referrer_id
          and p.founding_status = 'confirmed'
      );

    insert into public.founding_landlord_benefit_events (
      owner_id,
      event_type,
      metadata
    )
    values (
      p_user_id,
      'confirmed',
      jsonb_build_object(
        'foundingNumber', active_assignment.founding_number,
        'freeFeePeriodEndsAt', now() + make_interval(months => config_row.free_fee_months),
        'discountPercentage', config_row.discount_percentage,
        'trigger', 'account_level_landlord_verification'
      )
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'number', active_assignment.founding_number
    );
  end if;

  next_status := 'pending_verification';

  update public.profiles
  set
    founding_status = next_status,
    founding_landlord_number = active_assignment.founding_number,
    founding_reserved_at = active_assignment.reserved_at,
    founding_reservation_expires_at = active_assignment.reservation_expires_at
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'status', next_status,
    'number', active_assignment.founding_number,
    'hasVerification', has_verification,
    'hasIdentityVerification', has_identity_verification,
    'hasLandlordVerification', has_landlord_verification,
    'hasListing', true,
    'reservationExpiresAt', active_assignment.reservation_expires_at
  );
end;
$$;

revoke all on function public.landlord_account_has_marketplace_access(uuid) from public;
grant execute on function public.landlord_account_has_marketplace_access(uuid) to authenticated, service_role;
