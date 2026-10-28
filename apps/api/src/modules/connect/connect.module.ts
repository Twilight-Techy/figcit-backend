import { Module } from '@nestjs/common';
import { ConnectController } from './connect.controller.js';
import { ConnectService } from './connect.service.js';

@Module({ controllers: [ConnectController], providers: [ConnectService] })
export class ConnectModule {}
