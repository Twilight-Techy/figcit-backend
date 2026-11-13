import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module.js';
import { UsersController } from './users.controller.js';
import { ProfileService } from './profile.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [EntitlementsModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService, ProfileService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
