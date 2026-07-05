-- No-op. Prisma's auto-diff originally generated ALTER statements here trying to
-- convert leave_balances.balance / performance_reviews.final_rating back into
-- plain columns — both are real Postgres GENERATED ALWAYS columns (see migration
-- 20260704202858) and are now typed Unsupported(...) in schema.prisma specifically
-- so Prisma's diff engine leaves them alone from here on.
SELECT 1;
