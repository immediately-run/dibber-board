// The ticket vocabulary — data, not components.
//
// These are Dibber's words (https://github.com/immediately-run/dibber, SPEC.md): `status:`,
// `project:`, `prs:` and `depends_on:` mean something to a ticket store, not to a wiki engine
// (`grove/docs/ENGINE_BOUNDARY.md` §3), so they live in this viewer rather than in Grove, and
// a store opens here through the `opensWith` marker in its `immediately.run.json`.
//
// Kept out of the component files deliberately: a module that exports a React
// component must export ONLY components or Fast Refresh stops working. `<RoadmapBoard>`,
// `<StatusBadge>`, `<NextAvailable>`, `<Dependencies>`, `<RoadmapMeta>` and
// `<ProjectItems>` all read their ordering and labels from here.
//
// The status values are owned by Dibber's R-DIB-6 and checked by `dibber check` (and by each
// store's own checker); this module is the RENDERING view of them (order, class and label),
// never a second source of truth for which values are legal.

/** A ticket's status: Dibber's R-DIB-6 values, in its three classes. */
export type ItemStatus =
  | 'available'
  | 'in-progress'
  | 'in-review'
  | 'deprioritized'
  | 'done'
  | 'withdrawn'
  | 'superseded'
  | 'deferred';

/** The live statuses (R-DIB-6), in board column order: the lifecycle left to right, the
 *  parked state last. Every one gets a column on a status board, empty or not, so the
 *  board's shape is the same in every store ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)). */
export const LIVE_STATUSES: ItemStatus[] = ['available', 'in-progress', 'in-review', 'deprioritized'];

/** The closed statuses (R-DIB-6): done, then the three ways a ticket is withdrawn. Closure is
 *  read from `status` alone, in any folder (R-DIB-2); a status board puts these in one
 *  collapsed column. */
export const CLOSED_STATUSES: ItemStatus[] = ['done', 'withdrawn', 'superseded', 'deferred'];

/** Every status, in board order. */
export const STATUS_ORDER: ItemStatus[] = [...LIVE_STATUSES, ...CLOSED_STATUSES];

export const STATUS_LABEL: Record<ItemStatus, string> = {
  available: 'Available',
  'in-progress': 'In progress',
  'in-review': 'In review',
  deprioritized: 'Deprioritized',
  done: 'Done',
  withdrawn: 'Withdrawn',
  superseded: 'Superseded',
  deferred: 'Deferred',
};

/** Is this a closed status? An unknown status is not: it stays on the board, at the end. */
export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.includes(status as ItemStatus);
}

/** The one claimable state — what `roadmap/next-available.sh` looks for. */
export const CLAIMABLE: ItemStatus = 'available';

/** A project's own author-set lifecycle (NOT a rollup of its items' statuses). */
export const PROJECT_STATUS_ORDER = ['active', 'proposed', 'paused', 'complete', 'superseded'] as const;

/** Order an arbitrary status list by the lifecycle, unknown values last (stable). */
export function byStatusOrder(a: string, b: string): number {
  const ia = STATUS_ORDER.indexOf(a as ItemStatus);
  const ib = STATUS_ORDER.indexOf(b as ItemStatus);
  return (ia === -1 ? STATUS_ORDER.length : ia) - (ib === -1 ? STATUS_ORDER.length : ib);
}

/** A human label for a status, falling back to the raw value. */
export function statusLabel(status: string): string {
  return STATUS_LABEL[status as ItemStatus] ?? status;
}
