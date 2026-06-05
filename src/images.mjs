/** 5.1 and 6.4: the format of the images, and whether they are displayed at their original size. */
import { imageTags, isExternal } from './references.mjs';
import { imageSize } from './image-size.mjs';
import { resolve, extensionOf } from './site.mjs';
import { formatSize } from './format.mjs';

const RASTER = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tif', 'tiff', 'webp', 'avif', 'jxl']);
const EFFICIENT = new Set(['webp', 'avif', 'jxl']);

/** 5.1: more than 75 % of the raster images in an efficient format (WebP, AVIF, JPEG XL). */
export function imageFormatCheck(site) {
  const images = [...site.files.keys()].filter((name) => RASTER.has(extensionOf(name)));
  if (!images.length) return { id: '5.1', status: 'non-applicable', summary: 'Aucune image matricielle.', details: [] };
  const others = images.filter((name) => !EFFICIENT.has(extensionOf(name)));
  const share = (images.length - others.length) / images.length;
  return {
    id: '5.1',
    status: share > 0.75 ? 'valide' : 'non-valide',
    summary: `${Math.round(share * 100)} % des ${images.length} image(s) matricielle(s) en WebP, AVIF ou JPEG XL (seuil : plus de 75 %).`,
    details: others.map((name) => `${name} : ${extensionOf(name).toUpperCase()}, ${formatSize(site.files.get(name).transferred)}`),
  };
}

/** « fitting » (vector, several definitions, or original size), « resized » or « unknown » (no width, unreadable). */
export function classifyImage(image, pageName, files) {
  const found = resolve(image.source, pageName, files);
  if (image.srcset.length >= 2 || (found && extensionOf(found) === 'svg')) return { kind: 'fitting' };
  const size = found ? imageSize(files.get(found).bytes) : null;
  if (!size || !image.width) return { kind: 'unknown' };
  if (size.width === image.width) return { kind: 'fitting' };
  return { kind: 'resized', note: `${size.width} px de large, affichée à ${image.width} px` };
}

/** Each local <img> of each page, once. */
function pageImages(site) {
  const images = new Map();
  for (const page of site.pages) {
    for (const image of imageTags(page.html)) {
      if (image.source && !isExternal(image.source)) images.set(`${page.name} : ${image.source}`, { image, pageName: page.name });
    }
  }
  return images;
}

/** 6.4: images mostly displayed at their original size, or offered in several definitions. */
export function imageSizeCheck(site) {
  const groups = { fitting: [], resized: [], unknown: [] };
  for (const [label, { image, pageName }] of pageImages(site)) {
    const result = classifyImage(image, pageName, site.files);
    groups[result.kind].push(result.note ? `${label} : ${result.note}` : label);
  }
  const { fitting, resized, unknown } = groups;
  const measured = fitting.length + resized.length;
  if (!measured && !unknown.length) return { id: '6.4', status: 'non-applicable', summary: 'Aucune image dans les pages.', details: [] };
  const unknownNote = unknown.length ? ` ${unknown.length} image(s) sans largeur ni variantes : à vérifier dans un navigateur.` : '';
  if (!measured) return { id: '6.4', status: 'a-verifier', summary: 'Taille affichée inconnue sans navigateur.' + unknownNote, details: unknown };
  return {
    id: '6.4',
    status: fitting.length / measured > 0.5 ? 'valide' : 'non-valide',
    summary: `${fitting.length} image(s) sur ${measured} à leur taille d'origine, vectorielles ou avec plusieurs définitions.` + unknownNote,
    details: [...resized, ...unknown.map((label) => `${label} : à vérifier`)],
  };
}
