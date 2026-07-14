alter table public.listings
  add column if not exists campus_id text,
  add column if not exists campus_destination_label text,
  add column if not exists campus_coordinate_source text;

create index if not exists listings_campus_id_idx
  on public.listings(campus_id);
