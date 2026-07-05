-- The application connects at runtime as `hrms_app`, a non-owner role, so that
-- Postgres RLS policies actually apply (RLS is bypassed for table owners and
-- superusers, which `postgres` — the migration role — is). This role and its
-- grants were originally created by hand outside of migration history, which
-- meant a `prisma migrate reset` silently wiped them (discovered the hard way
-- when the running app started getting "permission denied for schema public").
-- Baking it into a tracked migration so it can never be silently lost again.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hrms_app') THEN
    CREATE ROLE hrms_app LOGIN PASSWORD 'hrms_app_pw_temp_2026';
  END IF;
END $$;

GRANT CONNECT ON DATABASE hrms TO hrms_app;
GRANT USAGE ON SCHEMA public TO hrms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hrms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hrms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hrms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hrms_app;
