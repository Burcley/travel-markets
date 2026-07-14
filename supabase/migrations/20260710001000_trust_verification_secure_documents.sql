create extension if not exists pgcrypto;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'property-verification-documents',
    'property-verification-documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = 10485760,
        allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'rental-application-documents',
    'rental-application-documents',
    false,
    10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
  on conflict (id) do update
    set public = false,
        file_size_limit = 10485760,
        allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
end $$;

alter table public.listings
  add column if not exists owner_occupies_property boolean,
  add column if not exists owner_family_occupies_property boolean,
  add column if not exists shared_kitchen_with_owner boolean,
  add column if not exists shared_bathroom_with_owner boolean,
  add column if not exists private_bedroom boolean,
  add column if not exists self_contained_unit boolean,
  add column if not exists other_occupants_present boolean,
  add column if not exists estimated_other_occupant_count integer,
  add column if not exists occupancy_notes text;

alter table public.profiles
  add column if not exists identity_verification_status text,
  add column if not exists identity_verified_at timestamptz,
  add column if not exists student_verification_status text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists profile_completion_percentage integer,
  add column if not exists trust_updated_at timestamptz;

create table if not exists public.listing_verifications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_submitted',
  relationship_type text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  expires_at timestamptz,
  admin_notes text,
  owner_visible_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_verifications_status_check check (
    status in (
      'not_submitted',
      'pending',
      'more_information_required',
      'verified',
      'declined',
      'expired'
    )
  ),
  constraint listing_verifications_relationship_type_check check (
    relationship_type is null or relationship_type in (
      'registered_owner',
      'property_manager',
      'authorized_representative',
      'corporate_representative',
      'authorized_sublessor',
      'other'
    )
  )
);

create table if not exists public.listing_verification_documents (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.listing_verifications(id) on delete cascade,
  uploader_id uuid references public.profiles(id),
  document_type text not null,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint,
  review_status text not null default 'pending',
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint listing_verification_documents_review_status_check check (
    review_status in ('pending', 'accepted', 'rejected')
  )
);

create table if not exists public.listing_document_requirements (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  display_name text not null,
  description text,
  requirement_level text not null default 'optional',
  applies_when text not null default 'all_applicants',
  alternative_documents text[] not null default '{}',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_document_requirements_document_type_check check (
    document_type in (
      'proof_of_enrolment',
      'proof_of_income',
      'employment_letter',
      'rental_history',
      'landlord_reference',
      'credit_report_or_consent',
      'guarantor_information',
      'government_identification',
      'visa_or_study_authorization',
      'bank_statement',
      'other'
    )
  ),
  constraint listing_document_requirements_requirement_level_check check (
    requirement_level in (
      'required',
      'optional',
      'conditional',
      'alternative_accepted'
    )
  ),
  constraint listing_document_requirements_applies_when_check check (
    applies_when in (
      'all_applicants',
      'employed',
      'self_employed',
      'student',
      'newcomer',
      'no_canadian_credit_history',
      'guarantor_used',
      'other'
    )
  )
);

create table if not exists public.rental_document_requests (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  conversation_id uuid,
  listing_id uuid not null references public.listings(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  custom_title text,
  purpose text not null,
  requirement_level text not null default 'required',
  alternative_documents text[] not null default '{}',
  status text not null default 'requested',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_document_requests_document_type_check check (
    document_type in (
      'proof_of_enrolment',
      'proof_of_income',
      'employment_letter',
      'rental_history',
      'landlord_reference',
      'credit_report_or_consent',
      'guarantor_information',
      'government_identification',
      'visa_or_study_authorization',
      'bank_statement',
      'other'
    )
  ),
  constraint rental_document_requests_requirement_level_check check (
    requirement_level in (
      'required',
      'optional',
      'conditional',
      'alternative_accepted'
    )
  ),
  constraint rental_document_requests_status_check check (
    status in (
      'requested',
      'submitted',
      'accepted',
      'replacement_requested',
      'declined_by_applicant',
      'cancelled',
      'expired'
    )
  )
);

create table if not exists public.rental_document_submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_document_requests(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint,
  applicant_note text,
  status text not null default 'submitted',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_document_submissions_status_check check (
    status in ('submitted', 'accepted', 'rejected', 'withdrawn', 'expired')
  )
);

create table if not exists public.rental_document_audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_document_requests(id) on delete cascade,
  submission_id uuid references public.rental_document_submissions(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists listing_verifications_owner_id_idx
  on public.listing_verifications(owner_id);
create index if not exists listing_verification_documents_verification_id_idx
  on public.listing_verification_documents(verification_id);
create index if not exists listing_document_requirements_listing_id_idx
  on public.listing_document_requirements(listing_id);
create index if not exists rental_document_requests_inquiry_id_idx
  on public.rental_document_requests(inquiry_id);
create index if not exists rental_document_requests_participants_idx
  on public.rental_document_requests(requester_id, recipient_id);
create index if not exists rental_document_submissions_request_id_idx
  on public.rental_document_submissions(request_id);

create or replace view public.public_listing_verification_status as
select
  listing_id,
  owner_id,
  status,
  relationship_type,
  submitted_at,
  reviewed_at,
  expires_at,
  owner_visible_reason,
  updated_at
from public.listing_verifications;

grant select on public.public_listing_verification_status to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listing_verifications_set_updated_at on public.listing_verifications;
create trigger listing_verifications_set_updated_at
before update on public.listing_verifications
for each row execute function public.set_updated_at();

drop trigger if exists listing_document_requirements_set_updated_at on public.listing_document_requirements;
create trigger listing_document_requirements_set_updated_at
before update on public.listing_document_requirements
for each row execute function public.set_updated_at();

drop trigger if exists rental_document_requests_set_updated_at on public.rental_document_requests;
create trigger rental_document_requests_set_updated_at
before update on public.rental_document_requests
for each row execute function public.set_updated_at();

drop trigger if exists rental_document_submissions_set_updated_at on public.rental_document_submissions;
create trigger rental_document_submissions_set_updated_at
before update on public.rental_document_submissions
for each row execute function public.set_updated_at();

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and (is_admin = true or lower(coalesce(role, '')) = 'admin')
  );
$$;

create or replace function public.user_participates_in_accepted_inquiry(target_inquiry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inquiries
    where id = target_inquiry_id
      and status = 'accepted'
      and (owner_id = auth.uid() or requester_id = auth.uid())
  );
$$;

alter table public.listing_verifications enable row level security;
alter table public.listing_verification_documents enable row level security;
alter table public.listing_document_requirements enable row level security;
alter table public.rental_document_requests enable row level security;
alter table public.rental_document_submissions enable row level security;
alter table public.rental_document_audit_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_verifications' and policyname = 'Listing owners and admins can view verification records') then
    create policy "Listing owners and admins can view verification records"
      on public.listing_verifications
      for select
      using (auth.uid() = owner_id or public.current_user_is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_verifications' and policyname = 'Listing owners can create their verification record') then
    create policy "Listing owners can create their verification record"
      on public.listing_verifications
      for insert
      with check (
        auth.uid() = owner_id
        and exists (
          select 1 from public.listings
          where listings.id = listing_id
            and listings.user_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_verifications' and policyname = 'Listing owners can submit pending verification') then
    create policy "Listing owners can submit pending verification"
      on public.listing_verifications
      for update
      using (auth.uid() = owner_id or public.current_user_is_admin())
      with check (auth.uid() = owner_id or public.current_user_is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_verification_documents' and policyname = 'Verification document owners and admins can view metadata') then
    create policy "Verification document owners and admins can view metadata"
      on public.listing_verification_documents
      for select
      using (
        public.current_user_is_admin()
        or exists (
          select 1 from public.listing_verifications
          where listing_verifications.id = verification_id
            and listing_verifications.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_verification_documents' and policyname = 'Owners can add verification document metadata') then
    create policy "Owners can add verification document metadata"
      on public.listing_verification_documents
      for insert
      with check (
        auth.uid() = uploader_id
        and exists (
          select 1 from public.listing_verifications
          where listing_verifications.id = verification_id
            and listing_verifications.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_verification_documents' and policyname = 'Admins can review verification documents') then
    create policy "Admins can review verification documents"
      on public.listing_verification_documents
      for update
      using (public.current_user_is_admin())
      with check (public.current_user_is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_document_requirements' and policyname = 'Anyone can view active listing document requirements') then
    create policy "Anyone can view active listing document requirements"
      on public.listing_document_requirements
      for select
      using (
        active = true
        or auth.uid() = owner_id
        or public.current_user_is_admin()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'listing_document_requirements' and policyname = 'Listing owners manage document requirements') then
    create policy "Listing owners manage document requirements"
      on public.listing_document_requirements
      for all
      using (auth.uid() = owner_id or public.current_user_is_admin())
      with check (auth.uid() = owner_id or public.current_user_is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_requests' and policyname = 'Document request participants can view requests') then
    create policy "Document request participants can view requests"
      on public.rental_document_requests
      for select
      using (
        auth.uid() = requester_id
        or auth.uid() = recipient_id
        or public.current_user_is_admin()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_requests' and policyname = 'Landlords can create document requests in accepted inquiries') then
    create policy "Landlords can create document requests in accepted inquiries"
      on public.rental_document_requests
      for insert
      with check (
        auth.uid() = requester_id
        and exists (
          select 1 from public.inquiries
          where inquiries.id = inquiry_id
            and inquiries.status = 'accepted'
            and inquiries.owner_id = auth.uid()
            and inquiries.requester_id = recipient_id
            and inquiries.listing_id = rental_document_requests.listing_id
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_requests' and policyname = 'Document request participants can update requests') then
    create policy "Document request participants can update requests"
      on public.rental_document_requests
      for update
      using (
        auth.uid() = requester_id
        or auth.uid() = recipient_id
        or public.current_user_is_admin()
      )
      with check (
        auth.uid() = requester_id
        or auth.uid() = recipient_id
        or public.current_user_is_admin()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_submissions' and policyname = 'Document participants can view submissions') then
    create policy "Document participants can view submissions"
      on public.rental_document_submissions
      for select
      using (
        public.current_user_is_admin()
        or uploader_id = auth.uid()
        or exists (
          select 1 from public.rental_document_requests
          where rental_document_requests.id = request_id
            and (
              rental_document_requests.requester_id = auth.uid()
              or rental_document_requests.recipient_id = auth.uid()
            )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_submissions' and policyname = 'Recipients can submit requested documents') then
    create policy "Recipients can submit requested documents"
      on public.rental_document_submissions
      for insert
      with check (
        auth.uid() = uploader_id
        and exists (
          select 1 from public.rental_document_requests
          where rental_document_requests.id = request_id
            and rental_document_requests.recipient_id = auth.uid()
            and rental_document_requests.status in ('requested', 'replacement_requested')
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_submissions' and policyname = 'Document participants can update submissions') then
    create policy "Document participants can update submissions"
      on public.rental_document_submissions
      for update
      using (
        uploader_id = auth.uid()
        or public.current_user_is_admin()
        or exists (
          select 1 from public.rental_document_requests
          where rental_document_requests.id = request_id
            and rental_document_requests.requester_id = auth.uid()
        )
      )
      with check (
        uploader_id = auth.uid()
        or public.current_user_is_admin()
        or exists (
          select 1 from public.rental_document_requests
          where rental_document_requests.id = request_id
            and rental_document_requests.requester_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_audit_events' and policyname = 'Document participants can view audit events') then
    create policy "Document participants can view audit events"
      on public.rental_document_audit_events
      for select
      using (
        public.current_user_is_admin()
        or exists (
          select 1 from public.rental_document_requests
          where rental_document_requests.id = request_id
            and (
              rental_document_requests.requester_id = auth.uid()
              or rental_document_requests.recipient_id = auth.uid()
            )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rental_document_audit_events' and policyname = 'Document participants can create audit events') then
    create policy "Document participants can create audit events"
      on public.rental_document_audit_events
      for insert
      with check (
        actor_id = auth.uid()
        and (
          public.current_user_is_admin()
          or exists (
            select 1 from public.rental_document_requests
            where rental_document_requests.id = request_id
              and (
                rental_document_requests.requester_id = auth.uid()
                or rental_document_requests.recipient_id = auth.uid()
              )
          )
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Property verification document private access') then
    create policy "Property verification document private access"
      on storage.objects
      for select
      using (
        bucket_id = 'property-verification-documents'
        and (
          public.current_user_is_admin()
          or exists (
            select 1
            from public.listing_verification_documents d
            join public.listing_verifications v on v.id = d.verification_id
            where d.storage_path = storage.objects.name
              and v.owner_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owners upload property verification documents') then
    create policy "Owners upload property verification documents"
      on storage.objects
      for insert
      with check (
        bucket_id = 'property-verification-documents'
        and owner = auth.uid()
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Rental application document private access') then
    create policy "Rental application document private access"
      on storage.objects
      for select
      using (
        bucket_id = 'rental-application-documents'
        and (
          public.current_user_is_admin()
          or exists (
            select 1
            from public.rental_document_submissions s
            join public.rental_document_requests r on r.id = s.request_id
            where s.storage_path = storage.objects.name
              and (s.uploader_id = auth.uid() or r.requester_id = auth.uid())
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Students upload rental application documents') then
    create policy "Students upload rental application documents"
      on storage.objects
      for insert
      with check (
        bucket_id = 'rental-application-documents'
        and owner = auth.uid()
      );
  end if;
end $$;
