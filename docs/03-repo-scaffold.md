# Chameleon — Repo Scaffold & Architecture

## 1. Directory layout

```
chameleon/
├── index.html                      # SPA shell; <meta> for agents lives here too
├── package.json
├── vite.config.ts                  # @vitejs/plugin-react + @tanstack/router-plugin + vite-plugin-stylex
├── tsconfig.json                   # "types": ["@mcp-b/webmcp-types", "vite/client"]
├── vitest.config.ts                # environment: 'jsdom'
├── wrangler.toml                   # Cloudflare Workers static assets deploy
├── AGENTS.md                       # astryx init output + project conventions appended
├── LICENSE                         # MIT
├── README.md
├── docs/                           # these specs, kept current — they're submission collateral
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    # mounts router; boots webmcp/boot.ts AFTER store rehydration
│   ├── routes/
│   │   ├── __root.tsx              # Astryx ThemeProvider + global CSS imports
│   │   └── index.tsx               # the single board route
│   ├── app/
│   │   ├── BoardPage.tsx           # composition root: header, grid, activity drawer, empty state
│   │   └── styles.ts               # stylex.create() for app-level custom styles (xstyle props)
│   ├── model/                      # pure domain: NO React, NO Zustand, NO WebMCP imports
│   │   ├── types.ts                # Widget, DataSet, Field, Row, Command, BoardState
│   │   ├── fields.ts               # Field zod schema, validateValue, coerceValue
│   │   ├── widgets.ts              # per-type config zod schemas, validateConfig(type, config, fields)
│   │   ├── migrate.ts              # bind_data row migration
│   │   ├── layout.ts               # auto-placement + collision push (pure functions)
│   │   └── limits.ts
│   ├── store/
│   │   ├── boardStore.ts           # Zustand + Immer + persist('chameleon-board-v1')
│   │   ├── mutate.ts               # THE single mutation gate: mutate(actor, action, summary, rationale, recipe)
│   │   │                           #   wraps produceWithPatches → appends command w/ inverse patches
│   │   ├── undo.ts                 # applies inverse patches, marks entries undone
│   │   └── selectors.ts            # snapshot(), effectiveDataset(widget), activity(...)
│   ├── webmcp/
│   │   ├── modelContext.ts         # getModelContext(): document.modelContext ?? navigator.modelContext
│   │   ├── registry.ts             # ToolRegistry (AbortController per tool), NameTakenError
│   │   ├── result.ts               # ok()/err() envelope, formatZodIssues, safeRun
│   │   ├── makeTool.ts             # zod → JSON Schema + validated execute wrapper
│   │   ├── boot.ts                 # registers static tools, then persisted minted tools
│   │   ├── minted.ts               # deriveSubmissionSchema(fields), mint/unmint/remint
│   │   └── tools/
│   │       ├── describe.ts         # describe_current_state, read_widget_data, get_activity_log
│   │       ├── widgets.ts          # add_widget, update_widget, remove_widget
│   │       ├── data.ts             # bind_data, add_rows, update_rows, delete_rows
│   │       ├── layout.ts           # set_layout, set_theme
│   │       ├── mint.ts             # create_form_tool, remove_minted_tool
│   │       └── undo.ts             # undo
│   ├── widgets/
│   │   ├── registry.tsx            # type → renderer map (the ONLY switch on widget type in the UI)
│   │   ├── WidgetShell.tsx         # header, drag handle, ⚡minted-tool badge, delete, agent-flash animation
│   │   ├── TableWidget.tsx
│   │   ├── KanbanWidget.tsx
│   │   ├── ChecklistWidget.tsx
│   │   ├── ChartWidget.tsx         # Recharts; lazy-imported (largest dep) via React.lazy
│   │   ├── NoteWidget.tsx
│   │   └── FormWidget.tsx
│   ├── grid/
│   │   └── BoardGrid.tsx           # react-grid-layout; onDragStop/onResizeStop → store.mutate(actor:'human')
│   └── components/
│       ├── EmptyState.tsx          # the near-blank landing: one line of copy + suggested prompts
│       ├── ActivityDrawer.tsx      # human-facing command log (mirrors get_activity_log)
│       ├── AgentPulse.tsx          # subtle toast when an agent tool fires ("Agent added ‘Guest list’")
│       └── ThemeMenu.tsx           # human-side theme/density switcher (same store path as set_theme)
└── tests/
    ├── fixtures/
    │   ├── boards.ts               # empty board, wedding board, health board (the demo states)
    │   └── describe-health.json    # canonical snapshot from docs/02 §5, asserted byte-compatible
    ├── webmcp/
    │   ├── fake-model-context.ts   # in-memory ModelContext honoring AbortSignal semantics
    │   ├── registry.test.ts
    │   ├── minted-lifecycle.test.ts
    │   └── schema-roundtrip.test.ts
    ├── tools/
    │   ├── describe.test.ts  widgets.test.ts  data.test.ts
    │   ├── layout.test.ts    mint.test.ts     undo.test.ts
    ├── model/
    │   ├── fields.test.ts  migrate.test.ts  layout.test.ts
    └── store/
        └── commands.test.ts        # mutate → log → undo → persist → rehydrate round trip
```

## 2. Key module contracts

### 2.1 `store/mutate.ts` — the single mutation gate

Every state change — agent tool, human drag, human cell edit, minted-tool call — goes through
one function. This is what makes the command log complete and undo trustworthy:

```ts
mutate(meta: { actor: 'human'|'agent'; action: string; summary: string; rationale?: string },
       recipe: (draft: BoardState) => void): { stateVersion: number }
```

Implementation: Immer `produceWithPatches`; the inverse patches are stored on the command entry;
`stateVersion` = command `seq`. UI event handlers and tool handlers both call it — there is no
second `setState` path (enforced by an ESLint `no-restricted-imports` rule on the raw store
setter outside `store/`).

### 2.2 `webmcp/boot.ts` — ordering matters

```
persist rehydration completes
  → registry.register(each of 15 static tools)
  → for each persisted mintedTool record: validate widget still exists & is a form → mint
  → store.subscribe: on mintedTools slice change → diff live registrations → mint/unmint/remint
```

Booting after rehydration (Zustand `persist.onFinishHydration`) prevents minting tools from a
default empty state and then clobbering them. The subscription makes undo/redo of mints work
without the undo code knowing about WebMCP.

### 2.3 `webmcp/registry.ts`

Constructor takes `ModelContext | undefined` (injected) — **all tool code is testable without a
browser implementation**; `tests/webmcp/fake-model-context.ts` implements `registerTool` with
real AbortSignal semantics (registration removed on abort, throw on duplicate name). When
`getModelContext()` is undefined (normal browsers today), the registry still tracks definitions
so the UI can render a "N tools available to agents" indicator, and a console banner explains
how to enable WebMCP.

### 2.4 Rendering the agent's work honestly

`WidgetShell` flashes a brief outline animation when `lastModifiedBy === 'agent'` changes —
in the demo this is how viewers see *where* the agent acted. `AgentPulse` toasts the command
summary. Both read from the command log, not from tool code.

## 3. Dependencies (exact)

```jsonc
{
  "dependencies": {
    "react": "^19", "react-dom": "^19",
    "@tanstack/react-router": "^1",
    "@astryxdesign/core": "latest", "@astryxdesign/theme-neutral": "latest",
    "@stylexjs/stylex": "peer range from astryx doctor",
    "zustand": "^5", "immer": "^10",
    "zod": "^4",
    "react-grid-layout": "^1", "recharts": "^3",
    "nanoid": "^5",
    "react-markdown": "^9"                    // note widget
  },
  "devDependencies": {
    "@astryxdesign/cli": "latest",
    "@mcp-b/webmcp-types": "latest",
    "@tanstack/router-plugin": "^1",
    "vite": "^7", "@vitejs/plugin-react": "^5",
    "vite-plugin-stylex": "latest",           // day-1 verification item; see build plan
    "vitest": "^3", "jsdom": "^26",
    "typescript": "^5", "wrangler": "^4"
  },
  "scripts": {
    "dev": "vite --port 4711", "build": "tsc -b && vite build", "preview": "vite preview",
    "test": "vitest run", "deploy": "npm run build && wrangler deploy",
    "astryx": "node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs"
  }
}
```

Notes:
- Astryx via the **pre-built CSS path** (`reset.css` + `astryx.css` + theme CSS imported in
  `__root.tsx`) — no build plugin needed for Astryx itself. `vite-plugin-stylex` is only for
  **our own** `stylex.create()` styles passed through `xstyle`. If day-1 verification of the
  plugin fails against current StyleX, the fallback is stated in the build plan (plain
  `className` + CSS files for custom styles; Astryx explicitly supports this) — **the widget
  grammar and tools are unaffected**.
- All seven `@astryxdesign/theme-*` packages installed so `set_theme`'s enum is real; themes are
  CSS-only. (Cut line: neutral + matcha.)
- `astryx init` runs once at scaffold time → component cheat sheet in `AGENTS.md`; use
  `npm run astryx component <Name>` for API lookups while building.

## 4. Vitest coverage (the "must not break during judging" list)

Minimum bar — all of these exist and pass before any feature is called done:

1. **Every tool handler** (`tests/tools/*`): for each of the 15 static tools — happy path,
   every error code it can return (driven from the table in docs/01 §5), and a
   stateVersion-increments assertion for mutations.
2. **Schema round-trips** (`schema-roundtrip.test.ts`): for every static tool and for minted
   tools over a matrix of field configurations:
   `z.toJSONSchema(zod)` → validate a set of sample inputs with a JSON-Schema validator (ajv,
   dev-only) → assert accept/reject **identical** to `zod.safeParse` on the same inputs. This is
   the test that guarantees "one schema, two consumers" is actually true.
3. **Minted lifecycle** (`minted-lifecycle.test.ts`): mint → call → row appears; rebind fields →
   schema re-derived (old input now rejected, new accepted); remove widget → tool gone; undo →
   tool back; simulated reload (new store from persisted JSON + fresh registry) → tool
   re-registered; name collision → `NAME_TAKEN`; reserved → `RESERVED_NAME`.
4. **Form/tool parity**: the same submission payload accepted by the FormWidget submit handler
   and the minted tool produce identical rows.
5. **Command log & undo** (`commands.test.ts`): every mutating tool, when undone, restores a
   deep-equal prior state; human mutations interleave correctly; log compaction at 500 keeps
   undo sound for the retained window; persistence round-trip (serialize → rehydrate → deep
   equal).
6. **Row migration** (`migrate.test.ts`): all field-type transition cases from docs/02 §2.
7. **describe fixture**: health-board fixture render equals `tests/fixtures/describe-health.json`
   (guards against accidental snapshot-shape drift — this shape is a published contract).

Not covered by unit tests (covered by manual agent checkpoints instead): actual
`document.modelContext` behavior in ChatGPT's browser / Chrome Canary, react-grid-layout drag
mechanics, Recharts rendering.
