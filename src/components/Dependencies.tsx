import { useMemo } from 'react';
import { Link, useCurrentEntry } from '@immediately-run/sdk';
import { blockedByThis, waitLabel, waitsOf } from './roadmapLib';
import type { ItemRow, Meta, Wait } from './roadmapLib';
import { useRoadmapRows, useTicketIndex } from './useRoadmapRows';
import StatusBadge from './StatusBadge';

function Edge({ row }: { row: ItemRow }) {
  return (
    <Link href={row.href} className="rm-dep">
      <span className="rm-dep__id">{row.id}</span>
      <StatusBadge status={row.status} />
    </Link>
  );
}

/** A dependency with no ticket here to link to: another repository's, or one that is not in
 *  this store. Labelled for which, so the first never reads as a broken link. */
function Outside({ wait }: { wait: Wait }) {
  return (
    <span className="rm-dep" data-why={wait.why} title={waitLabel(wait)}>
      <span className="rm-dep__id">{wait.id}</span>
      <span className="rm-dep__note">{wait.why === 'outside' ? 'another repository' : 'not in this store'}</span>
    </span>
  );
}

// `<Dependencies>` — the current ticket's relations (R-DIB-8), the directional complement to
// `<Backlinks>` ("who mentions this", undirected).
//
//   • Depends on — this ticket's own `depends_on`, each badged so you can see at a glance
//     whether it has landed. A qualified id (`baton:B-111`) is another repository's ticket,
//     which this store cannot see: it still holds the ticket, and says so, rather than
//     reading as a missing one ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)).
//   • Blocks     — the reverse edge, COMPUTED by querying tickets whose `depends_on` names
//     this id. Never stored, so the two directions cannot disagree (R-DIB-7).
//   • Parent / Children — `parent`, and the tickets whose `parent` names this one.
//
// Renders nothing when the ticket has no relation in any direction.
export default function Dependencies({ id }: { id?: string }) {
  const current = useCurrentEntry<Meta>();
  const currentPath = current?.path ?? null;
  const rows = useRoadmapRows();
  const index = useTicketIndex();

  const rel = useMemo(() => {
    const self = id ? rows.find((r) => r.id === id) : rows.find((r) => r.path === currentPath);
    if (!self) return null;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const unseen = new Map(waitsOf(self, index.ready).filter((w) => w.why !== 'status').map((w) => [w.id, w]));
    return {
      dependsOn: self.dependsOn
        .filter((d) => d !== self.id)
        .map((d) => byId.get(d) ?? unseen.get(d))
        .filter((x): x is ItemRow | Wait => Boolean(x)),
      blocks: blockedByThis(rows, self.id),
      parent: self.parent ? (byId.get(self.parent) ?? null) : null,
      children: index.children.get(self.id) ?? [],
    };
  }, [rows, index, currentPath, id]);

  if (!rel || (!rel.dependsOn.length && !rel.blocks.length && !rel.parent && !rel.children.length)) return null;

  return (
    <aside className="rm-deps">
      {rel.dependsOn.length ? (
        <div className="rm-deps__group" data-dir="blocked-by">
          <span className="rm-deps__h">Depends on</span>
          {rel.dependsOn.map((d) => ('path' in d ? <Edge key={d.path} row={d} /> : <Outside key={d.id} wait={d} />))}
        </div>
      ) : null}
      {rel.blocks.length ? (
        <div className="rm-deps__group" data-dir="blocks">
          <span className="rm-deps__h">Blocks</span>
          {rel.blocks.map((r) => <Edge key={r.path} row={r} />)}
        </div>
      ) : null}
      {rel.parent ? (
        <div className="rm-deps__group" data-dir="parent">
          <span className="rm-deps__h">Parent</span>
          <Edge row={rel.parent} />
        </div>
      ) : null}
      {rel.children.length ? (
        <div className="rm-deps__group" data-dir="children">
          <span className="rm-deps__h">Children</span>
          {rel.children.map((r) => <Edge key={r.path} row={r} />)}
        </div>
      ) : null}
    </aside>
  );
}
