// The valid stores and expected rows from the pinned Dibber conformance suite.
// [DIB-12](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-12.md)
import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@immediately-run/mdx-plugins/frontmatter';
import { stores } from './__fixtures__/dibber-conformance.json';
import { isItemMeta, itemRows, pageRole, ticketIndex, waitsOf } from './components/roadmapLib';
import type { Meta } from './components/roadmapLib';

describe('Dibber valid conformance stores', () => {
  for (const [name, { files, tickets }] of Object.entries(stores)) {
    it(`reads ${name}`, () => {
      const rows = itemRows(files.map(({ path, text }) => ({
        path: `/${path}`, href: `#/${path}`, meta: parseFrontmatter(text).data as Meta,
      })));
      expect(rows.map(({ id, status, parent, dependsOn }) => ({
        id, status, parent: parent || null, depends_on: dependsOn,
      }))).toEqual(tickets);
      if (name === 'random-ids') {
        const row = rows.find(({ id }) => id === 'is-01kf5zyg8h')!;
        expect(waitsOf(row, ticketIndex(rows).ready)).toEqual([
          { id: 'other:tek-m5tt', why: 'outside' },
        ]);
      }
    });
  }
});

it('recognizes migrated pages and work kinds (DIB-27)', () => {
  const page = { id: 'project-one', page: 'project', status: 'active' };
  expect(pageRole(page)).toBe('project');
  expect(isItemMeta(page)).toBe(false);
  expect(isItemMeta({ id: 'X-1', status: 'available', kind: 'bug' })).toBe(true);
});
