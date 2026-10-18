-- Staff operations (19 Oct 2026)
--
-- 1. A reversible marker for archiving QA / staff test applications out of
--    the staff queues without deleting anything.
-- 2. Indexes for the /admin/staff-queue reads and the notification log.
-- 3. A one-off archive of the existing QA / staff test applications.
--
-- Undo the archive (restores each row's previous status exactly):
--
--   update public.applications
--      set status = qa_archived_from_status,
--          qa_archived_at = null,
--          qa_archived_from_status = null,
--          qa_archive_reason = null
--    where qa_archive_reason = 'qa_test_data_2026_10_19';
--
-- A restored draft can collide with applications_one_ongoing_country_visa_idx
-- if the same test applicant has since opened another draft for the same
-- destination and visa; restore those rows one at a time.

alter table public.applications
  add column if not exists qa_archived_at timestamptz,
  add column if not exists qa_archived_from_status text,
  add column if not exists qa_archive_reason text;

comment on column public.applications.qa_archived_at is
  'Set when a QA / staff test application is archived out of staff queues. Reversible: restore status from qa_archived_from_status.';
comment on column public.applications.qa_archived_from_status is
  'applications.status before the QA archive.';
comment on column public.applications.qa_archive_reason is
  'Batch label for the QA archive, e.g. qa_test_data_2026_10_19.';

create index if not exists applications_staff_queue_status_idx
  on public.applications (status, updated_at desc)
  where qa_archived_at is null;

create index if not exists notification_event_log_application_ts_idx
  on public.notification_event_log (application_id, ts desc);

-- One-off archive. Test identities: @viza.test, @example.com, @test.com
-- applicant emails, any email that belongs to a staff user, and schema-QA
-- dry-run purposes. Rows touched in the last 24 hours are left alone so an
-- in-flight QA run is not disturbed; the staff queue hides them by identity.
with staff as (
  select lower(email) as email
    from public.users
   where email is not null
),
test_profiles as (
  select p.id
    from public.applicant_profiles p
   where lower(coalesce(p.email, '')) ~ '@(viza\.test|example\.com|test\.com)$'
      or lower(coalesce(p.email, '')) in (select email from staff)
),
archived as (
  update public.applications a
     set qa_archived_from_status = a.status,
         status = 'archived',
         qa_archived_at = now(),
         qa_archive_reason = 'qa_test_data_2026_10_19'
   where a.qa_archived_at is null
     and a.updated_at < now() - interval '24 hours'
     and (
       a.applicant_id in (select id from test_profiles)
       or coalesce(a.purpose, '') = 'VIZA_PLACEHOLDER_DRY_RUN'
     )
  returning a.id, a.qa_archived_from_status
)
insert into public.application_status_history (application_id, from_status, to_status, actor_kind, reason, metadata)
select id,
       qa_archived_from_status,
       'archived',
       'system',
       'qa_archive',
       jsonb_build_object('qa_archive_reason', 'qa_test_data_2026_10_19')
  from archived;
