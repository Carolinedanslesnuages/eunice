/**
 * The RGESN criteria that no tool can measure, as a Markdown task list grouped by theme.
 * Boxes ticked by hand in the previous comment stay ticked when Eunice rewrites it.
 */
import { readFileSync } from 'node:fs';

export const RGESN = JSON.parse(readFileSync(new URL('./rgesn-2024.json', import.meta.url), 'utf8'));

/** Criterion numbers ticked in a previous comment: « - [x] **2.3** … ». */
export function tickedCriteria(previousComment = '') {
  return new Set([...previousComment.matchAll(/^\s*-\s*\[[xX]\]\s*\*\*(\d+\.\d+)\*\*/gm)].map((found) => found[1]));
}

export function checklist({ measured = [], notApplicable = [], previousComment = '' } = {}) {
  const ticked = tickedCriteria(previousComment);
  const skipped = new Set([...measured, ...notApplicable]);
  const sections = [];
  let total = 0;
  let done = 0;
  for (const theme of RGESN.thematiques) {
    const criteria = RGESN.criteres.filter((criterion) => criterion.id.split('.')[0] === String(theme.numero) && !skipped.has(criterion.id));
    if (!criteria.length) continue;
    const lines = criteria.map((criterion) => {
      const isTicked = ticked.has(criterion.id);
      total += 1;
      if (isTicked) done += 1;
      return `- [${isTicked ? 'x' : ' '}] **${criterion.id}** ${criterion.libelle} _(${criterion.priorite.toLowerCase()})_`;
    });
    const themeDone = criteria.filter((criterion) => ticked.has(criterion.id)).length;
    sections.push(`<details><summary>${theme.numero}. ${theme.nom} · ${themeDone}/${criteria.length}</summary>\n\n${lines.join('\n')}\n\n</details>`);
  }
  return { markdown: sections.join('\n\n'), total, done };
}
