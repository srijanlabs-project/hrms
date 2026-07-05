# Security Notes

Living log of security findings from ongoing review passes. Items here are either
(a) deferred because they need real infrastructure this dev environment doesn't have,
or (b) deliberately left for a future pass with the reasoning documented so nobody
re-discovers the same gap from scratch.

## 2026-07 review pass

### Fixed in this pass
- **OTP request flooding** (`src/auth/auth.service.ts`): `/auth/otp/request` had no
  throttle at all — a client could spam it to burn SMS-provider budget or use response
  timing to fingerprint which mobile numbers exist in the system. Added a 30-second
  per-mobile-number cooldown keyed off `OtpChallenge.createdAt` (`OTP_REQUEST_TOO_SOON`
  error code). This is app-level and per-process; see "Not fixed" below for why it's
  not a full defense.

### Reviewed, found sound (no change needed)
- `MAX_OTP_ATTEMPTS` enforcement in `AuthService.verifyOtp`: attempts are checked
  *before* the hash comparison and incremented only on mismatch — no bypass found.
- JWT secrets: sourced from `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` env vars only,
  confirmed distinct values, never hardcoded.
- `PrismaService.withLoginLookup` / the `app.login_lookup` RLS escape hatch
  (migration `20260704210000_login_lookup_policy`): confirmed narrowly scoped — it's
  one additional `OR` clause on the `users` table's `USING` policy only, set via
  `set_config(..., true)` (transaction-local, auto-reverts), and there is no matching
  `WITH CHECK` relaxation, so it cannot be used to write/impersonate — only to resolve
  identity by mobile/email pre-tenant-context at login. No other table references it.
- Biometric device webhook (`src/attendance/attendance.controller.ts`): device API
  key is never logged (only `dto.deviceId` and event payloads are); comparison goes
  through `verifyPassword`, which uses `timingSafeEqual` — same helper used for user
  passwords, so the device-key path gets the same timing-attack resistance.
- No `$executeRawUnsafe` / `$queryRawUnsafe` usage anywhere in `src/` — grepped
  clean. All raw SQL in migrations uses parameterized `set_config(..., $1, true)` or
  is static DDL; the one dynamic-identifier use (`EXECUTE format('ALTER TABLE %I ...', t)`
  in the RLS migration) interpolates a fixed, hardcoded array of table names, not
  user input.

### Not fixed — needs real infrastructure or is out of this session's scope
- **OTP throttle is in-process/DB-based, not IP-based.** It stops rapid-fire OTP
  requests *for the same mobile number* but does nothing to stop one attacker IP
  hammering many different numbers, or a distributed attack. A real fix needs either
  an API gateway/WAF with IP-based rate limiting, or a Redis-backed sliding-window
  limiter — neither is available in this dev setup. Recommend adding `@nestjs/throttler`
  with a Redis store (or a managed WAF like Cloudflare in front of prod) before this
  goes to real users at scale.
- **Payslip disbursement file exposes bank account numbers as a base64 data URI.**
  `PayrollService.generateDisbursementFile` (`src/payroll/payroll.service.ts`) builds
  a CSV with `account_number,ifsc` per employee and stores it inline as
  `data:text/csv;base64,...` directly on `PayrollRun.disbursementFileUrl` — readable
  by anyone who can read that row/field (any HR Admin/Finance session, and anyone
  with DB access). This is fine as a *placeholder* for a real bank NEFT/RTGS format
  (per the code's own comment) but is a real PII/financial-data exposure risk before
  production: at minimum it should (1) be written to object storage (R2/S3-equivalent)
  behind a short-lived signed URL rather than embedded in an API response body, and
  (2) never be returned to a `GET` list endpoint's default field set. Left unfixed
  this pass — it's Payroll module territory, and a different agent may already be
  touching that module's schema; flagging here instead of risking a merge conflict.
- **`EditPayslipDto.lineItems` (raw `object`) and `CreateSalaryStructureDto.components`
  (raw `unknown[]`)** in `src/payroll/dto/payroll.dto.ts` accept arbitrary JSON shape
  with no `class-validator` shape validation — a malformed or oversized payload would
  reach the DB layer unchecked. Not fixed here (Payroll module is out of this
  session's scope) — flagging for whoever next touches Payroll DTOs.
- **No dedicated least-privilege Postgres role check for `prisma migrate`.** The RLS
  migration comment already notes RLS is `ENABLE`d but not `FORCE`d, because the
  migration role is the table owner and `FORCE ROW LEVEL SECURITY` would break
  `prisma migrate` unless a separate non-owner app role exists. `RUNTIME_DATABASE_URL`
  in `.env.example` already documents the intent to use a separate `hrms_app` role at
  runtime — confirm in each environment (especially prod) that the role behind
  `RUNTIME_DATABASE_URL` is genuinely not the table owner and has no `BYPASSRLS`
  attribute, or every tenant-isolation policy in this file is decorative.
- **No refresh-token revocation/denylist.** `AuthController.logout` is a no-op
  (stateless JWTs, client discards them) — a stolen refresh token remains valid for
  its full `JWT_REFRESH_EXPIRY` (30d default) even after "logout." Existing code
  comment already flags this as a known fast-follow. Given 30-day refresh tokens plus
  salary/PII data, recommend prioritizing a denylist table (or shortening
  `JWT_REFRESH_EXPIRY`) sooner rather than later.
- **Suggested index** (not applied — schema.prisma is off-limits to me this session
  per orchestration rules; only the architecture-review agent may edit it): consider
  `@@index([mobileNumber, createdAt])` on `OtpChallenge` to keep the new cooldown
  lookup (`findFirst` ordered by `createdAt desc` filtered by `mobileNumber`) fast at
  scale — today's `@@index([mobileNumber])` alone means Postgres still sorts by
  `createdAt` without an index assist once a number has many historical rows.

## 2026-07 module build — Assets / Exit / Engagement

- Anonymous survey responses: `SurveyResponse.employeeId` is only ever set when
  `survey.isAnonymous === false`; `SurveyHasResponded` (duplicate/rate tracking) is
  never joined back to `SurveyResponse` in either direction anywhere in
  `src/engagement/engagement.service.ts` — verified by re-reading the create-response
  method after writing it. See that file's top-of-class comment for the exact
  invariant.
- `GET surveys/:id/results` returns aggregates only (rating/NPS averages, shuffled
  free-text arrays) — there is no per-employee mapping returned for any survey,
  anonymous or not, by design (not just for anonymous ones), since even a named
  survey's raw per-response text could be sensitive and the spec only asked for
  aggregates.
- Recognition `visibility: manager_only` entries are filtered out in the service
  layer (not just the controller) for callers who aren't Manager/HR Admin, so a
  future new controller/endpoint reusing the service method doesn't accidentally
  leak them.
