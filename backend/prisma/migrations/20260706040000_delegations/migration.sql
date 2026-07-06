-- (Prisma's auto-diff also proposed touching leave_balances.balance and
-- performance_reviews.final_rating here — removed, see the recurring note in
-- earlier migrations: those are real Postgres GENERATED ALWAYS columns typed
-- Unsupported(...) in schema.prisma, this is a known false-positive.)

-- CreateTable
CREATE TABLE "delegations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "delegator_employee_id" UUID NOT NULL,
    "delegate_employee_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delegations_tenant_id_idx" ON "delegations"("tenant_id");
CREATE INDEX "delegations_delegator_employee_id_idx" ON "delegations"("delegator_employee_id");

ALTER TABLE "delegations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "delegations" USING (tenant_id = current_tenant_id());
