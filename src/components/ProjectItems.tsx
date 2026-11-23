import { useMemo } from 'react';
import { boardLayout } from './roadmapLib';
import type { BoardScope } from './roadmapLib';
import { statusLabel } from './roadmapData';
import { useBundleReady, useRoadmapRows, useTicketIndex } from './useRoadmapRows';
import { useProjectId } from './useProjectId';
import BoardColumn from './BoardColumn';

interface Props {
  /** The project id. Defaults to the current page's own `id` when it is a project. */
  project?: string;
  groupBy?: 'status' | 'repo' | 'tag';
  /** `open` (default): open members, with the closed folded into one column; `closed`: only
   *  the closed; `all`: every member. `live` and `archive` are older names for the first two. */
  scope?: BoardScope;
}

// `<ProjectItems>` — a Project's members, live, laid out like the board.
//
// **Membership is the TICKET's own `project:` field — the single source of truth** (R-DIB-10).
// This component is the query over it, so a project page NEVER hand-lists its tickets: add
// `project: <id>` to a new ticket and it appears here with no page edit.
export default function ProjectItems({ project, groupBy = 'status', scope = 'open' }: Props) {
  const id = useProjectId(project);
  const rows = useRoadmapRows();
  const index = useTicketIndex();
  const ready = useBundleReady();

  const layout = useMemo(
    () => boardLayout(id ? rows.filter((r) => r.project === id) : [], { groupBy, scope }),
    [rows, id, groupBy, scope],
  );

  const total = layout.columns.reduce((n, g) => n + g.rows.length, 0) + (layout.closed?.length ?? 0);

  if (!id) return <p className="grove-search__empty">No project named — pass <code>project="…"</code>.</p>;
  if (!ready) return <div className="rm-board" data-loading="1"><div className="sk sk-line" /></div>;
  if (!total) {
    return (
      <p className="grove-search__empty">
        No tickets carry <code>project: {id}</code> yet.
      </p>
    );
  }

  const byStatus = groupBy === 'status';
  return (
    <div className="rm-board" data-group={groupBy} data-project={id}>
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
