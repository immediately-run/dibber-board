# Dibber Board

Open a repository's [Dibber](https://github.com/immediately-run/dibber) ticket store on
immediately.run and see it as a read-only kanban board, with a page per ticket and per project.
Nothing to build or host: the store's files are the data, and this app renders them.

It used to be `baton-board`, the viewer the docs, baton, fieldhouse and hq ticket wikis render
through. It now reads any Dibber store, so it carries the format's name
([DIB-18](https://github.com/immediately-run/dibber/blob/main/tickets/DIB-18.md)).

## Open a store on immediately.run

In a repository already using Dibber:

```
npx -y @immediately-run/dibber init --immediately-run
```

That adds three files to the store (`tickets/` unless `.dibber/config.json` names another
folder), and touches nothing that is already there:

- `immediately.run.json`, the marker that names this app as the store's viewer:

  ```json
  {
    "opensWith": { "app": "github:immediately-run/dibber-board", "version": "1.0" },
    "kind": "wiki"
  }
  ```

- `home.mdx`, a page holding `<NextAvailable />` and `<RoadmapBoard />`.
- `_layout.mdx`, the page shell that puts `<RoadmapMeta />` above each ticket and
  `<Dependencies />` below it.

The templates are in Dibber's [`templates/immediately-run/`](https://github.com/immediately-run/dibber/tree/main/templates/immediately-run).
Push, and the board opens at
`https://immediately.run/present/github/<owner>/<repo>/main/bundle/tickets/home.mdx`. A public
repository opens signed out. The board is read-only: tickets change in git, by `dibber` or by
hand.

The marker's `version` is the exact bundle-format version, never a range. The range is this
app's own `opens` entry (`^1` in `package.json`), and the host checks the marker's version
against it. The host refuses a range in the marker and renders the bundle as plain files
(`BUNDLE_EMBEDDING_SPEC` §4b.1).

The store contributes **data only** — frontmatter and Markdown — and the components render in
this app's frame with this app's authority. That keeps the platform's rule that a repository
cannot choose the code that renders it, and it is why the board can render `render: safe`
content at all.

## What it reads

The board reads the format as Dibber's [`SPEC.md`](https://github.com/immediately-run/dibber/blob/main/SPEC.md)
writes it. The reader tests run every valid Dibber conformance store from a pinned revision.

- **A ticket** is a `.md` or `.mdx` file whose frontmatter has an `id` and no `kind` other than
  `ticket` (R-DIB-1). A page with an `id` of its own says what it is with `kind`, so the board
  needs no tag or folder convention to tell them apart. (It used to need the `roadmap-item`
  tag; in the docs, baton, fieldhouse and hq stores the new rule picks out exactly the same files, and
  `src/board.test.tsx` pins that.)
- **Status** (R-DIB-6): each live status (`available`, `in-progress`, `in-review`,
  `deprioritized`) gets a column, empty or not. A closed ticket (`done`, `withdrawn`,
  `superseded`, `deferred`) goes in one folded column, whichever folder it sits in (R-DIB-2).
- **Ready** (R-DIB-8): an `available` ticket whose every `depends_on` is `done` or
  `superseded` is ready, as in the `dibber` command and in Baton. A dependency on another
  repository's ticket (`baton:B-111`) still holds the ticket, and the card says it is in
  another repository rather than missing.
- **Relations**: a card shows its `assignee` and, for a parent, how many of its children are
  done. A ticket page lists what it depends on, what it blocks, its parent and its children.
- **Projects** (R-DIB-10): a `kind: project` page, found by its `id` wherever it sits.

### This viewer's own conventions

Dibber lets a reader give tags a meaning of its own, as long as it says so (R-DIB-9). These
come from the immediately.run roadmap, and a store that uses none of them never sees them:

- **`EXPEDITE`** (tag): the ticket goes to the front of the next-to-start list.
- **`OP`** (tag), or a **`Requires:` clause** at the end of `description` naming a resource an
  agent session does not hold: the ticket waits on a person. The project index then counts
  ready tickets by queue (expedite, autonomous, operator). A store with no such tag or clause
  sees a plain "ready" count instead.
- **`roadmap-item`** (tag): not shown as a chip, since every ticket in the older stores
  carries it.

## The components

| Name | What it renders | Props |
|---|---|---|
| `RoadmapBoard` | the board | `groupBy` (`status`, `project`, `repo`, `tag`), `scope` (`open`, `closed`, `all`), `filterTag`, `statuses` (a comma list naming the columns) |
| `NextAvailable` | the next ready tickets | `limit` |
| `RoadmapMeta` | a ticket's header line | — |
| `Dependencies` | a ticket's relations | `id` |
| `StatusBadge` | a status pill | `status`, `title` |
| `ProjectIndex` | every project with its rollups, then the tickets in none | `showUnclustered` |
| `ProjectItems` | one project's tickets, as a board | `project`, `groupBy`, `scope` |
| `ProjectMeta` | a project's rollup line | `project` |
| `ProjectMembers` | the members section of a project page | — |
| `TopicIndex` | entries grouped by `topics` | `filter` |

The names keep their roadmap-era spelling (`RoadmapBoard`, not `Board`) because the existing
ticket wikis place them by name. `scope` also accepts its older values, `live` and `archive`.

## What is here

- `src/main.tsx` — `boot({ mdxComponents: COMPONENTS, children: <App /> })`, the shell's
  map handed to the compiler and to the safe renderer. Without this line a marker's
  `<RoadmapBoard />` renders as nothing (R3-280, Drill 3).
- `src/App.tsx` — default-exports `<GroveApp />` and nothing else (the Fast Refresh rule).
- `src/components.ts` — `COMPONENTS = extendComponents(GROVE_MDX, { … })` over the **ten**
  names every ticket marker registers: `RoadmapBoard`, `RoadmapMeta`, `NextAvailable`,
  `Dependencies`, `ProjectIndex`, `ProjectItems`, `ProjectMembers`, `ProjectMeta`,
  `StatusBadge`, `TopicIndex`. These are additions, not overrides — nothing in the Grove
  manifest is composed over.
- `src/components/` — those components, their layout pieces (`ItemCard`, `QueueChips`,
  `InlineProse`) and their helpers (`roadmapData.ts`, `roadmapLib.ts`, `useProjectId.ts`,
  `useRoadmapRows.ts`, `roadmap.css`).
- `src/components.test.ts` — the contract: the ten names, that the map adds exactly ten,
  that every name in Baton's pre-switch marker fixture is covered, and that `Callout`
  still resolves to Grove's stock component.
- `src/board.test.tsx` — the board over Dibber's own `every-key` conformance store (copied
  into `src/__fixtures__/dibber-every-key/`), and the ticket rule over the docs and baton
  corpora (`src/__fixtures__/ticket-corpora.json`, written by
  `scripts/snapshot-ticket-corpora.mjs`).

## Where the components came from

They were Baton's, at commit
[`d0c5cf7`](https://github.com/immediately-run/baton/tree/d0c5cf79c646ae0ade053033a2edd2beb4cb9fb6/tickets/components)
`d0c5cf79c646ae0ade053033a2edd2beb4cb9fb6`, from `tickets/components/` — the most complete
of the copies. Git history does not cross repositories, so the move is a fresh first commit
here and Baton's copy goes away in the same change that points its marker at this app
(B-114).

Two things changed in the move and nothing else did:

- `InlineProse.tsx`'s header comment, which said the file was a corpus copy that could not
  path into the viewer's filesystem. It is app code now; the comment says so.
- `@immediately-run/mdx-plugins` became a direct dependency of this package. `InlineProse`
  imports `parseInlineProse` from it, and it used to arrive through Baton's toolchain
  rather than through a declared dependency; declared at Grove's own pin (`0.8.0`) so the
  parser is the one the engine parses with.

## Dependencies

```json
"@immediately-run/grove": "github:immediately-run/grove#e5e32849d946e1729bde8eff83102fa24d822335",
"@immediately-run/sdk": "^0.93.0",
"react": "^19.2.5",
"react-dom": "^19.2.5"
```

Grove is pinned **by commit**, never a branch: `LIBRARY_MOUNTS_SPEC §6/§7` makes a
commit-pinned ref immutable and cache-first, so this app is reproducible and fast. The pin
is the merge of grove#108 (package version 0.2.11), which re-reads a corpus file when it
changes, so a ticket's frontmatter edit reaches the board without a reload; grove#107
before it added the `logo:` key the board's top bar reads. Every commit since grove#105 builds its cache zip with
`libraryArtifacts: true` (R3-1345): the zip carries `files[].library`, the mounted-path
variants the sandbox seeds for a git library (R3-1343), so grove's modules run from the
cached zip instead of cold-transpiling on every boot.

The SDK line is not decoration. Grove declares the SDK and React in both `dependencies` and
`peerDependencies`; a shell whose range does not satisfy the engine's peer gets **no**
`ERESOLVE` — npm quietly satisfies the engine privately, and the shell ends up with two SDK
copies whose `TinkerableContext` objects are not the same object. Check it::

```
npm ls @immediately-run/sdk     # exactly one, deduped under @immediately-run/grove
```

## Type-checking the engine

Grove ships TSX **source**, not declarations, so `tsc --noEmit` type-checks the engine the
way its own build does: `moduleResolution: bundler`, `skipLibCheck: true` (Grove's own
setting, and only declaration-internal details are skipped), and `src/env.d.ts` carries the
one line that makes an app's ambient `fs` real —
`/// <reference types="@immediately-run/sdk/ambient" />`, Grove's `devfs.d.ts` by another
name. Every `.ts`/`.tsx` under `src` is checked against Grove's real exported types and the
SDK's, so a component whose surface changed fails here rather than at render time.

## Checks

```
npm install
npm ls @immediately-run/sdk   # one copy
npm run typecheck
npm test
```

## License

Copyright 2026 Peter Neumark. Dibber Board is licensed under the
[Apache License, Version 2.0](LICENSE); see [NOTICE](NOTICE). Its components came from Baton
and Grove, both Apache-2.0 by the same copyright holder.
