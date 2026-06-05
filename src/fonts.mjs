/** 4.8: at most two fonts and four variants per page, or at most 400 Ko of fonts per page. */
import { fontFaces, hostOf } from './references.mjs';
import { resolve, extensionOf } from './site.mjs';
import { formatSize } from './format.mjs';

const FONT_FILES = new Set(['woff2', 'woff', 'ttf', 'otf', 'eot']);
const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com|use\.typekit\.net|fonts\.bunny\.net/i;
const MAX_FAMILIES = 2;
const MAX_VARIANTS = 4;
const MAX_WEIGHT = 400_000;

/** The fonts a page declares (in its style sheets and <style>), their files and the font sites it calls. */
export function pageFonts(page, site) {
  const sheets = page.local.filter((name) => name.endsWith('.css')).map((name) => site.files.get(name).bytes.toString('utf8'));
  const faces = [...sheets, page.html].flatMap(fontFaces);
  const files = new Set(faces.flatMap((face) => face.files.map((file) => resolve(file, page.name, site.files)).filter(Boolean)));
  page.local.filter((name) => FONT_FILES.has(extensionOf(name))).forEach((name) => files.add(name));
  const families = new Set(faces.map((face) => face.family)).size;
  const variants = new Set(faces.map((face) => `${face.family}|${face.weight}|${face.style}`)).size;
  const weight = [...files].reduce((total, name) => total + site.files.get(name).transferred, 0);
  return {
    page: page.name,
    families,
    variants,
    weight,
    hosts: [...new Set(page.external.filter((address) => FONT_HOSTS.test(address)).map(hostOf))],
    passes: (families <= MAX_FAMILIES && variants <= MAX_VARIANTS) || weight <= MAX_WEIGHT,
    local: faces.length > 0 || files.size > 0,
  };
}

function describe(fonts) {
  const hosts = fonts.hosts.length ? `, et des polices de ${fonts.hosts.join(', ')} (non pesées)` : '';
  return `${fonts.page} : ${fonts.families} police(s), ${fonts.variants} variante(s), ${formatSize(fonts.weight)}${hosts}`;
}

function verdict(results) {
  const failing = results.filter((fonts) => !fonts.passes);
  if (failing.length) {
    return { status: 'non-valide', summary: `${failing.length} page(s) au-delà de 2 polices et 4 variantes, et de 400 Ko de polices.` };
  }
  const hosts = [...new Set(results.flatMap((fonts) => fonts.hosts))];
  if (!hosts.length) return { status: 'valide', summary: 'Au plus 2 polices et 4 variantes, ou 400 Ko de polices, sur chaque page.' };
  const start = results.some((fonts) => fonts.local) ? 'Polices locales dans les seuils, mais des polices viennent' : 'Les polices viennent';
  return { status: 'a-verifier', summary: `${start} de ${hosts.join(', ')} : à peser à part (leurs fichiers ne sont pas dans le site construit).` };
}

export function fontCheck(site) {
  const results = site.pages.map((page) => pageFonts(page, site)).filter((fonts) => fonts.local || fonts.hosts.length);
  if (!results.length) return { id: '4.8', status: 'non-applicable', summary: 'Aucune police téléchargée : polices du système.', details: [] };
  return { id: '4.8', ...verdict(results), details: results.map(describe) };
}
