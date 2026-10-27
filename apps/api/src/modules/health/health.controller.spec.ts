import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
import { HealthModule } from './health.module.js';

describe('HealthController', () => {
  it('reports ok', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] }).compile();
    expect(moduleRef.get(HealthController).check()).toEqual({ status: 'ok' });
  });
});
