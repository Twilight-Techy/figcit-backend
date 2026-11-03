import { Injectable, Logger } from '@nestjs/common';
import {
  checkInOptionsOf,
  type Catalogue,
  type CheckInOptionsView,
  type InputOptions,
  type WorkbookCell,
} from '@figcit/engine-v2';
import { PrismaService } from '../../common/db/prisma.service.js';

/** Everything the check-in screens offer, from the published rule set (E-40). */
export interface CheckInOptionsDto extends CheckInOptionsView {
  readonly version: string;
  readonly hash: string;
}

/** The server's own view, with what each option means for the engine. */
export interface CheckInOptions {
  readonly dto: CheckInOptionsDto;
  readonly options: InputOptions;
  readonly catalogue: Catalogue;
}

const CACHE_MS = 30_000;
/** Versions that can no longer change, so their options are kept once built. */
const FROZEN = new Set(['published', 'retired']);

/**
 * The check-in's options from the published rule set (DECISION_LOG E-40), cached for 30 s so a
 * publish reaches every instance without a restart. Null when no v2 version with options is
 * published yet (the v1 lists are used then).
 */
@Injectable()
export class CheckInOptionsService {
  private readonly logger = new Logger('CheckInOptions');
  private cached: { at: number; value: CheckInOptions | null } | undefined;
  private readonly frozen = new Map<string, CheckInOptions | null>();

  constructor(private readonly prisma: PrismaService) {}

  async current(): Promise<CheckInOptions | null> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.value;
    const version = await this.prisma.rulesetVersion.findFirst({
      where: { status: 'published' },
      select: { id: true, label: true, hash: true },
    });
    const value =
      version?.hash && this.cached?.value?.dto.hash === version.hash
        ? this.cached.value
        : version?.hash
          ? await this.build(version.id, version.label, version.hash)
          : null;
    this.cached = { at: Date.now(), value };
    return value;
  }

  /**
   * Any version's options, drafts included (the staff Simulator, E-61). A draft is built on each
   * call, since it can still change; a published or retired version is kept.
   */
  async ofVersion(versionId: string): Promise<CheckInOptions | null> {
    const kept = this.frozen.get(versionId);
    if (kept !== undefined) return kept;
    const v = await this.prisma.rulesetVersion.findUnique({
      where: { id: versionId },
      select: { id: true, label: true, hash: true, status: true },
    });
    if (!v) return null;
    const value = await this.build(v.id, v.label, v.hash ?? '');
    if (FROZEN.has(v.status)) this.frozen.set(v.id, value);
    return value;
  }

  private async build(
    versionId: string,
    label: string,
    hash: string,
  ): Promise<CheckInOptions | null> {
    const rows = await this.prisma.rulesetRecord.findMany({
      where: { versionId, tab: { in: ['catalogue', 'input_mappings', 'state_grid'] } },
      orderBy: { order: 'asc' },
      select: { tab: true, status: true, frame: true, role: true, columns: true },
    });
    const built = checkInOptionsOf(
      rows.map((r) => ({ ...r, columns: r.columns as unknown as WorkbookCell[] })),
    );
    if (built.issues.length > 0)
      this.logger.warn(`${label}: ${String(built.issues.length)} option problem(s) left out`);
    if (built.options.feeling.length === 0) {
      // A version made before the check-in options existed (format 2, E-40) can't serve check-ins.
      this.logger.warn(`${label} has no check-in options; using the v1 lists`);
      return null;
    }
    return {
      dto: { version: label, hash, ...built.view },
      options: built.options,
      catalogue: built.catalogue,
    };
  }
}
