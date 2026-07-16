alter table public.profiles
  add column if not exists institution_id text,
  add column if not exists institution_name text,
  add column if not exists institution_not_listed boolean not null default false,
  add column if not exists unlisted_institution_name text,
  add column if not exists campus_id text,
  add column if not exists campus_name text,
  add column if not exists campus_not_listed boolean not null default false,
  add column if not exists unlisted_campus_name text,
  add column if not exists program_category text,
  add column if not exists program_name text;

update public.profiles
set
  institution_name = coalesce(institution_name, nullif(school, '')),
  program_name = coalesce(program_name, nullif(program, ''))
where role = 'student';

create index if not exists profiles_institution_id_idx
  on public.profiles(institution_id);

create index if not exists profiles_campus_id_idx
  on public.profiles(campus_id);
