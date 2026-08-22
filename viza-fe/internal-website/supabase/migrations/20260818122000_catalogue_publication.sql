-- Auditable publication boundary between the internal product catalogue and
-- the public marketing site. Draft edits never change the live site until an
-- admin publishes a readiness-checked immutable snapshot.

CREATE TABLE IF NOT EXISTS public.catalogue_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_package_id UUID NOT NULL UNIQUE REFERENCES public.visa_packages(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'retired')),
  draft_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_payload JSONB,
  readiness JSONB NOT NULL DEFAULT '{"blockers":[],"warnings":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  draft_updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  published_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  retired_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalogue_publications_live_slug_idx
  ON public.catalogue_publications ((published_payload->>'slug'))
  WHERE status = 'published' AND published_payload IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalogue_publications_status_idx
  ON public.catalogue_publications(status, published_at DESC);

CREATE TABLE IF NOT EXISTS public.catalogue_publication_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.catalogue_publications(id) ON DELETE CASCADE,
  visa_package_id UUID NOT NULL REFERENCES public.visa_packages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('published', 'retired')),
  payload JSONB,
  readiness JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalogue_publication_history_publication_idx
  ON public.catalogue_publication_history(publication_id, version DESC, created_at DESC);

ALTER TABLE public.catalogue_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_publication_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogue_publications_staff_all"
  ON public.catalogue_publications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
        AND users.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
        AND users.deleted_at IS NULL
    )
  );

CREATE POLICY "catalogue_publication_history_staff_read"
  ON public.catalogue_publication_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'staff')
        AND users.deleted_at IS NULL
    )
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.catalogue_publications TO authenticated;
GRANT SELECT ON TABLE public.catalogue_publication_history TO authenticated;
GRANT ALL ON TABLE public.catalogue_publications, public.catalogue_publication_history TO service_role;

CREATE OR REPLACE FUNCTION public.save_catalogue_draft(
  p_visa_package_id UUID,
  p_payload JSONB,
  p_readiness JSONB,
  p_actor_user_id UUID,
  p_reason TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_before JSONB := '{}'::jsonb;
BEGIN
  IF length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A draft-change reason is required';
  END IF;

  SELECT id, jsonb_build_object(
    'status', status,
    'version', version,
    'draft_payload', draft_payload
  )
  INTO v_id, v_before
  FROM public.catalogue_publications
  WHERE visa_package_id = p_visa_package_id
  FOR UPDATE;

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
  END IF;

  INSERT INTO public.admin_command_events (
    actor_user_id, command, target_type, target_id, reason, before_state, after_state
  ) VALUES (
    p_actor_user_id,
    'catalogue.draft_saved',
    'catalogue_publications',
    v_id::text,
    trim(p_reason),
    v_before,
    jsonb_build_object('draft_payload', p_payload, 'readiness', p_readiness)
  );

  INSERT INTO public.catalogue_publications (
    id, visa_package_id, draft_payload, readiness, draft_updated_by, updated_at
  ) VALUES (
    v_id, p_visa_package_id, p_payload, p_readiness, p_actor_user_id, now()
  )
  ON CONFLICT (visa_package_id) DO UPDATE SET
    draft_payload = EXCLUDED.draft_payload,
    readiness = EXCLUDED.readiness,
    draft_updated_by = EXCLUDED.draft_updated_by,
    updated_at = EXCLUDED.updated_at;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_catalogue_entry(
  p_visa_package_id UUID,
  p_readiness JSONB,
  p_actor_user_id UUID,
  p_reason TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.catalogue_publications%ROWTYPE;
  v_next_version INTEGER;
BEGIN
  IF length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A publication reason is required';
  END IF;
  IF jsonb_array_length(COALESCE(p_readiness->'blockers', '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Readiness blockers must be resolved before publication';
  END IF;

  SELECT * INTO v_row
  FROM public.catalogue_publications
  WHERE visa_package_id = p_visa_package_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Save a draft before publishing';
  END IF;

  v_next_version := v_row.version + 1;

  INSERT INTO public.admin_command_events (
    actor_user_id, command, target_type, target_id, reason, before_state, after_state
  ) VALUES (
    p_actor_user_id,
    'catalogue.publish',
    'catalogue_publications',
    v_row.id::text,
    trim(p_reason),
    jsonb_build_object('status', v_row.status, 'version', v_row.version, 'published_payload', v_row.published_payload),
    jsonb_build_object('status', 'published', 'version', v_next_version, 'published_payload', v_row.draft_payload, 'readiness', p_readiness)
  );

  UPDATE public.catalogue_publications SET
    status = 'published',
    published_payload = v_row.draft_payload,
    readiness = p_readiness,
    version = v_next_version,
    published_by = p_actor_user_id,
    published_at = now(),
    retired_by = NULL,
    retired_at = NULL,
    updated_at = now()
  WHERE id = v_row.id;

  INSERT INTO public.catalogue_publication_history (
    publication_id, visa_package_id, version, action, payload, readiness,
    actor_user_id, reason
  ) VALUES (
    v_row.id, p_visa_package_id, v_next_version, 'published',
    v_row.draft_payload, p_readiness, p_actor_user_id, trim(p_reason)
  );

  RETURN v_next_version;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_catalogue_entry(
  p_visa_package_id UUID,
  p_actor_user_id UUID,
  p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.catalogue_publications%ROWTYPE;
BEGIN
  IF length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A retirement reason is required';
  END IF;

  SELECT * INTO v_row
  FROM public.catalogue_publications
  WHERE visa_package_id = p_visa_package_id
  FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'published' THEN
    RAISE EXCEPTION 'Only a published entry can be retired';
  END IF;

  INSERT INTO public.admin_command_events (
    actor_user_id, command, target_type, target_id, reason, before_state, after_state
  ) VALUES (
    p_actor_user_id,
    'catalogue.retire',
    'catalogue_publications',
    v_row.id::text,
    trim(p_reason),
    jsonb_build_object('status', v_row.status, 'version', v_row.version),
    jsonb_build_object('status', 'retired', 'version', v_row.version)
  );

  UPDATE public.catalogue_publications SET
    status = 'retired',
    retired_by = p_actor_user_id,
    retired_at = now(),
    updated_at = now()
  WHERE id = v_row.id;

  INSERT INTO public.catalogue_publication_history (
    publication_id, visa_package_id, version, action, payload, readiness,
    actor_user_id, reason
  ) VALUES (
    v_row.id, p_visa_package_id, v_row.version, 'retired',
    v_row.published_payload, v_row.readiness, p_actor_user_id, trim(p_reason)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_catalogue_draft(UUID, JSONB, JSONB, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_catalogue_entry(UUID, JSONB, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retire_catalogue_entry(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_catalogue_draft(UUID, JSONB, JSONB, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_catalogue_entry(UUID, JSONB, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.retire_catalogue_entry(UUID, UUID, TEXT) TO service_role;
