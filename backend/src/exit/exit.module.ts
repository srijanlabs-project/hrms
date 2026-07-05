import { Module } from '@nestjs/common';
import { ExitController } from './exit.controller';
import { ExitService } from './exit.service';
import { EmployeeCoreModule } from '../employee-core/employee-core.module';
import { PayrollModule } from '../payroll/payroll.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [EmployeeCoreModule, PayrollModule, AssetsModule],
  controllers: [ExitController],
  providers: [ExitService],
  exports: [ExitService],
})
export class ExitModule {}
