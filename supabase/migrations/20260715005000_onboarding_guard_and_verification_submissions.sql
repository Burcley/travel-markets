alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists verification_intro_viewed_at timestamptz,
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verification_status text default 'not_started',
  add column if not exists phone_verification_sent_at timestamptz,
  add column if not exists management_role text;

update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, now())
where onboarding_completed = true
  and onboarding_completed_at is null;

alter table public.profiles
  drop constraint if exists profiles_phone_verification_status_check;

alter table public.profiles
  add constraint profiles_phone_verification_status_check
  check (
    phone_verification_status in (
      'not_started',
      'code_sent',
      'verified',
      'failed',
      'locked'
    )
  );

create table if not exists public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  verification_type text not null,
  role text not null,
  status text not null default 'pending',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  rejection_reason text,
  internal_notes text,
  document_paths text[] not null default '{}',
  document_metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.verification_submissions
  drop constraint if exists verification_submissions_type_check;

alter table public.verification_submissions
  add constraint verification_submissions_type_check
  check (
    verification_type in (
      'identity',
      'student_status',
      'property_relationship'
    )
  );

alter table public.verification_submissions
  drop constraint if exists verification_submissions_status_check;

alter table public.verification_submissions
  add constraint verification_submissions_status_check
  check (
    status in (
      'not_started',
      'pending',
      'approved',
      'rejected',
      'resubmission_required',
      'expired'
    )
  );

create unique index if not exists verification_submissions_one_active_per_type
  on public.verification_submissions (user_id, verification_type)
  where status in ('pending', 'approved', 'resubmission_required');

alter table public.verification_submissions enable row level security;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (is_admin = true or role = 'admin')
  );
$$;

drop policy if exists "Users can read their own verification submissions" on public.verification_submissions;
create policy "Users can read their own verification submissions"
  on public.verification_submissions
  for select
  using (auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "Users can create their own verification submissions" on public.verification_submissions;
create policy "Users can create their own verification submissions"
  on public.verification_submissions
  for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
    and internal_notes is null
  );

drop policy if exists "Admins can review verification submissions" on public.verification_submissions;
create policy "Admins can review verification submissions"
  on public.verification_submissions
  for update
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

insert into storage.buckets (id, name, public)
values ('verification-submissions', 'verification-submissions', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can upload own verification submission documents" on storage.objects;
create policy "Users can upload own verification submission documents"
  on storage.objects
  for insert
  with check (
    bucket_id = 'verification-submissions'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "Users can read own verification submission documents" on storage.objects;
create policy "Users can read own verification submission documents"
  on storage.objects
  for select
  using (
    bucket_id = 'verification-submissions'
    and (
      auth.uid()::text = split_part(name, '/', 1)
      or public.current_user_is_admin()
    )
  );

