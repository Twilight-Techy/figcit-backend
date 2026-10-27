import { Controller, Get } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError } from '../../common/errors/errors.js';
import { Route } from '../../common/http/route.js';
import { RulesService } from '../rules/rules.service.js';

const healthSchema = z.object({ status: z.literal('ok') });
const readySchema = z.object({ status: z.literal('ok'), snapshot: z.string() });

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
  ) {}

  @Get(['', 'live'])
  @Route({
    summary: 'Liveness: the process is up',
    tags: ['Health'],
    access: 'public',
    response: healthSchema,
  })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @Route({
    summary: 'Readiness: database reachable and a snapshot loaded',
    tags: ['Health'],
    access: 'public',
    response: readySchema,
  })
  async ready(): Promise<{ status: 'ok'; snapshot: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const { version } = await this.rules.current();
      return { status: 'ok', snapshot: version };
    } catch {
      throw new AppError(503, 'not_ready', 'Not ready yet');
    }
  }
}
