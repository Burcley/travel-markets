create table if not exists public.owner_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.owner_subscriptions
  add column if not exists included_monthly_boosts_used integer not null default 0,
  add column if not exists monthly_boosts_used integer not null default 0,
  add column if not exists purchased_boost_credits integer not null default 0,
  add column if not exists included_monthly_boosts_reset_at timestamptz,
  add column if not exists legacy_plan text,
  add column if not exists last_stripe_event_id text;

update public.owner_subscriptions
set
  legacy_plan = coalesce(legacy_plan, 'old_pro'),
  plan = 'premium',
  updated_at = now()
where plan = 'pro';

update public.owner_subscriptions
set
  legacy_plan = coalesce(legacy_plan, 'old_premium'),
  plan = 'legacy_premium',
  updated_at = now()
where plan = 'premium'
  and legacy_plan is null
  and created_at < timestamptz '2026-07-14 00:00:00+00'
  and stripe_price_id is not null;

update public.owner_subscriptions
set
  plan = 'free',
  updated_at = now()
where plan is null
  or plan not in ('free', 'premium', 'elite', 'legacy_premium');

update public.owner_subscriptions
set
  included_monthly_boosts_used = greatest(0, coalesce(included_monthly_boosts_used, monthly_boosts_used, 0)),
  monthly_boosts_used = greatest(0, coalesce(monthly_boosts_used, included_monthly_boosts_used, 0)),
  purchased_boost_credits = greatest(0, coalesce(purchased_boost_credits, 0));

alter table public.owner_subscriptions
  drop constraint if exists owner_subscriptions_plan_check;

alter table public.owner_subscriptions
  add constraint owner_subscriptions_plan_check
  check (plan in ('free', 'premium', 'elite', 'legacy_premium'));

alter table public.owner_subscriptions
  drop constraint if exists owner_subscriptions_boost_usage_check;

alter table public.owner_subscriptions
  add constraint owner_subscriptions_boost_usage_check
  check (
    included_monthly_boosts_used >= 0
    and monthly_boosts_used >= 0
    and purchased_boost_credits >= 0
  );

create index if not exists owner_subscriptions_stripe_customer_id_idx
  on public.owner_subscriptions(stripe_customer_id);

create index if not exists owner_subscriptions_stripe_subscription_id_idx
  on public.owner_subscriptions(stripe_subscription_id);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.owner_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "Users can read their own owner subscription" on public.owner_subscriptions;
create policy "Users can read their own owner subscription"
on public.owner_subscriptions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own owner subscription" on public.owner_subscriptions;
drop policy if exists "Users can update their own owner subscription" on public.owner_subscriptions;
drop policy if exists "Owner subscriptions are service-role writable only" on public.owner_subscriptions;

-- No authenticated write policy is created on purpose. Stripe-backed fields
-- are written only by trusted server-side code using the service-role client.

drop policy if exists "Stripe webhook events are service-role only" on public.stripe_webhook_events;
create policy "Stripe webhook events are service-role only"
on public.stripe_webhook_events
for all
to service_role
using (true)
with check (true);

create or replace function public.spend_owner_included_boost(
  p_user_id uuid,
  p_monthly_allowance integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_used integer;
begin
  if p_monthly_allowance <= 0 then
    return false;
  end if;

  select included_monthly_boosts_used
    into current_used
  from public.owner_subscriptions
  where user_id = p_user_id
  for update;

  if current_used is null or current_used >= p_monthly_allowance then
    return false;
  end if;

  update public.owner_subscriptions
  set
    included_monthly_boosts_used = included_monthly_boosts_used + 1,
    monthly_boosts_used = greatest(monthly_boosts_used, included_monthly_boosts_used + 1),
    updated_at = now()
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.spend_owner_included_boost(uuid, integer) from public;
grant execute on function public.spend_owner_included_boost(uuid, integer) to service_role;
