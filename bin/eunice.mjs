#!/usr/bin/env node
/**
 * Eunice: measures the RGESN criteria a built site allows, and lists the others to tick.
 * Usage: eunice [--dossier dist] [--config eunice.json] [--adresse https://…] [--precedent commentaire.md]
 * Writes the Markdown report on the standard output; exits with 1 when a measured criterion fails
 * (unless « bloquant » is false in the configuration).
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { readSite } from '../src/site.mjs';
import { weightCheck } from '../src/weight.mjs';
import { imageFormatCheck, imageSizeCheck } from '../src/images.mjs';
import { fontCheck } from '../src/fonts.mjs';
import { cacheCheck } from '../src/cache.mjs';
import { report, hasFailure } from '../src/report.mjs';

const { values: options } = parseArgs({
  options: {
    dossier: { type: 'string' },
    config: { type: 'string', default: 'eunice.json' },
    adresse: { type: 'string' },
    precedent: { type: 'string' },
  },
});

let config = {};
if (existsSync(options.config)) {
  try {
    config = JSON.parse(readFileSync(options.config, 'utf8'));
  } catch (error) {
    console.error(`Eunice : « ${options.config} » n'est pas un JSON valide (${error.message}).`);
    process.exit(2);
  }
}
const folder = options.dossier || config.dossier || 'dist';
if (!existsSync(folder)) {
  console.error(`Eunice : le dossier « ${folder} » n'existe pas. Construisez le site avant ce contrôle.`);
  process.exit(2);
}
const notApplicable = config['non-applicables'] || [];
const site = readSite(folder);
if (!site.pages.length) {
  console.error(`Eunice : aucune page HTML dans « ${folder} ».`);
  process.exit(2);
}

const results = [
  weightCheck(site, config.budgets),
  imageFormatCheck(site),
  imageSizeCheck(site),
  fontCheck(site),
  await cacheCheck(site, options.adresse || config.adresse || ''),
].filter((result) => !notApplicable.includes(result.id));

const previousComment = options.precedent && existsSync(options.precedent) ? readFileSync(options.precedent, 'utf8') : '';
console.log(report(results, { notApplicable, previousComment }));
if (config.bloquant !== false && hasFailure(results)) process.exitCode = 1;
