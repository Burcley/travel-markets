alter table public.viewing_slots
  add column if not exists viewing_type text not null default 'in_person',
  add column if not exists timezone text not null default 'America/Toronto',
  add column if not exists status text default 'available',
  add column if not exists booked_viewing_id uuid;

update public.viewing_slots
set status = 'available'
where status is null or status = 'active';

alter table public.viewing_slots
  alter column status set default 'available',
  alter column status set not null;

alter table public.viewing_slots
  drop constraint if exists viewing_slots_viewing_type_check;

alter table public.viewing_slots
  add constraint viewing_slots_viewing_type_check
  check (viewing_type in ('in_person', 'video_call', 'both'));

alter table public.viewing_slots
  drop constraint if exists viewing_slots_status_check;

alter table public.viewing_slots
  add constraint viewing_slots_status_check
  check (status in ('available', 'requested', 'booked', 'disabled'));

drop index if exists public.viewing_slots_owner_listing_future_idx;

create index if not exists viewing_slots_owner_listing_future_idx
  on public.viewing_slots(owner_id, listing_id, slot_date, start_time)
  where status = 'available' and is_booked = false;

drop function if exists public.request_listing_viewing(uuid, uuid, uuid, text, date, time, text);

create or replace function public.request_listing_viewing(
  p_listing_id uuid,
  p_inquiry_id uuid,
  p_slot_id uuid,
  p_viewing_type text,
  p_requested_date date,
  p_requested_time time,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  inquiry_row record;
  listing_row record;
  slot_row record;
  existing_viewing_id uuid;
  viewing_row record;
  normalized_type text := coalesce(nullif(trim(p_viewing_type), ''), 'in_person');
  custom_start timestamp;
begin
  if requester is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;

  if normalized_type not in ('in_person', 'video_call', 'video_tour') then
    return jsonb_build_object('ok', false, 'code', 'INVALID_VIEWING_TYPE');
  end if;

  select *
    into inquiry_row
  from public.inquiries
  where id = p_inquiry_id
    and listing_id = p_listing_id
    and requester_id = requester
    and status = 'accepted'
  for update;

  if inquiry_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'ACCEPTED_INQUIRY_REQUIRED');
  end if;

  select *
    into listing_row
  from public.listings
  where id = p_listing_id
  for update;

  if listing_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'LISTING_NOT_FOUND');
  end if;

  if listing_row.user_id <> inquiry_row.owner_id then
    return jsonb_build_object('ok', false, 'code', 'LISTING_OWNER_MISMATCH');
  end if;

  if listing_row.user_id = requester then
    return jsonb_build_object('ok', false, 'code', 'OWNER_CANNOT_BOOK');
  end if;

  if coalesce(listing_row.status, 'available') not in ('available', 'pending') then
    return jsonb_build_object('ok', false, 'code', 'LISTING_UNAVAILABLE');
  end if;

  select id
    into existing_viewing_id
  from public.viewings
  where listing_id = p_listing_id
    and requester_id = requester
    and status in ('pending', 'accepted', 'suggested')
  limit 1;

  if existing_viewing_id is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'ACTIVE_VIEWING_EXISTS',
      'viewingId', existing_viewing_id
    );
  end if;

  if p_slot_id is not null then
    select *
      into slot_row
    from public.viewing_slots
    where id = p_slot_id
    for update;

    if slot_row.id is null then
      return jsonb_build_object('ok', false, 'code', 'SLOT_NOT_FOUND');
    end if;

    if slot_row.listing_id <> p_listing_id or slot_row.owner_id <> listing_row.user_id then
      return jsonb_build_object('ok', false, 'code', 'SLOT_NOT_FOR_LISTING');
    end if;

    if coalesce(slot_row.status, 'available') <> 'available' or coalesce(slot_row.is_booked, false) then
      return jsonb_build_object('ok', false, 'code', 'SLOT_UNAVAILABLE');
    end if;

    if (slot_row.slot_date + slot_row.start_time) <= (now() at time zone coalesce(slot_row.timezone, 'America/Toronto')) then
      return jsonb_build_object('ok', false, 'code', 'SLOT_PAST');
    end if;

    if normalized_type = 'video_tour' then
      return jsonb_build_object('ok', false, 'code', 'SLOT_TYPE_UNSUPPORTED');
    end if;

    if coalesce(slot_row.viewing_type, 'in_person') <> 'both'
      and coalesce(slot_row.viewing_type, 'in_person') <> normalized_type then
      return jsonb_build_object('ok', false, 'code', 'SLOT_TYPE_UNAVAILABLE');
    end if;

    insert into public.viewings (
      inquiry_id,
      listing_id,
      owner_id,
      requester_id,
      slot_id,
      requested_date,
      requested_time,
      note,
      status,
      viewing_type
    )
    values (
      inquiry_row.id,
      p_listing_id,
      listing_row.user_id,
      requester,
      slot_row.id,
      slot_row.slot_date,
      slot_row.start_time,
      nullif(trim(coalesce(p_note, '')), ''),
      'pending',
      normalized_type
    )
    returning * into viewing_row;

    update public.viewing_slots
    set
      is_booked = true,
      status = 'requested',
      booked_viewing_id = viewing_row.id
    where id = slot_row.id
      and status = 'available'
      and is_booked = false;

    if not found then
      raise exception 'Slot was booked before the viewing could be reserved.';
    end if;
  else
    if normalized_type <> 'video_tour' then
      if p_requested_date is null or p_requested_time is null then
        return jsonb_build_object('ok', false, 'code', 'DATE_TIME_REQUIRED');
      end if;

      custom_start := p_requested_date + p_requested_time;

      if custom_start <= (now() at time zone 'America/Toronto') then
        return jsonb_build_object('ok', false, 'code', 'CUSTOM_TIME_PAST');
      end if;
    end if;

    insert into public.viewings (
      inquiry_id,
      listing_id,
      owner_id,
      requester_id,
      slot_id,
      requested_date,
      requested_time,
      note,
      status,
      viewing_type
    )
    values (
      inquiry_row.id,
      p_listing_id,
      listing_row.user_id,
      requester,
      null,
      case when normalized_type = 'video_tour' then null else p_requested_date end,
      case when normalized_type = 'video_tour' then null else p_requested_time end,
      nullif(trim(coalesce(p_note, '')), ''),
      'pending',
      normalized_type
    )
    returning * into viewing_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'viewingId', viewing_row.id,
    'inquiryId', inquiry_row.id,
    'listingId', p_listing_id,
    'ownerId', listing_row.user_id,
    'requesterId', requester,
    'viewingType', normalized_type,
    'slotId', p_slot_id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'ACTIVE_VIEWING_EXISTS');
end;
$$;

revoke all on function public.request_listing_viewing(uuid, uuid, uuid, text, date, time, text) from public;
grant execute on function public.request_listing_viewing(uuid, uuid, uuid, text, date, time, text) to authenticated;

drop function if exists public.accept_viewing_and_book_slot(uuid);

create or replace function public.accept_viewing_and_book_slot(p_viewing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  viewing_row record;
begin
  if viewer is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;

  select *
    into viewing_row
  from public.viewings
  where id = p_viewing_id
  for update;

  if viewing_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'VIEWING_NOT_FOUND');
  end if;

  if viewing_row.owner_id <> viewer then
    return jsonb_build_object('ok', false, 'code', 'NOT_OWNER');
  end if;

  if viewing_row.status not in ('pending', 'suggested') then
    return jsonb_build_object('ok', false, 'code', 'VIEWING_NOT_ACCEPTABLE');
  end if;

  update public.viewings
  set status = 'accepted', updated_at = now()
  where id = p_viewing_id;

  if viewing_row.slot_id is not null then
    update public.viewing_slots
    set
      is_booked = true,
      status = 'booked',
      booked_viewing_id = p_viewing_id
    where id = viewing_row.slot_id
      and owner_id = viewing_row.owner_id
      and (
        booked_viewing_id = p_viewing_id
        or booked_viewing_id is null
      )
      and status in ('requested', 'available', 'booked');

    if not found then
      return jsonb_build_object('ok', false, 'code', 'SLOT_UNAVAILABLE');
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.accept_viewing_and_book_slot(uuid) from public;
grant execute on function public.accept_viewing_and_book_slot(uuid) to authenticated;

drop function if exists public.decline_viewing_and_reopen_slot(uuid);

create or replace function public.decline_viewing_and_reopen_slot(p_viewing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  viewing_row record;
begin
  if viewer is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;

  select *
    into viewing_row
  from public.viewings
  where id = p_viewing_id
  for update;

  if viewing_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'VIEWING_NOT_FOUND');
  end if;

  if viewing_row.owner_id <> viewer then
    return jsonb_build_object('ok', false, 'code', 'NOT_OWNER');
  end if;

  update public.viewings
  set status = 'declined', updated_at = now()
  where id = p_viewing_id;

  if viewing_row.slot_id is not null then
    update public.viewing_slots
    set
      is_booked = false,
      status = 'available',
      booked_viewing_id = null
    where id = viewing_row.slot_id
      and booked_viewing_id = p_viewing_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.decline_viewing_and_reopen_slot(uuid) from public;
grant execute on function public.decline_viewing_and_reopen_slot(uuid) to authenticated;

drop function if exists public.cancel_viewing_and_reopen_slot(uuid);

create or replace function public.cancel_viewing_and_reopen_slot(p_viewing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  viewing_row record;
begin
  if viewer is null then
    return jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  end if;

  select *
    into viewing_row
  from public.viewings
  where id = p_viewing_id
  for update;

  if viewing_row.id is null then
    return jsonb_build_object('ok', false, 'code', 'VIEWING_NOT_FOUND');
  end if;

  if viewing_row.requester_id <> viewer then
    return jsonb_build_object('ok', false, 'code', 'NOT_REQUESTER');
  end if;

  if viewing_row.status not in ('pending', 'suggested') then
    return jsonb_build_object('ok', false, 'code', 'VIEWING_NOT_CANCELABLE');
  end if;

  update public.viewings
  set status = 'declined', updated_at = now()
  where id = p_viewing_id;

  if viewing_row.slot_id is not null then
    update public.viewing_slots
    set
      is_booked = false,
      status = 'available',
      booked_viewing_id = null
    where id = viewing_row.slot_id
      and booked_viewing_id = p_viewing_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.cancel_viewing_and_reopen_slot(uuid) from public;
grant execute on function public.cancel_viewing_and_reopen_slot(uuid) to authenticated;
