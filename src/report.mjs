/** The PR comment: the measured criteria first, then the task list of the others. */
import { RGESN, checklist } from './checklist.mjs';

export const MARKER = '<!-- eunice -->';
const STATUS_LABELS = {
  valide: '✅ validé',
  'non-valide': '❌ non validé',
  'a-verifier': '🔎 à vérifier',
  'non-applicable': '➖ non applicable',
};

const titleOf = (id) => RGESN.criteres.find((criterion) => criterion.id === id)?.libelle || id;

export function report(results, { notApplicable = [], previousComment = '' } = {}) {
  const table = results.map((result) => `| **${result.id}** | ${titleOf(result.id)} | ${STATUS_LABELS[result.status]} | ${result.summary} |`);
  const details = results.filter((result) => result.details.length).map((result) =>
    `<details><summary>${result.id} : le détail</summary>\n\n${result.details.map((line) => `- ${line}`).join('\n')}\n\n</details>`);
  const list = checklist({ measured: results.map((result) => result.id), notApplicable, previousComment });
  return [
    MARKER,
    '## Écoconception (RGESN 2024)',
    '',
    '### Mesuré sur le site construit',
    '',
    '| Critère | | Résultat | Mesure |',
    '|---|---|---|---|',
    ...table,
    '',
    ...details,
    '',
    `### À vérifier à la main · ${list.done}/${list.total}`,
    '',
    'Cochez au fil de la PR : les cases restent cochées quand Eunice met ce commentaire à jour.',
    '',
    list.markdown,
    '',
    `<sub>Critères : ${RGESN.source}, ${RGESN.licence}. ${RGESN.adresse}</sub>`,
  ].join('\n');
}

/** A measured criterion that fails, and was not declared not applicable. */
export const hasFailure = (results) => results.some((result) => result.status === 'non-valide');
