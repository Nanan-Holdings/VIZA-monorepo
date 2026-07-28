


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."get_patient_lab_order_ids"() RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE patient_uuid uuid;
BEGIN
  SELECT id INTO patient_uuid FROM patients WHERE auth_user_id = (SELECT auth.uid());
  IF patient_uuid IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT id FROM lab_orders WHERE patient_id = patient_uuid;
END; $$;


ALTER FUNCTION "private"."get_patient_lab_order_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."get_patient_lab_report_ids"() RETURNS SETOF "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE patient_uuid uuid;
BEGIN
  SELECT id INTO patient_uuid FROM patients WHERE auth_user_id = (SELECT auth.uid());
  IF patient_uuid IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT lr.id FROM lab_reports lr INNER JOIN lab_orders lo ON lr.lab_order_id = lo.id WHERE lo.patient_id = patient_uuid;
END; $$;


ALTER FUNCTION "private"."get_patient_lab_report_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."advance_protocol_step"("p_patient_id" "uuid", "p_event" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_step INTEGER;
    v_max_step INTEGER;
BEGIN
    SELECT current_step_index INTO v_current_step
    FROM public.protocol_instances
    WHERE patient_id = p_patient_id AND status = 'active';

    IF v_current_step IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT MAX(step_index) INTO v_max_step
    FROM public.protocol_steps ps
    JOIN public.protocol_instances pi ON pi.protocol_id = ps.protocol_id
    WHERE pi.patient_id = p_patient_id AND pi.status = 'active';

    IF v_current_step >= v_max_step THEN
        RETURN FALSE;
    END IF;

    UPDATE public.protocol_instances
    SET
        current_step_index = current_step_index + 1,
        updated_at = NOW()
    WHERE patient_id = p_patient_id AND status = 'active';

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."advance_protocol_step"("p_patient_id" "uuid", "p_event" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_adherence_score"("p_patient_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT COALESCE(AVG(adherence_score), 0)
    FROM public.checkins
    WHERE patient_id = p_patient_id
        AND completed_at IS NOT NULL
        AND completed_at > NOW() - INTERVAL '30 days'
        AND adherence_score IS NOT NULL;
$$;


ALTER FUNCTION "public"."calculate_adherence_score"("p_patient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_goals"("p_patient_id" "uuid") RETURNS TABLE("goal_id" "uuid", "goal_type" "text", "target_json" "jsonb", "reason" "text", "start_date" "date", "target_date" "date", "progress_percent" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT
        g.id AS goal_id,
        g.goal_type,
        g.target_json,
        g.reason,
        g.start_date,
        g.target_date,
        CASE
            WHEN g.target_date IS NOT NULL AND g.target_date > g.start_date THEN
                LEAST(100::NUMERIC, GREATEST(0::NUMERIC,
                    100::NUMERIC * (CURRENT_DATE - g.start_date)::NUMERIC /
                    NULLIF((g.target_date - g.start_date)::NUMERIC, 0)
                ))
            ELSE 50::NUMERIC
        END AS progress_percent
    FROM public.goals g
    WHERE g.patient_id = p_patient_id
        AND g.status = 'active'
    ORDER BY g.created_at DESC;
$$;


ALTER FUNCTION "public"."get_active_goals"("p_patient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_consultation_status_counts"("start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "doctor_filter" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("status" "text", "count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
    SELECT
      status::text,
      COUNT(*)::bigint
    FROM consultations
    WHERE
      (start_date IS NULL OR start_time >= start_date)
      AND (end_date IS NULL OR start_time <= end_date)
      AND (doctor_filter IS NULL OR doctor_id = doctor_filter)
    GROUP BY status;
  $$;


ALTER FUNCTION "public"."get_consultation_status_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_med_knowledge_stats"() RETURNS TABLE("total_documents" bigint, "total_chunks" bigint, "medications" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT md.document_id) as total_documents,
    COUNT(mc.id) as total_chunks,
    ARRAY_AGG(DISTINCT md.medication ORDER BY md.medication) as medications
  FROM med_documents md
  LEFT JOIN med_chunks mc ON md.document_id = mc.document_id
  WHERE md.status = 'active' AND md.is_current = true;
END;
$$;


ALTER FUNCTION "public"."get_med_knowledge_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_revenue"("start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
    SELECT COALESCE(SUM((order_data->>'total_price')::numeric), 0)
    FROM orders
    WHERE
      status IN ('open', 'ready_to_ship', 'closed')
      AND (start_date IS NULL OR created_at >= start_date)
      AND (end_date IS NULL OR created_at <= end_date);
  $$;


ALTER FUNCTION "public"."get_order_revenue"("start_date" timestamp with time zone, "end_date" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_protocol_critical_info"("p_patient_id" "uuid") RETURNS TABLE("red_flag_symptoms" "text"[], "expected_side_effects" "text"[], "checkpoints" "jsonb", "education_items" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT
        ps.red_flag_symptoms,
        ps.expected_side_effects,
        ps.checkpoints,
        ps.education_items
    FROM public.protocol_instances pi
    JOIN public.protocol_steps ps ON ps.protocol_id = pi.protocol_id
        AND ps.step_index = pi.current_step_index
    WHERE pi.patient_id = p_patient_id
        AND pi.status = 'active'
    ORDER BY pi.created_at DESC
    LIMIT 1;
$$;


ALTER FUNCTION "public"."get_protocol_critical_info"("p_patient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_protocol_instance"("p_patient_id" "uuid") RETURNS TABLE("instance_id" "uuid", "protocol_name" "text", "current_step_index" integer, "current_phase" "text", "expected_dose_mg" numeric, "next_checkpoint_due_at" timestamp with time zone, "status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT
        pi.id AS instance_id,
        tp.name AS protocol_name,
        pi.current_step_index,
        ps.phase AS current_phase,
        ps.expected_dose_mg,
        pi.next_checkpoint_due_at,
        pi.status
    FROM public.protocol_instances pi
    JOIN public.treatment_protocols tp ON pi.protocol_id = tp.id
    LEFT JOIN public.protocol_steps ps ON ps.protocol_id = pi.protocol_id
        AND ps.step_index = pi.current_step_index
    WHERE pi.patient_id = p_patient_id
        AND pi.status = 'active'
    ORDER BY pi.created_at DESC
    LIMIT 1;
$$;


ALTER FUNCTION "public"."get_protocol_instance"("p_patient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_vitals"("p_patient_id" "uuid", "p_metric" "text" DEFAULT NULL::"text", "p_days" integer DEFAULT 30) RETURNS TABLE("recorded_at" timestamp with time zone, "metric" "text", "value" numeric, "unit" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
    SELECT
        recorded_at,
        metric,
        value,
        unit
    FROM public.vitals
    WHERE patient_id = p_patient_id
        AND (p_metric IS NULL OR metric = p_metric)
        AND recorded_at > NOW() - (p_days || ' days')::INTERVAL
    ORDER BY recorded_at DESC;
$$;


ALTER FUNCTION "public"."get_recent_vitals"("p_patient_id" "uuid", "p_metric" "text", "p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_treatment_approval_counts"("start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "doctor_filter" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("approval_status" "text", "count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
    SELECT
      approval_status::text,
      COUNT(*)::bigint
    FROM treatments
    WHERE
      (start_date IS NULL OR created_at >= start_date)
      AND (end_date IS NULL OR created_at <= end_date)
      AND (doctor_filter IS NULL OR approved_by = doctor_filter)
    GROUP BY approval_status;
  $$;


ALTER FUNCTION "public"."get_treatment_approval_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Skip creating public.users entry for patient users
    -- Patients are tracked in the patients table via auth_user_id, not in public.users
    IF NEW.raw_app_meta_data->>'user_type' = 'patient' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.users (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search_med_knowledge"("query_embedding" "extensions"."vector", "query_text" "text", "match_count" integer DEFAULT 5, "filter_medication" "text" DEFAULT NULL::"text", "semantic_weight" real DEFAULT 0.5, "keyword_weight" real DEFAULT 0.5, "min_similarity" real DEFAULT 0.7) RETURNS TABLE("id" integer, "document_id" "text", "chunk_index" integer, "content" "text", "section_title" "text", "medication" "text", "document_type" "text", "similarity" real, "keyword_rank" real, "hybrid_score" real)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH semantic_search AS (
    SELECT
      mc.id,
      mc.document_id,
      mc.chunk_index,
      mc.content,
      mc.section_title,
      md.medication,
      md.document_type,
      1 - (mc.embedding_chunk <=> query_embedding) AS similarity,
      0::real AS keyword_rank
    FROM public.med_chunks mc
    INNER JOIN public.med_documents md ON mc.document_id = md.document_id
    WHERE
      md.status = 'active'
      AND (filter_medication IS NULL OR md.medication ILIKE '%' || filter_medication || '%')
      AND mc.embedding_chunk IS NOT NULL
      AND (1 - (mc.embedding_chunk <=> query_embedding)) >= min_similarity
    ORDER BY mc.embedding_chunk <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      mc.id,
      mc.document_id,
      mc.chunk_index,
      mc.content,
      mc.section_title,
      md.medication,
      md.document_type,
      0::real AS similarity,
      ts_rank_cd(mc.content_fts, plainto_tsquery('english', query_text)) AS keyword_rank
    FROM public.med_chunks mc
    INNER JOIN public.med_documents md ON mc.document_id = md.document_id
    WHERE
      md.status = 'active'
      AND (filter_medication IS NULL OR md.medication ILIKE '%' || filter_medication || '%')
      AND mc.content_fts @@ plainto_tsquery('english', query_text)
    ORDER BY keyword_rank DESC
    LIMIT match_count * 2
  ),
  combined_results AS (
    SELECT
      COALESCE(s.id, k.id) AS id,
      COALESCE(s.document_id, k.document_id) AS document_id,
      COALESCE(s.chunk_index, k.chunk_index) AS chunk_index,
      COALESCE(s.content, k.content) AS content,
      COALESCE(s.section_title, k.section_title) AS section_title,
      COALESCE(s.medication, k.medication) AS medication,
      COALESCE(s.document_type, k.document_type) AS document_type,
      COALESCE(s.similarity, 0::real) AS similarity,
      COALESCE(k.keyword_rank, 0::real) AS keyword_rank,
      (COALESCE(s.similarity, 0::real) * semantic_weight +
       COALESCE(k.keyword_rank, 0::real) * keyword_weight) AS hybrid_score
    FROM semantic_search s
    FULL OUTER JOIN keyword_search k ON s.id = k.id
  )
  SELECT * FROM combined_results
  ORDER BY hybrid_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."hybrid_search_med_knowledge"("query_embedding" "extensions"."vector", "query_text" "text", "match_count" integer, "filter_medication" "text", "semantic_weight" real, "keyword_weight" real, "min_similarity" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_doctor"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
    and role = 'doctor'
  );
$$;


ALTER FUNCTION "public"."is_doctor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_med_knowledge"("query_embedding" "extensions"."vector", "match_count" integer DEFAULT 5, "filter_medication" "text" DEFAULT NULL::"text") RETURNS TABLE("chunk_id" integer, "document_id" "text", "content" "text", "section_title" "text", "medication" "text", "document_type" "text", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as chunk_id,
    c.document_id,
    c.content,
    c.section_title,
    d.medication,
    d.document_type,
    (1 - (c.embedding_chunk <=> query_embedding))::float as similarity
  FROM public.med_chunks c
  INNER JOIN public.med_documents d ON c.document_id = d.document_id
  WHERE
    d.status = 'active'
    AND (filter_medication IS NULL OR d.medication ILIKE '%' || filter_medication || '%')
    AND c.embedding_chunk IS NOT NULL
  ORDER BY c.embedding_chunk <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_med_knowledge"("query_embedding" "extensions"."vector", "match_count" integer, "filter_medication" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_patient_memories"("query_embedding" "extensions"."vector", "p_patient_id" "uuid", "match_count" integer DEFAULT 10, "min_similarity" real DEFAULT 0.0, "filter_memory_type" "text" DEFAULT NULL::"text", "filter_min_importance" real DEFAULT NULL::real) RETURNS TABLE("id" bigint, "text" "text", "memory_type" "text", "importance" real, "similarity" real, "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    m.id,
    m.text,
    m.memory_type,
    m.importance,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.metadata,
    m.created_at
  FROM memories m
  WHERE
    m.patient_id = p_patient_id
    AND m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) >= min_similarity
    AND (filter_memory_type IS NULL OR m.memory_type = filter_memory_type)
    AND (filter_min_importance IS NULL OR m.importance >= filter_min_importance)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."search_patient_memories"("query_embedding" "extensions"."vector", "p_patient_id" "uuid", "match_count" integer, "min_similarity" real, "filter_memory_type" "text", "filter_min_importance" real) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_consultation_statuses"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
    -- Mark as 'ready' when start_time has arrived
    UPDATE consultations
    SET status = 'ready'
    WHERE status = 'scheduled'
      AND start_time <= NOW();

    -- Mark as 'missed' when end_time has passed without starting
    UPDATE consultations
    SET status = 'missed'
    WHERE status IN ('scheduled', 'ready')
      AND end_time < NOW();
  END;
  $$;


ALTER FUNCTION "public"."update_consultation_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_escalation_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_escalation_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_reward_wallet_from_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.reward_wallets
    SET
        balance = balance + NEW.amount,
        lifetime_earned = CASE
            WHEN NEW.amount > 0 THEN lifetime_earned + NEW.amount
            ELSE lifetime_earned
        END,
        lifetime_spent = CASE
            WHEN NEW.amount < 0 THEN lifetime_spent + ABS(NEW.amount)
            ELSE lifetime_spent
        END,
        updated_at = NOW()
    WHERE id = NEW.wallet_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_reward_wallet_from_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_agentic"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_agentic"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."action_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "file_size_bytes" integer,
    "mime_type" "text" DEFAULT 'application/pdf'::"text",
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."action_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "resource_id" "text",
    "resource_type" "text",
    "records_affected" integer DEFAULT 0,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "has_error_details" boolean DEFAULT false,
    CONSTRAINT "activity_log_provider_check" CHECK (("provider" = ANY (ARRAY['shopify'::"text", 'calcom'::"text"]))),
    CONSTRAINT "activity_log_source_check" CHECK (("source" = ANY (ARRAY['webhook'::"text", 'manual_sync'::"text"]))),
    CONSTRAINT "activity_log_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'success'::"text", 'failed'::"text"])))
);

ALTER TABLE ONLY "public"."activity_log" REPLICA IDENTITY FULL;


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cal_sync_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sync_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "records_synced" integer DEFAULT 0,
    "records_created" integer DEFAULT 0,
    "records_updated" integer DEFAULT 0,
    "patients_created" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "cal_sync_log_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "cal_sync_log_sync_type_check" CHECK (("sync_type" = ANY (ARRAY['manual'::"text", 'webhook'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."cal_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkins" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "scheduled_for" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "channel" "text" DEFAULT 'chat'::"text" NOT NULL,
    "prompt" "text",
    "response_json" "jsonb",
    "adherence_score" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "checkins_adherence_score_check" CHECK ((("adherence_score" >= (0)::numeric) AND ("adherence_score" <= (10)::numeric))),
    CONSTRAINT "checkins_channel_check" CHECK (("channel" = ANY (ARRAY['chat'::"text", 'sms'::"text", 'email'::"text", 'phone'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_temp_access" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "revoked_at" timestamp with time zone
);


ALTER TABLE "public"."client_temp_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "transcript" "jsonb",
    "doctor_notes" "jsonb",
    "cal_booking_uid" "text",
    "cal_event_id" bigint,
    "cal_meeting_url" "text",
    "cal_metadata" "jsonb",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancellation_reason" "text",
    "cancellation_source" "text",
    CONSTRAINT "consultations_cancellation_source_check" CHECK ((("cancellation_source" IS NULL) OR ("cancellation_source" = ANY (ARRAY['doctor'::"text", 'patient'::"text", 'admin'::"text", 'system'::"text", 'calcom'::"text"])))),
    CONSTRAINT "consultations_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'ready'::"text", 'in_progress'::"text", 'completed'::"text", 'missed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."consultations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."episode_items" (
    "episode_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL
);


ALTER TABLE "public"."episode_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."episodes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "time_range" "tsrange" NOT NULL,
    "summary" "text" NOT NULL,
    "summary_json" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."episodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."escalations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "message_id" "uuid",
    "escalation_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "description" "text" NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "assigned_to" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    CONSTRAINT "escalations_escalation_type_check" CHECK (("escalation_type" = ANY (ARRAY['red_flag_symptom'::"text", 'severe_side_effect'::"text", 'emergency'::"text", 'drug_interaction'::"text", 'treatment_request'::"text", 'reported_side_effect'::"text", 'med_knowledge_gap'::"text", 'other'::"text"]))),
    CONSTRAINT "escalations_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "escalations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'assigned'::"text", 'in_review'::"text", 'resolved'::"text", 'escalated_further'::"text"])))
);


ALTER TABLE "public"."escalations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "goal_type" "text" NOT NULL,
    "target_json" "jsonb" NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" "date" DEFAULT CURRENT_DATE,
    "target_date" "date",
    "achieved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "goals_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['weight_loss'::"text", 'waist_reduction'::"text", 'event_based'::"text", 'health_metric'::"text", 'lifestyle'::"text"]))),
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'achieved'::"text", 'abandoned'::"text", 'modified'::"text"])))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."impersonation_allowed_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "added_by" "uuid",
    "added_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."impersonation_allowed_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."impersonation_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "impersonator_user_id" "uuid" NOT NULL,
    "impersonator_email" "text" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "patient_email" "text" NOT NULL,
    "token_generated_at" timestamp with time zone DEFAULT "now"(),
    "token_used_at" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text",
    "reason" "text"
);


ALTER TABLE "public"."impersonation_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."impersonation_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "audit_log_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."impersonation_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_aging_scores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lab_report_id" "uuid",
    "score_type" "text" NOT NULL,
    "score_value" numeric NOT NULL,
    "score_category" "text",
    "component_metrics" "jsonb",
    "interpretation" "text",
    "recommendations" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lab_order_id" "uuid",
    CONSTRAINT "lab_aging_scores_has_reference" CHECK ((("lab_report_id" IS NOT NULL) OR ("lab_order_id" IS NOT NULL)))
);


ALTER TABLE "public"."lab_aging_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_metric_definitions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "category" "text",
    "section_id" "uuid",
    "is_derived" boolean DEFAULT false NOT NULL,
    "unit" "text",
    "formula" "text",
    "role" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "what_this_means_default" "text",
    "what_you_can_do_default" "text",
    "clinical_significance" "text",
    "interpretation" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "accepted_units" "text"[]
);


ALTER TABLE "public"."lab_metric_definitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "panel_id" "uuid" NOT NULL,
    "sample_type" "text",
    "fasting_required" boolean DEFAULT false,
    "collected_at" timestamp with time zone,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "input_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "source_pdf_original_filename" "text",
    "source_pdf_gcs_path" "text",
    "source_pdf_url" "text",
    "extraction_method" "text",
    "extraction_confidence" "text",
    "extraction_operation_id" "text",
    "extraction_uploaded_by" "uuid",
    "extraction_uploaded_at" timestamp with time zone
);


ALTER TABLE "public"."lab_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_panel_metrics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "panel_id" "uuid" NOT NULL,
    "metric_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lab_panel_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_pdf_extraction_context_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "extraction_id" "uuid" NOT NULL,
    "page_number" integer DEFAULT 1 NOT NULL,
    "block_order" integer NOT NULL,
    "scope" "text" NOT NULL,
    "scope_key" "text",
    "kind" "text" NOT NULL,
    "text" "text",
    "criteria_rows" "jsonb"
);


ALTER TABLE "public"."lab_pdf_extraction_context_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_pdf_extraction_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "extraction_id" "uuid" NOT NULL,
    "page_number" integer DEFAULT 1 NOT NULL,
    "row_order" integer NOT NULL,
    "analyte_label" "text" NOT NULL,
    "flag_raw" "text",
    "interpretation_label" "text",
    "result_type" "text" DEFAULT 'TEXT'::"text" NOT NULL,
    "value_numeric" double precision,
    "value_text" "text",
    "si_result_raw" "text",
    "si_unit_raw" "text",
    "si_ref_range_raw" "text",
    "conv_result_raw" "text",
    "conv_unit_raw" "text",
    "conv_ref_range_raw" "text",
    "metric_code" "text"
);


ALTER TABLE "public"."lab_pdf_extraction_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_pdf_extractions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lab_order_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "encounter_id" "uuid",
    "source_pdf_gcs_path" "text",
    "source_pdf_url" "text",
    "extraction_method" "text" NOT NULL,
    "extraction_confidence" "text",
    "operation_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lab_pdf_extractions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_reference_ranges" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "metric_id" "uuid" NOT NULL,
    "sex" "text" DEFAULT 'ANY'::"text" NOT NULL,
    "min_age_years" integer DEFAULT 0 NOT NULL,
    "max_age_years" integer DEFAULT 120 NOT NULL,
    "ref_low" numeric,
    "ref_high" numeric,
    "optimal_low" numeric,
    "optimal_high" numeric,
    "unit" "text" NOT NULL,
    "status_optimal_label" "text",
    "status_borderline_label" "text",
    "status_high_label" "text",
    "source" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lab_reference_ranges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_report_metrics" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lab_report_id" "uuid" NOT NULL,
    "metric_id" "uuid" NOT NULL,
    "section_code" "text" NOT NULL,
    "value" numeric,
    "value_display" "text" NOT NULL,
    "unit" "text",
    "ref_low" numeric,
    "ref_high" numeric,
    "optimal_low" numeric,
    "optimal_high" numeric,
    "status_label" "text" NOT NULL,
    "status_severity" "text" NOT NULL,
    "prev_value" numeric,
    "prev_date" timestamp with time zone,
    "trend_direction" "text",
    "trend_magnitude" numeric,
    "what_this_means" "text",
    "what_you_can_do" "jsonb",
    "calculation_details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lab_report_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "lab_order_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "grade" "text",
    "summary_counts" "jsonb",
    "clinician_message" "text",
    "signed_by" "uuid",
    "structured_data" "jsonb",
    "clinician_pdf_url" "text",
    "patient_pdf_url" "text",
    "input_hash" "text",
    "generation_duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "signed_at" timestamp with time zone,
    "patient_notified_at" timestamp with time zone
);


ALTER TABLE "public"."lab_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_results" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lab_order_id" "uuid" NOT NULL,
    "metric_id" "uuid" NOT NULL,
    "value" numeric,
    "unit" "text",
    "result_type" "text" DEFAULT 'NUMERIC'::"text" NOT NULL,
    "value_text" "text",
    "is_abnormal" boolean DEFAULT false,
    "flags" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lab_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_sections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lab_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lab_test_panels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "sex" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lab_test_panels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manual_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lab_order_id" "uuid" NOT NULL,
    "shopify_product_id" bigint NOT NULL,
    "shopify_variant_id" bigint,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "reason" "text" NOT NULL,
    "is_custom_reason" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "manual_recommendations_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."manual_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."med_chunks" (
    "id" integer NOT NULL,
    "document_id" "text" NOT NULL,
    "chunk_index" integer NOT NULL,
    "section_title" "text",
    "content" "text" NOT NULL,
    "content_hash" "text" NOT NULL,
    "embedding_chunk" "extensions"."vector"(768),
    "embedding_context" "extensions"."vector"(768),
    "token_count" integer,
    "embedding_model" "text",
    "embedding_dim" integer,
    "safety_tag" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "content_fts" "tsvector"
);


ALTER TABLE "public"."med_chunks" OWNER TO "postgres";


ALTER TABLE "public"."med_chunks" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."med_chunks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."med_documents" (
    "document_id" "text" NOT NULL,
    "title" "text",
    "source_url" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "medication" "text",
    "version" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_to" timestamp with time zone,
    "is_current" boolean DEFAULT true NOT NULL,
    "embedding_parent" "text",
    "embedding_model" "text",
    "embedding_dim" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."med_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."medications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "treatment_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "dosage" "text" NOT NULL,
    "schedule" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."medications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memories" (
    "id" bigint NOT NULL,
    "session_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "importance" real DEFAULT 0.5,
    "embedding" "extensions"."vector"(768),
    "memory_type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "memories_importance_check" CHECK ((("importance" >= (0)::double precision) AND ("importance" <= (1)::double precision))),
    CONSTRAINT "memories_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['goal'::"text", 'motivation'::"text", 'preference'::"text", 'event'::"text", 'fact'::"text"])))
);


ALTER TABLE "public"."memories" OWNER TO "postgres";


ALTER TABLE "public"."memories" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."memories_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "intent" "text",
    "risk_level" "text",
    "tool_calls" "jsonb",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['patient'::"text", 'agent'::"text", 'system'::"text", 'doctor'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "target_value" "jsonb",
    "due_date" "date",
    "achieved_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid",
    "shopify_order_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "order_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "consultation_id" "uuid",
    "order_source" "text" DEFAULT 'shopify'::"text",
    "admin_approval_status" "text",
    "admin_approved_by" "uuid",
    "admin_approved_at" timestamp with time zone,
    "parent_order_id" "uuid",
    CONSTRAINT "orders_admin_approval_status_check" CHECK ((("admin_approval_status" IS NULL) OR ("admin_approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))),
    CONSTRAINT "orders_order_source_check" CHECK (("order_source" = ANY (ARRAY['shopify'::"text", 'prescription'::"text", 'upsell'::"text", 'upsell_add'::"text", 'upsell_change'::"text"]))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'ready_to_ship'::"text", 'closed'::"text", 'pending_approval'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_form_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "form_type" "text" DEFAULT 'about_me'::"text" NOT NULL,
    "triggered_by" "text" NOT NULL,
    "triggered_by_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "skipped_at" timestamp with time zone,
    "due_date" timestamp with time zone,
    "notes" "text",
    CONSTRAINT "patient_form_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'skipped'::"text"]))),
    CONSTRAINT "patient_form_requests_triggered_by_check" CHECK (("triggered_by" = ANY (ARRAY['system'::"text", 'doctor'::"text", 'scheduled'::"text"])))
);


ALTER TABLE "public"."patient_form_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."patient_form_requests" IS 'Tracks form requests for patients (about_me form, etc.). Used for first-login redirect flow and doctor-triggered updates.';



COMMENT ON COLUMN "public"."patient_form_requests"."form_type" IS 'Type of form requested. Currently only about_me, extensible for future forms.';



COMMENT ON COLUMN "public"."patient_form_requests"."triggered_by" IS 'Who/what triggered the request: system (first login), doctor (manual), or scheduled (periodic).';



COMMENT ON COLUMN "public"."patient_form_requests"."triggered_by_user_id" IS 'The user (doctor/admin) who triggered the request. NULL for system/scheduled triggers.';



COMMENT ON COLUMN "public"."patient_form_requests"."status" IS 'Current status: pending (awaiting action), completed (form filled), skipped (user skipped).';



COMMENT ON COLUMN "public"."patient_form_requests"."due_date" IS 'Optional deadline for completing the form.';



COMMENT ON COLUMN "public"."patient_form_requests"."notes" IS 'Optional notes, e.g., doctor reason for requesting update.';



CREATE TABLE IF NOT EXISTS "public"."patient_hormones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "treatment_id" "uuid",
    "menstruation_status" "text",
    "current_cycle_day" "text",
    "hormonal_birth_control" boolean,
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "patient_hormones_menstruation_status_check" CHECK ((("menstruation_status" IS NULL) OR ("menstruation_status" = ANY (ARRAY['regular'::"text", 'irregular'::"text", 'post_menopausal'::"text", 'pre_menopausal'::"text", 'perimenopause'::"text"]))))
);


ALTER TABLE "public"."patient_hormones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_lifestyle" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "treatment_id" "uuid",
    "smoking_status" "text",
    "alcohol_consumption" "text",
    "exercise_hours_per_week" numeric,
    "diet_type" "text",
    "stress_level" integer,
    "sleep_hours_per_night" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "patient_lifestyle_smoking_status_check" CHECK ((("smoking_status" IS NULL) OR ("smoking_status" = ANY (ARRAY['non_smoker'::"text", 'former_smoker'::"text", 'current_smoker'::"text", 'occasional'::"text"])))),
    CONSTRAINT "patient_lifestyle_stress_level_check" CHECK ((("stress_level" IS NULL) OR (("stress_level" >= 1) AND ("stress_level" <= 10))))
);


ALTER TABLE "public"."patient_lifestyle" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_medical" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "treatment_id" "uuid",
    "current_medications" "text",
    "hormone_optimization" "text",
    "thyroid_medication" "text",
    "diagnosed_conditions" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."patient_medical" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."patient_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_prescriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "file_size_bytes" integer,
    "mime_type" "text" DEFAULT 'application/pdf'::"text",
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."patient_prescriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_tags" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL,
    "color" "text" DEFAULT 'gray'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "patient_tags_color_check" CHECK (("color" = ANY (ARRAY['gray'::"text", 'red'::"text", 'orange'::"text", 'yellow'::"text", 'green'::"text", 'blue'::"text", 'purple'::"text", 'pink'::"text"])))
);


ALTER TABLE "public"."patient_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "shopify_customer_id" "text",
    "date_of_birth" "date",
    "address" "text",
    "notes" "text",
    "auth_user_id" "uuid",
    "sex" "text",
    CONSTRAINT "patients_sex_check" CHECK (("sex" = ANY (ARRAY['M'::"text", 'F'::"text"])))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protocol_instances" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "treatment_id" "uuid" NOT NULL,
    "protocol_id" "uuid" NOT NULL,
    "current_step_index" integer DEFAULT 0 NOT NULL,
    "completed_checkpoints" "text"[] DEFAULT ARRAY[]::"text"[],
    "next_checkpoint_due_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "protocol_instances_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text", 'transition_pending'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."protocol_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protocol_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "protocol_id" "uuid" NOT NULL,
    "step_index" integer NOT NULL,
    "phase" "text" NOT NULL,
    "start_week" integer NOT NULL,
    "end_week" integer NOT NULL,
    "expected_dose_mg" numeric,
    "allowed_dose_range_mg" "numrange",
    "expected_side_effects" "text"[],
    "red_flag_symptoms" "text"[],
    "checkpoints" "jsonb" DEFAULT '[]'::"jsonb",
    "education_items" "jsonb" DEFAULT '[]'::"jsonb",
    "monitoring_requirements" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."protocol_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questionnaires" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "responses" "jsonb" NOT NULL,
    "questionnaire_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "questionnaires_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."questionnaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refill_tracks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "plan_id" "text" NOT NULL,
    "last_check_at" timestamp with time zone DEFAULT "now"(),
    "last_result" "text" NOT NULL,
    "rule_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "next_refill_due_at" timestamp with time zone,
    "auto_charge_enabled" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "refill_tracks_last_result_check" CHECK (("last_result" = ANY (ARRAY['green'::"text", 'amber'::"text", 'red'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."refill_tracks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "source" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "reference_id" "uuid",
    "reference_type" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reward_transactions_source_check" CHECK (("source" = ANY (ARRAY['checkin'::"text", 'milestone'::"text", 'goal_achieved'::"text", 'treatment_completion'::"text", 'referral'::"text", 'campaign'::"text", 'admin_adjustment'::"text"]))),
    CONSTRAINT "reward_transactions_type_check" CHECK (("type" = ANY (ARRAY['earned'::"text", 'spent'::"text", 'adjusted'::"text", 'expired'::"text", 'bonus'::"text"])))
);


ALTER TABLE "public"."reward_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_wallets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "lifetime_earned" integer DEFAULT 0 NOT NULL,
    "lifetime_spent" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reward_wallets_balance_check" CHECK (("balance" >= 0)),
    CONSTRAINT "reward_wallets_lifetime_earned_check" CHECK (("lifetime_earned" >= 0)),
    CONSTRAINT "reward_wallets_lifetime_spent_check" CHECK (("lifetime_spent" >= 0))
);


ALTER TABLE "public"."reward_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "journey_type" "text" NOT NULL,
    "state" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sessions_journey_type_check" CHECK (("journey_type" = ANY (ARRAY['intake'::"text", 'triage'::"text", 'treatment'::"text", 'check_in'::"text", 'post_treatment'::"text"]))),
    CONSTRAINT "sessions_state_check" CHECK (("state" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_customers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shopify_customer_id" bigint NOT NULL,
    "patient_id" "uuid",
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "orders_count" integer DEFAULT 0,
    "total_spent" numeric DEFAULT 0,
    "state" "text",
    "tags" "text"[],
    "accepts_marketing" boolean DEFAULT false,
    "customer_data" "jsonb" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shopify_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_inventory_levels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "inventory_item_id" bigint NOT NULL,
    "location_id" bigint NOT NULL,
    "available" integer,
    "inventory_data" "jsonb" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shopify_inventory_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shopify_product_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "handle" "text" NOT NULL,
    "vendor" "text",
    "product_type" "text",
    "status" "text" NOT NULL,
    "tags" "text"[],
    "published_at" timestamp with time zone,
    "product_data" "jsonb" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shopify_products_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'draft'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."shopify_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_sync_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sync_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "records_synced" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "shopify_sync_log_status_check" CHECK (("status" = ANY (ARRAY['started'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "shopify_sync_log_sync_type_check" CHECK (("sync_type" = ANY (ARRAY['products'::"text", 'orders'::"text", 'customers'::"text", 'inventory'::"text", 'full'::"text"])))
);


ALTER TABLE "public"."shopify_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopify_variants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shopify_variant_id" bigint NOT NULL,
    "shopify_product_id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "sku" "text",
    "price" numeric NOT NULL,
    "compare_at_price" numeric,
    "inventory_item_id" bigint,
    "inventory_quantity" integer DEFAULT 0,
    "inventory_policy" "text",
    "position" integer,
    "variant_data" "jsonb" NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shopify_variants_inventory_policy_check" CHECK (("inventory_policy" = ANY (ARRAY['deny'::"text", 'continue'::"text"])))
);


ALTER TABLE "public"."shopify_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."side_effect_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "medication_id" "uuid",
    "treatment_id" "uuid",
    "description" "text" NOT NULL,
    "severity" integer NOT NULL,
    "action_taken" "text",
    "requires_escalation" boolean DEFAULT false,
    "escalated_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "side_effect_reports_severity_check" CHECK ((("severity" >= 1) AND ("severity" <= 10)))
);


ALTER TABLE "public"."side_effect_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "note_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "staff_notes_note_type_check" CHECK (("note_type" = ANY (ARRAY['general'::"text", 'alert'::"text", 'flag'::"text", 'followup'::"text"])))
);


ALTER TABLE "public"."staff_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."symptoms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "name" "text" NOT NULL,
    "severity" integer NOT NULL,
    "onset" timestamp with time zone NOT NULL,
    "resolved_at" timestamp with time zone,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "symptoms_severity_check" CHECK ((("severity" >= 1) AND ("severity" <= 10)))
);


ALTER TABLE "public"."symptoms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatment_protocols" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "medication" "text" NOT NULL,
    "total_weeks" integer NOT NULL,
    "version" "text" DEFAULT '1.0'::"text" NOT NULL,
    "sop_source" "text",
    "protocol_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "treatment_protocols_protocol_type_check" CHECK (("protocol_type" = ANY (ARRAY['standard'::"text", 'transition'::"text", 'maintenance'::"text"])))
);


ALTER TABLE "public"."treatment_protocols" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."treatments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "product" "text" NOT NULL,
    "plan_json" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "start_date" "date",
    "completed_at" timestamp with time zone,
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "approval_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "treatments_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "treatments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'paused'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."treatments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."triage_decisions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "questionnaire_id" "uuid",
    "product_pathway" "text" NOT NULL,
    "eligibility_status" "text" NOT NULL,
    "reason_json" "jsonb" NOT NULL,
    "risk_factors" "text"[],
    "recommended_treatment" "text",
    "requires_consultation" boolean DEFAULT false,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "triage_decisions_eligibility_status_check" CHECK (("eligibility_status" = ANY (ARRAY['eligible'::"text", 'doctor_review'::"text", 'ineligible'::"text"]))),
    CONSTRAINT "triage_decisions_product_pathway_check" CHECK (("product_pathway" = ANY (ARRAY['weight_loss'::"text", 'ed'::"text", 'hair_loss'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."triage_decisions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'doctor'::"text", 'staff'::"text", 'client'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."deleted_at" IS 'Timestamp when user was soft deleted. NULL means user is active.';



COMMENT ON COLUMN "public"."users"."deleted_by" IS 'User ID who performed the deletion.';



CREATE TABLE IF NOT EXISTS "public"."vitals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "treatment_id" "uuid",
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "metric" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vitals_metric_check" CHECK (("metric" = ANY (ARRAY['weight'::"text", 'waist'::"text", 'height'::"text", 'blood_pressure_systolic'::"text", 'blood_pressure_diastolic'::"text", 'heart_rate'::"text", 'sleep_hours'::"text", 'glucose'::"text", 'lipids'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."vitals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_error_details" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_log_id" "uuid" NOT NULL,
    "stack_trace" "text",
    "request_payload" "jsonb",
    "request_headers" "jsonb",
    "processing_steps" "jsonb" DEFAULT '[]'::"jsonb",
    "environment_context" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."webhook_error_details" OWNER TO "postgres";


ALTER TABLE ONLY "public"."action_plans"
    ADD CONSTRAINT "action_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cal_sync_log"
    ADD CONSTRAINT "cal_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_temp_access"
    ADD CONSTRAINT "client_temp_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_cal_booking_uid_key" UNIQUE ("cal_booking_uid");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."episode_items"
    ADD CONSTRAINT "episode_items_pkey" PRIMARY KEY ("message_id", "episode_id");



ALTER TABLE ONLY "public"."episodes"
    ADD CONSTRAINT "episodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."impersonation_allowed_users"
    ADD CONSTRAINT "impersonation_allowed_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."impersonation_allowed_users"
    ADD CONSTRAINT "impersonation_allowed_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."impersonation_audit_log"
    ADD CONSTRAINT "impersonation_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."impersonation_tokens"
    ADD CONSTRAINT "impersonation_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."impersonation_tokens"
    ADD CONSTRAINT "impersonation_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."lab_aging_scores"
    ADD CONSTRAINT "lab_aging_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_metric_definitions"
    ADD CONSTRAINT "lab_metric_definitions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."lab_metric_definitions"
    ADD CONSTRAINT "lab_metric_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_panel_metrics"
    ADD CONSTRAINT "lab_panel_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_pdf_extraction_context_blocks"
    ADD CONSTRAINT "lab_pdf_extraction_context_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_pdf_extraction_rows"
    ADD CONSTRAINT "lab_pdf_extraction_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_pdf_extractions"
    ADD CONSTRAINT "lab_pdf_extractions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_reference_ranges"
    ADD CONSTRAINT "lab_reference_ranges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_report_metrics"
    ADD CONSTRAINT "lab_report_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_reports"
    ADD CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_results"
    ADD CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_sections"
    ADD CONSTRAINT "lab_sections_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."lab_sections"
    ADD CONSTRAINT "lab_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lab_test_panels"
    ADD CONSTRAINT "lab_test_panels_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."lab_test_panels"
    ADD CONSTRAINT "lab_test_panels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manual_recommendations"
    ADD CONSTRAINT "manual_recommendations_lab_order_id_shopify_product_id_key" UNIQUE ("lab_order_id", "shopify_product_id");



ALTER TABLE ONLY "public"."manual_recommendations"
    ADD CONSTRAINT "manual_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."med_chunks"
    ADD CONSTRAINT "med_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."med_documents"
    ADD CONSTRAINT "med_documents_pkey" PRIMARY KEY ("document_id");



ALTER TABLE ONLY "public"."medications"
    ADD CONSTRAINT "medications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memories"
    ADD CONSTRAINT "memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shopify_order_id_key" UNIQUE ("shopify_order_id");



ALTER TABLE ONLY "public"."patient_form_requests"
    ADD CONSTRAINT "patient_form_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_hormones"
    ADD CONSTRAINT "patient_hormones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_lifestyle"
    ADD CONSTRAINT "patient_lifestyle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_medical"
    ADD CONSTRAINT "patient_medical_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_prescriptions"
    ADD CONSTRAINT "patient_prescriptions_patient_id_unique" UNIQUE ("patient_id");



ALTER TABLE ONLY "public"."patient_prescriptions"
    ADD CONSTRAINT "patient_prescriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_tags"
    ADD CONSTRAINT "patient_tags_patient_id_tag_key" UNIQUE ("tag", "patient_id");



ALTER TABLE ONLY "public"."patient_tags"
    ADD CONSTRAINT "patient_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_auth_user_id_unique" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_shopify_customer_id_key" UNIQUE ("shopify_customer_id");



ALTER TABLE ONLY "public"."protocol_instances"
    ADD CONSTRAINT "protocol_instances_patient_id_treatment_id_key" UNIQUE ("patient_id", "treatment_id");



ALTER TABLE ONLY "public"."protocol_instances"
    ADD CONSTRAINT "protocol_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protocol_steps"
    ADD CONSTRAINT "protocol_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protocol_steps"
    ADD CONSTRAINT "protocol_steps_protocol_id_step_index_key" UNIQUE ("protocol_id", "step_index");



ALTER TABLE ONLY "public"."questionnaires"
    ADD CONSTRAINT "questionnaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refill_tracks"
    ADD CONSTRAINT "refill_tracks_patient_id_treatment_id_key" UNIQUE ("patient_id", "treatment_id");



ALTER TABLE ONLY "public"."refill_tracks"
    ADD CONSTRAINT "refill_tracks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_patient_id_key" UNIQUE ("patient_id");



ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_customers"
    ADD CONSTRAINT "shopify_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_customers"
    ADD CONSTRAINT "shopify_customers_shopify_customer_id_key" UNIQUE ("shopify_customer_id");



ALTER TABLE ONLY "public"."shopify_inventory_levels"
    ADD CONSTRAINT "shopify_inventory_levels_inventory_item_id_location_id_key" UNIQUE ("inventory_item_id", "location_id");



ALTER TABLE ONLY "public"."shopify_inventory_levels"
    ADD CONSTRAINT "shopify_inventory_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_products"
    ADD CONSTRAINT "shopify_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_products"
    ADD CONSTRAINT "shopify_products_shopify_product_id_key" UNIQUE ("shopify_product_id");



ALTER TABLE ONLY "public"."shopify_sync_log"
    ADD CONSTRAINT "shopify_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_variants"
    ADD CONSTRAINT "shopify_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_variants"
    ADD CONSTRAINT "shopify_variants_shopify_variant_id_key" UNIQUE ("shopify_variant_id");



ALTER TABLE ONLY "public"."side_effect_reports"
    ADD CONSTRAINT "side_effect_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_notes"
    ADD CONSTRAINT "staff_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."symptoms"
    ADD CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatment_protocols"
    ADD CONSTRAINT "treatment_protocols_name_version_key" UNIQUE ("version", "name");



ALTER TABLE ONLY "public"."treatment_protocols"
    ADD CONSTRAINT "treatment_protocols_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."triage_decisions"
    ADD CONSTRAINT "triage_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopify_variants"
    ADD CONSTRAINT "uq_shopify_variants_inventory_item_id" UNIQUE ("inventory_item_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vitals"
    ADD CONSTRAINT "vitals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_error_details"
    ADD CONSTRAINT "webhook_error_details_pkey" PRIMARY KEY ("id");



CREATE INDEX "client_temp_access_email_idx" ON "public"."client_temp_access" USING "btree" ("email");



CREATE INDEX "client_temp_access_expires_at_idx" ON "public"."client_temp_access" USING "btree" ("expires_at");



CREATE INDEX "client_temp_access_user_id_idx" ON "public"."client_temp_access" USING "btree" ("user_id");



CREATE INDEX "idx_action_plans_created_at" ON "public"."action_plans" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_action_plans_patient_id" ON "public"."action_plans" USING "btree" ("patient_id");



CREATE INDEX "idx_action_plans_uploaded_by" ON "public"."action_plans" USING "btree" ("uploaded_by");



CREATE INDEX "idx_activity_log_created_at" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_provider" ON "public"."activity_log" USING "btree" ("provider");



CREATE INDEX "idx_activity_log_source" ON "public"."activity_log" USING "btree" ("source");



CREATE INDEX "idx_activity_log_status" ON "public"."activity_log" USING "btree" ("status");



CREATE INDEX "idx_cal_sync_log_status_completed" ON "public"."cal_sync_log" USING "btree" ("status", "completed_at" DESC);



CREATE INDEX "idx_cal_sync_log_type_started" ON "public"."cal_sync_log" USING "btree" ("sync_type", "started_at" DESC);



CREATE INDEX "idx_checkins_completed_at" ON "public"."checkins" USING "btree" ("completed_at");



CREATE INDEX "idx_checkins_patient_id" ON "public"."checkins" USING "btree" ("patient_id");



CREATE INDEX "idx_checkins_patient_scheduled" ON "public"."checkins" USING "btree" ("patient_id", "scheduled_for");



CREATE INDEX "idx_checkins_scheduled_for" ON "public"."checkins" USING "btree" ("scheduled_for");



CREATE INDEX "idx_checkins_treatment_id" ON "public"."checkins" USING "btree" ("treatment_id");



CREATE INDEX "idx_consultations_cal_booking_uid" ON "public"."consultations" USING "btree" ("cal_booking_uid");



CREATE INDEX "idx_consultations_cancelled_at" ON "public"."consultations" USING "btree" ("cancelled_at") WHERE ("cancelled_at" IS NOT NULL);



CREATE INDEX "idx_consultations_patient_status" ON "public"."consultations" USING "btree" ("patient_id", "status", "start_time" DESC);



CREATE INDEX "idx_episode_items_episode_id" ON "public"."episode_items" USING "btree" ("episode_id");



CREATE INDEX "idx_episode_items_message_id" ON "public"."episode_items" USING "btree" ("message_id");



CREATE INDEX "idx_episodes_created_at" ON "public"."episodes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_episodes_session_id" ON "public"."episodes" USING "btree" ("session_id");



CREATE INDEX "idx_episodes_time_range" ON "public"."episodes" USING "gist" ("time_range");



CREATE INDEX "idx_escalations_assigned_to" ON "public"."escalations" USING "btree" ("assigned_to");



CREATE INDEX "idx_escalations_severity" ON "public"."escalations" USING "btree" ("severity");



CREATE INDEX "idx_escalations_status" ON "public"."escalations" USING "btree" ("status");



CREATE INDEX "idx_goals_goal_type" ON "public"."goals" USING "btree" ("goal_type");



CREATE INDEX "idx_goals_patient_id" ON "public"."goals" USING "btree" ("patient_id");



CREATE INDEX "idx_goals_patient_status" ON "public"."goals" USING "btree" ("patient_id", "status");



CREATE INDEX "idx_goals_status" ON "public"."goals" USING "btree" ("status");



CREATE INDEX "idx_goals_treatment_id" ON "public"."goals" USING "btree" ("treatment_id");



CREATE INDEX "idx_impersonation_audit_log_created" ON "public"."impersonation_audit_log" USING "btree" ("token_generated_at" DESC);



CREATE INDEX "idx_impersonation_audit_log_impersonator" ON "public"."impersonation_audit_log" USING "btree" ("impersonator_user_id");



CREATE INDEX "idx_impersonation_audit_log_patient" ON "public"."impersonation_audit_log" USING "btree" ("patient_id");



CREATE INDEX "idx_impersonation_tokens_token" ON "public"."impersonation_tokens" USING "btree" ("token");



CREATE INDEX "idx_inventory_levels_available" ON "public"."shopify_inventory_levels" USING "btree" ("available");



CREATE INDEX "idx_inventory_levels_item" ON "public"."shopify_inventory_levels" USING "btree" ("inventory_item_id");



CREATE INDEX "idx_inventory_levels_location" ON "public"."shopify_inventory_levels" USING "btree" ("location_id");



CREATE INDEX "idx_lab_aging_scores_lab_report_id" ON "public"."lab_aging_scores" USING "btree" ("lab_report_id");



CREATE INDEX "idx_lab_orders_patient_id" ON "public"."lab_orders" USING "btree" ("patient_id");



CREATE INDEX "idx_lab_report_metrics_lab_report_id" ON "public"."lab_report_metrics" USING "btree" ("lab_report_id");



CREATE INDEX "idx_lab_reports_lab_order_id" ON "public"."lab_reports" USING "btree" ("lab_order_id");



CREATE INDEX "idx_lab_results_lab_order_id" ON "public"."lab_results" USING "btree" ("lab_order_id");



CREATE INDEX "idx_manual_recommendations_lab_order" ON "public"."manual_recommendations" USING "btree" ("lab_order_id");



CREATE INDEX "idx_medications_treatment_id" ON "public"."medications" USING "btree" ("treatment_id");



CREATE INDEX "idx_memories_created_at" ON "public"."memories" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_memories_embedding" ON "public"."memories" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_memories_importance" ON "public"."memories" USING "btree" ("importance" DESC);



CREATE INDEX "idx_memories_memory_type" ON "public"."memories" USING "btree" ("memory_type");



CREATE INDEX "idx_memories_patient_id" ON "public"."memories" USING "btree" ("patient_id");



CREATE INDEX "idx_memories_session_id" ON "public"."memories" USING "btree" ("session_id");



CREATE INDEX "idx_milestones_achieved_at" ON "public"."milestones" USING "btree" ("achieved_at");



CREATE INDEX "idx_milestones_due_date" ON "public"."milestones" USING "btree" ("due_date");



CREATE INDEX "idx_milestones_goal_id" ON "public"."milestones" USING "btree" ("goal_id");



CREATE INDEX "idx_orders_admin_approval_status" ON "public"."orders" USING "btree" ("admin_approval_status");



CREATE INDEX "idx_orders_consultation_id" ON "public"."orders" USING "btree" ("consultation_id");



CREATE INDEX "idx_orders_consultation_pending" ON "public"."orders" USING "btree" ("order_source", "admin_approval_status") WHERE ("admin_approval_status" = 'pending'::"text");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_order_source" ON "public"."orders" USING "btree" ("order_source");



CREATE INDEX "idx_orders_parent_order_id" ON "public"."orders" USING "btree" ("parent_order_id");



CREATE INDEX "idx_orders_patient_id" ON "public"."orders" USING "btree" ("patient_id");



CREATE INDEX "idx_orders_shopify_order_id" ON "public"."orders" USING "btree" ("shopify_order_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_patient_form_requests_form_type" ON "public"."patient_form_requests" USING "btree" ("form_type");



CREATE INDEX "idx_patient_form_requests_patient_pending" ON "public"."patient_form_requests" USING "btree" ("patient_id", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_patient_hormones_patient_id" ON "public"."patient_hormones" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_hormones_recorded_at" ON "public"."patient_hormones" USING "btree" ("patient_id", "recorded_at" DESC);



CREATE INDEX "idx_patient_lifestyle_diet" ON "public"."patient_lifestyle" USING "btree" ("diet_type") WHERE ("diet_type" IS NOT NULL);



CREATE INDEX "idx_patient_lifestyle_patient_id" ON "public"."patient_lifestyle" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_lifestyle_recorded_at" ON "public"."patient_lifestyle" USING "btree" ("patient_id", "recorded_at" DESC);



CREATE INDEX "idx_patient_lifestyle_smoking" ON "public"."patient_lifestyle" USING "btree" ("smoking_status") WHERE ("smoking_status" IS NOT NULL);



CREATE INDEX "idx_patient_medical_patient_id" ON "public"."patient_medical" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_medical_recorded_at" ON "public"."patient_medical" USING "btree" ("patient_id", "recorded_at" DESC);



CREATE INDEX "idx_patient_notes_created_at" ON "public"."patient_notes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_patient_notes_doctor_id" ON "public"."patient_notes" USING "btree" ("doctor_id");



CREATE INDEX "idx_patient_notes_patient_id" ON "public"."patient_notes" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_prescriptions_created_at" ON "public"."patient_prescriptions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_patient_prescriptions_patient_id" ON "public"."patient_prescriptions" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_tags_patient_id" ON "public"."patient_tags" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_tags_tag" ON "public"."patient_tags" USING "btree" ("tag");



CREATE INDEX "idx_patients_auth_user_id" ON "public"."patients" USING "btree" ("auth_user_id");



CREATE INDEX "idx_patients_email" ON "public"."patients" USING "btree" ("email");



CREATE INDEX "idx_patients_shopify_customer_id" ON "public"."patients" USING "btree" ("shopify_customer_id");



CREATE INDEX "idx_protocol_instances_checkpoint_due" ON "public"."protocol_instances" USING "btree" ("next_checkpoint_due_at");



CREATE INDEX "idx_protocol_instances_patient_id" ON "public"."protocol_instances" USING "btree" ("patient_id");



CREATE INDEX "idx_protocol_instances_protocol_id" ON "public"."protocol_instances" USING "btree" ("protocol_id");



CREATE INDEX "idx_protocol_instances_status" ON "public"."protocol_instances" USING "btree" ("status");



CREATE INDEX "idx_protocol_instances_treatment_id" ON "public"."protocol_instances" USING "btree" ("treatment_id");



CREATE INDEX "idx_protocol_steps_phase" ON "public"."protocol_steps" USING "btree" ("phase");



CREATE INDEX "idx_protocol_steps_protocol_id" ON "public"."protocol_steps" USING "btree" ("protocol_id");



CREATE INDEX "idx_protocol_steps_step_index" ON "public"."protocol_steps" USING "btree" ("protocol_id", "step_index");



CREATE INDEX "idx_questionnaires_patient_id" ON "public"."questionnaires" USING "btree" ("patient_id");



CREATE INDEX "idx_refill_tracks_auto_charge" ON "public"."refill_tracks" USING "btree" ("auto_charge_enabled", "last_result");



CREATE INDEX "idx_refill_tracks_last_result" ON "public"."refill_tracks" USING "btree" ("last_result");



CREATE INDEX "idx_refill_tracks_next_refill" ON "public"."refill_tracks" USING "btree" ("next_refill_due_at");



CREATE INDEX "idx_refill_tracks_patient_id" ON "public"."refill_tracks" USING "btree" ("patient_id");



CREATE INDEX "idx_refill_tracks_treatment_id" ON "public"."refill_tracks" USING "btree" ("treatment_id");



CREATE INDEX "idx_reward_transactions_created_at" ON "public"."reward_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reward_transactions_reference" ON "public"."reward_transactions" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_reward_transactions_source" ON "public"."reward_transactions" USING "btree" ("source");



CREATE INDEX "idx_reward_transactions_type" ON "public"."reward_transactions" USING "btree" ("type");



CREATE INDEX "idx_reward_transactions_wallet_id" ON "public"."reward_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_reward_wallets_balance" ON "public"."reward_wallets" USING "btree" ("balance" DESC);



CREATE INDEX "idx_reward_wallets_patient_id" ON "public"."reward_wallets" USING "btree" ("patient_id");



CREATE INDEX "idx_shopify_customers_email" ON "public"."shopify_customers" USING "btree" ("email");



CREATE INDEX "idx_shopify_customers_patient" ON "public"."shopify_customers" USING "btree" ("patient_id");



CREATE INDEX "idx_shopify_customers_shopify_id" ON "public"."shopify_customers" USING "btree" ("shopify_customer_id");



CREATE INDEX "idx_shopify_customers_tags" ON "public"."shopify_customers" USING "gin" ("tags");



CREATE INDEX "idx_shopify_products_handle" ON "public"."shopify_products" USING "btree" ("handle");



CREATE INDEX "idx_shopify_products_shopify_id" ON "public"."shopify_products" USING "btree" ("shopify_product_id");



CREATE INDEX "idx_shopify_products_status" ON "public"."shopify_products" USING "btree" ("status");



CREATE INDEX "idx_shopify_products_tags" ON "public"."shopify_products" USING "gin" ("tags");



CREATE INDEX "idx_shopify_variants_inventory_item" ON "public"."shopify_variants" USING "btree" ("inventory_item_id");



CREATE INDEX "idx_shopify_variants_product_id" ON "public"."shopify_variants" USING "btree" ("shopify_product_id");



CREATE INDEX "idx_shopify_variants_shopify_id" ON "public"."shopify_variants" USING "btree" ("shopify_variant_id");



CREATE INDEX "idx_shopify_variants_sku" ON "public"."shopify_variants" USING "btree" ("sku");



CREATE INDEX "idx_side_effect_reports_escalation" ON "public"."side_effect_reports" USING "btree" ("requires_escalation", "created_at" DESC);



CREATE INDEX "idx_side_effect_reports_medication_id" ON "public"."side_effect_reports" USING "btree" ("medication_id");



CREATE INDEX "idx_side_effect_reports_patient_id" ON "public"."side_effect_reports" USING "btree" ("patient_id");



CREATE INDEX "idx_side_effect_reports_severity" ON "public"."side_effect_reports" USING "btree" ("severity" DESC);



CREATE INDEX "idx_side_effect_reports_treatment_id" ON "public"."side_effect_reports" USING "btree" ("treatment_id");



CREATE INDEX "idx_staff_notes_created_at" ON "public"."staff_notes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_staff_notes_is_pinned" ON "public"."staff_notes" USING "btree" ("is_pinned") WHERE ("is_pinned" = true);



CREATE INDEX "idx_staff_notes_patient_id" ON "public"."staff_notes" USING "btree" ("patient_id");



CREATE INDEX "idx_staff_notes_user_id" ON "public"."staff_notes" USING "btree" ("user_id");



CREATE INDEX "idx_symptoms_onset" ON "public"."symptoms" USING "btree" ("onset" DESC);



CREATE INDEX "idx_symptoms_patient_id" ON "public"."symptoms" USING "btree" ("patient_id");



CREATE INDEX "idx_symptoms_severity" ON "public"."symptoms" USING "btree" ("severity" DESC);



CREATE INDEX "idx_symptoms_treatment_id" ON "public"."symptoms" USING "btree" ("treatment_id");



CREATE INDEX "idx_sync_log_type_started" ON "public"."shopify_sync_log" USING "btree" ("sync_type", "started_at" DESC);



CREATE INDEX "idx_treatment_protocols_active" ON "public"."treatment_protocols" USING "btree" ("is_active");



CREATE INDEX "idx_treatment_protocols_medication" ON "public"."treatment_protocols" USING "btree" ("medication");



CREATE INDEX "idx_treatment_protocols_type" ON "public"."treatment_protocols" USING "btree" ("protocol_type");



CREATE INDEX "idx_treatments_approval_status" ON "public"."treatments" USING "btree" ("approval_status");



CREATE INDEX "idx_treatments_approved_by" ON "public"."treatments" USING "btree" ("approved_by");



CREATE INDEX "idx_treatments_patient_approval" ON "public"."treatments" USING "btree" ("patient_id", "approval_status");



CREATE INDEX "idx_treatments_patient_id" ON "public"."treatments" USING "btree" ("patient_id");



CREATE INDEX "idx_triage_decisions_eligibility" ON "public"."triage_decisions" USING "btree" ("eligibility_status");



CREATE INDEX "idx_triage_decisions_expires_at" ON "public"."triage_decisions" USING "btree" ("expires_at");



CREATE INDEX "idx_triage_decisions_patient_id" ON "public"."triage_decisions" USING "btree" ("patient_id");



CREATE INDEX "idx_triage_decisions_product_pathway" ON "public"."triage_decisions" USING "btree" ("product_pathway");



CREATE INDEX "idx_triage_decisions_questionnaire_id" ON "public"."triage_decisions" USING "btree" ("questionnaire_id");



CREATE INDEX "idx_users_active" ON "public"."users" USING "btree" ("email") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_users_id_role" ON "public"."users" USING "btree" ("id", "role");



CREATE INDEX "idx_vitals_metric" ON "public"."vitals" USING "btree" ("metric");



CREATE INDEX "idx_vitals_patient_id" ON "public"."vitals" USING "btree" ("patient_id");



CREATE INDEX "idx_vitals_patient_metric" ON "public"."vitals" USING "btree" ("patient_id", "metric", "recorded_at" DESC);



CREATE INDEX "idx_vitals_recorded_at" ON "public"."vitals" USING "btree" ("recorded_at" DESC);



CREATE INDEX "idx_vitals_treatment_id" ON "public"."vitals" USING "btree" ("treatment_id");



CREATE INDEX "idx_webhook_error_details_activity_log_id" ON "public"."webhook_error_details" USING "btree" ("activity_log_id");



CREATE INDEX "lab_aging_scores_lab_order_idx" ON "public"."lab_aging_scores" USING "btree" ("lab_order_id");



CREATE INDEX "lab_aging_scores_lab_order_type_idx" ON "public"."lab_aging_scores" USING "btree" ("lab_order_id", "score_type");



CREATE INDEX "lab_aging_scores_report_type_idx" ON "public"."lab_aging_scores" USING "btree" ("lab_report_id", "score_type");



CREATE INDEX "lab_metric_definitions_accepted_units_idx" ON "public"."lab_metric_definitions" USING "gin" ("accepted_units");



CREATE UNIQUE INDEX "lab_metric_definitions_code_idx" ON "public"."lab_metric_definitions" USING "btree" ("code");



CREATE INDEX "lab_metric_definitions_derived_idx" ON "public"."lab_metric_definitions" USING "btree" ("is_derived");



CREATE INDEX "lab_metric_definitions_section_idx" ON "public"."lab_metric_definitions" USING "btree" ("section_id");



CREATE INDEX "lab_orders_consultation_idx" ON "public"."lab_orders" USING "btree" ("consultation_id");



CREATE INDEX "lab_orders_hash_idx" ON "public"."lab_orders" USING "btree" ("input_hash");



CREATE INDEX "lab_orders_patient_idx" ON "public"."lab_orders" USING "btree" ("patient_id");



CREATE INDEX "lab_orders_status_idx" ON "public"."lab_orders" USING "btree" ("status");



CREATE INDEX "lab_panel_metrics_panel_metric_idx" ON "public"."lab_panel_metrics" USING "btree" ("panel_id", "metric_id");



CREATE INDEX "lab_panel_metrics_panel_order_idx" ON "public"."lab_panel_metrics" USING "btree" ("panel_id", "display_order");



CREATE INDEX "lab_pdf_extraction_context_blocks_extraction_order_idx" ON "public"."lab_pdf_extraction_context_blocks" USING "btree" ("extraction_id", "page_number", "block_order");



CREATE INDEX "lab_pdf_extraction_rows_extraction_metric_code_idx" ON "public"."lab_pdf_extraction_rows" USING "btree" ("extraction_id", "metric_code");



CREATE INDEX "lab_pdf_extraction_rows_extraction_order_idx" ON "public"."lab_pdf_extraction_rows" USING "btree" ("extraction_id", "page_number", "row_order");



CREATE INDEX "lab_pdf_extractions_lab_order_idx" ON "public"."lab_pdf_extractions" USING "btree" ("lab_order_id", "created_at" DESC);



CREATE INDEX "lab_reference_ranges_metric_sex_age_idx" ON "public"."lab_reference_ranges" USING "btree" ("metric_id", "sex", "min_age_years", "max_age_years");



CREATE UNIQUE INDEX "lab_reference_ranges_metric_sex_age_unit_uidx" ON "public"."lab_reference_ranges" USING "btree" ("metric_id", "sex", "min_age_years", "max_age_years", "unit");



CREATE INDEX "lab_report_metrics_report_idx" ON "public"."lab_report_metrics" USING "btree" ("lab_report_id");



CREATE UNIQUE INDEX "lab_report_metrics_report_metric_idx" ON "public"."lab_report_metrics" USING "btree" ("lab_report_id", "metric_id");



CREATE INDEX "lab_report_metrics_section_idx" ON "public"."lab_report_metrics" USING "btree" ("lab_report_id", "section_code");



CREATE INDEX "lab_reports_consultation_idx" ON "public"."lab_reports" USING "btree" ("consultation_id");



CREATE INDEX "lab_reports_notified_idx" ON "public"."lab_reports" USING "btree" ("patient_notified_at") WHERE ("patient_notified_at" IS NULL);



CREATE UNIQUE INDEX "lab_reports_order_idx" ON "public"."lab_reports" USING "btree" ("lab_order_id");



CREATE INDEX "lab_reports_patient_idx" ON "public"."lab_reports" USING "btree" ("patient_id");



CREATE INDEX "lab_reports_status_idx" ON "public"."lab_reports" USING "btree" ("status");



CREATE INDEX "lab_results_order_idx" ON "public"."lab_results" USING "btree" ("lab_order_id");



CREATE UNIQUE INDEX "lab_results_order_metric_idx" ON "public"."lab_results" USING "btree" ("lab_order_id", "metric_id");



CREATE UNIQUE INDEX "lab_sections_code_idx" ON "public"."lab_sections" USING "btree" ("code");



CREATE UNIQUE INDEX "lab_test_panels_code_idx" ON "public"."lab_test_panels" USING "btree" ("code");



CREATE INDEX "lab_test_panels_sex_tier_idx" ON "public"."lab_test_panels" USING "btree" ("sex", "tier");



CREATE INDEX "med_chunks_content_fts_idx" ON "public"."med_chunks" USING "gin" ("content_fts");



CREATE INDEX "med_chunks_document_id_idx" ON "public"."med_chunks" USING "btree" ("document_id");



CREATE INDEX "med_chunks_embedding_chunk_idx" ON "public"."med_chunks" USING "hnsw" ("embedding_chunk" "extensions"."vector_cosine_ops");



CREATE INDEX "med_documents_medication_idx" ON "public"."med_documents" USING "btree" ("medication");



CREATE INDEX "med_documents_medication_status_idx" ON "public"."med_documents" USING "btree" ("medication", "status");



CREATE INDEX "med_documents_status_idx" ON "public"."med_documents" USING "btree" ("status");



CREATE INDEX "memories_embedding_idx" ON "public"."memories" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "messages_session_id_idx" ON "public"."messages" USING "btree" ("session_id");



CREATE INDEX "patients_auth_user_id_idx" ON "public"."patients" USING "btree" ("auth_user_id");



CREATE INDEX "patients_sex_idx" ON "public"."patients" USING "btree" ("sex") WHERE ("sex" IS NOT NULL);



CREATE INDEX "sessions_patient_id_idx" ON "public"."sessions" USING "btree" ("patient_id");



CREATE OR REPLACE TRIGGER "escalations_updated_at_trigger" BEFORE UPDATE ON "public"."escalations" FOR EACH ROW EXECUTE FUNCTION "public"."update_escalation_updated_at"();



CREATE OR REPLACE TRIGGER "update_episodes_updated_at" BEFORE UPDATE ON "public"."episodes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_goals_updated_at" BEFORE UPDATE ON "public"."goals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_medications_updated_at" BEFORE UPDATE ON "public"."medications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_protocol_instances_updated_at" BEFORE UPDATE ON "public"."protocol_instances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_refill_tracks_updated_at" BEFORE UPDATE ON "public"."refill_tracks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reward_wallets_updated_at" BEFORE UPDATE ON "public"."reward_wallets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_treatment_protocols_updated_at" BEFORE UPDATE ON "public"."treatment_protocols" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_treatments_updated_at" BEFORE UPDATE ON "public"."treatments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_wallet_on_transaction" AFTER INSERT ON "public"."reward_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_reward_wallet_from_transaction"();



ALTER TABLE ONLY "public"."action_plans"
    ADD CONSTRAINT "action_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."action_plans"
    ADD CONSTRAINT "action_plans_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."client_temp_access"
    ADD CONSTRAINT "client_temp_access_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."client_temp_access"
    ADD CONSTRAINT "client_temp_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."episode_items"
    ADD CONSTRAINT "episode_items_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."escalations"
    ADD CONSTRAINT "escalations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shopify_inventory_levels"
    ADD CONSTRAINT "fk_shopify_inventory_levels_variant" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."shopify_variants"("inventory_item_id");



ALTER TABLE ONLY "public"."shopify_variants"
    ADD CONSTRAINT "fk_shopify_variants_product" FOREIGN KEY ("shopify_product_id") REFERENCES "public"."shopify_products"("shopify_product_id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."impersonation_allowed_users"
    ADD CONSTRAINT "impersonation_allowed_users_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."impersonation_audit_log"
    ADD CONSTRAINT "impersonation_audit_log_impersonator_fkey" FOREIGN KEY ("impersonator_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."impersonation_audit_log"
    ADD CONSTRAINT "impersonation_audit_log_patient_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."impersonation_tokens"
    ADD CONSTRAINT "impersonation_tokens_audit_log_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "public"."impersonation_audit_log"("id");



ALTER TABLE ONLY "public"."impersonation_tokens"
    ADD CONSTRAINT "impersonation_tokens_patient_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."lab_aging_scores"
    ADD CONSTRAINT "lab_aging_scores_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id");



ALTER TABLE ONLY "public"."lab_aging_scores"
    ADD CONSTRAINT "lab_aging_scores_lab_report_id_fkey" FOREIGN KEY ("lab_report_id") REFERENCES "public"."lab_reports"("id");



ALTER TABLE ONLY "public"."lab_metric_definitions"
    ADD CONSTRAINT "lab_metric_definitions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."lab_sections"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "public"."lab_test_panels"("id");



ALTER TABLE ONLY "public"."lab_orders"
    ADD CONSTRAINT "lab_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."lab_panel_metrics"
    ADD CONSTRAINT "lab_panel_metrics_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."lab_metric_definitions"("id");



ALTER TABLE ONLY "public"."lab_panel_metrics"
    ADD CONSTRAINT "lab_panel_metrics_panel_id_fkey" FOREIGN KEY ("panel_id") REFERENCES "public"."lab_test_panels"("id");



ALTER TABLE ONLY "public"."lab_pdf_extraction_context_blocks"
    ADD CONSTRAINT "lab_pdf_extraction_context_blocks_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "public"."lab_pdf_extractions"("id");



ALTER TABLE ONLY "public"."lab_pdf_extraction_rows"
    ADD CONSTRAINT "lab_pdf_extraction_rows_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "public"."lab_pdf_extractions"("id");



ALTER TABLE ONLY "public"."lab_pdf_extractions"
    ADD CONSTRAINT "lab_pdf_extractions_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id");



ALTER TABLE ONLY "public"."lab_reference_ranges"
    ADD CONSTRAINT "lab_reference_ranges_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."lab_metric_definitions"("id");



ALTER TABLE ONLY "public"."lab_report_metrics"
    ADD CONSTRAINT "lab_report_metrics_lab_report_id_fkey" FOREIGN KEY ("lab_report_id") REFERENCES "public"."lab_reports"("id");



ALTER TABLE ONLY "public"."lab_report_metrics"
    ADD CONSTRAINT "lab_report_metrics_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."lab_metric_definitions"("id");



ALTER TABLE ONLY "public"."lab_reports"
    ADD CONSTRAINT "lab_reports_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."lab_reports"
    ADD CONSTRAINT "lab_reports_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id");



ALTER TABLE ONLY "public"."lab_reports"
    ADD CONSTRAINT "lab_reports_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."lab_reports"
    ADD CONSTRAINT "lab_reports_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."lab_results"
    ADD CONSTRAINT "lab_results_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id");



ALTER TABLE ONLY "public"."lab_results"
    ADD CONSTRAINT "lab_results_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "public"."lab_metric_definitions"("id");



ALTER TABLE ONLY "public"."manual_recommendations"
    ADD CONSTRAINT "manual_recommendations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."manual_recommendations"
    ADD CONSTRAINT "manual_recommendations_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "public"."lab_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."med_chunks"
    ADD CONSTRAINT "med_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."med_documents"("document_id");



ALTER TABLE ONLY "public"."medications"
    ADD CONSTRAINT "medications_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."memories"
    ADD CONSTRAINT "memories_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_admin_approved_by_fkey" FOREIGN KEY ("admin_approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_parent_order_id_fkey" FOREIGN KEY ("parent_order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."patient_form_requests"
    ADD CONSTRAINT "patient_form_requests_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_form_requests"
    ADD CONSTRAINT "patient_form_requests_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."patient_hormones"
    ADD CONSTRAINT "patient_hormones_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."patient_hormones"
    ADD CONSTRAINT "patient_hormones_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."patient_hormones"
    ADD CONSTRAINT "patient_hormones_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."patient_lifestyle"
    ADD CONSTRAINT "patient_lifestyle_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."patient_lifestyle"
    ADD CONSTRAINT "patient_lifestyle_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."patient_lifestyle"
    ADD CONSTRAINT "patient_lifestyle_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."patient_medical"
    ADD CONSTRAINT "patient_medical_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id");



ALTER TABLE ONLY "public"."patient_medical"
    ADD CONSTRAINT "patient_medical_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."patient_medical"
    ADD CONSTRAINT "patient_medical_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."patient_notes"
    ADD CONSTRAINT "patient_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."patient_prescriptions"
    ADD CONSTRAINT "patient_prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_prescriptions"
    ADD CONSTRAINT "patient_prescriptions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."patient_tags"
    ADD CONSTRAINT "patient_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."patient_tags"
    ADD CONSTRAINT "patient_tags_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."protocol_instances"
    ADD CONSTRAINT "protocol_instances_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."protocol_instances"
    ADD CONSTRAINT "protocol_instances_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "public"."treatment_protocols"("id");



ALTER TABLE ONLY "public"."protocol_instances"
    ADD CONSTRAINT "protocol_instances_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."protocol_steps"
    ADD CONSTRAINT "protocol_steps_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "public"."treatment_protocols"("id");



ALTER TABLE ONLY "public"."questionnaires"
    ADD CONSTRAINT "questionnaires_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."refill_tracks"
    ADD CONSTRAINT "refill_tracks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."refill_tracks"
    ADD CONSTRAINT "refill_tracks_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."reward_wallets"("id");



ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."shopify_customers"
    ADD CONSTRAINT "shopify_customers_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."side_effect_reports"
    ADD CONSTRAINT "side_effect_reports_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id");



ALTER TABLE ONLY "public"."side_effect_reports"
    ADD CONSTRAINT "side_effect_reports_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."side_effect_reports"
    ADD CONSTRAINT "side_effect_reports_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."staff_notes"
    ADD CONSTRAINT "staff_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."staff_notes"
    ADD CONSTRAINT "staff_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."symptoms"
    ADD CONSTRAINT "symptoms_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."symptoms"
    ADD CONSTRAINT "symptoms_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."treatments"
    ADD CONSTRAINT "treatments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."triage_decisions"
    ADD CONSTRAINT "triage_decisions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."triage_decisions"
    ADD CONSTRAINT "triage_decisions_questionnaire_id_fkey" FOREIGN KEY ("questionnaire_id") REFERENCES "public"."questionnaires"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."vitals"
    ADD CONSTRAINT "vitals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id");



ALTER TABLE ONLY "public"."vitals"
    ADD CONSTRAINT "vitals_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."treatments"("id");



ALTER TABLE ONLY "public"."webhook_error_details"
    ADD CONSTRAINT "webhook_error_details_activity_log_id_fkey" FOREIGN KEY ("activity_log_id") REFERENCES "public"."activity_log"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can delete client access" ON "public"."client_temp_access" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "Allow authenticated delete" ON "public"."manual_recommendations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated insert" ON "public"."manual_recommendations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read" ON "public"."manual_recommendations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update" ON "public"."manual_recommendations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can delete consultations" ON "public"."consultations" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete patient_hormones" ON "public"."patient_hormones" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete patient_lifestyle" ON "public"."patient_lifestyle" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete patient_medical" ON "public"."patient_medical" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete patient_notes" ON "public"."patient_notes" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete patient_tags" ON "public"."patient_tags" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can delete prescriptions" ON "public"."patient_prescriptions" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete staff_notes" ON "public"."staff_notes" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert cal_sync_log" ON "public"."cal_sync_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert checkins" ON "public"."checkins" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert consultations" ON "public"."consultations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert episode_items" ON "public"."episode_items" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert episodes" ON "public"."episodes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert goals" ON "public"."goals" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert memories" ON "public"."memories" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert milestones" ON "public"."milestones" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert orders" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert patient_hormones" ON "public"."patient_hormones" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert patient_lifestyle" ON "public"."patient_lifestyle" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert patient_medical" ON "public"."patient_medical" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert patient_notes" ON "public"."patient_notes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert patient_tags" ON "public"."patient_tags" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert patients" ON "public"."patients" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert prescriptions" ON "public"."patient_prescriptions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert protocol_instances" ON "public"."protocol_instances" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert questionnaires" ON "public"."questionnaires" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert refill_tracks" ON "public"."refill_tracks" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert reward_transactions" ON "public"."reward_transactions" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert reward_wallets" ON "public"."reward_wallets" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert staff_notes" ON "public"."staff_notes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert triage_decisions" ON "public"."triage_decisions" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can insert vitals" ON "public"."vitals" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can read activity_log" ON "public"."activity_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update cal_sync_log" ON "public"."cal_sync_log" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update checkins" ON "public"."checkins" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update episodes" ON "public"."episodes" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update goals" ON "public"."goals" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update memories" ON "public"."memories" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update milestones" ON "public"."milestones" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update orders" ON "public"."orders" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update patient_hormones" ON "public"."patient_hormones" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update patient_lifestyle" ON "public"."patient_lifestyle" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update patient_medical" ON "public"."patient_medical" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update patient_notes" ON "public"."patient_notes" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update patient_tags" ON "public"."patient_tags" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update patients" ON "public"."patients" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update prescriptions" ON "public"."patient_prescriptions" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update protocol_instances" ON "public"."protocol_instances" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update questionnaires" ON "public"."questionnaires" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update refill_tracks" ON "public"."refill_tracks" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update staff_notes" ON "public"."staff_notes" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view cal_sync_log" ON "public"."cal_sync_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view checkins" ON "public"."checkins" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view episode_items" ON "public"."episode_items" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view episodes" ON "public"."episodes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view goals" ON "public"."goals" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view memories" ON "public"."memories" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view milestones" ON "public"."milestones" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view orders" ON "public"."orders" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view patient_hormones" ON "public"."patient_hormones" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view patient_lifestyle" ON "public"."patient_lifestyle" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view patient_medical" ON "public"."patient_medical" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view patient_notes" ON "public"."patient_notes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view patient_tags" ON "public"."patient_tags" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view patients" ON "public"."patients" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view prescriptions" ON "public"."patient_prescriptions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view protocol_instances" ON "public"."protocol_instances" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view protocol_steps" ON "public"."protocol_steps" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view questionnaires" ON "public"."questionnaires" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view refill_tracks" ON "public"."refill_tracks" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view reward_transactions" ON "public"."reward_transactions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view reward_wallets" ON "public"."reward_wallets" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view staff_notes" ON "public"."staff_notes" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view treatment_protocols" ON "public"."treatment_protocols" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view triage_decisions" ON "public"."triage_decisions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view vitals" ON "public"."vitals" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view webhook error details" ON "public"."webhook_error_details" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Clients can view their own access" ON "public"."client_temp_access" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Doctors can create medications" ON "public"."medications" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_doctor"());



CREATE POLICY "Doctors can create treatments" ON "public"."treatments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_doctor"());



CREATE POLICY "Doctors can delete draft treatments" ON "public"."treatments" FOR DELETE TO "authenticated" USING (("public"."is_doctor"() AND ("status" = 'draft'::"text")));



CREATE POLICY "Doctors can delete medications" ON "public"."medications" FOR DELETE TO "authenticated" USING ("public"."is_doctor"());



CREATE POLICY "Doctors can insert protocol_steps" ON "public"."protocol_steps" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can insert side_effect_reports" ON "public"."side_effect_reports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can insert symptoms" ON "public"."symptoms" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can insert treatment_protocols" ON "public"."treatment_protocols" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can update medications" ON "public"."medications" FOR UPDATE TO "authenticated" USING ("public"."is_doctor"()) WITH CHECK ("public"."is_doctor"());



CREATE POLICY "Doctors can update protocol_steps" ON "public"."protocol_steps" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can update side_effect_reports" ON "public"."side_effect_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can update symptoms" ON "public"."symptoms" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can update treatment_protocols" ON "public"."treatment_protocols" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can update treatments" ON "public"."treatments" FOR UPDATE TO "authenticated" USING ("public"."is_doctor"()) WITH CHECK ("public"."is_doctor"());



CREATE POLICY "Doctors can view all medications" ON "public"."medications" FOR SELECT TO "authenticated" USING ("public"."is_doctor"());



CREATE POLICY "Doctors can view all treatments" ON "public"."treatments" FOR SELECT TO "authenticated" USING ("public"."is_doctor"());



CREATE POLICY "Doctors can view side_effect_reports" ON "public"."side_effect_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Doctors can view symptoms" ON "public"."symptoms" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'doctor'::"text")))));



CREATE POLICY "Only admins can insert users" ON "public"."users" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."role" = 'admin'::"text")))));



CREATE POLICY "Only admins can update users" ON "public"."users" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND ("users_1"."role" = 'admin'::"text")))));



CREATE POLICY "Patients can update own form requests" ON "public"."patient_form_requests" FOR UPDATE USING (("patient_id" IN ( SELECT "patients"."id"
   FROM "public"."patients"
  WHERE ("patients"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Patients can view own action_plans" ON "public"."action_plans" FOR SELECT USING (("patient_id" IN ( SELECT "patients"."id"
   FROM "public"."patients"
  WHERE ("patients"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Patients can view own form requests" ON "public"."patient_form_requests" FOR SELECT USING (("patient_id" IN ( SELECT "patients"."id"
   FROM "public"."patients"
  WHERE ("patients"."auth_user_id" = "auth"."uid"()))));



CREATE POLICY "Service role can insert activity_log" ON "public"."activity_log" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert webhook error details" ON "public"."webhook_error_details" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Staff and admin can create client access" ON "public"."client_temp_access" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff and admin can update client access" ON "public"."client_temp_access" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff and admin can view client access" ON "public"."client_temp_access" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff can delete action_plans" ON "public"."action_plans" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff can insert action_plans" ON "public"."action_plans" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff can insert form requests" ON "public"."patient_form_requests" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"])))));



CREATE POLICY "Staff can update action_plans" ON "public"."action_plans" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text"]))))));



CREATE POLICY "Staff can update form requests" ON "public"."patient_form_requests" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"])))));



CREATE POLICY "Staff can view all action_plans" ON "public"."action_plans" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"]))))));



CREATE POLICY "Staff can view all form requests" ON "public"."patient_form_requests" FOR SELECT USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"])))));



CREATE POLICY "Users can view all users" ON "public"."users" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."action_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_full" ON "public"."impersonation_allowed_users" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "admin_full" ON "public"."impersonation_audit_log" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "admin_full" ON "public"."impersonation_tokens" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = 'admin'::"text")))));



CREATE POLICY "authenticated users can manage shopify_customers" ON "public"."shopify_customers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can manage shopify_inventory_levels" ON "public"."shopify_inventory_levels" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can manage shopify_products" ON "public"."shopify_products" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can manage shopify_sync_log" ON "public"."shopify_sync_log" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can manage shopify_variants" ON "public"."shopify_variants" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated users can read shopify_customers" ON "public"."shopify_customers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can read shopify_inventory_levels" ON "public"."shopify_inventory_levels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can read shopify_products" ON "public"."shopify_products" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can read shopify_sync_log" ON "public"."shopify_sync_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated users can read shopify_variants" ON "public"."shopify_variants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."lab_metric_definitions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."lab_panel_metrics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."lab_reference_ranges" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."lab_sections" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."lab_test_panels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."med_chunks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read" ON "public"."med_documents" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cal_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_temp_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."episode_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."episodes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."escalations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."impersonation_allowed_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."impersonation_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."impersonation_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_aging_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_metric_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_panel_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_pdf_extraction_context_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_pdf_extraction_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_pdf_extractions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_reference_ranges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_report_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lab_test_panels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manual_recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."med_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."med_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."medications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_form_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_hormones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_lifestyle" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_medical" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "patient_own_data" ON "public"."lab_aging_scores" FOR SELECT TO "authenticated" USING ((("lab_report_id" IN ( SELECT "get_patient_lab_report_ids"."get_patient_lab_report_ids"
   FROM "private"."get_patient_lab_report_ids"() "get_patient_lab_report_ids"("get_patient_lab_report_ids"))) OR ("lab_order_id" IN ( SELECT "get_patient_lab_order_ids"."get_patient_lab_order_ids"
   FROM "private"."get_patient_lab_order_ids"() "get_patient_lab_order_ids"("get_patient_lab_order_ids")))));



CREATE POLICY "patient_own_data" ON "public"."lab_orders" FOR SELECT TO "authenticated" USING (("patient_id" IN ( SELECT "patients"."id"
   FROM "public"."patients"
  WHERE ("patients"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "patient_own_data" ON "public"."lab_report_metrics" FOR SELECT TO "authenticated" USING (("lab_report_id" IN ( SELECT "get_patient_lab_report_ids"."get_patient_lab_report_ids"
   FROM "private"."get_patient_lab_report_ids"() "get_patient_lab_report_ids"("get_patient_lab_report_ids"))));



CREATE POLICY "patient_own_data" ON "public"."lab_reports" FOR SELECT TO "authenticated" USING (("id" IN ( SELECT "get_patient_lab_report_ids"."get_patient_lab_report_ids"
   FROM "private"."get_patient_lab_report_ids"() "get_patient_lab_report_ids"("get_patient_lab_report_ids"))));



CREATE POLICY "patient_own_data" ON "public"."lab_results" FOR SELECT TO "authenticated" USING (("lab_order_id" IN ( SELECT "get_patient_lab_order_ids"."get_patient_lab_order_ids"
   FROM "private"."get_patient_lab_order_ids"() "get_patient_lab_order_ids"("get_patient_lab_order_ids"))));



ALTER TABLE "public"."patient_prescriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."protocol_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."protocol_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questionnaires" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."refill_tracks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service role can manage shopify_customers" ON "public"."shopify_customers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role can manage shopify_inventory_levels" ON "public"."shopify_inventory_levels" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role can manage shopify_products" ON "public"."shopify_products" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role can manage shopify_sync_log" ON "public"."shopify_sync_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service role can manage shopify_variants" ON "public"."shopify_variants" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."impersonation_allowed_users" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."impersonation_audit_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."impersonation_tokens" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_aging_scores" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_metric_definitions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_orders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_panel_metrics" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_reference_ranges" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_report_metrics" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_reports" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_results" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_sections" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."lab_test_panels" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."med_chunks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_full" ON "public"."med_documents" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopify_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopify_inventory_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopify_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopify_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopify_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."side_effect_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_read_all" ON "public"."lab_aging_scores" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"]))))));



CREATE POLICY "staff_read_all" ON "public"."lab_orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"]))))));



CREATE POLICY "staff_read_all" ON "public"."lab_report_metrics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"]))))));



CREATE POLICY "staff_read_all" ON "public"."lab_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"]))))));



CREATE POLICY "staff_read_all" ON "public"."lab_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."role" = ANY (ARRAY['admin'::"text", 'staff'::"text", 'doctor'::"text"]))))));



ALTER TABLE "public"."symptoms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatment_protocols" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."treatments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."triage_decisions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vitals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_error_details" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activity_log";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."advance_protocol_step"("p_patient_id" "uuid", "p_event" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."advance_protocol_step"("p_patient_id" "uuid", "p_event" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_protocol_step"("p_patient_id" "uuid", "p_event" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_adherence_score"("p_patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_adherence_score"("p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_adherence_score"("p_patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_goals"("p_patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_goals"("p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_goals"("p_patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_consultation_status_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_consultation_status_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_consultation_status_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_med_knowledge_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_med_knowledge_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_med_knowledge_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_revenue"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_revenue"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_revenue"("start_date" timestamp with time zone, "end_date" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_protocol_critical_info"("p_patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_protocol_critical_info"("p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_protocol_critical_info"("p_patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_protocol_instance"("p_patient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_protocol_instance"("p_patient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_protocol_instance"("p_patient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_vitals"("p_patient_id" "uuid", "p_metric" "text", "p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_vitals"("p_patient_id" "uuid", "p_metric" "text", "p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_vitals"("p_patient_id" "uuid", "p_metric" "text", "p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_treatment_approval_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_treatment_approval_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_treatment_approval_counts"("start_date" timestamp with time zone, "end_date" timestamp with time zone, "doctor_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";






GRANT ALL ON FUNCTION "public"."is_doctor"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_doctor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_doctor"() TO "service_role";









GRANT ALL ON FUNCTION "public"."update_consultation_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_consultation_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_consultation_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_escalation_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_escalation_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_escalation_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_reward_wallet_from_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_reward_wallet_from_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_reward_wallet_from_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_agentic"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_agentic"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_agentic"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";




































GRANT ALL ON TABLE "public"."action_plans" TO "anon";
GRANT ALL ON TABLE "public"."action_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."action_plans" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."cal_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."cal_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."cal_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."checkins" TO "anon";
GRANT ALL ON TABLE "public"."checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."checkins" TO "service_role";



GRANT ALL ON TABLE "public"."client_temp_access" TO "anon";
GRANT ALL ON TABLE "public"."client_temp_access" TO "authenticated";
GRANT ALL ON TABLE "public"."client_temp_access" TO "service_role";



GRANT ALL ON TABLE "public"."consultations" TO "anon";
GRANT ALL ON TABLE "public"."consultations" TO "authenticated";
GRANT ALL ON TABLE "public"."consultations" TO "service_role";



GRANT ALL ON TABLE "public"."episode_items" TO "anon";
GRANT ALL ON TABLE "public"."episode_items" TO "authenticated";
GRANT ALL ON TABLE "public"."episode_items" TO "service_role";



GRANT ALL ON TABLE "public"."episodes" TO "anon";
GRANT ALL ON TABLE "public"."episodes" TO "authenticated";
GRANT ALL ON TABLE "public"."episodes" TO "service_role";



GRANT ALL ON TABLE "public"."escalations" TO "anon";
GRANT ALL ON TABLE "public"."escalations" TO "authenticated";
GRANT ALL ON TABLE "public"."escalations" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_allowed_users" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_allowed_users" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_allowed_users" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."impersonation_tokens" TO "anon";
GRANT ALL ON TABLE "public"."impersonation_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."impersonation_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."lab_aging_scores" TO "anon";
GRANT ALL ON TABLE "public"."lab_aging_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_aging_scores" TO "service_role";



GRANT ALL ON TABLE "public"."lab_metric_definitions" TO "anon";
GRANT ALL ON TABLE "public"."lab_metric_definitions" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_metric_definitions" TO "service_role";



GRANT ALL ON TABLE "public"."lab_orders" TO "anon";
GRANT ALL ON TABLE "public"."lab_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_orders" TO "service_role";



GRANT ALL ON TABLE "public"."lab_panel_metrics" TO "anon";
GRANT ALL ON TABLE "public"."lab_panel_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_panel_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."lab_pdf_extraction_context_blocks" TO "anon";
GRANT ALL ON TABLE "public"."lab_pdf_extraction_context_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_pdf_extraction_context_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."lab_pdf_extraction_rows" TO "anon";
GRANT ALL ON TABLE "public"."lab_pdf_extraction_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_pdf_extraction_rows" TO "service_role";



GRANT ALL ON TABLE "public"."lab_pdf_extractions" TO "anon";
GRANT ALL ON TABLE "public"."lab_pdf_extractions" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_pdf_extractions" TO "service_role";



GRANT ALL ON TABLE "public"."lab_reference_ranges" TO "anon";
GRANT ALL ON TABLE "public"."lab_reference_ranges" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_reference_ranges" TO "service_role";



GRANT ALL ON TABLE "public"."lab_report_metrics" TO "anon";
GRANT ALL ON TABLE "public"."lab_report_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_report_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."lab_reports" TO "anon";
GRANT ALL ON TABLE "public"."lab_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_reports" TO "service_role";



GRANT ALL ON TABLE "public"."lab_results" TO "anon";
GRANT ALL ON TABLE "public"."lab_results" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_results" TO "service_role";



GRANT ALL ON TABLE "public"."lab_sections" TO "anon";
GRANT ALL ON TABLE "public"."lab_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_sections" TO "service_role";



GRANT ALL ON TABLE "public"."lab_test_panels" TO "anon";
GRANT ALL ON TABLE "public"."lab_test_panels" TO "authenticated";
GRANT ALL ON TABLE "public"."lab_test_panels" TO "service_role";



GRANT ALL ON TABLE "public"."manual_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."manual_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."manual_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."med_chunks" TO "anon";
GRANT ALL ON TABLE "public"."med_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."med_chunks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."med_chunks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."med_chunks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."med_chunks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."med_documents" TO "anon";
GRANT ALL ON TABLE "public"."med_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."med_documents" TO "service_role";



GRANT ALL ON TABLE "public"."medications" TO "anon";
GRANT ALL ON TABLE "public"."medications" TO "authenticated";
GRANT ALL ON TABLE "public"."medications" TO "service_role";



GRANT ALL ON TABLE "public"."memories" TO "anon";
GRANT ALL ON TABLE "public"."memories" TO "authenticated";
GRANT ALL ON TABLE "public"."memories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."memories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."memories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."memories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."milestones" TO "anon";
GRANT ALL ON TABLE "public"."milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."milestones" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."patient_form_requests" TO "anon";
GRANT ALL ON TABLE "public"."patient_form_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_form_requests" TO "service_role";



GRANT ALL ON TABLE "public"."patient_hormones" TO "anon";
GRANT ALL ON TABLE "public"."patient_hormones" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_hormones" TO "service_role";



GRANT ALL ON TABLE "public"."patient_lifestyle" TO "anon";
GRANT ALL ON TABLE "public"."patient_lifestyle" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_lifestyle" TO "service_role";



GRANT ALL ON TABLE "public"."patient_medical" TO "anon";
GRANT ALL ON TABLE "public"."patient_medical" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_medical" TO "service_role";



GRANT ALL ON TABLE "public"."patient_notes" TO "anon";
GRANT ALL ON TABLE "public"."patient_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_notes" TO "service_role";



GRANT ALL ON TABLE "public"."patient_prescriptions" TO "anon";
GRANT ALL ON TABLE "public"."patient_prescriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_prescriptions" TO "service_role";



GRANT ALL ON TABLE "public"."patient_tags" TO "anon";
GRANT ALL ON TABLE "public"."patient_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_tags" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."protocol_instances" TO "anon";
GRANT ALL ON TABLE "public"."protocol_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."protocol_instances" TO "service_role";



GRANT ALL ON TABLE "public"."protocol_steps" TO "anon";
GRANT ALL ON TABLE "public"."protocol_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."protocol_steps" TO "service_role";



GRANT ALL ON TABLE "public"."questionnaires" TO "anon";
GRANT ALL ON TABLE "public"."questionnaires" TO "authenticated";
GRANT ALL ON TABLE "public"."questionnaires" TO "service_role";



GRANT ALL ON TABLE "public"."refill_tracks" TO "anon";
GRANT ALL ON TABLE "public"."refill_tracks" TO "authenticated";
GRANT ALL ON TABLE "public"."refill_tracks" TO "service_role";



GRANT ALL ON TABLE "public"."reward_transactions" TO "anon";
GRANT ALL ON TABLE "public"."reward_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."reward_wallets" TO "anon";
GRANT ALL ON TABLE "public"."reward_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_customers" TO "anon";
GRANT ALL ON TABLE "public"."shopify_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_customers" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_inventory_levels" TO "anon";
GRANT ALL ON TABLE "public"."shopify_inventory_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_inventory_levels" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_products" TO "anon";
GRANT ALL ON TABLE "public"."shopify_products" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_products" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."shopify_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."shopify_variants" TO "anon";
GRANT ALL ON TABLE "public"."shopify_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."shopify_variants" TO "service_role";



GRANT ALL ON TABLE "public"."side_effect_reports" TO "anon";
GRANT ALL ON TABLE "public"."side_effect_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."side_effect_reports" TO "service_role";



GRANT ALL ON TABLE "public"."staff_notes" TO "anon";
GRANT ALL ON TABLE "public"."staff_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_notes" TO "service_role";



GRANT ALL ON TABLE "public"."symptoms" TO "anon";
GRANT ALL ON TABLE "public"."symptoms" TO "authenticated";
GRANT ALL ON TABLE "public"."symptoms" TO "service_role";



GRANT ALL ON TABLE "public"."treatment_protocols" TO "anon";
GRANT ALL ON TABLE "public"."treatment_protocols" TO "authenticated";
GRANT ALL ON TABLE "public"."treatment_protocols" TO "service_role";



GRANT ALL ON TABLE "public"."treatments" TO "anon";
GRANT ALL ON TABLE "public"."treatments" TO "authenticated";
GRANT ALL ON TABLE "public"."treatments" TO "service_role";



GRANT ALL ON TABLE "public"."triage_decisions" TO "anon";
GRANT ALL ON TABLE "public"."triage_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."triage_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vitals" TO "anon";
GRANT ALL ON TABLE "public"."vitals" TO "authenticated";
GRANT ALL ON TABLE "public"."vitals" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_error_details" TO "anon";
GRANT ALL ON TABLE "public"."webhook_error_details" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_error_details" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































