-- BUG FOUND IN PRODUCTION-EQUIVALENT TESTING: Postgres's set_config(key, value,
-- true) (transaction-LOCAL) reverts a custom GUC that had no prior value to an
-- EMPTY STRING when the transaction commits — not NULL. Confirmed directly:
--   BEGIN; SELECT set_config('app.current_tenant_id', '<real-uuid>', true); COMMIT;
--   SELECT current_setting('app.current_tenant_id', true); -- returns '' , not NULL
--
-- Under Prisma's connection pooling, this means: once ANY pooled connection has
-- handled ONE withTenant() call, every LATER transaction reusing that same raw
-- connection inherits app.current_tenant_id = '' unless it also calls
-- withTenant() itself. Every RLS policy of the form
--   tenant_id = current_setting('app.current_tenant_id', true)::uuid
-- then throws `invalid input syntax for type uuid: ""` — and because Postgres
-- does NOT guarantee short-circuit evaluation of OR, this breaks even policies
-- like the users table's login-lookup OR clause, where the OTHER branch would
-- have been true. This is systemic: it can hit ANY tenant-scoped table's RLS
-- policy, any time a request lands on a "used" pooled connection — not just
-- login. Root-caused after seed-workflows-continue3.ts intermittently hit this
-- on /auth/otp/verify.
--
-- Fix: a single safe accessor function that coalesces '' to NULL before
-- casting, and repoint every existing tenant_isolation policy at it.
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$ LANGUAGE sql STABLE;

-- Tables with a direct, NOT NULL tenant_id column
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments', 'designations', 'locations', 'holidays', 'employees',
    'employee_bank_accounts', 'documents', 'audit_logs',
    'approval_chains', 'approval_instances',
    'shift_policies', 'attendance_records', 'regularization_requests', 'biometric_devices',
    'leave_types', 'leave_balances', 'leave_requests',
    'salary_structures', 'employee_compensations', 'payroll_runs', 'payslips', 'loan_advances',
    'job_requisitions', 'candidates',
    'goals', 'review_cycles',
    'courses', 'training_assignments', 'certifications',
    'assets', 'asset_allocations', 'it_access_requests',
    'exit_requests',
    'announcements', 'recognitions', 'surveys'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_tenant_id())', t);
  END LOOP;
END $$;

-- Tables with a NULLABLE tenant_id (platform-admin users / system roles have none)
DROP POLICY IF EXISTS tenant_isolation ON "users";
CREATE POLICY tenant_isolation ON "users"
  USING (
    tenant_id = current_tenant_id()
    OR tenant_id IS NULL
    OR current_setting('app.login_lookup', true) = 'true'
  );

DROP POLICY IF EXISTS tenant_isolation ON "roles";
CREATE POLICY tenant_isolation ON "roles"
  USING (tenant_id = current_tenant_id() OR tenant_id IS NULL);

-- Child tables scoped via their parent's tenant_id
DROP POLICY IF EXISTS tenant_isolation ON "statutory_deductions";
CREATE POLICY tenant_isolation ON "statutory_deductions"
  USING (payslip_id IN (SELECT id FROM payslips WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "interview_feedback";
CREATE POLICY tenant_isolation ON "interview_feedback"
  USING (candidate_id IN (SELECT id FROM candidates WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "offers";
CREATE POLICY tenant_isolation ON "offers"
  USING (candidate_id IN (SELECT id FROM candidates WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "performance_reviews";
CREATE POLICY tenant_isolation ON "performance_reviews"
  USING (cycle_id IN (SELECT id FROM review_cycles WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "clearance_tasks";
CREATE POLICY tenant_isolation ON "clearance_tasks"
  USING (exit_request_id IN (SELECT id FROM exit_requests WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "exit_interviews";
CREATE POLICY tenant_isolation ON "exit_interviews"
  USING (exit_request_id IN (SELECT id FROM exit_requests WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "survey_responses";
CREATE POLICY tenant_isolation ON "survey_responses"
  USING (survey_id IN (SELECT id FROM surveys WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "survey_has_responded";
CREATE POLICY tenant_isolation ON "survey_has_responded"
  USING (survey_id IN (SELECT id FROM surveys WHERE tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS tenant_isolation ON "biometric_user_mappings";
CREATE POLICY tenant_isolation ON "biometric_user_mappings"
  USING (biometric_device_id IN (SELECT id FROM biometric_devices WHERE tenant_id = current_tenant_id()));
