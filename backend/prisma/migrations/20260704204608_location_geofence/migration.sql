-- AlterTable
-- (Prisma's auto-diff also proposed touching leave_balances.balance and
-- performance_reviews.final_rating here — removed. Those are real Postgres
-- GENERATED ALWAYS columns; Prisma's schema-diff doesn't know that and would
-- otherwise try to convert them back to plain columns. See migration
-- 20260704202858_rls_and_generated_columns for where they're actually defined.)
ALTER TABLE "locations" ADD COLUMN     "geofence_latitude" DECIMAL(9,6),
ADD COLUMN     "geofence_longitude" DECIMAL(9,6),
ADD COLUMN     "geofence_radius_meters" INTEGER;
