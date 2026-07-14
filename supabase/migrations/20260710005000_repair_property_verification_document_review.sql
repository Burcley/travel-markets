alter table public.listing_verification_documents
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists file_sha256 text;

with ranked_duplicate_documents as (
  select
    id,
    row_number() over (
      partition by verification_id, storage_path
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.listing_verification_documents
  where storage_path is not null
)
delete from public.listing_verification_documents documents
using ranked_duplicate_documents ranked
where documents.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists listing_verification_documents_verification_storage_path_key
  on public.listing_verification_documents(verification_id, storage_path)
  where storage_path is not null;

create unique index if not exists listing_verification_documents_verification_file_sha256_key
  on public.listing_verification_documents(verification_id, file_sha256)
  where file_sha256 is not null;
