import { useMemo } from 'react';
import { nextAvailable } from './roadmapLib';
import { useBundleReady, useRoadmapRows, useTicketIndex } from './useRoadmapRows';
import ItemCard from './ItemCard';

// `<NextAvailable>` — `dibber list --ready` as a live query: the first READY
// `status: available` ticket (every `depends_on` done — the ready gate in roadmapLib,
// R-DIB-8), `EXPEDITE`-tagged tickets ahead of the rest, then `order`: the one to start next.
// A blocked ticket is never shown here, however low its `order:`.
export default function NextAvailable({ limit }: { limit?: string | number }) {
  const rows = useRoadmapRows();
  const ready = useBundleReady();
  const index = useTicketIndex();
  const n = Math.max(1, Number(limit) || 1);
  const picks = useMemo(() => nextAvailable(rows, n), [rows, n]);

  if (!ready) return <div className="rm-next" data-loading="1"><div className="sk sk-line" /></div>;

  if (!picks.length) {
    return (
      <div className="rm-next" data-empty="1">
        <span className="rm-next__h">Next available</span>
        <p className="rm-col__empty">Nothing ready — every open ticket is taken, parked or waiting.</p>
      </div>
    );
  }

  return (
    <div className="rm-next">
      <span className="rm-next__h">Next available{picks.length > 1 ? ` (${picks.length})` : ''}</span>
      {picks.map((r) => <ItemCard key={r.path} row={r} index={index} />)}
    </div>
  );
}
