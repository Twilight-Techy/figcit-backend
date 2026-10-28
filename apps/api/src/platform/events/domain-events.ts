import { Injectable, Logger } from '@nestjs/common';

/** Typed in-process events between modules (rules §2.1: modules react through events). */
export interface DomainEventMap {
  'checkin.created': { userId: string; checkInId: string };
  'dump.created': { userId: string; dumpId: string };
  'recheck.evaluated': {
    userId: string;
    previousCheckInId: string;
    checkInId: string;
    light: string;
    rule: string | null;
  };
  'recommendation.created': { userId: string; recommendationId: string; light: string };
  'session.completed': { userId: string; sessionId: string; pathway: string };
  'safety.triggered': { userId: string | null; sourceModule: string };
  'reflection.created': { userId: string; topicTag: string | null };
  'user.deleted': { userId: string };
  'entitlement.changed': { userId: string };
}

type Listener<K extends keyof DomainEventMap> = (
  payload: DomainEventMap[K],
) => Promise<void> | void;

@Injectable()
export class DomainEvents {
  private readonly logger = new Logger('Events');
  private readonly listeners = new Map<keyof DomainEventMap, Listener<keyof DomainEventMap>[]>();

  on<K extends keyof DomainEventMap>(name: K, listener: Listener<K>): void {
    const list = this.listeners.get(name) ?? [];
    list.push(listener as Listener<keyof DomainEventMap>);
    this.listeners.set(name, list);
  }

  /** Listeners run after the caller's transaction; a failing listener never fails the request. */
  emit<K extends keyof DomainEventMap>(name: K, payload: DomainEventMap[K]): void {
    for (const listener of this.listeners.get(name) ?? []) {
      void Promise.resolve()
        .then(() => listener(payload))
        .catch((error: unknown) => {
          this.logger.warn(
            { event: name, err: error instanceof Error ? error.message : String(error) },
            'listener failed',
          );
        });
    }
  }
}
