import { PATHWAYS, type Snapshot } from '@figcit/engine';
import type { WorkbookTables } from './workbook.js';

/** Returns every problem found; an empty list means the draft can go to review (SYSTEM_DESIGN §5.4). */
export function validateSnapshot(snapshot: Snapshot, tables: WorkbookTables): string[] {
  const problems: string[] = [];
  const need = (ok: boolean, message: string): void => {
    if (!ok) problems.push(message);
  };

  need(snapshot.cells.length === 16, `expected 16 cells, found ${String(snapshot.cells.length)}`);
  for (let e = 1; e <= 4; e += 1)
    for (let m = 1; m <= 4; m += 1)
      need(
        snapshot.cells.some((c) => c.id === `E${String(e)}M${String(m)}`),
        `cell E${String(e)}M${String(m)} missing`,
      );

  for (const code of ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'TX', 'TR'])
    need(
      snapshot.timelines.some((t) => t.code === code),
      `timeline ${code} missing a step cap`,
    );

  for (let id = 1; id <= 41; id += 1) {
    need(tables.patternIds.has(id), `pattern ${String(id)} not found in Tab 7`);
    need(
      snapshot.patterns.some((p) => p.id === id),
      `pattern ${String(id)} has no card wording`,
    );
  }

  const families = new Set(snapshot.families.map((f) => f.code));
  for (const emotion of snapshot.emotions)
    need(
      families.has(emotion.family),
      `emotion ${emotion.code} has unknown family ${emotion.family}`,
    );

  const toolIds = new Set(snapshot.tools.map((t) => t.id));
  need(toolIds.size === snapshot.tools.length, 'duplicate tool ids');
  for (const env of snapshot.environments)
    for (const id of env.excludeTools)
      need(toolIds.has(id), `environment ${env.code} excludes unknown tool ${id}`);

  for (const pathway of PATHWAYS) {
    // ENT-1: every pathway has a free tool.
    need(
      snapshot.tools.some((t) => t.pathway === pathway && t.tier === 'free'),
      `ENT-1: ${pathway} has no free tool`,
    );
  }
  // ENT-2: safety-floor tools are never Advanced.
  for (const tool of snapshot.tools)
    need(
      !(tool.safetyFloor && tool.tier === 'advanced'),
      `ENT-2: safety-floor tool ${tool.id} is Advanced`,
    );

  // ENT-1 in every setting: each pathway keeps at least one free tool after the context filter,
  // except pathways a setting rules out entirely by design (exam hall: Connect and Reflect).
  const exempt = new Set([
    'exam:connect',
    'exam:reflect',
    'exam:dump',
    'formal:reflect',
    'clinical:reflect',
    'clinical:meditate',
    'worship:reflect',
  ]);
  for (const env of snapshot.environments) {
    for (const pathway of PATHWAYS) {
      if (exempt.has(`${env.settingClass}:${pathway}`)) continue;
      const free = snapshot.tools.filter(
        (t) => t.pathway === pathway && t.tier === 'free' && !env.excludeTools.includes(t.id),
      );
      need(free.length > 0, `ENT-1: ${pathway} has no free tool left in ${env.code}`);
    }
  }

  need(snapshot.safety.phrases.length > 0, 'no safety phrases');
  need((snapshot.crisisRoutes['GB'] ?? []).length > 0, 'no GB crisis routes');
  return problems;
}
