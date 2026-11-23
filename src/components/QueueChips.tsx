import type { QueueRollup } from './roadmapLib';

// `<QueueChips>` — a member set's queue rollup (`queueRollup` in roadmapLib) as chips:
// "1 expedite · 3 autonomous · 2 operator · 1 blocked · 2 in flight". Zero counts are
// omitted, so an all-zero rollup renders nothing. The queue counts are READY tickets only;
// `blocked` is available work the ready gate holds on an unfinished dependency. A store that
// does not use the queue convention (`byQueue` false) sees "2 ready" in place of the three
// queues ([DIB-13](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-13.md)).
const BY_QUEUE: { key: keyof QueueRollup; label: string }[] = [
  { key: 'expedite', label: 'expedite' },
  { key: 'autonomous', label: 'autonomous' },
  { key: 'operator', label: 'operator' },
  { key: 'blocked', label: 'blocked' },
  { key: 'inFlight', label: 'in flight' },
];

const PLAIN: { key: keyof QueueRollup; label: string }[] = [
  { key: 'ready', label: 'ready' },
  { key: 'blocked', label: 'blocked' },
  { key: 'inFlight', label: 'in flight' },
];

export default function QueueChips({ rollup, byQueue }: { rollup: QueueRollup; byQueue: boolean }) {
  return (
    <>
      {(byQueue ? BY_QUEUE : PLAIN).filter(({ key }) => rollup[key] > 0).map(({ key, label }) => (
        <span key={key} className="rm-chip" data-kind="queue" data-queue={key}>
          {rollup[key]} {label}
        </span>
      ))}
    </>
  );
}
