import { useMemo } from 'react';
import { boardLayout } from './roadmapLib';
import type { BoardScope } from './roadmapLib';
import { statusLabel } from './roadmapData';
import { useBundleReady, useRoadmapRows, useTicketIndex } from './useRoadmapRows';
import BoardColumn from './BoardColumn';

interface Props {
  groupBy?: 'status' | 'project' | 'repo' | 'tag';
  /** Extra tag AND-filter, e.g. `SEC`. */
  filterTag?: string;
  /** Comma-separated subset/order override for the groups shown. */
  statuses?: string;
  /** `open` (default): open tickets, with the closed folded into one column; `closed`: only
   *  the closed; `all`: every ticket. `live` and `archive` are older names for the first two. */
  scope?: BoardScope;
}

// `<RoadmapBoard>` — the kanban board: a live, grouped query over every ticket in the store
// (R-DIB-1), so a ticket added to the folder appears with no page edit. Grouped by status it
// shows a column per live status and folds the closed tickets into one collapsed column
// ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)); the
// layout itself is `boardLayout`'s.
export default function RoadmapBoard({ groupBy = 'status', filterTag, statuses, scope = 'open' }: Props) {
  const rows = useRoadmapRows();
  const ready = useBundleReady();
  const index = useTicketIndex();

  const layout = useMemo(
    () => boardLayout(rows, { groupBy, scope, filterTag, statuses }),
    [rows, groupBy, filterTag, statuses, scope],
  );

  if (!ready) {
    return (
      <div className="rm-board" data-loading="1">
        {[0, 1, 2].map((i) => (
          <div className="rm-col" key={i}>
            <div className="sk sk-line" />
            <div className="sk sk-line" />
          </div>
        ))}
      </div>
    );
  }

  const total = layout.columns.reduce((n, g) => n + g.rows.length, 0) + (layout.closed?.length ?? 0);
  if (!total) return <p className="grove-search__empty">No tickets match.</p>;

  const byStatus = groupBy === 'status';
  return (
    <div className="rm-board" data-group={groupBy}>
      {layout.columns.map((g) => (
        <BoardColumn
          key={g.key}
          title={byStatus ? statusLabel(g.key) : g.key}
          status={byStatus ? g.key : undefined}
          rows={g.rows}
          showStatus={!byStatus}
          index={index}
        />
      ))}
      {layout.closed?.length ? (
        <BoardColumn title="Closed" status="closed" rows={layout.closed} showStatus index={index} folded />
      ) : null}
    </div>
  );
}
