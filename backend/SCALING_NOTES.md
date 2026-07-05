# Scaling Notes

Written during the architecture review pass (2026-07-05). These are structural
observations that are safe to ship as-is today but will need real work before
the platform is running large tenants (roughly: hundreds of employees per
tenant, or thousands of tenants). None of these are bugs — they're "this will
fall over eventually, here's the shape of the fix" notes so nobody has to
re-derive them from scratch under pressure later.

## 1. Payroll run processing is O(employees) synchronous work inside one DB transaction

`PayrollService.processRun()` (`src/payroll/payroll.service.ts`) loops over every
active employee in the tenant and, for each one, does ~10 sequential queries
(compensation lookup, attendance aggregate, statutory param lookup, PT slab
lookup, TDS slab lookup, loan updates, payslip upsert, deduction row inserts) —
all inside a single `withTenant` transaction that stays open for the entire
run.

This is correct (atomic: either the whole run processes or none of it does)
but doesn't scale:
- A single Postgres transaction held open for the duration of processing N
  employees means row/table locks are held that long, and a connection is tied
  up the whole time. At a few hundred employees this is already
  multi-second-to-minutes; at a few thousand it risks hitting
  `statement_timeout`/`idle_in_transaction_session_timeout` or exhausting the
  connection pool if two large tenants run payroll simultaneously.
- `attendance.getMonthlyAggregate()` is called once per employee per run and
  itself does a `findMany` over the whole month's attendance rows — that's
  fine per-call, but it means payroll's total DB round-trips scale as
  O(employees) rather than being batchable.

**Recommended direction (not done here):** Move `processRun` to a BullMQ job
(already a project dependency, currently unused) that processes employees in
bounded batches, each batch in its own short transaction, with the
`PayrollRun` row's status tracking overall progress instead of one giant
transaction. `processEmployeePayslip` is already a clean per-employee unit —
it just needs to be invoked from a queue worker instead of a `for` loop inside
one transaction. Keep the current synchronous path for small tenants /
dev/test if desired, but gate the queued path in behind employee count.

## 2. Attendance nightly finalization and leave monthly accrual are per-tenant, per-employee sequential loops

`AttendanceService.nightlyFinalization()` and `LeaveService.monthlyAccrualJob()`
(both `@Cron`, running once daily across ALL tenants via `withoutTenantScope`)
loop over every non-exited employee across the whole platform, doing several
queries per employee (shift policy resolution, holiday lookup, balance
upsert). Same shape of issue as payroll: correct today, but is an unbounded
single-transaction-or-single-process loop that grows linearly with total
platform employee count, not per-tenant count. A platform with many small
tenants will feel this before any single tenant does.

**Recommended direction:** Same as above — batch by tenant (or by employee
page) and consider moving off `@Cron` on the monolith into a queued job so a
slow night for one large tenant doesn't delay the sweep for others. Low
priority vs. #1 since these are background jobs with no user waiting on them
synchronously, but worth remembering before the employee count assumption
gets tested by a real customer.

## 3. `ApprovalsService.escalateOverdueSteps` — same pattern, smaller blast radius

Hourly cron, loops over all pending `ApprovalInstance` rows per tenant with a
`findMany` + per-row conditional update. Added a `[tenantId, status]` index in
this pass (see migration `20260705125248_add_indexes`) so the base lookup is
no longer a sequential scan, but the per-row escalation logic itself is still
a loop. Given escalation windows are hours, not minutes, this is low risk
until pending-approval volume is very large; noting it for completeness
rather than recommending immediate action.

## 4. RLS is enabled, not forced

Documented already in the RLS migration's own comments
(`prisma/migrations/20260704202858_rls_and_generated_columns/migration.sql`):
Postgres RLS `FORCE` was deliberately not applied because the historical
migration-owner role and the runtime role were the same at that point. This
has since been separated (`DATABASE_URL` = table-owning role used only by
Prisma Migrate; `RUNTIME_DATABASE_URL` = `hrms_app`, a non-owner role used by
the running app — see `src/common/prisma/prisma.service.ts` and `.env`), which
is exactly the precondition the migration's comment says to wait for. RLS is
already effective for the app today because it never connects as the owner.
Confirmed this is fine as-is; flagging only because "enabled but not forced"
reads alarming out of context and someone should double check the
`hrms_app` role's grants stay non-owner as the schema evolves (a future
migration or manual `GRANT` that accidentally makes `hrms_app` the owner of a
new table would silently reopen the RLS bypass for that one table).

## 5. Payroll disbursement file is a stub

`PayrollService.generateDisbursementFile()` produces a generic CSV
(beneficiary/account/IFSC/amount/narration) as a base64 data URL — there is no
real bank-specific NEFT/RTGS bulk file format wired up, by design (per the
Payroll spec, this is meant to be pluggable per bank, and no specific bank
integration exists yet to build against). Not a scaling issue, just recording
it here since it's the kind of gap that's easy to forget about once payroll
"works" in demos.

## What was fixed instead of deferred (context for the above)

The cheap, safe items from this review were applied directly rather than
noted here:
- Missing tenant-scoped composite indexes (migration `20260705125248_add_indexes`)
  on `employees`, `attendance_records`, `leave_balances`, `leave_requests`,
  `employee_compensations`, `payslips`, `loan_advances`, `job_requisitions`,
  `candidates`, `approval_instances` — all of which previously relied on a PK
  or an unrelated `@@unique` for lookups that are actually filtered by
  `tenant_id` + a second column.
- RLS coverage was spot-checked table-by-table against `schema.prisma`'s full
  `@@map` list (52 tables) rather than assumed correct: 5 tenant-independent
  tables (tenant itself, `otp_challenges`, the 3 statutory reference tables),
  `users`/`roles` (nullable tenant_id, handled explicitly), the 36-table direct
  `tenant_id` policy loop, and 9 child-table policies scoped via a parent FK —
  all 52 accounted for, including Recruitment's `job_requisitions`,
  `candidates`, `interview_feedback`, `offers`. No gap found.
- Transaction boundaries were checked across Attendance, Leave, Payroll,
  Approvals, Employee Core, and Recruitment services — every multi-step write
  already goes through `withTenant`/`withoutTenantScope`; no sequential
  non-transactional writes found that could leave partial state on failure.
- AppErrors usage was checked platform-wide — the only raw `throw new Error(...)`
  in `src/` is a defensive assertion in `PrismaService.withTenant()` guarding
  against a programmer error (calling it without a tenantId), which is
  correctly not a domain-facing AppError.
