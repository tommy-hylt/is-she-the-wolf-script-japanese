import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EPISODES } from './episode-config.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
for (const episode of EPISODES) {
  const entries = JSON.parse(await fs.readFile(path.join(ROOT, '..', 'web', 'public', 'data', `episode-${episode.id}.json`), 'utf8'));
  const ids = new Set(); let ruby = 0;
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id) || !Array.isArray(entry.segments) || !entry.segments.length) failures += 1;
    ids.add(entry.id); ruby += entry.segments.filter(segment => typeof segment !== 'string').length;
  }
  console.log(`${episode.id}: ${entries.length} cues, ${ruby} ruby segments`);
}
if (failures) { console.error(`Validation failed: ${failures} issue(s)`); process.exitCode = 1; } else console.log('Dataset validation passed.');
