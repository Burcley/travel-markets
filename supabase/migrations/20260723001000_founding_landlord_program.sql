alter table public.profiles
  add column if not exists is_founding_landlord boolean not null default false,
  add column if not exists founding_landlord_number integer,
  add column if not exists founding_status text not null default 'not_eligible',
  add column if not exists founding_reserved_at timestamptz,
  add column if not exists founding_reservation_expires_at timestamptz,
  add column if not exists founding_confirmed_at timestamptz,
  add column if not exists founding_benefits_started_at timestamptz,
  add column if not exists founding_free_fee_period_ends_at timestamptz,
  add column if not exists founding_discount_percentage integer,
  add column if not exists founding_referral_code text,
  add column if not exists founding_referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists founding_benefits_disabled boolean not null default false,
  add column if not exists founding_benefits_disabled_reason text;

alter table public.profiles
  drop constraint if exists profiles_founding_status_check;

alter table public.profiles
  add constraint profiles_founding_status_check
  check (
    founding_status in (
      'not_eligible',
      'reserved',
      'pending_verification',
      'pending_listing',
      'confirmed',
      'disqualified'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_founding_number_check;

alter table public.profiles
  add constraint profiles_founding_number_check
  check (
    founding_landlord_number is null
    or founding_landlord_number between 1 and 30
  );

alter table public.profiles
  drop constraint if exists profiles_founding_discount_check;

alter table public.profiles
  add constraint profiles_founding_discount_check
  check (
    founding_discount_percentage is null
    or founding_discount_percentage between 0 and 100
  );

alter table public.profiles
  drop constraint if exists profiles_founding_confirmed_consistency_check;

alter table public.profiles
  add constraint profiles_founding_confirmed_consistency_check
  check (
    founding_status <> 'confirmed'
    or (
      is_founding_landlord = true
      and founding_landlord_number is not null
      and founding_confirmed_at is not null
      and founding_benefits_started_at is not null
      and founding_free_fee_period_ends_at is not null
      and founding_discount_percentage is not null
    )
  );

create unique index if not exists profiles_founding_number_unique_idx
  on public.profiles(founding_landlord_number)
  where founding_landlord_number is not null;

create unique index if not exists profiles_founding_referral_code_unique_idx
  on public.profiles(lower(founding_referral_code))
  where founding_referral_code is not null;

create table if not exists public.founding_landlord_program_config (
  id boolean primary key default true,
  is_active boolean not null default true,
  max_positions integer not null default 30,
  reservation_days integer not null default 14,
  monthly_free_boosts integer not null default 2,
  free_fee_months integer not null default 12,
  discount_percentage integer not null default 25,
  program_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founding_landlord_program_config_singleton check (id = true),
  constraint founding_landlord_program_config_values check (
    max_positions between 1 and 30
    and reservation_days between 1 and 90
    and monthly_free_boosts between 0 and 20
    and free_fee_months between 0 and 36
    and discount_percentage between 0 and 100
  )
);

insert into public.founding_landlord_program_config (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.founding_landlord_number_assignments (
  id uuid primary key default gen_random_uuid(),
  founding_number integer not null check (founding_number between 1 and 30),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'reserved',
  reserved_at timestamptz not null default now(),
  reservation_expires_at timestamptz,
  confirmed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founding_landlord_assignments_status_check check (
    status in ('reserved', 'confirmed', 'released', 'disqualified')
  )
);

create unique index if not exists founding_landlord_active_number_idx
  on public.founding_landlord_number_assignments(founding_number)
  where status in ('reserved', 'confirmed');

create unique index if not exists founding_landlord_confirmed_number_idx
  on public.founding_landlord_number_assignments(founding_number)
  where status = 'confirmed';

create unique index if not exists founding_landlord_active_profile_idx
  on public.founding_landlord_number_assignments(profile_id)
  where status in ('reserved', 'confirmed');

create index if not exists founding_landlord_assignments_profile_idx
  on public.founding_landlord_number_assignments(profile_id, status);

create table if not exists public.founding_landlord_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending',
  reward_boosts_awarded integer not null default 0,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founding_landlord_referrals_status_check check (
    status in ('pending', 'qualified', 'rewarded', 'disqualified')
  ),
  constraint founding_landlord_referrals_no_self_check check (referrer_id <> referred_id)
);

create unique index if not exists founding_landlord_referrals_referred_idx
  on public.founding_landlord_referrals(referred_id);

create index if not exists founding_landlord_referrals_referrer_idx
  on public.founding_landlord_referrals(referrer_id, status);

create table if not exists public.founding_landlord_monthly_boost_redemptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  boost_id uuid references public.listing_boosts(id) on delete set null,
  month_start date,
  source text not null,
  referral_id uuid references public.founding_landlord_referrals(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint founding_landlord_boost_redemptions_source_check check (
    source in ('founding_monthly', 'founding_referral')
  )
);

create index if not exists founding_landlord_boost_redemptions_owner_month_idx
  on public.founding_landlord_monthly_boost_redemptions(owner_id, month_start, source);

create table if not exists public.founding_landlord_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  message text,
  status text not null default 'requested',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founding_landlord_assistance_status_check check (
    status in ('requested', 'in_progress', 'completed', 'closed')
  )
);

create index if not exists founding_landlord_assistance_owner_idx
  on public.founding_landlord_assistance_requests(owner_id, status);

create table if not exists public.founding_landlord_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'general',
  message text not null,
  status text not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founding_landlord_feedback_status_check check (
    status in ('new', 'reviewed', 'closed')
  )
);

create index if not exists founding_landlord_feedback_owner_idx
  on public.founding_landlord_feedback(owner_id, status);

create table if not exists public.founding_landlord_benefit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists founding_landlord_benefit_events_owner_idx
  on public.founding_landlord_benefit_events(owner_id, created_at desc);

alter table public.listing_boosts
  drop constraint if exists listing_boosts_source_check;

alter table public.listing_boosts
  add constraint listing_boosts_source_check
  check (
    source in (
      'included',
      'founding_monthly',
      'founding_referral',
      'purchased_7_day',
      'purchased_14_day',
      'purchased_30_day',
      'legacy'
    )
  );

alter table public.founding_landlord_number_assignments enable row level security;
alter table public.founding_landlord_referrals enable row level security;
alter table public.founding_landlord_monthly_boost_redemptions enable row level security;
alter table public.founding_landlord_assistance_requests enable row level security;
alter table public.founding_landlord_feedback enable row level security;
alter table public.founding_landlord_benefit_events enable row level security;

drop policy if exists "Users can read their founding number assignments"
  on public.founding_landlord_number_assignments;
create policy "Users can read their founding number assignments"
on public.founding_landlord_number_assignments
for select
to authenticated
using (auth.uid() = profile_id or public.current_user_is_admin());

drop policy if exists "Users can read their founding referrals"
  on public.founding_landlord_referrals;
create policy "Users can read their founding referrals"
on public.founding_landlord_referrals
for select
to authenticated
using (auth.uid() in (referrer_id, referred_id) or public.current_user_is_admin());

drop policy if exists "Users can read their founding boost redemptions"
  on public.founding_landlord_monthly_boost_redemptions;
create policy "Users can read their founding boost redemptions"
on public.founding_landlord_monthly_boost_redemptions
for select
to authenticated
using (auth.uid() = owner_id or public.current_user_is_admin());

drop policy if exists "Users can read their founding assistance requests"
  on public.founding_landlord_assistance_requests;
create policy "Users can read their founding assistance requests"
on public.founding_landlord_assistance_requests
for select
to authenticated
using (auth.uid() = owner_id or public.current_user_is_admin());

drop policy if exists "Users can create their founding assistance requests"
  on public.founding_landlord_assistance_requests;
create policy "Users can create their founding assistance requests"
on public.founding_landlord_assistance_requests
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users can read their founding feedback"
  on public.founding_landlord_feedback;
create policy "Users can read their founding feedback"
on public.founding_landlord_feedback
for select
to authenticated
using (auth.uid() = owner_id or public.current_user_is_admin());

drop policy if exists "Users can create their founding feedback"
  on public.founding_landlord_feedback;
create policy "Users can create their founding feedback"
on public.founding_landlord_feedback
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users can read their founding benefit events"
  on public.founding_landlord_benefit_events;
create policy "Users can read their founding benefit events"
on public.founding_landlord_benefit_events
for select
to authenticated
using (auth.uid() = owner_id or public.current_user_is_admin());

drop policy if exists "Founding landlord tables are service-role writable only"
  on public.founding_landlord_number_assignments;
create policy "Founding landlord assignments are service-role writable only"
on public.founding_landlord_number_assignments
for all
to service_role
using (true)
with check (true);

drop policy if exists "Founding landlord referrals are service-role writable only"
  on public.founding_landlord_referrals;
create policy "Founding landlord referrals are service-role writable only"
on public.founding_landlord_referrals
for all
to service_role
using (true)
with check (true);

drop policy if exists "Founding landlord boost redemptions are service-role writable only"
  on public.founding_landlord_monthly_boost_redemptions;
create policy "Founding landlord boost redemptions are service-role writable only"
on public.founding_landlord_monthly_boost_redemptions
for all
to service_role
using (true)
with check (true);

drop policy if exists "Founding landlord assistance is service-role writable"
  on public.founding_landlord_assistance_requests;
create policy "Founding landlord assistance is service-role writable"
on public.founding_landlord_assistance_requests
for all
to service_role
using (true)
with check (true);

drop policy if exists "Founding landlord feedback is service-role writable"
  on public.founding_landlord_feedback;
create policy "Founding landlord feedback is service-role writable"
on public.founding_landlord_feedback
for all
to service_role
using (true)
with check (true);

drop policy if exists "Founding landlord benefit events are service-role writable only"
  on public.founding_landlord_benefit_events;
create policy "Founding landlord benefit events are service-role writable only"
on public.founding_landlord_benefit_events
for all
to service_role
using (true)
with check (true);

create or replace function public.is_founding_landlord_role(p_role text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_role, '')) in ('owner', 'landlord', 'host');
$$;

create or replace function public.generate_founding_referral_code(p_user_id uuid)
returns text
language sql
immutable
as $$
  select upper('TM-' || substr(md5(p_user_id::text), 1, 8));
$$;

create or replace function public.release_expired_founding_landlord_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer := 0;
begin
  update public.founding_landlord_number_assignments a
  set
    status = 'released',
    released_at = now(),
    release_reason = 'reservation_expired',
    updated_at = now()
  where a.status = 'reserved'
    and a.reservation_expires_at is not null
    and a.reservation_expires_at < now()
    and not exists (
      select 1
      from public.profiles p
      where p.id = a.profile_id
        and p.founding_status = 'confirmed'
    );

  get diagnostics released_count = row_count;

  update public.profiles p
  set
    is_founding_landlord = false,
    founding_landlord_number = null,
    founding_status = 'not_eligible',
    founding_reserved_at = null,
    founding_reservation_expires_at = null,
    founding_confirmed_at = null,
    founding_benefits_started_at = null,
    founding_free_fee_period_ends_at = null,
    founding_discount_percentage = null
  where p.founding_status in (
      'reserved',
      'pending_verification',
      'pending_listing'
    )
    and p.founding_reservation_expires_at is not null
    and p.founding_reservation_expires_at < now()
    and not exists (
      select 1
      from public.founding_landlord_number_assignments a
      where a.profile_id = p.id
        and a.status = 'confirmed'
    );

  return released_count;
end;
$$;

create or replace function public.try_reserve_founding_landlord(
  p_user_id uuid,
  p_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row record;
  config_row record;
  existing_assignment record;
  next_number integer;
  expires_at_value timestamptz;
  normalized_referral_code text := nullif(upper(trim(coalesce(p_referral_code, ''))), '');
  referrer_profile record;
begin
  perform pg_advisory_xact_lock(hashtext('founding_landlord_program'));
  perform public.release_expired_founding_landlord_reservations();

  select *
  into config_row
  from public.founding_landlord_program_config
  where id = true
  for update;

  if config_row.id is null or config_row.is_active is not true then
    return jsonb_build_object('ok', false, 'code', 'PROGRAM_INACTIVE');
  end if;

  select *
  into profile_row
  from public.profiles
  where id = p_user_id
  for update;

  if profile_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  if coalesce(profile_row.is_admin, false)
    or lower(coalesce(profile_row.role, '')) = 'admin'
    or not public.is_founding_landlord_role(profile_row.role)
    or lower(coalesce(profile_row.account_status, 'active')) in ('banned', 'suspended', 'test')
  then
    return jsonb_build_object('ok', false, 'code', 'NOT_ELIGIBLE');
  end if;

  if profile_row.founding_status = 'disqualified'
    or coalesce(profile_row.founding_benefits_disabled, false)
  then
    return jsonb_build_object('ok', false, 'code', 'DISQUALIFIED');
  end if;

  if profile_row.founding_status = 'confirmed'
    and profile_row.founding_landlord_number is not null
  then
    return jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'number', profile_row.founding_landlord_number
    );
  end if;

  select *
  into existing_assignment
  from public.founding_landlord_number_assignments
  where profile_id = p_user_id
    and status = 'reserved'
    and (
      reservation_expires_at is null
      or reservation_expires_at >= now()
    )
  order by reserved_at desc
  limit 1;

  if existing_assignment.id is not null then
    return jsonb_build_object(
      'ok', true,
      'status', profile_row.founding_status,
      'number', existing_assignment.founding_number,
      'reservationExpiresAt', existing_assignment.reservation_expires_at
    );
  end if;

  select candidate
  into next_number
  from generate_series(1, config_row.max_positions) as candidate
  where not exists (
    select 1
    from public.founding_landlord_number_assignments a
    where a.founding_number = candidate
      and a.status in ('reserved', 'confirmed')
  )
  order by candidate
  limit 1;

  if next_number is null then
    return jsonb_build_object('ok', false, 'code', 'PROGRAM_FULL');
  end if;

  expires_at_value := now() + make_interval(days => config_row.reservation_days);

  insert into public.founding_landlord_number_assignments (
    founding_number,
    profile_id,
    status,
    reserved_at,
    reservation_expires_at
  )
  values (
    next_number,
    p_user_id,
    'reserved',
    now(),
    expires_at_value
  );

  update public.profiles
  set
    is_founding_landlord = false,
    founding_landlord_number = next_number,
    founding_status = 'reserved',
    founding_reserved_at = now(),
    founding_reservation_expires_at = expires_at_value,
    founding_referral_code = coalesce(
      nullif(founding_referral_code, ''),
      public.generate_founding_referral_code(p_user_id)
    )
  where id = p_user_id;

  if normalized_referral_code is not null then
    select *
    into referrer_profile
    from public.profiles
    where upper(coalesce(founding_referral_code, '')) = normalized_referral_code
      and id <> p_user_id
      and founding_status = 'confirmed'
    limit 1;

    if referrer_profile.id is not null then
      insert into public.founding_landlord_referrals (
        referrer_id,
        referred_id,
        referral_code,
        status
      )
      values (
        referrer_profile.id,
        p_user_id,
        normalized_referral_code,
        'pending'
      )
      on conflict (referred_id) do nothing;

      update public.profiles
      set founding_referred_by = referrer_profile.id
      where id = p_user_id
        and founding_referred_by is null;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'reserved',
    'number', next_number,
    'reservationExpiresAt', expires_at_value
  );
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
  has_verification boolean := false;
  has_listing boolean := false;
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

  has_verification :=
    coalesce(profile_row.identity_verified, false)
    or coalesce(profile_row.is_verified, false)
    or lower(coalesce(profile_row.identity_verification_status, '')) in ('approved', 'verified')
    or exists (
      select 1
      from public.verification_submissions s
      where s.user_id = p_user_id
        and s.verification_type in ('identity', 'property_relationship')
        and s.status = 'approved'
    )
    or exists (
      select 1
      from public.listing_verifications v
      where v.owner_id = p_user_id
        and v.status = 'verified'
    );

  has_listing := exists (
    select 1
    from public.listings l
    where l.user_id = p_user_id
      and coalesce(l.status, '') in ('available', 'pending')
      and (
        exists (
          select 1
          from public.listing_verifications v
          where v.listing_id = l.id
            and v.owner_id = p_user_id
            and v.status = 'verified'
        )
        or exists (
          select 1
          from public.verification_submissions s
          where s.user_id = p_user_id
            and s.verification_type = 'property_relationship'
            and s.status = 'approved'
        )
      )
  );

  if has_verification and has_listing then
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
        'discountPercentage', config_row.discount_percentage
      )
    );

    return jsonb_build_object(
      'ok', true,
      'status', 'confirmed',
      'number', active_assignment.founding_number
    );
  end if;

  next_status := case
    when not has_verification then 'pending_verification'
    else 'pending_listing'
  end;

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
    'hasListing', has_listing,
    'reservationExpiresAt', active_assignment.reservation_expires_at
  );
end;
$$;

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
    case when source_value = 'founding_referral' then referral_available.id else null end
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

create or replace function public.get_founding_landlord_public_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  config_row record;
  confirmed_count integer;
  reserved_count integer;
begin
  perform public.release_expired_founding_landlord_reservations();

  select *
  into config_row
  from public.founding_landlord_program_config
  where id = true;

  select count(*)
  into confirmed_count
  from public.profiles
  where founding_status = 'confirmed'
    and is_founding_landlord = true;

  select count(*)
  into reserved_count
  from public.founding_landlord_number_assignments
  where status = 'reserved'
    and (
      reservation_expires_at is null
      or reservation_expires_at >= now()
    );

  return jsonb_build_object(
    'isActive', coalesce(config_row.is_active, false),
    'maxPositions', coalesce(config_row.max_positions, 30),
    'confirmedCount', confirmed_count,
    'reservedCount', reserved_count,
    'availablePositions', greatest(
      0,
      coalesce(config_row.max_positions, 30) - confirmed_count - reserved_count
    )
  );
end;
$$;

revoke all on function public.try_reserve_founding_landlord(uuid, text) from public;
revoke all on function public.evaluate_founding_landlord(uuid) from public;
revoke all on function public.activate_founding_listing_boost(uuid, uuid) from public;
revoke all on function public.release_expired_founding_landlord_reservations() from public;

grant execute on function public.try_reserve_founding_landlord(uuid, text) to service_role;
grant execute on function public.evaluate_founding_landlord(uuid) to service_role;
grant execute on function public.activate_founding_listing_boost(uuid, uuid) to service_role;
grant execute on function public.release_expired_founding_landlord_reservations() to service_role;
grant execute on function public.get_founding_landlord_public_stats() to anon, authenticated, service_role;
