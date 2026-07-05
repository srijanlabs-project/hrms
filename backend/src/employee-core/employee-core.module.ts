import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { LookupsController } from './lookups.controller';

@Module({
  controllers: [EmployeesController, LookupsController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeeCoreModule {}
