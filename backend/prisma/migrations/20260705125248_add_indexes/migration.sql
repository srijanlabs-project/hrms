-- Architecture review follow-up: tenant_id-leading composite indexes on hot
-- lookup paths that previously relied on the PK or an unrelated @@unique only.
--
-- NOTE: `prisma migrate diff` also emitted two ALTER COLUMN statements re-typing
-- leave_balances.balance and performance_reviews.final_rating — those are Prisma
-- mis-diffing the Unsupported("decimal(...)")-typed GENERATED ALWAYS columns from
-- migration 20260704202858 as plain columns needing a type/default change. That
-- is a known false positive (no real column change is needed or wanted — the
-- columns are Postgres-computed and untouched here); the statements were
-- deliberately dropped from this migration.

CREATE INDEX "employees_tenant_id_employment_status_idx" ON "employees"("tenant_id", "employment_status");
CREATE INDEX "employees_tenant_id_manager_id_idx" ON "employees"("tenant_id", "manager_id");
CREATE INDEX "employees_tenant_id_department_id_idx" ON "employees"("tenant_id", "department_id");

CREATE INDEX "attendance_records_tenant_id_employee_id_date_idx" ON "attendance_records"("tenant_id", "employee_id", "date");

CREATE INDEX "leave_balances_tenant_id_employee_id_idx" ON "leave_balances"("tenant_id", "employee_id");

CREATE INDEX "leave_requests_tenant_id_employee_id_status_idx" ON "leave_requests"("tenant_id", "employee_id", "status");
CREATE INDEX "leave_requests_employee_id_status_start_date_end_date_idx" ON "leave_requests"("employee_id", "status", "start_date", "end_date");

CREATE INDEX "employee_compensations_tenant_id_employee_id_idx" ON "employee_compensations"("tenant_id", "employee_id");

CREATE INDEX "payslips_tenant_id_employee_id_idx" ON "payslips"("tenant_id", "employee_id");

CREATE INDEX "loan_advances_employee_id_status_type_idx" ON "loan_advances"("employee_id", "status", "type");

CREATE INDEX "job_requisitions_tenant_id_status_idx" ON "job_requisitions"("tenant_id", "status");

CREATE INDEX "candidates_tenant_id_requisition_id_idx" ON "candidates"("tenant_id", "requisition_id");
CREATE INDEX "candidates_tenant_id_current_stage_idx" ON "candidates"("tenant_id", "current_stage");

CREATE INDEX "approval_instances_tenant_id_status_idx" ON "approval_instances"("tenant_id", "status");
