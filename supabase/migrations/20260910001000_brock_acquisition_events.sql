create table if not exists public.brock_acquisition_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  listing_id uuid references public.listings(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  source text,
  medium text,
  campaign text,
  content text,
  referrer text,
  landing_page text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint brock_acquisition_events_event_name_check check (
    event_name in (
      'brock_page_view',
      'brock_listing_impression',
      'brock_listing_click',
      'brock_search_started',
      'brock_search_completed',
      'brock_signup_started',
      'brock_signup_completed',
      'brock_listing_saved',
      'brock_message_started',
      'brock_inquiry_sent',
      'brock_viewing_requested',
      'brock_saved_search_created',
      'campus_search_opened',
      'campus_selected',
      'campus_card_clicked'
    )
  )
);

create index if not exists brock_acquisition_events_created_at_idx
  on public.brock_acquisition_events(created_at desc);

create index if not exists brock_acquisition_events_event_name_idx
  on public.brock_acquisition_events(event_name);

create index if not exists brock_acquisition_events_listing_id_idx
  on public.brock_acquisition_events(listing_id);

create index if not exists brock_acquisition_events_source_idx
  on public.brock_acquisition_events(source);

alter table public.brock_acquisition_events enable row level security;

drop policy if exists "Admins can read Brock acquisition events"
  on public.brock_acquisition_events;

create policy "Admins can read Brock acquisition events"
on public.brock_acquisition_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
