// The board over a plain Dibber store
// ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)).
//
// The store is Dibber's own conformance fixture `valid/every-key` (dibber 38435b8), copied
// verbatim into `__fixtures__/dibber-every-key/`: every key of the format, every status. Its
// frontmatter is parsed with `parseFrontmatter`, the engine's own parser (Grove's corpus scan
// calls it), so the rows here are the rows the viewer would get. The SDK is the one thing
// stood in for: the bundle hooks hand out those entries and `Link` is a plain anchor.
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseFrontmatter } from '@immediately-run/mdx-plugins';
import ek1 from './__fixtures__/dibber-every-key/tickets/EK-1.md?raw';
import ek2 from './__fixtures__/dibber-every-key/tickets/EK-2.md?raw';
import ek3 from './__fixtures__/dibber-every-key/tickets/EK-3.md?raw';
import ek4 from './__fixtures__/dibber-every-key/tickets/EK-4.md?raw';
import ek5 from './__fixtures__/dibber-every-key/tickets/EK-5.md?raw';
import ek6 from './__fixtures__/dibber-every-key/tickets/EK-6.md?raw';
import ek7 from './__fixtures__/dibber-every-key/tickets/EK-7.md?raw';
import ek8 from './__fixtures__/dibber-every-key/tickets/EK-8.md?raw';
import ek9 from './__fixtures__/dibber-every-key/tickets/EK-9.md?raw';
import launch from './__fixtures__/dibber-every-key/tickets/projects/launch.md?raw';
import corpora from './__fixtures__/ticket-corpora.json';
import { boardLayout, isItemMeta, itemRows, ticketIndex, waitsOf } from './components/roadmapLib';
import type { Meta } from './components/roadmapLib';
import { CLOSED_STATUSES, LIVE_STATUSES } from './components/roadmapData';

const FILES: Record<string, string> = {
  '/EK-1.md': ek1,
  '/EK-2.md': ek2,
  '/EK-3.md': ek3,
  '/EK-4.md': ek4,
  '/EK-5.md': ek5,
  '/EK-6.md': ek6,
  '/EK-7.md': ek7,
  '/EK-8.md': ek8,
  '/EK-9.md': ek9,
  '/projects/launch.md': launch,
};

const ENTRIES = Object.entries(FILES).map(([path, text]) => ({
  path,
  href: `#${path}`,
  meta: parseFrontmatter(text).data as Meta,
}));

const sdk = vi.hoisted(() => ({ current: null as null | { path: string; meta: Meta } }));

vi.mock('@immediately-run/sdk', () => ({
  useBundleEntries: () => ENTRIES,
  useBundle: () => ({ root: '/', toHref: (p: string) => `#${p}` }),
  useCurrentEntry: () => sdk.current,
  Link: ({ href, className, children }: { href: string; className?: string; children?: ReactNode }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { default: RoadmapBoard } = await import('./components/RoadmapBoard');
const { default: Dependencies } = await import('./components/Dependencies');
const { default: RoadmapMeta } = await import('./components/RoadmapMeta');
const { default: ProjectIndex } = await import('./components/ProjectIndex');

/** The ticket ids in each column of a rendered board, keyed by the column's `data-status`. */
function columnsOf(html: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const cols = html.split(/<(?:section|details) class="rm-col" data-status="/).slice(1);
  for (const col of cols) {
    const status = col.slice(0, col.indexOf('"'));
    out[status] = [...col.matchAll(/<span class="rm-card__id">([^<]+)<\/span>/g)].map((m) => m[1]);
  }
  return out;
}

const STORE_STATUS: Record<string, string> = Object.fromEntries(
  ENTRIES.filter((e) => isItemMeta(e.meta)).map((e) => [String(e.meta.id), String(e.meta.status)]),
);

describe("a plain Dibber store (dibber's every-key fixture)", () => {
  it('finds every ticket and no page (R-DIB-1)', () => {
    const ids = itemRows(ENTRIES).map((r) => r.id).sort();
    expect(ids).toEqual(['EK-1', 'EK-2', 'EK-3', 'EK-4', 'EK-5', 'EK-6', 'EK-7', 'EK-8', 'EK-9']);
  });

  it('renders every open ticket in its status column and every closed one in the closed column', () => {
    const cols = columnsOf(renderToStaticMarkup(<RoadmapBoard />));
    // Every live status gets a column, empty or not, in R-DIB-6's order, then the fold.
    expect(Object.keys(cols)).toEqual([...LIVE_STATUSES, 'closed']);
    for (const [id, status] of Object.entries(STORE_STATUS)) {
      if ((CLOSED_STATUSES as string[]).includes(status)) expect(cols.closed).toContain(id);
      else expect(cols[status]).toContain(id);
    }
    const placed = Object.values(cols).flat().sort();
    expect(placed).toEqual(Object.keys(STORE_STATUS).sort());
  });

  it('folds the closed column shut', () => {
    const html = renderToStaticMarkup(<RoadmapBoard />);
    expect(html).toMatch(/<details class="rm-col" data-status="closed" data-folded="1"><summary/);
    expect(html).not.toMatch(/<details[^>]* open/);
  });

  it('gives every status its own column with scope="all"', () => {
    const cols = columnsOf(renderToStaticMarkup(<RoadmapBoard scope="all" />));
    for (const [id, status] of Object.entries(STORE_STATUS)) expect(cols[status]).toContain(id);
    expect(Object.values(cols).flat()).toHaveLength(Object.keys(STORE_STATUS).length);
  });

  it('labels a qualified dependency as outside the store, not as missing (R-DIB-8)', () => {
    const rows = itemRows(ENTRIES);
    const index = ticketIndex(rows);
    const ek1Row = rows.find((r) => r.id === 'EK-1')!;
    expect(waitsOf(ek1Row, index.ready)).toEqual([
      { id: 'EK-2', why: 'status', status: 'in-progress' },
      { id: 'other:OT-9', why: 'outside' },
    ]);
    const html = renderToStaticMarkup(<RoadmapBoard />);
    expect(html).toContain('data-why="outside">waits on other:OT-9 in another repository</span>');
    expect(html).not.toContain('not in this store');

    sdk.current = { path: '/EK-1.md', meta: ENTRIES[0].meta };
    const deps = renderToStaticMarkup(<Dependencies />);
    sdk.current = null;
    expect(deps).toContain('<span class="rm-dep__id">other:OT-9</span><span class="rm-dep__note">another repository</span>');
  });

  it('shows the assignee, and a parent with its children', () => {
    const html = renderToStaticMarkup(<RoadmapBoard />);
    expect(html.match(/data-kind="assignee"[^>]*>sam</g)).toHaveLength(2); // EK-2, EK-3
    expect(html).toContain('>0/1 children done</span>'); // EK-6, parent of EK-2

    sdk.current = { path: '/EK-6.md', meta: ENTRIES[5].meta };
    const deps = renderToStaticMarkup(<Dependencies />);
    sdk.current = null;
    expect(deps).toMatch(/<span class="rm-deps__h">Children<\/span><a href="#\/EK-2.md"/);
  });

  it("links a ticket's project to its page, wherever the page is and whatever its extension", () => {
    sdk.current = { path: '/EK-2.md', meta: ENTRIES[1].meta };
    const html = renderToStaticMarkup(<RoadmapMeta />);
    sdk.current = null;
    expect(html).toContain('<a href="#/projects/launch.md" class="rm-chip">launch</a>');
  });

  it('shows ready counts, not queues, for a store without the queue convention', () => {
    const html = renderToStaticMarkup(<ProjectIndex />);
    expect(html).not.toMatch(/data-queue="(autonomous|operator|expedite)"/);
    expect(html).toMatch(/data-queue="blocked"/); // EK-1 waits on EK-2
  });
});

describe('R-DIB-1 picks the same tickets as the roadmap-item tag did', () => {
  // The frontmatter of every entry in the baton and docs ticket corpora that either rule
  // could pick, snapshotted by `scripts/snapshot-ticket-corpora.mjs` with the engine's parser.
  // Fieldhouse and hq were outside the session that wrote this; add them the same way.
  for (const [name, corpus] of Object.entries(corpora as Record<string, { commit: string; entries: { path: string; meta: Meta }[] }>)) {
    it(`${name} @ ${corpus.commit.slice(0, 7)}`, () => {
      const byRule = corpus.entries.filter((e) => isItemMeta(e.meta)).map((e) => e.path);
      const byTag = corpus.entries
        .filter((e) => Array.isArray(e.meta.tags) && e.meta.tags.includes('roadmap-item'))
        .map((e) => e.path);
      expect(byTag.length).toBeGreaterThan(300);
      expect(byRule).toEqual(byTag);
    });
  }
});

describe('boardLayout', () => {
  it('keeps the older scope names working', () => {
    const rows = itemRows(ENTRIES);
    expect(boardLayout(rows, { scope: 'live' })).toEqual(boardLayout(rows, { scope: 'open' }));
    expect(boardLayout(rows, { scope: 'archive' })).toEqual(boardLayout(rows, { scope: 'closed' }));
  });

  it('lets an explicit statuses list win over the scope', () => {
    const rows = itemRows(ENTRIES);
    const layout = boardLayout(rows, { statuses: 'done, available' });
    expect(layout.columns.map((c) => [c.key, c.rows.map((r) => r.id)])).toEqual([
      ['done', ['EK-5']],
      ['available', ['EK-1', 'EK-6']],
    ]);
    expect(layout.closed).toBeNull();
  });
});
