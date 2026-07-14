create table if not exists public.listing_boosts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  source text not null,
  duration_days integer not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_event_id text,
  billing_period_start timestamptz,
  billing_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.listing_boosts
  drop constraint if exists listing_boosts_source_check;

alter table public.listing_boosts
  add constraint listing_boosts_source_check
  check (
    source in (
      'included',
      'purchased_7_day',
      'purchased_14_day',
      'purchased_30_day',
      'legacy'
    )
  );

alter table public.listing_boosts
  drop constraint if exists listing_boosts_status_check;

alter table public.listing_boosts
  add constraint listing_boosts_status_check
  check (
    status in (
      'active',
      'expired',
      'canceled',
      'pending'
    )
  );

alter table public.listing_boosts
  drop constraint if exists listing_boosts_duration_days_check;

alter table public.listing_boosts
  add constraint listing_boosts_duration_days_check
  check (duration_days > 0);

create index if not exists listing_boosts_owner_id_idx
  on public.listing_boosts(owner_id);

create index if not exists listing_boosts_listing_id_idx
  on public.listing_boosts(listing_id);

create index if not exists listing_boosts_active_expiry_idx
  on public.listing_boosts(status, expires_at);

drop index if exists listing_boosts_one_active_per_listing_idx;

create index if not exists listing_boosts_active_listing_idx
  on public.listing_boosts(listing_id, status, expires_at);

create unique index if not exists listing_boosts_stripe_session_idx
  on public.listing_boosts(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

insert into public.listing_boosts (
  owner_id,
  listing_id,
  source,
  duration_days,
  started_at,
  expires_at,
  status,
  created_at,
  updated_at
)
select
  l.user_id,
  l.id,
  'legacy',
  7,
  coalesce(l.created_at, now()),
  l.boost_until,
  case
    when l.boost_until > now() then 'active'
    else 'expired'
  end,
  coalesce(l.created_at, now()),
  now()
from public.listings l
where l.boost_until is not null
  and not exists (
    select 1
    from public.listing_boosts b
    where b.listing_id = l.id
      and b.expires_at = l.boost_until
  );

alter table public.listing_boosts enable row level security;

drop policy if exists "Owners can read their own listing boosts"
  on public.listing_boosts;

create policy "Owners can read their own listing boosts"
on public.listing_boosts
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Listing boosts are service-role writable only"
  on public.listing_boosts;

create policy "Listing boosts are service-role writable only"
on public.listing_boosts
for all
to service_role
using (true)
with check (true);

create or replace function public.activate_included_listing_boost(
  p_owner_id uuid,
  p_listing_id uuid,
  p_monthly_allowance integer,
  p_billing_period_start timestamptz,
  p_billing_period_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row record;
  subscription_row record;
  boost_row record;
  expires_at_value timestamptz := now() + interval '7 days';
begin
  if p_monthly_allowance <= 0 then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SUBSCRIPTION_NOT_ELIGIBLE'
    );
  end if;

  select *
  into listing_row
  from public.listings
  where id = p_listing_id
  for update;

  if listing_row.id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'LISTING_NOT_FOUND'
    );
  end if;

  if listing_row.user_id <> p_owner_id then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'NOT_OWNER'
    );
  end if;

  if coalesce(listing_row.status, '') not in ('available', 'pending') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'LISTING_NOT_ACTIVE'
    );
  end if;

  if listing_row.boost_until is not null
    and listing_row.boost_until > now()
  then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'LISTING_ALREADY_BOOSTED'
    );
  end if;

  if exists (
    select 1
    from public.listing_boosts
    where listing_id = p_listing_id
      and status = 'active'
      and started_at <= now()
      and expires_at > now()
  ) then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'LISTING_ALREADY_BOOSTED'
    );
  end if;

  select *
  into subscription_row
  from public.owner_subscriptions
  where user_id = p_owner_id
  for update;

  if subscription_row.user_id is null then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SUBSCRIPTION_INACTIVE'
    );
  end if;

  if subscription_row.status not in ('active', 'trialing') then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'SUBSCRIPTION_INACTIVE'
    );
  end if;

  if coalesce(
    subscription_row.included_monthly_boosts_used,
    0
  ) >= p_monthly_allowance then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'NO_INCLUDED_BOOSTS'
    );
  end if;

  update public.owner_subscriptions
  set
    included_monthly_boosts_used =
      coalesce(included_monthly_boosts_used, 0) + 1,
    monthly_boosts_used = greatest(
      coalesce(monthly_boosts_used, 0),
      coalesce(included_monthly_boosts_used, 0) + 1
    ),
    updated_at = now()
  where user_id = p_owner_id;

  insert into public.listing_boosts (
    owner_id,
    listing_id,
    source,
    duration_days,
    started_at,
    expires_at,
    status,
    billing_period_start,
    billing_period_end
  )
  values (
    p_owner_id,
    p_listing_id,
    'included',
    7,
    now(),
    expires_at_value,
    'active',
    p_billing_period_start,
    p_billing_period_end
  )
  returning *
  into boost_row;

  update public.listings
  set
    boost_until = expires_at_value,
    boost_rank = 200,
    is_featured = true
  where id = p_listing_id
    and user_id = p_owner_id;

  return jsonb_build_object(
    'ok',
    true,
    'boostId',
    boost_row.id,
    'listingId',
    boost_row.listing_id,
    'source',
    boost_row.source,
    'startedAt',
    boost_row.started_at,
    'expiresAt',
    boost_row.expires_at,
    'remaining',
    greatest(
      0,
      p_monthly_allowance -
      (
        coalesce(
          subscription_row.included_monthly_boosts_used,
          0
        ) + 1
      )
    )
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok',
      false,
      'code',
      'LISTING_ALREADY_BOOSTED'
    );
end;
$$;

revoke all
on function public.activate_included_listing_boost(
  uuid,
  uuid,
  integer,
  timestamptz,
  timestamptz
)
from public;

grant execute
on function public.activate_included_listing_boost(
  uuid,
  uuid,
  integer,
  timestamptz,
  timestamptz
)
to service_role;

create or replace function public.increment_purchased_boost_credit(
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_balance integer;
begin
  insert into public.owner_subscriptions (
    user_id,
    plan,
    status,
    purchased_boost_credits,
    updated_at
  )
  values (
    p_user_id,
    'free',
    'inactive',
    1,
    now()
  )
  on conflict (user_id)
  do update set
    purchased_boost_credits =
      coalesce(
        public.owner_subscriptions.purchased_boost_credits,
        0
      ) + 1,
    updated_at = now()
  returning purchased_boost_credits
  into next_balance;

  return next_balance;
end;
$$;

revoke all
on function public.increment_purchased_boost_credit(uuid)
from public;

grant execute
on function public.increment_purchased_boost_credit(uuid)
to service_role;