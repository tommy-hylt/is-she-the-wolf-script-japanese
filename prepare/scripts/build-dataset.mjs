import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import KuroshiroModule from 'kuroshiro';
import KuromojiAnalyzerModule from 'kuroshiro-analyzer-kuromoji';
import { EPISODES } from './episode-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'sources', 'srt');
const OUT_DIR = path.join(ROOT, '..', 'web', 'public', 'data');
const INTERMEDIATE_DIR = path.join(ROOT, 'workspace', 'intermediate');
const REPORT_DIR = path.join(ROOT, 'workspace', 'reports');
const OVERRIDE_PATH = path.join(ROOT, 'manual-overrides', 'furigana.json');
const ENGLISH_PATH = path.join(ROOT, 'manual-overrides', 'english.json');
const Kuroshiro = KuroshiroModule.default ?? KuroshiroModule;
const KuromojiAnalyzer = KuromojiAnalyzerModule.default ?? KuromojiAnalyzerModule;
const kuroshiro = new Kuroshiro();
await kuroshiro.init(new KuromojiAnalyzer());

await Promise.all([fs.mkdir(OUT_DIR, { recursive: true }), fs.mkdir(INTERMEDIATE_DIR, { recursive: true }), fs.mkdir(REPORT_DIR, { recursive: true })]);
const manualOverrides = JSON.parse(await fs.readFile(OVERRIDE_PATH, 'utf8'));
const englishOverrides = JSON.parse(await fs.readFile(ENGLISH_PATH, 'utf8').catch(() => '{}'));

for (const episode of EPISODES) {
  const raw = await fs.readFile(path.join(SOURCE_DIR, episode.file), 'utf8');
  const cues = [];
  const noteCounts = new Map();
  for (const [index, block] of raw.split(/\r?\n\r?\n+/).entries()) {
    const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const time = lines[1] || '';
    const rawText = lines.slice(2).join(' ').replace(/\s+/g, ' ').trim();
    if (!time || !/[ぁ-んァ-ン一-龯A-Za-z]/.test(rawText)) continue;
    const speakerMatches = [...rawText.matchAll(/（([^）]+)）/g)];
    const speaker = speakerMatches.map(match => match[1].replace(/\([^)]*\)/g, '')).join(' / ');
    const spoken = rawText.replace(/（[^）]*）/g, '').trim();
    if (!spoken) continue;
    const id = `wolf-${episode.id}-${String(index + 1).padStart(4, '0')}`;
    const generatedSegments = await toSegments(spoken);
    const segments = manualOverrides[id] || generatedSegments;
    cues.push({ id, time: time.split(' --> ')[0], timeEnd: time.split(' --> ')[1] || time.split(' --> ')[0], character: speaker, segments, english: englishOverrides[id] || '', notes: [] });
  }
  await fs.writeFile(path.join(OUT_DIR, `episode-${episode.id}.json`), `${JSON.stringify(cues, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(INTERMEDIATE_DIR, `episode-${episode.id}.json`), `${JSON.stringify(cues, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(REPORT_DIR, `episode-${episode.id}-summary.json`), `${JSON.stringify({ episode: episode.id, title: episode.title, cueCount: cues.length, rubySegments: cues.reduce((sum, cue) => sum + cue.segments.filter(segment => typeof segment !== 'string').length, 0) }, null, 2)}\n`, 'utf8');
}
console.log('Wolf dataset build complete.');

async function toSegments(text) {
  const sourceSegments = [];
  let cursor = 0;
  const inlineReading = /([一-龯々A-Za-z0-9]+)\(([^)]+)\)/g;
  for (const match of text.matchAll(inlineReading)) {
    if (match.index > cursor) sourceSegments.push(text.slice(cursor, match.index));
    sourceSegments.push({ kanji: match[1], reading: match[2] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) sourceSegments.push(text.slice(cursor));
  const result = [];
  for (const segment of sourceSegments) {
    if (typeof segment !== 'string' || !/[一-龯々]/u.test(segment)) { push(result, segment); continue; }
    const html = await kuroshiro.convert(segment, { mode: 'furigana', to: 'hiragana', format: 'html' });
    let last = 0;
    for (const match of html.matchAll(/<ruby>(.*?)((?:<rp>.*?<\/rp>)*)<rt>(.*?)<\/rt>(?:<rp>.*?<\/rp>)*<\/ruby>/g)) {
      const before = html.slice(last, match.index).replace(/<[^>]+>/g, '');
      push(result, before);
      push(result, { kanji: match[1].replace(/<[^>]+>/g, ''), reading: match[3].replace(/<[^>]+>/g, '') });
      last = match.index + match[0].length;
    }
    push(result, html.slice(last).replace(/<[^>]+>/g, ''));
  }
  return compact(result);
}
function push(segments, value) { if (!value) return; const previous = segments.at(-1); if (typeof value === 'string' && typeof previous === 'string') segments[segments.length - 1] = previous + value; else segments.push(value); }
function compact(segments) { return segments.filter(segment => typeof segment === 'string' ? segment.length > 0 : segment.kanji && segment.reading); }
function segmentsToText(segments) { return segments.map(segment => typeof segment === 'string' ? segment : segment.kanji).join(''); }
function compactNotes(notes, counts) {
  const compacted = [];
  for (const note of notes) {
    for (const part of note.replace(/^Useful vocabulary:\s*/u, '').split(/;\s*/u)) {
      const words = part.trim().split(/\s+/u).filter(Boolean);
      if (!words.length) continue;
      const short = words.length <= 10 ? part.trim() : `${words.slice(0, 10).join(' ')}…`;
      const count = counts.get(short) || 0;
      if (count >= 3 || compacted.includes(short)) continue;
      counts.set(short, count + 1);
      compacted.push(short);
      if (compacted.length === 2) return compacted;
    }
  }
  return compacted;
}
function defaultNotes(text) {
  const notes = [];
  const shortExpressions = [
    [/わーい/u, 'わーい is an upbeat “yay!” The stretched vowel makes the reaction feel bright and openly excited.'],
    [/やったぜ/u, 'やったぜ means “I did it!” or “yes!” The sentence-ending ぜ adds a bold, casual masculine flavor.'],
    [/イエーイ|わいわい/u, 'イエーイ is “yeah!” and わいわい evokes lively cheering or group excitement. Both are deliberately informal.'],
    [/すごすぎます/u, 'すごすぎます is すごい + すぎる: “it is too amazing / unbelievably impressive.” すぎる intensifies the adjective.'],
    [/すごいなあ/u, 'なあ stretches the speaker’s admiration into a reflective reaction: “wow, that really is something.”'],
    [/おっ/u, 'おっ is a clipped “oh!” used when someone notices or realizes something. It is casual and more abrupt than あっ.'],
    [/ハァ/u, 'ハァ… is a sigh rather than a lexical sentence; its feeling can be fatigue, resignation, or emotional overload.'],
  ];
  for (const [pattern, note] of shortExpressions) {
    if (pattern.test(text)) notes.push(note);
  }
  const rules = [
    [/ないといけない|なきゃいけない/u, 'ないといけない expresses obligation: “have to.” In conversation, it often sounds like the speaker is accepting an unpleasant rule.'],
    [/ことになりました/u, 'ことになりました presents a decision or arrangement as settled news, rather than emphasizing who made the decision.'],
    [/てしまっ|ちゃっ/u, 'てしまう / ちゃう adds a sense of completion, regret, or “it happened before I could stop it”; the casual ちゃう feels especially conversational.'],
    [/んだろ|のかな/u, 'んだろ / のかな turns the sentence inward: “I wonder…” It makes uncertainty feel personal and invites the listener into the speaker’s thought.'],
    [/んやろ/u, 'んやろ is a casual regional form of んだろう: “I wonder / probably.” It gives the uncertainty a relaxed, conversational color.'],
    [/だな|だね/u, 'だな / だね turns a statement into an audible self-reaction: “that is…” or “I suppose.” The ending makes the feeling linger.'],
    [/マジで|本当に/u, 'マジで / 本当に intensifies the statement: “seriously / really.” マジで is the more casual, punchy choice.'],
    [/ちょっと/u, 'ちょっと literally means “a little,” but in conversation it often softens a request, hesitation, or criticism rather than measuring an amount.'],
    [/すぎて|すぎる/u, 'すぎる means “too much / excessively.” With て, すぎて links the excess to its result: “so… that…” or “too… to…”.'],
    [/という感じ|って感じ/u, 'という感じ means “the feeling is…” or “something like…” It deliberately avoids making the description sound too definite.'],
    [/とか/u, 'とか gives examples without claiming the list is complete: “things like…” It is a very natural way to keep casual speech open-ended.'],
    [/ましょう/u, 'ましょう is the polite “let’s…” form. It can be a genuine invitation or a gentle proposal, depending on the relationship.'],
    [/呼び捨て/u, '呼び捨て means using someone’s name without an honorific. Whether it feels intimate, bold, or rude depends on the relationship and the moment.'],
    [/一応/u, '一応 means “for now / just in case / technically.” It often downplays the claim so the speaker does not sound overly confident.'],
    [/全然/u, '全然 usually pairs with a negative (“not at all”), but in relaxed modern speech it can also intensify a positive: “totally / really.”'],
    [/わりと/u, 'わりと means “relatively / fairly.” It softens the comparison and sounds less absolute than “very” or “definitely.”'],
    [/し(?:[、。！]|$)/u, 'し adds another reason or point, often leaving the list unfinished. It makes the speaker sound conversational rather than neatly conclusive.'],
    [/ように/u, 'ように means “so that / in the way that.” It often links an action to a desired result or a model to imitate.'],
    [/たら/u, 'たら frames a condition or discovery: “if / when.” In conversation it can also introduce what happened next.'],
    [/ほしい/u, 'ほしい expresses the speaker’s desire for something; with a verb, 〜てほしい means “I want someone to…”'],
    [/ても/u, 'ても means “even if / even though,” setting up a condition that does not change the result.'],
    [/(?:^|[\s「『“])って/u, 'って is the spoken form of と言って / という: it quotes a phrase or frames an idea without sounding formal.'],
    [/ばっかり/u, 'ばっかり means “mostly / nothing but” in casual speech and can carry a hint of exaggeration or complaint.'],
    [/ほど/u, 'ほど marks a degree: “the more…,” “to the extent that…,” or “as much as…,” depending on the phrase around it.'],
    [/のに/u, 'のに marks a contrast—“even though / despite that”—so the line often carries disappointment or surprise.'],
    [/じゃん/u, 'じゃん is a casual “see? / after all / isn’t it?” It presents the point as obvious or shared knowledge.'],
    [/やっぱ/u, 'やっぱ(り) means “as expected / when you think about it,” often showing that the speaker’s first impression has been confirmed.'],
    [/なんか/u, 'なんか is a spoken softener meaning “somehow / kind of.” It makes the thought less sharply defined and more conversational.'],
    [/でも|けど/u, 'でも / けど marks a turn or contrast. When the sentence trails off, the unfinished ending lets the hesitation or emotion remain unspoken.'],
    [/みたい/u, 'みたい means “like / seems,” making the comparison or impression less absolute.'],
    [/そう/u, 'そう can mean “seems / looks” or “that way.” Check what comes before it: it may describe an appearance or refer back to an idea.'],
  ];
  for (const [pattern, note] of rules) {
    if (pattern.test(text) && notes.length < 2) notes.push(note);
  }
  if (notes.length === 0 && /…|⸺$/.test(text)) {
    notes.push('The trailing pause is meaningful: the speaker leaves the thought unfinished, often because the feeling is awkward, obvious, or still forming.');
  }
  if (notes.length === 0) {
    const vocabulary = [
      ['オオカミ', 'wolf'], ['騙', 'deceive / be deceived'], ['ついに', 'finally / at last'], ['スタート', 'start'], ['シリーズ', 'series / installment'],
      ['配信', 'streaming / distribution'], ['大人', 'adult / grown-up'], ['愛', 'love'], ['ウソ', 'lie'], ['恋', 'romantic love'], ['番組', 'program / show'],
      ['条件', 'condition / rule'], ['正体', 'true identity'], ['役割', 'role'], ['孤独', 'loneliness'], ['一目', 'first glance'],
      ['気持ち', 'feeling'], ['買い物', 'shopping'], ['景色', 'scenery / view'], ['相談', 'consultation / talking something over'],
      ['お願い', 'request / favor'], ['大切', 'important / precious'], ['参加', 'participation'], ['告白', 'confession of love'], ['すごい', 'amazing / impressive'], ['悲しい', 'sad'], ['深い', 'deep'], ['上手', 'skilled / good at'], ['分かる', 'understand / get it'], ['緩く', 'loosely / casually'],
    ];
    const found = vocabulary.filter(([word]) => text.includes(word)).slice(0, 2);
    if (found.length) notes.push(`Useful vocabulary: ${found.map(([word, gloss]) => `${word} = ${gloss}`).join('; ')}.`);
  }
  return notes;
}
