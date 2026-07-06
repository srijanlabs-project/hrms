import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './common/prisma/prisma.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { AuthModule } from './auth/auth.module';
import { EmployeeCoreModule } from './employee-core/employee-core.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { PayrollModule } from './payroll/payroll.module';
import { HealthController } from './health.controller';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { PerformanceModule } from './performance/performance.module';
import { LearningModule } from './learning/learning.module';
import { AssetsModule } from './assets/assets.module';
import { ExitModule } from './exit/exit.module';
import { EngagementModule } from './engagement/engagement.module';
import { DelegationsModule } from './delegations/delegations.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AuthModule,
    EmployeeCoreModule,
    DelegationsModule,
    ApprovalsModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    RecruitmentModule,
    PerformanceModule,
    LearningModule,
    AssetsModule,
    ExitModule,
    EngagementModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
