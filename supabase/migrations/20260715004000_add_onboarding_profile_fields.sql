alter table public.profiles
  add column if not exists country text,
  add column if not exists preferred_language text,
  add column if not exists school text,
  add column if not exists program text,
  add column if not exists expected_graduation date,
  add column if not exists host_type text,
  add column if not exists property_management_company text;

