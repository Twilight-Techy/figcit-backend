import { Module } from '@nestjs/common';
import { ExpressController } from './express.controller.js';
import { ExpressService } from './express.service.js';

@Module({ controllers: [ExpressController], providers: [ExpressService] })
export class ExpressModule {}
