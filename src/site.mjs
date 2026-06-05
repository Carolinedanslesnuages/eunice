/**
 * The built site, read from its folder: every file with its transferred size, and for each HTML page
 * the resources it loads on arrival (its own, then those its style sheets call).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, posix, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { htmlReferences, cssReferences, isExternal } from './references.mjs';

/** Text files travel compressed (gzip, as a server sends them); the others as they are. */
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml', '.webmanifest']);

export function readSite(folder) {
  const files = new Map();
  for (const path of listFiles(folder)) {
    const name = relative(folder, path).replaceAll('\\', '/');
    if (name.endsWith('.map')) continue;
    const bytes = readFileSync(path);
    const transferred = TEXT_EXTENSIONS.has(extname(name).toLowerCase()) ? gzipSync(bytes).length : bytes.length;
    files.set(name, { name, bytes, transferred });
  }
  const pages = [...files.keys()].filter((name) => name.endsWith('.html')).sort((first, second) => first.localeCompare(second)).map((name) => pageOf(name, files));
  return { files, pages };
}

/** What a page downloads on arrival: local files (found in the build) and external addresses. */
function pageOf(name, files) {
  const html = files.get(name).bytes.toString('utf8');
  const local = new Set([name]);
  const external = new Set();
  const missing = new Set();
  const queue = htmlReferences(html).map((reference) => ({ reference, from: name }));
  while (queue.length) {
    const { reference, from } = queue.shift();
    if (isExternal(reference)) {
      external.add(reference.startsWith('//') ? `https:${reference}` : reference);
      continue;
    }
    const found = resolve(reference, from, files);
    if (!found) {
      missing.add(reference);
      continue;
    }
    if (local.has(found)) continue;
    local.add(found);
    if (found.endsWith('.css')) {
      queue.push(...cssReferences(files.get(found).bytes.toString('utf8')).map((inner) => ({ reference: inner, from: found })));
    }
  }
  return { name, html, local: [...local], external: [...external], missing: [...missing] };
}

/**
 * The build file an address points to. An absolute address may carry the base path of the site
 * (« /mon-site/assets/x.js » on GitHub Pages): when it is not found as is, the first segment is dropped.
 */
export function resolve(reference, from, files) {
  const path = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!path) return null;
  const candidates = path.startsWith('/')
    ? [path.slice(1), path.split('/').slice(2).join('/')]
    : [posix.normalize(posix.join(posix.dirname(from), path))];
  return candidates.find((candidate) => files.has(candidate)) || null;
}

function listFiles(folder) {
  const found = [];
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) found.push(...listFiles(path));
    else found.push(path);
  }
  return found;
}

export const extensionOf = (name) => extname(name).slice(1).toLowerCase();
