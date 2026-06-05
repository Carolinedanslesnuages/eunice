import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readSite } from '../src/site.mjs';
import { weightCheck } from '../src/weight.mjs';
import { imageFormatCheck, imageSizeCheck } from '../src/images.mjs';
import { fontCheck } from '../src/fonts.mjs';
import { cacheCheck, hasVersionedName, isCacheable } from '../src/cache.mjs';
import { imageSize } from '../src/image-size.mjs';
import { checklist, tickedCriteria, RGESN } from '../src/checklist.mjs';
import { report, MARKER } from '../src/report.mjs';

/** A PNG header of the given size: enough for imageSize, which reads only the first bytes. */
function pngOf(width, height) {
  const bytes = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function siteFolder(files) {
  const folder = mkdtempSync(join(tmpdir(), 'eunice-'));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, name)), { recursive: true });
    writeFileSync(join(folder, name), content);
  }
  return folder;
}

const FONT_FACES = ['Inter 400', 'Inter 700', 'Lora 400', 'Mono 400']
  .map((face) => {
    const [family, weight] = face.split(' ');
    return `@font-face{font-family:"${family}";font-weight:${weight};src:url(./${family}-${weight}.woff2)}`;
  })
  .join('');

const sample = () => siteFolder({
  'index.html': `<!doctype html><link rel="stylesheet" href="/mon-site/assets/index-Ab12Cd34.css">
    <script type="module" src="/mon-site/assets/index-Xy98Zw76.js"></script>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">
    <img src="photo.png" width="400"><img src="logo.svg"><img src="hero.webp" srcset="hero.webp 1x, hero-2x.webp 2x"><img src="banner.png">`,
  'assets/index-Ab12Cd34.css': `body{color:red}${FONT_FACES}`,
  'assets/index-Xy98Zw76.js': 'console.log("bonjour")',
  'assets/Inter-400.woff2': Buffer.alloc(30_000),
  'assets/Inter-700.woff2': Buffer.alloc(30_000),
  'assets/Lora-400.woff2': Buffer.alloc(30_000),
  'assets/Mono-400.woff2': Buffer.alloc(30_000),
  'photo.png': pngOf(1600, 900),
  'banner.png': pngOf(800, 200),
  'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'hero.webp': Buffer.alloc(40),
  'hero-2x.webp': Buffer.alloc(40),
});

test('reads image sizes from PNG, GIF and JPEG headers', () => {
  assert.deepEqual(imageSize(pngOf(120, 80)), { width: 120, height: 80 });
  const gif = Buffer.alloc(32);
  gif.write('GIF89a', 0, 'ascii');
  gif.writeUInt16LE(64, 6);
  gif.writeUInt16LE(32, 8);
  assert.deepEqual(imageSize(gif), { width: 64, height: 32 });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x32, 0x00, 0x64, ...Array(20).fill(0)]);
  assert.deepEqual(imageSize(jpeg), { width: 100, height: 50 });
  assert.equal(imageSize(Buffer.from('pas une image, juste du texte assez long')), null);
});

test('follows the page, its style sheets and the base path of the site', () => {
  const site = readSite(sample());
  const [page] = site.pages;
  assert.ok(page.local.includes('assets/index-Ab12Cd34.css'));
  assert.ok(page.local.includes('assets/Inter-700.woff2'), 'fonts called by the style sheet');
  assert.deepEqual(page.external, ['https://fonts.googleapis.com/css2?family=Roboto']);
});

test('6.1 without budgets is not validated, and with budgets compares each page', () => {
  const site = readSite(sample());
  assert.equal(weightCheck(site).status, 'non-valide');
  assert.equal(weightCheck(site, { poids: 500, requetes: 30 }).status, 'valide');
  assert.equal(weightCheck(site, { poids: 500, requetes: 3 }).status, 'non-valide');
});

test('5.1 needs more than 75 % of raster images in WebP, AVIF or JPEG XL', () => {
  const result = imageFormatCheck(readSite(sample()));
  assert.equal(result.status, 'non-valide');
  assert.match(result.summary, /^50 %/);
  assert.equal(result.details.length, 2);
});

test('6.4 counts resized images, accepts vectors and srcset, and flags the unknown', () => {
  const result = imageSizeCheck(readSite(sample()));
  assert.equal(result.status, 'valide', 'two fitting (svg, srcset) out of three measured');
  assert.ok(result.details.some((line) => /photo\.png : 1600 px de large, affichée à 400 px/.test(line)));
  assert.ok(result.details.some((line) => /banner\.png : à vérifier/.test(line)));
});

test('4.8 accepts more than two fonts when they weigh under 400 Ko, but not the ones from other sites', () => {
  const result = fontCheck(readSite(sample()));
  assert.equal(result.status, 'a-verifier');
  assert.match(result.details[0], /3 police\(s\), 4 variante\(s\), 120,0 Ko, et des polices de fonts\.googleapis\.com/);
  const heavy = siteFolder({
    'index.html': `<link rel="stylesheet" href="style.css">`,
    'style.css': FONT_FACES.replaceAll('./', 'fonts/'),
    ...Object.fromEntries(['Inter-400', 'Inter-700', 'Lora-400', 'Mono-400'].map((name) => [`fonts/${name}.woff2`, Buffer.alloc(120_000)])),
  });
  assert.equal(fontCheck(readSite(heavy)).status, 'non-valide');
  assert.equal(fontCheck(readSite(siteFolder({ 'index.html': '<p>Bonjour</p>' }))).status, 'non-applicable');
});

test('6.2 tells versioned names, and reads the cache headers of the deployed site', async () => {
  assert.ok(hasVersionedName('assets/index-DiwrgTda.js'));
  assert.ok(hasVersionedName('logo.3f9a1c2b.png'));
  assert.ok(!hasVersionedName('my-background.png'));
  assert.ok(!hasVersionedName('favicon-16x16.png'));
  assert.ok(isCacheable(new Headers({ 'cache-control': 'max-age=600' })));
  assert.ok(isCacheable(new Headers({ etag: '"abc"' })));
  assert.ok(!isCacheable(new Headers({ 'cache-control': 'no-store', etag: '"abc"' })));

  const site = readSite(sample());
  assert.equal((await cacheCheck(site)).status, 'a-verifier');
  const cached = async () => new Response(null, { headers: { 'cache-control': 'max-age=31536000, immutable' } });
  assert.equal((await cacheCheck(site, 'https://exemple.fr/mon-site', cached)).status, 'valide');
  const uncached = async (address) => new Response(null, { headers: String(address).endsWith('.png') ? {} : { etag: '"x"' } });
  const result = await cacheCheck(site, 'https://exemple.fr/mon-site/', uncached);
  assert.equal(result.status, 'non-valide');
  assert.ok(result.details.every((line) => /\.png : ni Cache-Control/.test(line)));

  // In a pull request, a new file is not online yet: not a cache fault.
  const newInPullRequest = async (address) => new Response(null, String(address).endsWith('.js') ? { status: 404 } : { headers: { etag: '"x"' } });
  const pending = await cacheCheck(site, 'https://exemple.fr/mon-site/', newInPullRequest);
  assert.equal(pending.status, 'valide');
  assert.match(pending.summary, /1 fichier\(s\) pas encore en ligne/);
  const nothingOnline = await cacheCheck(site, 'https://exemple.fr/', async () => new Response(null, { status: 404 }));
  assert.equal(nothingOnline.status, 'a-verifier');
});

test('the task list holds every unmeasured criterion and keeps the ticked boxes', () => {
  assert.equal(RGESN.criteres.length, 78);
  const previous = '- [x] **1.3** Le service…\n- [ ] **2.1** …\n  - [X] **8.2** …';
  assert.deepEqual([...tickedCriteria(previous)].sort(), ['1.3', '8.2']);
  const list = checklist({ measured: ['4.8', '5.1', '6.1', '6.2', '6.4'], notApplicable: ['5.3'], previousComment: previous });
  assert.equal(list.total, 72);
  assert.equal(list.done, 2);
  assert.match(list.markdown, /- \[x\] \*\*1\.3\*\*/);
  assert.doesNotMatch(list.markdown, /\*\*(6\.1|5\.3)\*\*/);
});

test('the report starts with its marker, so the action finds and updates its comment', () => {
  const markdown = report([{ id: '6.1', status: 'valide', summary: 'Sous le budget.', details: [] }]);
  assert.ok(markdown.startsWith(MARKER));
  assert.match(markdown, /\| \*\*6\.1\*\* \| Le service numérique s’astreint-il/);
  assert.match(markdown, /À vérifier à la main · 0\/77/);
});

test('the command fails on a measured criterion, unless « bloquant » is false', () => {
  const folder = sample();
  const run = (config) => {
    writeFileSync(join(folder, '..', 'eunice-test.json'), JSON.stringify(config));
    try {
      execFileSync('node', ['bin/eunice.mjs', '--dossier', folder, '--config', join(folder, '..', 'eunice-test.json')], { stdio: 'pipe' });
      return 0;
    } catch (error) {
      return error.status;
    }
  };
  assert.equal(run({ budgets: { poids: 500, requetes: 30 } }), 1, '5.1 fails: half of the images are PNG');
  assert.equal(run({ budgets: { poids: 500, requetes: 30 }, bloquant: false }), 0);
  assert.equal(run({ budgets: { poids: 500, requetes: 30 }, 'non-applicables': ['5.1'] }), 0);
});
