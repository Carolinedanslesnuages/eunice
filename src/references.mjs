/**
 * What a page loads: the resources referenced by its HTML (scripts, style sheets, preloads, icons,
 * images) and by its CSS (@import, url()). Links (<a href>) and connection hints (preconnect…) are
 * not resources. Pure text parsing: no browser.
 */
const LOADING_LINK_RELS = new Set(['stylesheet', 'modulepreload', 'preload', 'icon', 'apple-touch-icon', 'manifest']);

export const attributeOf = (tag, name) => {
  const found = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return found ? found[1] ?? found[2] ?? found[3] : null;
};

/** Addresses loaded by an HTML page. */
export function htmlReferences(html) {
  const references = [];
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const source = attributeOf(tag, 'src');
    if (source) references.push(source);
  }
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rels = (attributeOf(tag, 'rel') || '').toLowerCase().split(/\s+/);
    const target = attributeOf(tag, 'href');
    if (target && rels.some((rel) => LOADING_LINK_RELS.has(rel))) references.push(target);
  }
  for (const [tag] of html.matchAll(/<(?:img|source|video|audio|iframe|embed)\b[^>]*>/gi)) {
    const source = attributeOf(tag, 'src') || (attributeOf(tag, 'srcset') || '').trim().split(/\s+/)[0];
    if (source) references.push(source);
  }
  for (const [, styles] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) references.push(...cssReferences(styles));
  return unique(references);
}

/** Addresses loaded by a style sheet: @import and url(). */
export function cssReferences(css) {
  const references = [];
  for (const found of css.matchAll(/@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi)) references.push(found[1]);
  for (const found of css.matchAll(/url\(\s*["']?([^"')]+?)["']?\s*\)/gi)) references.push(found[1]);
  return unique(references);
}

/** The @font-face rules of a style sheet: family, weight, style and the files they point to. */
export function fontFaces(css) {
  const faces = [];
  for (const [, body] of css.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const property = (name) => (body.match(new RegExp(`(?:^|;|\\s)${name}\\s*:\\s*([^;]+)`, 'i')) || [])[1]?.trim() || '';
    faces.push({
      family: property('font-family').replace(/^["']|["']$/g, ''),
      weight: property('font-weight') || '400',
      style: property('font-style') || 'normal',
      files: cssReferences(body),
    });
  }
  return faces;
}

/** <img> tags with what tells their displayed size: width, height, srcset. */
export function imageTags(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map(([tag]) => ({
    source: attributeOf(tag, 'src'),
    width: Number.parseInt(attributeOf(tag, 'width') || '', 10) || null,
    srcset: (attributeOf(tag, 'srcset') || '').split(',').map((candidate) => candidate.trim()).filter(Boolean),
  }));
}

/** An address served by another site: http(s):// or protocol-relative //. */
export const isExternal = (reference) => /^(https?:)?\/\//i.test(reference);

export const hostOf = (reference) => {
  try {
    return new URL(reference, 'https://site.local/').host;
  } catch {
    return reference;
  }
};

function unique(references) {
  return [...new Set(references)].filter((reference) => !reference.startsWith('data:') && !reference.startsWith('#'));
}
