alter table public.viewings
  add column if not exists owner_suggested_date date,
  add column if not exists owner_suggested_time time,
  add column if not exists owner_suggested_message text;
