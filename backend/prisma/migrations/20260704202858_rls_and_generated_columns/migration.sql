-- ============================================================================
-- Generated (computed) columns
-- These are real Postgres GENERATED ALWAYS ... STORED columns, per the module
-- specs' explicit requirement that they "cannot drift" from application logic.
-- Prisma schema declares them as plain fields — application code must never
-- write to them directly (Prisma Client will still let you try; don't).
-- ============================================================================

ALTER TABLE "leave_balances"
  ADD COLUMN "balance" DECIMAL(6,2) GENERATED ALWAYS AS
    (opening_balance + accrued + adjusted - used) STORED;

ALTER TABLE "performance_reviews"
  ADD COLUMN "final_rating" DECIMAL(2,1) GENERATED ALWAYS AS
    (COALESCE(calibrated_rating, manager_rating)) STORED;

-- ============================================================================
-- Partial unique indexes (an active/current row per parent, not per all-time)
-- ============================================================================

CREATE UNIQUE INDEX "employee_compensations_active_unique"
  ON "employee_compensations" ("employee_id")
  WHERE "effective_to" IS NULL;

CREATE UNIQUE INDEX "asset_allocations_active_unique"
  ON "asset_allocations" ("asset_id")
  WHERE "returned_on" IS NULL;

-- ============================================================================
-- Row-level security
-- app.current_tenant_id is set per-request-scoped transaction by the tenant
-- context middleware (src/common/tenant) from the authenticated JWT — it is
-- never accepted as a client-supplied parameter (Engineering Spec §6, and
-- repeated per-module in Attendance/Leave/Payroll §7/§10).
--
-- Enabled but NOT forced: the application's Postgres role is not the table
-- owner, so RLS already applies to it; FORCE would additionally restrict the
-- owner/migration role itself, which would break `prisma migrate` unless a
-- separate non-owner app role is introduced. Revisit when a dedicated
-- least-privilege app DB role is set up (tracked as a follow-up).
-- ============================================================================

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
      t
    );
  END LOOP;
END $$;

-- Tables with a NULLABLE tenant_id (platform-admin users / system roles have none)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR tenant_id IS NULL);

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR tenant_id IS NULL);

-- Child tables scoped via their parent's tenant_id (no direct column, to avoid
-- a duplicated/denormalized tenant_id that could silently drift from the parent)
ALTER TABLE "statutory_deductions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "statutory_deductions"
  USING (payslip_id IN (SELECT id FROM payslips WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "interview_feedback" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "interview_feedback"
  USING (candidate_id IN (SELECT id FROM candidates WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "offers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "offers"
  USING (candidate_id IN (SELECT id FROM candidates WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "performance_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "performance_reviews"
  USING (cycle_id IN (SELECT id FROM review_cycles WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "clearance_tasks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "clearance_tasks"
  USING (exit_request_id IN (SELECT id FROM exit_requests WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "exit_interviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exit_interviews"
  USING (exit_request_id IN (SELECT id FROM exit_requests WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "survey_responses" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "survey_responses"
  USING (survey_id IN (SELECT id FROM surveys WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "survey_has_responded" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "survey_has_responded"
  USING (survey_id IN (SELECT id FROM surveys WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));

ALTER TABLE "biometric_user_mappings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "biometric_user_mappings"
  USING (biometric_device_id IN (SELECT id FROM biometric_devices WHERE tenant_id = current_setting('app.current_tenant_id', true)::uuid));
