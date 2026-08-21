-- Stage 5: bounded database defaults for the agent-backend migration/runtime role.
--
-- These defaults apply only to new database sessions established after commit.
-- Deployment must gracefully recycle the application pool and Supavisor backend connections
-- before verification, without terminating sessions from this migration.
-- POSTFLIGHT-CONTRACT: recycle=application_pool,supavisor_backend; new_connection_samples=3
-- Postflight requires at least three new connections.
-- Sample SHOW statement_timeout and SHOW idle_in_transaction_session_timeout on each, then
-- inspect pg_roles.rolconfig for these exact entries:
--   statement_timeout=30s
--   idle_in_transaction_session_timeout=30s
-- Do not restart PostgreSQL; use only the supported application/pooler connection lifecycle.

DO $role_guard$
BEGIN
	IF current_user <> 'postgres' THEN
		RAISE EXCEPTION
			'0160_agent_backend_role_timeouts.sql must run after SET ROLE postgres (current_user=%)',
			current_user;
	END IF;
END
$role_guard$;

ALTER ROLE postgres SET statement_timeout = '30s';
ALTER ROLE postgres SET idle_in_transaction_session_timeout = '30s';
