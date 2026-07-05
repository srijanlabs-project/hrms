import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

type TenantTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Every tenant-scoped query MUST go through withTenant(), which sets
 * app.current_tenant_id via a parameterized set_config() call inside a
 * transaction (reverts automatically at transaction end, matching SET LOCAL
 * semantics without any risk of string-interpolation injection). Postgres RLS
 * policies (see prisma/migrations/20260704202858_rls_and_generated_columns)
 * enforce isolation from there — tenant_id is never trusted from application
 * code, only from this one call site fed by the authenticated JWT.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Deliberately NOT the same role `prisma migrate` uses (DATABASE_URL) — see
    // RUNTIME_DATABASE_URL in .env for why (RLS is bypassed for table owners).
    super({ datasourceUrl: process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async withTenant<T>(tenantId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    if (!tenantId) {
      throw new Error('withTenant() called without a tenantId — refusing to run an unscoped query');
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return fn(tx as unknown as TenantTx);
    });
  }

  /** For platform-admin cross-tenant reads only — never call from a tenant-scoped controller. */
  async withoutTenantScope<T>(fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => fn(tx as unknown as TenantTx));
  }

  /**
   * Login only: resolves a User by mobile/email before the caller's tenant is
   * known. Opens a narrow, single-table RLS exception on "users" for exactly
   * the duration of this transaction (see migration 20260704210000) — never
   * use this for anything beyond identity resolution at login.
   */
  async withLoginLookup<T>(fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.login_lookup', 'true', true)`;
      return fn(tx as unknown as TenantTx);
    });
  }
}

export { Prisma };
