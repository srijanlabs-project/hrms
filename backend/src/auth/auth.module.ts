import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // global: true — JwtAuthGuard is bound as an app-wide APP_GUARD in app.module.ts,
  // so JwtService must be resolvable from the root DI context, not just within
  // whatever module happens to import AuthModule.
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
