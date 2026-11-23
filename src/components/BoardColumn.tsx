import type { ItemRow, TicketIndex } from './roadmapLib';
import ItemCard from './ItemCard';

interface Props {
  title: string;
  /** The column's status, for its colour; `closed` for the folded column of closed tickets. */
  status?: string;
  rows: ItemRow[];
  showStatus: boolean;
  index: TicketIndex;
  /** Fold the column shut, as the closed tickets are on a status board. */
  folded?: boolean;
}

// One board column: a header with a count, then its cards. A folded column is a native
// `<details>`, so it opens by keyboard and by tap with no script of its own
// ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)).
export default function BoardColumn({ title, status, rows, showStatus, index, folded = false }: Props) {
  const header = (
    <>
      <span className="rm-col__t">{title}</span>
      <span className="rm-col__n">{rows.length}</span>
    </>
  );
  const body = (
    <div className="rm-col__body">
      {rows.map((r) => (
        <ItemCard key={r.path} row={r} showStatus={showStatus} index={index} />
      ))}
      {rows.length === 0 ? <p className="rm-col__empty">None</p> : null}
    </div>
  );
  if (folded) {
    return (
      <details className="rm-col" data-status={status} data-folded="1">
        <summary className="rm-col__h">{header}</summary>
        {body}
      </details>
    );
  }
  return (
    <section className="rm-col" data-status={status}>
      <header className="rm-col__h">{header}</header>
      {body}
    </section>
  );
}
