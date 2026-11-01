import { Injectable, Logger } from '@nestjs/common';
import {
  catalogueOf,
  cellText,
  inputOptionsOf,
  INPUTS,
  type Catalogue,
  type InputKind,
  type InputOption,
  type WorkbookCell,
} from '@figcit/engine-v2';
import { PrismaService } from '../../common/db/prisma.service.js';

/** One option as the app sees it. Where it maps to stays on the server (O-16). */
export interface PublicOption {
  readonly code: string;
  readonly label: string;
  readonly group: string | null;
  /** Choosing it means immediate risk: the app offers support at once (E-43). */
  readonly risk?: true;
  /** A need that doesn't work without a task (Tab 6b): the task step is required (E-45). */
  readonly needsTask?: true;
}

export interface PublicCell {
  readonly id: string;
  readonly energy: number;
  readonly mood: number;
  readonly name: string;
  readonly icon: string;
  readonly meaning: string;
  readonly band: string;
}

/** Everything the check-in screens offer, from the published rule set (E-40). */
export interface CheckInOptionsDto {
  readonly version: string;
  readonly hash: string;
  readonly inputs: Readonly<Record<InputKind, readonly PublicOption[]>>;
  readonly intensityBands: readonly {
    code: string;
    label: string;
    from: number | null;
    to: number | null;
  }[];
  readonly cells: readonly PublicCell[];
}

/** The server's own view, with what each option means for the engine. */
export interface CheckInOptions {
  readonly dto: CheckInOptionsDto;
  readonly options: Readonly<Record<InputKind, readonly InputOption[]>>;
  readonly catalogue: Catalogue;
}

const CACHE_MS = 30_000;
const CELL = /^E([1-4])M([1-4])$/;

function publicOption(input: InputKind, o: InputOption, catalogue: Catalogue): PublicOption {
  const to = o.mapsTo && 'domain' in o.mapsTo ? o.mapsTo : null;
  const risk =
    input === 'feeling' && to?.domain === 'family' && to.code === 'immediate_risk_language';
  const needsTask =
    to?.domain === 'need' &&
    (catalogue.get('need') ?? []).some((v) => v.code === to.code && v.group === 'task_needed');
  return {
    code: o.code,
    label: o.label,
    group: o.group,
    ...(risk ? { risk: true as const } : {}),
    ...(needsTask ? { needsTask: true as const } : {}),
  };
}

function cellOf(columns: readonly WorkbookCell[]): PublicCell | null {
  const id = cellText(columns, 'Cell ID');
  const m = CELL.exec(id);
  if (!m) return null;
  return {
    id,
    energy: Number(m[1]),
    mood: Number(m[2]),
    name: cellText(columns, 'Name'),
    icon: cellText(columns, 'Icon'),
    meaning: cellText(columns, 'Plain-language meaning (layman, no jargon)'),
    band: cellText(columns, 'Capacity band'),
  };
}

/**
 * The check-in's options from the published rule set (DECISION_LOG E-40), cached for 30 s so a
 * publish reaches every instance without a restart. Null when no v2 version is published yet.
 */
@Injectable()
export class CheckInOptionsService {
  private readonly logger = new Logger('CheckInOptions');
  private cached: { at: number; value: CheckInOptions | null } | undefined;

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
    const typed = rows.map((r) => ({ ...r, columns: r.columns as unknown as WorkbookCell[] }));
    const { catalogue } = catalogueOf(typed);
    const { options, issues } = inputOptionsOf(typed, catalogue);
    if (issues.length > 0)
      this.logger.warn(`${label}: ${String(issues.length)} option problem(s) left out`);
    if (options.feeling.length === 0) {
      // A version made before the check-in options existed (format 2, E-40) can't serve check-ins.
      this.logger.warn(`${label} has no check-in options; using the v1 lists`);
      return null;
    }
    const inputs = Object.fromEntries(
      INPUTS.map((input) => [input, options[input].map((o) => publicOption(input, o, catalogue))]),
    ) as Record<InputKind, PublicOption[]>;
    const cells = typed
      .filter((r) => r.tab === 'state_grid' && r.role === 'rule' && r.status === 'active')
      .map((r) => cellOf(r.columns))
      .filter((c): c is PublicCell => c !== null);
    const intensityBands = (catalogue.get('intensity_band') ?? []).map((b) => ({
      code: b.code,
      label: b.label,
      from: b.from,
      to: b.to,
    }));
    return { dto: { version: label, hash, inputs, intensityBands, cells }, options, catalogue };
  }
}
