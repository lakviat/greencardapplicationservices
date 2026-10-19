begin;
-- An owner's own tracking note, never a government verification or payment state.
alter table public.gcas_preparations add column submission_reported_at timestamptz;
comment on column public.gcas_preparations.submission_reported_at is
  'Time the owner recorded submission on the official website; not independently verified.';
commit;
