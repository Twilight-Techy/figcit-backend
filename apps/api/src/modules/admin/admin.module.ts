import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SnapshotsService } from './snapshots.service.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [UsersModule],
  controllers: [AdminController, StaffController],
  providers: [AdminService, SnapshotsService, StaffService],
})
export class AdminModule {}
