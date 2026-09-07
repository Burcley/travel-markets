create table if not exists public.listing_import_batches (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  source_filename text,
  source_row_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  warning_count integer not null default 0,
  status text not null default 'drafts_created',
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.listing_import_batches
  drop constraint if exists listing_import_batches_status_check;

alter table public.listing_import_batches
  add constraint listing_import_batches_status_check
  check (status in ('previewed', 'drafts_created', 'partial_failure', 'failed'));

create index if not exists listing_import_batches_admin_id_idx
  on public.listing_import_batches(admin_id, created_at desc);

create index if not exists listing_import_batches_owner_id_idx
  on public.listing_import_batches(owner_id, created_at desc);

create table if not exists public.listing_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.listing_import_batches(id) on delete cascade,
  source_row_number integer,
  listing_id uuid references public.listings(id) on delete set null,
  source_fingerprint text not null,
  status text not null default 'pending',
  reason text,
  normalized_data jsonb not null default '{}'::jsonb,
  image_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.listing_import_rows
  drop constraint if exists listing_import_rows_status_check;

alter table public.listing_import_rows
  add constraint listing_import_rows_status_check
  check (status in ('pending', 'imported', 'skipped_duplicate', 'skipped_existing', 'skipped_invalid', 'failed'));

create index if not exists listing_import_rows_batch_id_idx
  on public.listing_import_rows(batch_id);

create index if not exists listing_import_rows_source_fingerprint_idx
  on public.listing_import_rows(source_fingerprint);

alter table public.listing_import_batches enable row level security;
alter table public.listing_import_rows enable row level security;

drop policy if exists "Admins can read listing import batches" on public.listing_import_batches;
create policy "Admins can read listing import batches"
  on public.listing_import_batches
  for select
  using (public.current_user_is_admin());

drop policy if exists "Listing import batches are service-role writable" on public.listing_import_batches;
create policy "Listing import batches are service-role writable"
  on public.listing_import_batches
  for all
  using (false)
  with check (false);

drop policy if exists "Admins can read listing import rows" on public.listing_import_rows;
create policy "Admins can read listing import rows"
  on public.listing_import_rows
  for select
  using (public.current_user_is_admin());

drop policy if exists "Listing import rows are service-role writable" on public.listing_import_rows;
create policy "Listing import rows are service-role writable"
  on public.listing_import_rows
  for all
  using (false)
  with check (false);
