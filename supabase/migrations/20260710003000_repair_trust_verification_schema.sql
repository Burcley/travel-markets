create extension if not exists pgcrypto;

alter table public.listings
  add column if not exists verification_required_at timestamptz,
  add column if not exists verification_disclaimer_acknowledged boolean not null default false,
  add column if not exists fair_housing_acknowledged boolean not null default false,
  add column if not exists owner_occupies_property boolean,
  add column if not exists owner_family_occupies_property boolean,
  add column if not exists shared_kitchen_with_owner boolean,
  add column if not exists shared_bathroom_with_owner boolean,
  add column if not exists private_bedroom boolean,
  add column if not exists self_contained_unit boolean,
  add column if not exists other_occupants_present boolean,
  add column if not exists estimated_other_occupant_count integer,
  add column if not exists occupancy_notes text;

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
  updated_at timestamptz not null default now()
);

alter table public.listing_verifications
  add column if not exists other_relationship_explanation text;

alter table public.listing_verifications
  drop constraint if exists listing_verifications_relationship_type_check;

alter table public.listing_verifications
  add constraint listing_verifications_relationship_type_check
  check (
    relationship_type is null or relationship_type in (
      'registered_owner',
      'property_manager',
      'authorized_representative',
      'corporate_representative',
      'authorized_sublessor',
      'other'
    )
  );

alter table public.listing_verifications
  drop constraint if exists listing_verifications_other_relationship_explanation_check;

alter table public.listing_verifications
  add constraint listing_verifications_other_relationship_explanation_check
  check (
    relationship_type <> 'other'
    or nullif(btrim(coalesce(other_relationship_explanation, '')), '') is not null
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
  reviewed_at timestamptz
);

alter table public.listing_verification_documents
  add column if not exists uploader_id uuid references public.profiles(id),
  add column if not exists document_type text,
  add column if not exists storage_path text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists review_status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz;

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
  updated_at timestamptz not null default now()
);

alter table public.listing_document_requirements
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade,
  add column if not exists document_type text,
  add column if not exists display_name text,
  add column if not exists description text,
  add column if not exists requirement_level text not null default 'optional',
  add column if not exists applies_when text not null default 'all_applicants',
  add column if not exists alternative_documents text[] not null default '{}',
  add column if not exists sort_order integer not null default 0,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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
  updated_at timestamptz not null default now()
);

alter table public.rental_document_requests
  add column if not exists conversation_id uuid,
  add column if not exists requester_id uuid references public.profiles(id) on delete cascade,
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade,
  add column if not exists document_type text,
  add column if not exists custom_title text,
  add column if not exists purpose text,
  add column if not exists requirement_level text not null default 'required',
  add column if not exists alternative_documents text[] not null default '{}',
  add column if not exists status text not null default 'requested',
  add column if not exists due_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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
  updated_at timestamptz not null default now()
);

alter table public.rental_document_submissions
  add column if not exists uploader_id uuid references public.profiles(id) on delete cascade,
  add column if not exists storage_path text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists applicant_note text,
  add column if not exists status text not null default 'submitted',
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.rental_document_audit_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.rental_document_requests(id) on delete cascade,
  submission_id uuid references public.rental_document_submissions(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.rental_document_audit_events
  add column if not exists submission_id uuid references public.rental_document_submissions(id) on delete set null,
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists event_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.listing_verification_audit_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  verification_id uuid references public.listing_verifications(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.listing_verification_audit_events
  add column if not exists listing_id uuid references public.listings(id) on delete cascade,
  add column if not exists verification_id uuid references public.listing_verifications(id) on delete set null,
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists event_type text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

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
create index if not exists listing_verification_audit_events_listing_id_idx
  on public.listing_verification_audit_events(listing_id);
