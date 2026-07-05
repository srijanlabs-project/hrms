-- AlterTable
-- (Prisma's auto-diff also proposed touching leave_balances.balance and
-- performance_reviews.final_rating here — removed; those are real Postgres
-- GENERATED ALWAYS columns typed Unsupported(...) in schema.prisma, see
-- migration 20260704202858_rls_and_generated_columns.)
ALTER TABLE "employees" ADD COLUMN     "aadhaar_number" TEXT,
ADD COLUMN     "pan_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employees_pan_number_key" ON "employees"("pan_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_aadhaar_number_key" ON "employees"("aadhaar_number");
