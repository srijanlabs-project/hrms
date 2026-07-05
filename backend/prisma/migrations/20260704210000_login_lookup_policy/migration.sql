-- Login (OTP or email+password) must resolve a User by mobile_number/email
-- BEFORE the caller's tenant is known — the normal tenant_isolation policy on
-- "users" would hide every tenant-scoped row at that point. Rather than widen
-- tenant_isolation broadly, add one narrow, explicitly-named OR clause that
-- only opens up when the auth module sets app.login_lookup='true' for the
-- duration of a single transaction (see PrismaService.withLoginLookup). No
-- other table gets this exception, and it never widens write access.
DROP POLICY IF EXISTS tenant_isolation ON "users";
CREATE POLICY tenant_isolation ON "users"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::uuid
    OR tenant_id IS NULL
    OR current_setting('app.login_lookup', true) = 'true'
  );
