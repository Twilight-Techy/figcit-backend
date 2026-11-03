import { Injectable } from '@nestjs/common';
import { stateGrid, valuesOf, type GridCell, type GridOutcome } from '@figcit/engine-v2';
import type { z } from 'zod';
import { CaseContextService, caseDto } from './case-context.service.js';
import type { gridBodySchema, GridResult } from './decisions.schemas.js';
import { EngineRuntimeService, type Runnable } from './engine-runtime.service.js';
import { shownLead } from './present.js';

type Outcome = NonNullable<GridResult['cells'][number]['outcome']>;

/**
 * The state grid (DESIGN §8 outcome map as the app's State Grid, E-61): for a feeling picked as
 * the user picks it, the card of each of the 16 cells, and every single other answer that
 * changes it; against another version, that version's card as well. Runs in the worker.
 */
@Injectable()
export class GridService {
  constructor(
    private readonly runtime: EngineRuntimeService,
    private readonly contexts: CaseContextService,
  ) {}

  async grid(label: string, body: z.infer<typeof gridBodySchema>): Promise<GridResult> {
    const engine = await this.runtime.byLabel(label);
    const choice = { feeling: body.feeling, intensity: body.intensity, account: body.account };
    const cells = stateGrid(engine.ruleset, await this.contexts.of(engine), choice);
    const other = body.against ? await this.runtime.byLabel(body.against) : null;
    const before = other ? stateGrid(other.ruleset, await this.contexts.of(other), choice) : null;
    return {
      ...choice,
      against: other?.label ?? null,
      cells: cells.map((c, i) => this.cellDto(engine, c, other, before?.[i])),
    };
  }

  private cellDto(
    engine: Runnable,
    c: GridCell,
    other: Runnable | null,
    before: GridCell | undefined,
  ): GridResult['cells'][number] {
    return {
      cell: c.cell,
      case: caseDto(c.case),
      outcome: c.outcome ? shown(engine, c.outcome) : null,
      before: other && before?.outcome ? shown(other, before.outcome) : null,
      changes: c.changes.map((ch) => ({
        answer: { input: ch.answer.input, ...(ch.answer.code ? { code: ch.answer.code } : {}) },
        outcome: shown(
          engine,
          ch.outcome,
          ch.answer.input === 'declined' ? ch.answer.code : undefined,
        ),
      })),
    };
  }
}

/** A cell's card as the user sees it: the light and the main button's words. */
function shown(engine: Runnable, o: GridOutcome, declinedTool?: string): Outcome {
  const pathway = declinedTool
    ? valuesOf(engine.ruleset.catalogue, 'tool').find((t) => t.code === declinedTool)?.group
    : undefined;
  const lead = shownLead(o.card, engine.copy, pathway ? [pathway] : []);
  return { light: o.light, kind: o.kind, label: lead.label, tool: lead.tool };
}
