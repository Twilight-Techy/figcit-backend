import { Module } from '@nestjs/common';
import { AdaptController } from './adapt.controller.js';

@Module({ controllers: [AdaptController] })
export class AdaptModule {}
