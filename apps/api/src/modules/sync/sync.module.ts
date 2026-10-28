import { Module } from '@nestjs/common';
import { SyncController, UpgradeController } from './sync.controller.js';
import { SyncService } from './sync.service.js';

@Module({ controllers: [SyncController, UpgradeController], providers: [SyncService] })
export class SyncModule {}
