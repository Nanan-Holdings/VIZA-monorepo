-- 0188_inbound_email_client_state.sql
-- Client mailbox state for the /client/settings/inbox surface (INBOX-008).
--
-- inbound_email gains per-message applicant-facing state (read / star /
-- archive) plus cached enrichment blobs: the AI reading panel (`ai_meta`),
-- on-demand body translations (`translations`), and the lazily parsed
-- attachment manifest (`attachments_meta`). The authenticated role keeps the
-- SELECT-only grant from 0176; every mutation goes through service-role
-- server actions that re-derive ownership from the active inbox alias, so no
-- UPDATE policy or grant is added here.
--
-- inbound_email_replies stores applicant-authored replies and
-- consultant-attention flags. Replies are queued for VIZA staff review before
-- any outbound delivery (the alias domain has no verified outbound sender),
-- so the table is service-role only end to end.

ALTER TABLE public.inbound_email
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_meta JSONB,
  ADD COLUMN IF NOT EXISTS translations JSONB,
  ADD COLUMN IF NOT EXISTS attachments_meta JSONB;

-- Unread-per-alias is the hottest new lookup (folder tab counts).
CREATE INDEX IF NOT EXISTS idx_inbound_email_unread
  ON public.inbound_email (to_addr, received_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL AND quarantined = FALSE;

CREATE TABLE IF NOT EXISTS public.inbound_email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES public.inbound_email(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'reply'
    CONSTRAINT inbound_email_replies_kind_check CHECK (kind IN ('reply', 'consultant_flag')),
  body TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CONSTRAINT inbound_email_replies_status_check
    CHECK (status IN ('queued', 'sent', 'cancelled', 'acknowledged')),
  created_by_auth_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT inbound_email_replies_reply_body_check CHECK (kind <> 'reply' OR body IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_inbound_email_replies_email
  ON public.inbound_email_replies (email_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_inbound_email_replies_applicant
  ON public.inbound_email_replies (applicant_id, created_at DESC);

-- Staff review queue: pending applicant replies in arrival order.
CREATE INDEX IF NOT EXISTS idx_inbound_email_replies_queued
  ON public.inbound_email_replies (created_at ASC)
  WHERE status = 'queued' AND kind = 'reply';

ALTER TABLE public.inbound_email_replies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.inbound_email_replies FROM PUBLIC;
REVOKE ALL ON TABLE public.inbound_email_replies FROM anon;
REVOKE ALL ON TABLE public.inbound_email_replies FROM authenticated;
GRANT ALL ON TABLE public.inbound_email_replies TO service_role;
