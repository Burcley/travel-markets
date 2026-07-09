alter table public.viewings
  add column if not exists viewing_type text,
  add column if not exists video_tour_url text,
  add column if not exists owner_suggested_date date,
  add column if not exists owner_suggested_time time,
  add column if not exists owner_suggested_message text;

update public.viewings
set viewing_type = 'video_tour'
where viewing_type = 'recorded_tour';

update public.viewings
set viewing_type = 'in_person'
where viewing_type is null
   or viewing_type not in ('in_person', 'video_call', 'video_tour');

alter table public.viewings
  alter column viewing_type set default 'in_person',
  alter column viewing_type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'viewings_viewing_type_check'
      and conrelid = 'public.viewings'::regclass
  ) then
    alter table public.viewings
      add constraint viewings_viewing_type_check
      check (viewing_type in ('in_person', 'video_call', 'video_tour'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'viewings'
      and policyname = 'Students can create their own viewing requests'
  ) then
    create policy "Students can create their own viewing requests"
      on public.viewings
      for insert
      with check (auth.uid() = requester_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'viewings'
      and policyname = 'Viewing participants can update viewing status'
  ) then
    create policy "Viewing participants can update viewing status"
      on public.viewings
      for update
      using (auth.uid() = owner_id or auth.uid() = requester_id)
      with check (auth.uid() = owner_id or auth.uid() = requester_id);
  end if;
end $$;
