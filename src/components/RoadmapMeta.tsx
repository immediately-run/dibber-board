import { useMemo } from 'react';
import { Link, useBundleEntries, useCurrentEntry } from '@immediately-run/sdk';
import { isItemMeta, projectHref } from './roadmapLib';
import type { Meta } from './roadmapLib';
import StatusBadge from './StatusBadge';
import { PrLinks } from './ItemCard';

// `<RoadmapMeta>` — a ticket's header: status badge, PROJECT CHIP, assignee, repo chips,
// tags and PR links. Placed by the store's `_layout.mdx` so every ticket gets it with no
// per-entry markup; also available as an MDX component for explicit placement.
//
// The project chip is the TICKET→PROJECT direction of the bidirectional link (R3-226):
// it links to the `kind: project` page whose `id` the ticket's `project` names (R-DIB-10),
// wherever that page sits and whatever its extension, and the project page's own
// `<ProjectItems>` query supplies the reverse direction. Neither side is hand-listed. The
// href is the one the viewer gave that page's entry, never a path joined here: a content
// component that knew where the bundle sits would be wrong under dispatch.
export default function RoadmapMeta() {
  const current = useCurrentEntry<Meta>();
  const entries = useBundleEntries<Meta>();
  const meta = current?.meta;
  const project = typeof meta?.project === 'string' ? meta.project : '';
  const projectLink = useMemo(() => projectHref(entries, project), [entries, project]);
  if (!meta || !isItemMeta(meta)) return null;

  const repos: string[] = Array.isArray(meta.repos) ? meta.repos : [];
  const tags: string[] = Array.isArray(meta.tags)
    ? meta.tags.filter((t: string) => t !== 'roadmap-item' && !t.startsWith('ui/'))
    : [];
  const prs: string[] = Array.isArray(meta.prs) ? meta.prs : [];

  return (
    <div className="rm-meta">
      <StatusBadge status={meta.status} />
      {project && projectLink ? (
        <Link href={projectLink} className="rm-chip" data-kind="project" title="Project">
          {project}
        </Link>
      ) : project ? (
        <span className="rm-chip" data-kind="project" title="Project (no project page in this store)">
          {project}
        </span>
      ) : null}
      {meta.assignee ? (
        <span className="rm-chip" data-kind="assignee" title="assignee: who said they are working on it">
          {String(meta.assignee)}
        </span>
      ) : null}
      {repos.map((r) => (
        <span key={r} className="rm-chip" data-kind="repo">{r}</span>
      ))}
      {tags.map((t) => (
        <span key={t} className="rm-chip" data-kind="tag">{t}</span>
      ))}
      <PrLinks prs={prs} />
    </div>
  );
}
