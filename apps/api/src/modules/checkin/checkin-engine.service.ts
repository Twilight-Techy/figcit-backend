import { Injectable } from '@nestjs/common';
import type { EngineInput, UserSignals } from '@figcit/engine';
import type { Tx } from '../../common/db/prisma.service.js';
import { CardBridgeService } from '../decisions/card-bridge.service.js';
import type { CardDto } from '../recommendation/recommendation.schemas.js';
import {
  RecommendationService,
  type RunOutcome,
} from '../recommendation/recommendation.service.js';
import type { SafetyMatch } from '../safety/safety.service.js';
import type { CheckInInput } from './checkin.schemas.js';

/** One check-in's card, whichever engine made it. */
export interface CheckInOutcome {
  readonly id: string;
  readonly card: CardDto;
  readonly cellId: string;
  /** The re-check rule v1 reports; v2 keeps it in the decision's trace. */
  readonly recheckRule: string | null;
  readonly v1: RunOutcome | null;
  readonly risk: SafetyMatch | null;
}

/**
 * Which engine makes the check-in's card (M8, E-53): engine v2 once its rule set with check-in
 * options is published, else v1 (the transition; T-17 removes v1 once v2 has been live).
 */
@Injectable()
export class CheckInEngineService {
  constructor(
    private readonly recs: RecommendationService,
    private readonly bridge: CardBridgeService,
  ) {}

  v2(): Promise<boolean> {
    return this.bridge.enabled();
  }

  signals(userId: string, now: Date): Promise<UserSignals> {
    return this.recs.signalsFor(userId, now);
  }

  latestCard(userId: string, checkInId: string): Promise<CardDto | null> {
    return this.recs.latestFor(userId, checkInId);
  }

  /** Runs the engine and stores the card in the check-in's transaction. */
  async run(
    tx: Tx,
    a: {
      v2: boolean;
      body: CheckInInput;
      v1Input: EngineInput;
      signals: UserSignals;
      userId: string;
      checkInId: string;
      taskId: string | null;
      taskTitle: string | null;
      now: Date;
    },
  ): Promise<CheckInOutcome> {
    if (a.v2) {
      const made = await this.bridge.checkIn(tx, {
        body: a.body,
        userId: a.userId,
        checkInId: a.checkInId,
        taskId: a.taskId,
        taskTitle: a.taskTitle,
        now: a.now,
      });
      return {
        id: made.id,
        card: made.card,
        cellId: made.cellId,
        recheckRule: made.recheckRule,
        v1: null,
        risk: made.risk,
      };
    }
    const run = await this.recs.run(
      a.v1Input,
      {
        userId: a.userId,
        checkInId: a.checkInId,
        taskId: a.taskId,
        origin: a.body.origin,
        signals: a.signals,
      },
      tx,
    );
    return {
      id: run.id,
      card: run.card,
      cellId: run.result.state.cellId,
      recheckRule: run.result.recheck?.rule ?? null,
      v1: run,
      risk: null,
    };
  }

  /** Domain events and the safety log, after the transaction. */
  announce(userId: string, o: CheckInOutcome): void {
    if (o.v1) this.recs.announce(userId, o.id, o.v1.result);
    else this.bridge.announce(userId, o);
  }
}
