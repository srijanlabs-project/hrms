import { Module } from '@nestjs/common';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { EmployeeCoreModule } from '../employee-core/employee-core.module';

@Module({
  imports: [ApprovalsModule, EmployeeCoreModule],
  controllers: [RecruitmentController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
