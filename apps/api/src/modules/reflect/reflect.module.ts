import { Module } from '@nestjs/common';
import { PatternsService } from './patterns.service.js';
import { ReflectController } from './reflect.controller.js';
import { ReflectDeps } from './reflect.deps.js';
import { ReflectService } from './reflect.service.js';

@Module({
  controllers: [ReflectController],
  providers: [ReflectService, ReflectDeps, PatternsService],
  exports: [ReflectService],
})
export class ReflectModule {}
