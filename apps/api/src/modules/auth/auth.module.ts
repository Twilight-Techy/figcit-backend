import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleService } from './google.service.js';
import { GuestService } from './guest.service.js';
import { SessionsService } from './sessions.service.js';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, SessionsService, GoogleService, GuestService],
  exports: [SessionsService],
})
export class AuthModule {}
