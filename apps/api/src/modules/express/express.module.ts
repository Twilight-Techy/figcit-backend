import { Module } from '@nestjs/common';
import { CommCardsController } from './cards.controller.js';
import { CommCardsService } from './cards.service.js';
import { ExpressController } from './express.controller.js';
import { ExpressService } from './express.service.js';

@Module({
  controllers: [ExpressController, CommCardsController],
  providers: [ExpressService, CommCardsService],
})
export class ExpressModule {}
