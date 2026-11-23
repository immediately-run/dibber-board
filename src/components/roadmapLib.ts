// Pure helpers for the roadmap surfaces — no React, no components (the Fast-Refresh
// rule: a module exporting a component exports only components). The board, dependency
// graph, next-available card, item header and project views all read the SAME projection
// from here, so "what is a roadmap item" is defined once.
//
// **What changed when this moved out of the Grove fork and into the corpus (R3-174).**
// Two things, and both are the point rather than incidental damage:
//
//  1. **Rows are built from `useBundleEntries()`, not from the raw metadata store.** The
//     store is keyed by ABSOLUTE module path, which under dispatch means
//     `/mnt/<hash>/roadmap/R3-174.mdx` — a host-minted chroot that is not stable across
//     loads and that content must never publish. The bundle scope hands out
//     bundle-absolute paths (`/roadmap/R3-174.mdx`) instead, identical under fork,
//     library and dispatch composition (`PLATFORM_LAYERING_SPEC` §1.1).
//  2. **A row carries its own `href`.** Bundle-path→URL is the VIEWER's policy and the
//     packagings genuinely disagree about it, so the viewer supplies the mapping and
//     nothing here computes a URL. That is what lets these components render correctly in
//     a viewer this corpus has never heard of.

import type { BundleEntry } from '@immediately-run/sdk';
import { LIVE_STATUSES, byStatusOrder, isClosedStatus } from './roadmapData';

/** One ticket, projected out of the frontmatter index. */
export type ItemRow = {
  /** Bundle-absolute path (`/roadmap/R3-174.mdx`) — never the mount path. */
  path: string;
  /** Where to navigate for this item, per the viewer's mapping. */
  href: string;
  id: string;
  title: string;
  status: string;
  project: string;
  repos: string[];
  tags: string[];
  order: number;
  prs: string[];
  dependsOn: string[];
  /** The local id this ticket is a child of (R-DIB-8), or `''`. */
  parent: string;
  /** Who said they are working on it: advisory, never a lock (R-DIB-5). `''` when unset. */
  assignee: string;
  /** The resources the item's `Requires:` clause names, in clause order. Empty when the
   *  item carries no clause — an absent clause means "not recorded", which is a different
   *  fact from the explicit `['none']` that means "checked, nothing needed" (R3-646). */
  requires: string[];
  /** Closed by its `status` (R-DIB-6), in whichever folder it sits: closure is read from
   *  the status alone (R-DIB-2), so a legacy `archive/` folder is a folder like any other. */
  closed: boolean;
};

/**
 * The resources a `description:`'s `Requires:` clause names, or `[]` when there is none.
 *
 * SECOND COPY, DELIBERATELY. The first is `requiredResources` in
 * `scripts/check-roadmap-requires.mjs`, which gates the board in `verify`. Neither can
 * import the other: that one is node ESM outside the bundle, this one ships INSIDE the
 * corpus bundle and must not path into the viewer's filesystem (`MDX_FROM_MOUNT_SPEC` §2).
 * The divergence that would matter — one accepting a clause the other rejects — is pinned
 * by the same fixture strings asserted on both sides (`src/test/roadmap.test.ts` here,
 * the script's `--self-test` there). Change one, change both.
 *
 * The LAST occurrence wins, not the first: a description may legitimately discuss the
 * mechanism before carrying its own clause, and matching the first hit reads that prose as
 * a resource list.
 */
export function requiredResources(description: unknown): string[] {
  if (typeof description !== 'string') return [];
  const all = [...description.matchAll(/Requires:\s*([^.]*)\./g)];
  if (all.length === 0) return [];
  return all[all.length - 1][1]
    .split(',')
    .map((r) => r.trim().replace(/^`|`$/g, ''))
    .filter(Boolean);
}

// The frontmatter index is untyped by nature; each field is narrowed at use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Meta = Record<string, any>;

const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : typeof v === 'string' && v ? [v] : [];

/**
 * Is this bundle path a readable entry?
 *
 * The engine applies the same rule to decide what to route and list; it is restated here
 * (rather than imported) because a content component must not path into the viewer's
 * filesystem — that is the two-filesystem rule in `MDX_FROM_MOUNT_SPEC` §2, and it is what
 * keeps this corpus renderable by a viewer that never heard of it. The rule itself is
 * three lines and is pinned by this corpus's own checker.
 */
export function isEntryPath(path: string): boolean {
  if (!/\.mdx?$/.test(path)) return false;
  return !(path.split('/').pop() || '').startsWith('_');
}

/**
 * Is this metadata entry a ticket? Dibber's R-DIB-1: its frontmatter carries an `id` and no
 * `kind` other than `ticket`. Every other page with an `id` says what it is with `kind`
 * (`project`, `doc`, …), so no folder convention or tag is needed to tell them apart
 * ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)). In the
 * docs and Baton corpora this picks out exactly the files tagged `roadmap-item`, which is what
 * the board used to key on (`roadmapLib.test.ts` pins it).
 */
export function isItemMeta(meta: Meta | undefined): boolean {
  if (!meta) return false;
  const id = meta.id;
  if (id === undefined || id === null || String(id) === '') return false;
  return meta.kind === undefined || meta.kind === null || meta.kind === '' || meta.kind === 'ticket';
}

/** A dependency on another repository's ticket: `<repo>:<ID>` (R-DIB-4, R-DIB-8). */
const QUALIFIED_ID = /^[a-z0-9][a-z0-9._-]*:[A-Z][A-Z0-9]*-[0-9]+[a-z0-9]*$/;

/** Is this `depends_on` entry another repository's ticket? */
export function isQualifiedId(id: string): boolean {
  return QUALIFIED_ID.test(id);
}

/** The project id an entry DESCRIBES: its own `id` when it is a `kind: project` page,
 *  else `''`. The empty string is the gate every project surface reads — a page that
 *  is not a project entity has no members to show, so its chrome renders nothing. */
export function projectIdOf(meta: Meta | undefined): string {
  return meta?.kind === 'project' ? String(meta.id ?? '') : '';
}

/** The href of the project page a ticket's `project` names: the `kind: project` entry
 *  whose `id` it is (R-DIB-10), or `null` when the store has no such page. */
export function projectHref(entries: BundleEntry<Meta>[], project: string): string | null {
  if (!project) return null;
  const page = entries.find((e) => isEntryPath(e.path) && projectIdOf(e.meta) === project);
  return page ? page.href : null;
}

/** Project one bundle entry as a row. Lists stay lists — frontmatter carries any JSON
 *  value, so nothing is encoded and nothing has to be decoded. */
export function toRow(entry: BundleEntry<Meta>): ItemRow {
  const meta = entry.meta;
  const tags = list(meta.tags);
  const status = String(meta.status ?? '');
  return {
    path: entry.path,
    href: entry.href,
    id: String(meta.id ?? ''),
    title: String(meta.title ?? ''),
    status,
    project: meta.project ?? '',
    repos: list(meta.repos),
    tags,
    order: Number(meta.order ?? 9999) || 9999,
    prs: list(meta.prs),
    dependsOn: list(meta.depends_on),
    parent: String(meta.parent ?? ''),
    assignee: String(meta.assignee ?? ''),
    requires: requiredResources(meta.description),
    closed: isClosedStatus(status),
  };
}

/** Every ticket in the bundle, open or closed, as rows in path order. */
export function itemRows(entries: BundleEntry<Meta>[]): ItemRow[] {
  return entries.filter((e) => isEntryPath(e.path) && isItemMeta(e.meta)).map(toRow);
}

/** Reading-order sort: by `order`, then by id, so a board column is stable. */
export function byOrder(a: ItemRow, b: ItemRow): number {
  return a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Bucket rows by a field, returning groups in lifecycle order for `status` and
 *  alphabetically otherwise. An item with N values for the field (repos, tags)
 *  appears in N buckets. */
export function groupRows(rows: ItemRow[], groupBy: string): { key: string; rows: ItemRow[] }[] {
  const buckets = new Map<string, ItemRow[]>();
  const push = (k: string, r: ItemRow) => {
    const cur = buckets.get(k);
    if (cur) cur.push(r);
    else buckets.set(k, [r]);
  };
  for (const r of rows) {
    if (groupBy === 'repo') {
      if (!r.repos.length) push('—', r);
      else for (const repo of r.repos) push(repo, r);
    } else if (groupBy === 'tag') {
      const own = r.tags.filter((t) => t !== 'roadmap-item');
      if (!own.length) push('—', r);
      else for (const t of own) push(t, r);
    } else if (groupBy === 'project') {
      push(r.project || 'unclustered', r);
    } else {
      push(r.status || 'unknown', r);
    }
  }
  const keys = [...buckets.keys()];
  keys.sort(groupBy === 'status' ? byStatusOrder : (a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return keys.map((key) => ({ key, rows: [...(buckets.get(key) ?? [])].sort(byOrder) }));
}

/** Which tickets a board shows: `open` (the default) shows open tickets in their columns and
 *  the closed ones folded into one; `closed` only the closed; `all` every ticket, each status
 *  its own column. `live` and `archive` are the older names for `open` and `closed`. */
export type BoardScope = 'open' | 'closed' | 'all' | 'live' | 'archive';

export type BoardColumn = { key: string; rows: ItemRow[] };

/** A board, laid out: its columns, and the closed tickets folded into one column of their
 *  own (`null` when the board does not fold them). */
export type BoardLayout = { columns: BoardColumn[]; closed: ItemRow[] | null };

/**
 * Lay out a board ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)).
 *
 * Grouped by status with the default scope, every live status of R-DIB-6 gets a column even
 * when it is empty, so a store shows the same shape however few tickets it has; a status the
 * board does not know follows them; and closed tickets (by `status`, in any folder) fold into
 * one column, `closed`. `statuses` names the columns and their order outright, from every
 * ticket, and wins over `scope`. Grouped any other way, the scope only filters.
 */
export function boardLayout(
  rows: ItemRow[],
  opts: { groupBy?: string; scope?: BoardScope; filterTag?: string; statuses?: string } = {},
): BoardLayout {
  const groupBy = opts.groupBy ?? 'status';
  const scope = opts.scope === 'live' ? 'open' : opts.scope === 'archive' ? 'closed' : (opts.scope ?? 'open');
  const tagged = opts.filterTag ? rows.filter((r) => r.tags.includes(opts.filterTag as string)) : rows;

  if (opts.statuses) {
    // An explicit subset also fixes the order — the author's list wins.
    const grouped = groupRows(tagged, groupBy);
    const wanted = opts.statuses.split(',').map((x) => x.trim()).filter(Boolean);
    return { columns: wanted.map((k) => grouped.find((g) => g.key === k) ?? { key: k, rows: [] }), closed: null };
  }

  const open = tagged.filter((r) => !r.closed);
  const closed = tagged.filter((r) => r.closed);
  if (scope === 'closed') return { columns: groupRows(closed, groupBy), closed: null };
  if (scope === 'all') return { columns: groupRows(tagged, groupBy), closed: null };
  if (groupBy !== 'status') return { columns: groupRows(open, groupBy), closed: null };

  const grouped = groupRows(open, 'status');
  const columns: BoardColumn[] = LIVE_STATUSES.map((k) => grouped.find((g) => g.key === k) ?? { key: k, rows: [] });
  for (const g of grouped) if (!(LIVE_STATUSES as string[]).includes(g.key)) columns.push(g);
  return { columns, closed: [...closed].sort(byOrder) };
}

// ─── Work queues and the ready gate ─────────────────────────────────────────────────────
//
// THE QUEUE RULE IS THIS VIEWER'S OWN CONVENTION, not Dibber's. The `EXPEDITE` and `OP` tags
// and the `Requires:` clause in `description` are the immediately.run roadmap's words; Dibber
// lets a reader give tags a meaning of its own as long as it documents them (R-DIB-9), and the
// README does. A store that uses none of them sees no queue chips (`usesQueues`). The rule
// mirrors `queueOf` / `AGENT_HOLDS` in docs' `scripts/lib/workQueues.mjs`, which this module
// cannot import: it ships inside the viewer's bundle, not the docs toolchain. Change one,
// change both.
//
// THE READY GATE is Dibber's R-DIB-8: an available ticket is ready once every ticket it
// `depends_on` is done.

/** What the autonomous line HOLDS — the capabilities an agent session has, the standing
 *  agent venue and the legacy names it fulfills. A `Requires:` name outside this set means
 *  the item waits on the operator. Mirrors `AGENT_HOLDS` in `scripts/lib/workQueues.mjs`. */
export const AGENT_HOLDS: readonly string[] = [
  'authentication',
  'llm-call',
  'create-pr',
  'drivable-browser',
  'agent-venue',
  'mcp-chrome',
  'local-host',
  'npm-publish',
  'none',
];

export type Queue = 'expedite' | 'operator' | 'autonomous';

/** Which queue an item waits in: the `EXPEDITE` tag jumps both lines; the `OP` tag, or any
 *  required resource the agent line does not hold, means the operator; else autonomous. */
export function queueOf(row: { tags?: string[] | null; requires?: string[] | null }): Queue {
  const tags = row.tags ?? [];
  if (tags.includes('EXPEDITE')) return 'expedite';
  if (tags.includes('OP')) return 'operator';
  if ((row.requires ?? []).some((r) => !AGENT_HOLDS.includes(r))) return 'operator';
  return 'autonomous';
}

/** What the ready gate needs to know about every other ticket: its status, by id. Built
 *  once per row set by `readyIndex`. */
export type ReadyIndex = ReadonlyMap<string, string>;

/** The statuses that satisfy a dependency: `done`, and `superseded`, whose replacement
 *  carries the work on. Baton's own ready gate counts the same two (`isDone` in baton's
 *  `src/defaults/tickets.ts`); the `dibber` command counts `done` alone, and which is right is
 *  part of Dibber's open DIB-20. */
const SATISFIES_DEPENDENCY = new Set(['done', 'superseded']);

/** The ready gate's lookup table over a full row set, open and closed. An id that appears
 *  twice (a stray copy beside an older archive) counts as done if either copy is. */
export function readyIndex(rows: ItemRow[]): ReadyIndex {
  const index = new Map<string, string>();
  for (const r of rows) {
    if (!r.id) continue;
    const seen = index.get(r.id);
    if (seen === undefined || !SATISFIES_DEPENDENCY.has(seen)) index.set(r.id, r.status);
  }
  return index;
}

/** Why a dependency still holds a ticket: it is in another repository, so this store cannot
 *  see it (R-DIB-8 still counts it); it names no ticket here; or the status it is in. */
export type Wait = { id: string; why: 'outside' | 'missing' | 'status'; status?: string };

/** The dependencies that still hold this ticket, in `depends_on` order. Empty means every
 *  dependency is done. Its own id is ignored. */
export function waitsOf(row: Pick<ItemRow, 'id' | 'dependsOn'>, index: ReadyIndex): Wait[] {
  const waits: Wait[] = [];
  for (const d of row.dependsOn) {
    if (d === row.id) continue;
    if (isQualifiedId(d)) {
      waits.push({ id: d, why: 'outside' });
      continue;
    }
    const status = index.get(d);
    if (status === undefined) waits.push({ id: d, why: 'missing' });
    else if (!SATISFIES_DEPENDENCY.has(status)) waits.push({ id: d, why: 'status', status });
  }
  return waits;
}

/** The ready gate: an `available` ticket is READY when nothing it depends on still holds it
 *  (`waitsOf`). Anything not `available` is never ready. */
export function isReady(row: Pick<ItemRow, 'id' | 'status' | 'dependsOn'>, index: ReadyIndex): boolean {
  return row.status === 'available' && waitsOf(row, index).length === 0;
}

/** Does this store use the queue conventions at all: an `EXPEDITE` or `OP` tag, or a
 *  `Requires:` clause, on any ticket? A store that does not sees `ready` counts, not queues. */
export function usesQueues(rows: ItemRow[]): boolean {
  return rows.some((r) => r.tags.includes('EXPEDITE') || r.tags.includes('OP') || r.requires.length > 0);
}

export type QueueRollup = {
  ready: number;
  autonomous: number;
  operator: number;
  expedite: number;
  blocked: number;
  inFlight: number;
};

/** The queue view of a member set (a project's tickets, the unclustered tickets):
 *  READY available tickets, in total and by queue; available tickets the ready gate holds as
 *  `blocked`; and `in-progress` + `in-review` as `inFlight`. Closed members are skipped.
 *  `index` must be built over the FULL row set — a dependency may sit in another project. */
export function queueRollup(members: ItemRow[], index: ReadyIndex): QueueRollup {
  const out: QueueRollup = { ready: 0, autonomous: 0, operator: 0, expedite: 0, blocked: 0, inFlight: 0 };
  for (const r of members) {
    if (r.closed) continue;
    if (r.status === 'in-progress' || r.status === 'in-review') out.inFlight++;
    else if (r.status === 'available') {
      if (isReady(r, index)) {
        out.ready++;
        out[queueOf(r)]++;
      } else out.blocked++;
    }
  }
  return out;
}

/** The next tickets to start — what `dibber list --ready` lists first. Only READY available
 *  tickets (the ready gate above); `EXPEDITE`-tagged tickets first, then execution order. A
 *  closed ticket is never ready, since it is not `available`. */
export function nextAvailable(rows: ItemRow[], limit = 1): ItemRow[] {
  const index = readyIndex(rows);
  const expedite = (r: ItemRow) => (r.tags.includes('EXPEDITE') ? 0 : 1);
  return rows
    .filter((r) => isReady(r, index))
    .sort((a, b) => expedite(a) - expedite(b) || byOrder(a, b))
    .slice(0, limit);
}

/** The reverse dependency edge: tickets whose `depends_on` names `id`. */
export function blockedByThis(rows: ItemRow[], id: string): ItemRow[] {
  return rows.filter((r) => r.dependsOn.includes(id)).sort(byOrder);
}

/** What a card needs to know beyond its own row: the ready gate's index, to say what still
 *  holds a ticket, and each parent's children: the tickets whose `parent` names it (R-DIB-8),
 *  derived by reading and never stored on the parent (R-DIB-7). Built once per row set. */
export type TicketIndex = { ready: ReadyIndex; children: ReadonlyMap<string, ItemRow[]> };

export function ticketIndex(rows: ItemRow[]): TicketIndex {
  const children = new Map<string, ItemRow[]>();
  for (const r of rows) {
    if (!r.parent) continue;
    const cur = children.get(r.parent);
    if (cur) cur.push(r);
    else children.set(r.parent, [r]);
  }
  for (const list of children.values()) list.sort(byOrder);
  return { ready: readyIndex(rows), children };
}

/** A short line for one wait, as a card or a ticket page shows it. */
export function waitLabel(w: Wait): string {
  if (w.why === 'outside') return `waits on ${w.id} in another repository`;
  if (w.why === 'missing') return `waits on ${w.id}, which is not in this store`;
  return `waits on ${w.id} (${w.status})`;
}

/** A count-by-status rollup, in lifecycle order — `<ProjectMeta>`'s informational
 *  summary. Deliberately NOT a project's own status (which is author-set). */
export function statusRollup(rows: ItemRow[]): { status: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => byStatusOrder(a[0], b[0]))
    .map(([status, count]) => ({ status, count }));
}

/** A GitHub URL for a `owner/repo#123` PR reference, or null if it isn't one. */
export function prUrl(ref: string): string | null {
  const m = ref.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (m) return `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}`;
  return /^https?:\/\//.test(ref) ? ref : null;
}

/** A short label for a PR reference (`owner/repo#12` → `repo#12`). */
export function prLabel(ref: string): string {
  const m = ref.match(/^[\w.-]+\/([\w.-]+)#(\d+)$/);
  if (m) return `${m[1]}#${m[2]}`;
  const n = ref.match(/\/pull\/(\d+)/);
  return n ? `#${n[1]}` : ref;
}
