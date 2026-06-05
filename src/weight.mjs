/** 6.1: a maximum weight and number of requests per screen, set and respected. */
import { formatSize } from './format.mjs';

function describePage(page) {
  const external = page.external ? ` dont ${page.external} vers d'autres sites (non pesées)` : '';
  return `${page.name} : ${formatSize(page.weight)}, ${page.requests} requête(s)${external}`;
}

export function weightCheck(site, budgets = {}) {
  const pages = site.pages.map((page) => ({
    name: page.name,
    weight: page.local.reduce((total, name) => total + site.files.get(name).transferred, 0),
    requests: page.local.length + page.external.length,
    external: page.external.length,
  }));
  const details = pages.map(describePage);
  if (!budgets.poids || !budgets.requetes) {
    return { id: '6.1', status: 'non-valide', summary: 'Aucun poids maximum ou nombre de requêtes maximum par écran fixé : ajoutez « budgets » dans eunice.json.', details };
  }
  const over = pages.filter((page) => page.weight > budgets.poids * 1000 || page.requests > budgets.requetes);
  return {
    id: '6.1',
    status: over.length ? 'non-valide' : 'valide',
    summary: over.length
      ? `${over.length} page(s) au-dessus de ${budgets.poids} Ko ou ${budgets.requetes} requêtes.`
      : `Toutes les pages sous ${budgets.poids} Ko et ${budgets.requetes} requêtes.`,
    details,
  };
}
