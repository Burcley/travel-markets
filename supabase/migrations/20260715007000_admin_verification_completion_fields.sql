alter table public.verification_submissions
  add column if not exists request_more_information_message text;

alter table public.profiles
  add column if not exists phone_country_code text,
  add column if not exists phone_country_iso text,
  add column if not exists phone_number_e164 text;

update public.profiles
set phone_number_e164 = coalesce(phone_number_e164, nullif(phone, ''))
where phone_number_e164 is null
  and phone is not null;
