/**
 * 6.2: a browser cache for the content the service controls.
 * From the build alone, Eunice sees whether file names carry a version (a hash): such files can be
 * kept for a year without risk. Whether they are, the host decides through its HTTP headers: with an
 * address, Eunice reads those headers on the deployed site.
 */
import { extensionOf } from './site.mjs';

/** « index-DiwrgTda.js », « logo.3f9a1c2b.png »: a segment of 8+ letters or digits that is not a word. */
export function hasVersionedName(name) {
  const base = name.split('/').pop();
  return base.split(/[.-]/).slice(1, -1).some((part) => part.length >= 8 && /^\w+$/.test(part) && (/\d/.test(part) || (/[a-z]/.test(part) && /[A-Z]/.test(part))));
}

/** A response the browser may keep or revalidate: max-age above 0, or a validator (ETag, Last-Modified). */
export function isCacheable(headers) {
  const control = (headers.get('cache-control') || '').toLowerCase();
  if (/no-store/.test(control)) return false;
  const maxAge = Number((control.match(/max-age=(\d+)/) || [])[1] || 0);
  return maxAge > 0 || /immutable/.test(control) || headers.has('etag') || headers.has('last-modified');
}

export async function cacheCheck(site, address = '', fetchResponse = fetch) {
  const resources = [...new Set(site.pages.flatMap((page) => page.local))].filter((name) => extensionOf(name) !== 'html');
  if (!resources.length) return { id: '6.2', status: 'non-applicable', summary: 'Aucune ressource statique à mettre en cache.', details: [] };
  const unversioned = resources.filter((name) => !hasVersionedName(name));
  const namesSummary = `${resources.length - unversioned.length} fichier(s) sur ${resources.length} aux noms versionnés (cache long possible sans risque).`;
  if (!address) {
    return {
      id: '6.2',
      status: 'a-verifier',
      summary: `${namesSummary} Le cache lui-même vient de l'hébergeur : donnez « adresse » à Eunice pour lire ses en-têtes.`,
      details: unversioned.map((name) => `${name} : nom sans version`),
    };
  }
  const base = address.endsWith('/') ? address : `${address}/`;
  const { checked, notCached, notOnline } = await readHeaders(resources, base, fetchResponse);
  // In a pull request, new files (new hash) are not online yet: they are not a cache fault.
  const notOnlineNote = notOnline.length ? ` ${notOnline.length} fichier(s) pas encore en ligne, non vérifiés.` : '';
  if (notCached.length) {
    return {
      id: '6.2',
      status: 'non-valide',
      summary: `${notCached.length} ressource(s) sur ${checked} sans cache navigateur sur ${base}.${notOnlineNote} ${namesSummary}`,
      details: notCached,
    };
  }
  if (!checked) {
    return { id: '6.2', status: 'a-verifier', summary: `Aucune ressource encore en ligne sur ${base} : le cache se vérifiera après publication. ${namesSummary}`, details: [] };
  }
  return {
    id: '6.2',
    status: 'valide',
    summary: `Les ${checked} ressource(s) en ligne sur ${base} peuvent être gardées par le navigateur.${notOnlineNote} ${namesSummary}`,
    details: notOnline.map((name) => `${name} : pas encore en ligne`),
  };
}

async function readHeaders(resources, base, fetchResponse) {
  const notCached = [];
  const notOnline = [];
  let checked = 0;
  for (const name of resources) {
    try {
      const response = await fetchResponse(new URL(name, base), { method: 'HEAD' });
      if (response.status === 404) {
        notOnline.push(name);
        continue;
      }
      checked += 1;
      if (!response.ok) notCached.push(`${name} : réponse ${response.status}`);
      else if (!isCacheable(response.headers)) notCached.push(`${name} : ni Cache-Control, ni ETag, ni Last-Modified`);
    } catch (error) {
      checked += 1;
      notCached.push(`${name} : injoignable (${error.message})`);
    }
  }
  return { checked, notCached, notOnline };
}
