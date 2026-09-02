# Chameleon — Repository & Architecture

This document describes the shipped v1 structure. It is submission collateral, not the original scaffold plan.

## 1. Directory layout

```text
chameleon/
├── index.html
├── package.json
├── vite.config.ts                  # React + StyleX plugins
├── vitest.config.ts                # jsdom tests
├── wrangler.jsonc                  # Cloudflare static assets
├── public/                         # favicon, icons, demo video
├── docs/                           # tool, widget, architecture, demo, submission docs
├── src/
│   ├── main.tsx                    # mounts App; boots WebMCP after persisted hydration
│   ├── App.tsx                     # theme, header, banners, grid, activity footer
│   ├── app/
│   │   ├── styles.ts
│   │   └── suggestedPrompts.ts
│   ├── components/
│   │   ├── ActivityDrawer.tsx      # shared command log for the human
│   │   ├── AddWidgetMenu.tsx       # human-side note/checklist/table creation
│   │   ├── AgentPulse.tsx          # toast after an agent mutation
│   │   └── BoardTitle.tsx          # human-side board rename
│   ├── grid/
│   │   └── BoardGrid.tsx           # desktop drag/resize; mobile one-column stack
│   ├── model/                      # pure field, widget, layout, limits, migration logic
│   ├── store/
│   │   ├── boardStore.ts           # Zustand persist + mutation log + inverse-patch undo
│   │   ├── human.ts                # direct-manipulation commands
│   │   ├── mutate.ts               # public mutation gate wrapper
│   │   ├── selectors.ts            # agent snapshots, unfinished work, activity
│   │   ├── submit.ts               # shared form/minted-tool row append
│   │   └── persistStorage.ts       # localStorage quota health
│   ├── webmcp/
│   │   ├── boot.ts                 # register static tools after hydration
│   │   ├── makeTool.ts             # Zod parse, stale guard, MCP result wrapper
│   │   ├── modelContext.ts         # document first, deprecated navigator fallback
│   │   ├── registry.ts             # AbortController-owned registrations
│   │   ├── minted.ts               # derive/register persistent form tools
│   │   ├── result.ts               # stable ok/error envelopes and hints
│   │   └── tools/                  # 15 static tool definitions
│   └── widgets/                    # six renderers + shell + editable widget title
└── tests/
    ├── model/
    ├── store/
    ├── tools/
    ├── webmcp/
    └── widgets/
```

There is one route, rendered directly by `main.tsx`; no client router is needed.

## 2. Collaboration contracts

### 2.1 One document and one mutation gate

Human controls and WebMCP handlers mutate the same `BoardDocument`. `boardStore.mutate()` wraps
Immer `produceWithPatches`, increments `stateVersion`, stores inverse patches, and appends a
`Command` with `actor: "human" | "agent"`. No renderer keeps a second copy of board data.

Undo applies those inverse patches regardless of which actor created the target command. Reset
is deliberately not undoable and clears the command history, but it still advances
`stateVersion` so an agent holding an older snapshot can detect replacement.

### 2.2 Agent read → guarded write

`describe_current_state` is the synchronization point. It returns the full widget snapshot,
unfinished handoffs, recent activity, `humanChangesSinceLastDescribe`, and `stateVersion`.

Every static mutation accepts optional `expectedStateVersion`. When supplied, `makeTool`
compares it with the live document immediately before the handler runs. A mismatch returns
`STALE_STATE` without mutation; the hint tells the agent to describe again, review the human's
changes, and retry. Existing agents may omit the guard for backward compatibility. Minted tools
are append-only submissions and intentionally expose only their form-derived fields.

### 2.3 Layout truth

The desktop board is a 12-column `react-grid-layout`. Human drag/resize callbacks persist every
position changed by grid collision-push, not only the grabbed widget. Agent `set_layout` and
`update_widget.position` use the same pure `applyLayout()` collision resolution. Therefore the
coordinates an agent reads match the arrangement the human sees. The grid uses `noCompactor`:
intentional empty rows stay visible instead of moving upward only in the renderer. Under 700px,
rendering uses a derived one-column stack and disables drag/resize so mobile coordinates never
overwrite the desktop layout.

### 2.4 Data and minted tools

Tables, kanban boards, checklists, charts, and forms use typed datasets. Zod field definitions
drive runtime row validation and Draft-7 tool schemas. A form can mint a persistent WebMCP tool
whose schema follows its current fields. Form submit and minted-tool calls share `appendRows()`,
so both paths validate and append through the same command log.

Registration starts only after Zustand persistence hydrates:

```text
hydrate board
  → register 15 static tools
  → validate and register persisted minted tools
  → watch minted records and form fields for add/remove/remint
```

`ToolRegistry` owns each live registration with an `AbortController`. Normal browsers still
build an unhosted registry so the UI can truthfully show how many definitions are ready, while
the WebMCP banner explains where agents can use them.

## 3. Shipped stack

- React 19 + TypeScript 6 + Vite 8
- Astryx 0.5 themes/components + StyleX for token-based custom styles
- Zustand 5 + Immer 11
- Zod 4 + `@mcp-b/webmcp-types`
- react-grid-layout 2 + Recharts 3
- Vitest 4 + jsdom + Ajv
- Cloudflare Workers static assets

Use `package.json` and `package-lock.json` as the exact dependency record.

## 4. Verification

Automated coverage includes:

1. Zod/JSON-Schema accept/reject parity for every static tool and minted field matrices.
2. Tool happy paths, stable error envelopes, stale-state refusal, row validation, and limits.
3. Mint/register/remint/remove/reload lifecycle against an in-memory ModelContext.
4. Human and agent command interleaving, layout collision persistence, undo, reset versioning,
   localStorage persistence, and migration.
5. Table/chart scaling and form/minted submission parity.

The repository skill at `.cursor/skills/verify-chameleon/` drives the built UI in an isolated
Chrome profile. Its maintained feature map covers empty first paint, human board construction,
drag and resize, inline edits and validation, activity attribution, undo, reset, reload
persistence, and the mobile stack. Chrome Canary audit scripts separately exercise the real
`document.modelContext` surface and all recoverable error codes.
