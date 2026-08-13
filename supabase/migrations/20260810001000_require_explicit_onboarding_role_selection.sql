create or replace function public.ensure_profile_for_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    bio,
    role,
    avatar_url,
    account_status,
    onboarding_completed,
    updated_at
  )
  values (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', ''),
    '',
    null,
    null,
    null,
    null,
    'active',
    false,
    now()
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    bio,
    role,
    avatar_url,
    account_status,
    onboarding_completed,
    updated_at
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    null,
    null,
    null,
    null,
    'active',
    false,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.ensure_profile_for_current_user() from public;
revoke all on function public.handle_new_user_profile() from public;
grant execute on function public.ensure_profile_for_current_user() to authenticated;
