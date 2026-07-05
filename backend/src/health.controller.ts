import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get()
  root() {
    return { status: 'ok', service: 'HRMS backend', docs: '/api/v1/*' };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
