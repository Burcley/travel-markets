create or replace function public.activate_founding_listing_boost(
  p_owner_id uuid,
  p_listing_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row record;
  listing_row record;
  config_row record;
  boost_row record;
  month_start_value date := date_trunc('month', now())::date;
  monthly_used integer := 0;
  referral_available record;
  referral_id_value uuid := null;
  source_value text := 'founding_monthly';
  expires_at_value timestamptz := now() + interval '7 days';
begin
  select *
  into profile_row
  from public.profiles
  where id = p_owner_id
  for update;

  if profile_row.id is null
    or profile_row.founding_status <> 'confirmed'
    or coalesce(profile_row.is_founding_landlord, false) is not true
    or coalesce(profile_row.founding_benefits_disabled, false) is true
  then
    return jsonb_build_object('ok', false, 'code', 'FOUNDING_NOT_ELIGIBLE');
  end if;

  select *
  into listing_row
  from public.listings
  where id = p_listing_id
  for update;

  if listing_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'LISTING_NOT_FOUND');
  end if;

  if listing_row.user_id <> p_owner_id then
    return jsonb_build_object('ok', false, 'code', 'NOT_OWNER');
  end if;

  if coalesce(listing_row.status, '') not in ('available', 'pending') then
    return jsonb_build_object('ok', false, 'code', 'LISTING_NOT_ACTIVE');
  end if;

  if listing_row.boost_until is not null and listing_row.boost_until > now() then
    return jsonb_build_object('ok', false, 'code', 'LISTING_ALREADY_BOOSTED');
  end if;

  if exists (
    select 1
    from public.listing_boosts
    where listing_id = p_listing_id
      and status = 'active'
      and started_at <= now()
      and expires_at > now()
  ) then
    return jsonb_build_object('ok', false, 'code', 'LISTING_ALREADY_BOOSTED');
  end if;

  select *
  into config_row
  from public.founding_landlord_program_config
  where id = true;

  select count(*)
  into monthly_used
  from public.founding_landlord_monthly_boost_redemptions
  where owner_id = p_owner_id
    and source = 'founding_monthly'
    and month_start = month_start_value;

  if monthly_used >= coalesce(config_row.monthly_free_boosts, 0) then
    select r.*
    into referral_available
    from public.founding_landlord_referrals r
    where r.referrer_id = p_owner_id
      and r.status = 'rewarded'
      and r.reward_boosts_awarded >
        (
          select count(*)
          from public.founding_landlord_monthly_boost_redemptions b
          where b.owner_id = p_owner_id
            and b.source = 'founding_referral'
            and b.referral_id = r.id
        )
    order by r.rewarded_at nulls last, r.created_at
    limit 1;

    if referral_available.id is null then
      return jsonb_build_object('ok', false, 'code', 'FOUNDING_NO_BOOSTS');
    end if;

    source_value := 'founding_referral';
    referral_id_value := referral_available.id;
  end if;

  insert into public.listing_boosts (
    owner_id,
    listing_id,
    source,
    duration_days,
    started_at,
    expires_at,
    status
  )
  values (
    p_owner_id,
    p_listing_id,
    source_value,
    7,
    now(),
    expires_at_value,
    'active'
  )
  returning *
  into boost_row;

  insert into public.founding_landlord_monthly_boost_redemptions (
    owner_id,
    listing_id,
    boost_id,
    month_start,
    source,
    referral_id
  )
  values (
    p_owner_id,
    p_listing_id,
    boost_row.id,
    case when source_value = 'founding_monthly' then month_start_value else null end,
    source_value,
    referral_id_value
  );

  update public.listings
  set
    boost_until = expires_at_value,
    boost_rank = greatest(coalesce(boost_rank, 0), 175),
    is_featured = true
  where id = p_listing_id
    and user_id = p_owner_id;

  return jsonb_build_object(
    'ok', true,
    'boostId', boost_row.id,
    'listingId', boost_row.listing_id,
    'source', boost_row.source,
    'startedAt', boost_row.started_at,
    'expiresAt', boost_row.expires_at,
    'remainingMonthly', greatest(
      0,
      coalesce(config_row.monthly_free_boosts, 0) -
      case when source_value = 'founding_monthly' then monthly_used + 1 else monthly_used end
    )
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'LISTING_ALREADY_BOOSTED');
end;
$$;
