// Writes `src/__fixtures__/ticket-corpora.json`: the keys the ticket rule reads (`id`, `kind`)
// and the key the old rule read (`tags`), for every entry of the ticket corpora that renders
// in this viewer, parsed with the engine's own frontmatter parser
// ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)).
//
//   node scripts/snapshot-ticket-corpora.mjs <name>=<checkout>/<store> …
//   node scripts/snapshot-ticket-corpora.mjs baton=../baton/tickets docs=../docs/content
//
// Each argument names a corpus and the folder its bundle opens at. The fixture records the
// commit each was read at, so the test's numbers can be traced back.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isContentEntryPath, parseFrontmatter } from '@immediately-run/mdx-plugins';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'src', '__fixtures__', 'ticket-corpora.json');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.mdx?$/.test(name)) acc.push(p);
  }
  return acc;
}

const corpora = {};
for (const arg of process.argv.slice(2)) {
  const eq = arg.indexOf('=');
  if (eq < 1) throw new Error(`expected <name>=<folder>, got ${arg}`);
  const name = arg.slice(0, eq);
  const root = arg.slice(eq + 1);
  const commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const entries = [];
  for (const file of walk(root).sort()) {
    const path = '/' + relative(root, file).split('\\').join('/');
    if (!isContentEntryPath(path)) continue;
    const { data } = parseFrontmatter(readFileSync(file, 'utf8'));
    // Only entries either rule could pick: one with an `id` or a `kind`, or one tagged
    // `roadmap-item`. Every other page is a page under both, and would only pad the file.
    const tagged = Array.isArray(data.tags) && data.tags.includes('roadmap-item');
    if (data.id === undefined && data.kind === undefined && !tagged) continue;
    const meta = {};
    for (const k of ['id', 'kind', 'tags']) if (data[k] !== undefined) meta[k] = data[k];
    entries.push({ path, meta });
  }
  corpora[name] = { commit, entries };
}
if (!Object.keys(corpora).length) throw new Error('name at least one corpus');
writeFileSync(out, JSON.stringify(corpora, null, 0).replace(/\},\{"path"/g, '},\n{"path"') + '\n');
console.log(Object.entries(corpora).map(([n, c]) => `${n}@${c.commit.slice(0, 7)}: ${c.entries.length}`).join(', '));
