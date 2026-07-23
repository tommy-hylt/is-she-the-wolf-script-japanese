import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(ROOT, 'workspace', 'intermediate', 'episode-01.json');
const outputPath = path.join(ROOT, 'manual-overrides', 'english.json');
const cues = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const output = {};
const queue = [...cues];
const workerCount = 8;

async function translate(text) {
  const query = encodeURIComponent(text);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${query}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const result = data[0]?.map(part => part[0] || '').join('').trim();
      if (result) return result;
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  return text;
}

async function worker() {
  while (queue.length) {
    const cue = queue.shift();
    if (!cue) return;
    const text = cue.segments.map(segment => typeof segment === 'string' ? segment : segment.kanji).join('').trim();
    output[cue.id] = await translate(text);
    process.stdout.write(`Translated ${Object.keys(output).length}/${cues.length}\r`);
  }
}

await Promise.all(Array.from({ length: workerCount }, worker));
await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`\nWrote ${Object.keys(output).length} Episode 1 translations.`);
