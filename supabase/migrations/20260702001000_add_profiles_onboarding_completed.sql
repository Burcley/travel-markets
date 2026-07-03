alter table public.profiles
add column if not exists onboarding_completed boolean default false;

update public.profiles
set onboarding_completed = false
where onboarding_completed is null;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can read their own profile'
  ) then
    create policy "Users can read their own profile"
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile"
      on public.profiles
      for insert
      with check (auth.uid() = id);
  end if;

end $$;

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
    'student',
    null,
    'active',
    false,
    now()
  )
  on conflict (id) do nothing;
end;
$$;

create or replace function public.complete_onboarding_for_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_profile_for_current_user();

  update public.profiles
  set onboarding_completed = true
  where id = auth.uid();
end;
$$;

revoke all on function public.ensure_profile_for_current_user() from public;
revoke all on function public.complete_onboarding_for_current_user() from public;
grant execute on function public.ensure_profile_for_current_user() to authenticated;
grant execute on function public.complete_onboarding_for_current_user() to authenticated;

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
    'student',
    null,
    'active',
    false,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();
