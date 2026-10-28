import { Injectable } from '@nestjs/common';
import {
  buildSafetyScreen,
  type CrisisRoute,
  type SafetyScreen,
  type Snapshot,
} from '@figcit/engine';
import { PrismaService } from '../../common/db/prisma.service.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { RulesService } from '../rules/rules.service.js';

export interface SafetyMatch {
  readonly ruleId: string;
  readonly category: string;
}

/**
 * The server-side safety screen for every free text received (FR-M14-02), and safety events.
 * Events store where it came from and what matched — never the text (SYSTEM_DESIGN §6.4).
 */
@Injectable()
export class SafetyService {
  private screen: { version: string; screen: SafetyScreen } | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly events: DomainEvents,
  ) {}

  private async screenFor(): Promise<{ screen: SafetyScreen; snapshot: Snapshot }> {
    const { snapshot, version } = await this.rules.current();
    if (this.screen?.version !== version)
      this.screen = {
        version,
        screen: buildSafetyScreen(snapshot.safety.phrases, snapshot.safety.exclusions),
      };
    return { screen: this.screen.screen, snapshot };
  }

  async check(texts: readonly (string | null | undefined)[]): Promise<SafetyMatch | null> {
    const present = texts.filter((t): t is string => typeof t === 'string' && t.length > 0);
    if (present.length === 0) return null;
    return (await this.screenFor()).screen.check(present);
  }

  async record(event: {
    userId: string | null;
    sourceModule: string;
    trigger: 'button' | 'phrase' | 'option' | 'sustained';
    ruleId?: string | null | undefined;
    category?: string | null | undefined;
    routeChosen?: string | null | undefined;
    origin?: 'online' | 'offline' | undefined;
  }): Promise<void> {
    await this.prisma.safetyEvent.create({
      data: {
        userId: event.userId,
        sourceModule: event.sourceModule,
        trigger: event.trigger,
        ruleId: event.ruleId ?? null,
        category: event.category ?? null,
        routeChosen: event.routeChosen ?? null,
        origin: event.origin ?? 'online',
      },
    });
    this.events.emit('safety.triggered', {
      userId: event.userId,
      sourceModule: event.sourceModule,
    });
  }

  /** Records a phrase match and returns the user's crisis routes, for modules that screen text. */
  async flag(
    userId: string,
    sourceModule: string,
    match: SafetyMatch,
    origin: 'online' | 'offline' = 'online',
  ): Promise<CrisisRoute[]> {
    await this.record({
      userId,
      sourceModule,
      trigger: 'phrase',
      ruleId: match.ruleId,
      category: match.category,
      origin,
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { region: true },
    });
    return [...(await this.routes(user?.region ?? 'GB'))];
  }

  async routes(region: string): Promise<readonly CrisisRoute[]> {
    const { snapshot } = await this.screenFor();
    return snapshot.crisisRoutes[region] ?? snapshot.crisisRoutes['GB'] ?? [];
  }
}
