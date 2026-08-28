# Agent checkpoint notes

Living log of real-agent and inspector findings. Day 2 is the first checkpoint.
Rewrite tool descriptions from evidence here. Do not paper over a misuse by
changing the human prompt.

## 2026-08-28 — Day 2 checkpoint

### Environment of this run

Cloud Agent VM plus one real ChatGPT session driven by Ryan.

This VM can deploy to Cloudflare and drive a normal Chromium for UI
verification. It cannot launch ChatGPT’s desktop-app browser or Chrome Canary
with `chrome://flags/#enable-webmcp-testing`.

ChatGPT checkpoint #1 is captured below. Canary Tool Inspector is still open.

### Detection (implementation)

`getModelContext()` / `detectModelContext()`:

1. Feature-detect `document.modelContext` first (canonical April 2026 draft).
2. Fall back to `navigator.modelContext` only if the document surface is absent
   (`@mcp-b/webmcp-types` marks navigator as `@deprecated`).
3. If neither exists, the registry still tracks tools so the UI can show
   “N tools ready”, and a Banner + console line explain how to enable WebMCP.

Unit tests cover the preference order. Stable Chromium in this VM reports
**WebMCP not detected** and still renders the board.

### Registration contract vs. known implementation drift

Evidence from `@mcp-b/webmcp-types` 5.0.1 (not weakened in handlers):

| Surface | Spec / types | Known drift |
|---|---|---|
| `registerTool` | object `inputSchema`, returns `Promise<void>`, lifetime via `AbortSignal` | `getTools()` on Chrome 149–153 returned the schema as a **string**; 154+ returns an object. Some polyfills mirrored the string form on register. |
| `unregisterTool` | **absent** | Older snippets still mention it. Registry always `abort()`s, then calls `unregisterTool(name)` if that function exists. |
| `provideContext` / `clearContext` | removed March 2026 | We never call them. |
| Tool execute input | one object argument | If a runtime ever delivers a JSON string, that would be an adapter concern at the registry edge. Handlers always receive Zod-parsed objects. |

Adapter (`registerToolCompatible`): try object schema first; if the host throws
a type error mentioning `inputSchema` / string, retry once with
`JSON.stringify(schema)`. `ToolRegistry.schemaEncoding` records which arm won
(`object` \| `string` \| `unhosted`) so a Canary inspector session can confirm
without guessing.

Handlers are unchanged by the adapter: they still validate with Zod, still
return the envelope, never throw.

### Tools registered on boot (Day 2)

After Zustand persist hydration:

- `describe_current_state`
- `get_activity_log`
- `add_widget`
- `update_widget`
- `remove_widget`

### ChatGPT desktop / Sol — dinner-party prompt

Screenshot: `docs/day-2-chatgpt-dinner-party.png`

**URL:** https://chameleon-webmcp.ryan-970.workers.dev
**Model:** GPT-5.6 Sol Medium
**Runtime:** ChatGPT with the live Chameleon tab open. Header token read
`5 tools via document`, so ChatGPT’s browser hosted `document.modelContext`
(not navigator, not unhosted). Undo was enabled. No “WebMCP not detected”
banner.

**Prompt actually typed** (spec prompt plus a routing nudge after a ChatGPT
Sites misfire; do not bake the nudge into tool copy):

> set up a page for planning a small dinner party - run this prompt using the
> url opened in the browser now which has webmcp

Worked for 3m 33s. ChatGPT’s recap: Dinner details, Guest and RSVP table,
Three-course menu, Preparation checklist, Shopping list, Saturday hosting
schedule.

**Board after the run** (footer: `Latest: Updated 'What happens next'`,
state v10, 10 commands):

| Widget | Type | What landed |
|---|---|---|
| Dinner at home | note | Saturday 6:30pm, six people, warm / casual / seasonal |
| Guest list | table | Empty-state **No rows yet** (fields exist; no rows) |
| Menu | note | Three vegetarian courses in markdown |
| Before guests arrive | checklist | Placeholder shell only |
| Shopping list | table | Empty-state **No rows yet** (fields exist; no rows) |
| Saturday game plan | note | Timeline 3:00pm–7:15pm in markdown |
| Workspace tips | table | Seed rows from **What happens next** (renamed) |

Seed note **A canvas that listens** is gone. Most likely `update_widget` on
`w_welcome` (title + `config.markdown`) rather than remove + add: the dinner
note sits where the seed note sat, and ChatGPT did not list a deletion.

Last command summary `Updated 'What happens next'` matches `update_widget`
capturing the title *before* the rename to Workspace tips. The three seed
rows (`Your agent reads the board`, `Widgets appear live`, `You keep editing
by hand`) are unchanged. There is still no row tool, so that is expected.

**What we can say without a tool-call list**

- Discovery worked. Five tools via `document.modelContext`.
- `add_widget` accepted `note`, `table`, and `checklist`.
- Guest list and Shopping list used the **No rows yet** empty state, not **No
  columns yet**, so `fields` was passed at creation. The `fields` shortcut
  works. `bind_data` is not required to get a typed empty table.
- Written content went into notes (`config.markdown`). Tables and the
  checklist stayed hollow. That is Day 2’s real surface, not a failed call.
- No form, kanban, or chart widget. `create_form_tool` was not needed for this
  prompt and was not evidenced as a successful call.
- 10 commands / state v10 from a seed of 0 is consistent with ~5 adds plus
  several updates (seed note, seed table title, note bodies).
- 3m 33s is slow for ten mutations. The screenshot does not show Site tools →
  Recently used, so we cannot tell whether Sol retried ghost names
  (`bind_data`, row tools, `create_form_tool`, undo-as-tool).

**Description changes made from this run** (live tool strings only, not
`docs/01-tool-spec.md`):

- Stop naming tools that are not registered.
- Say notes are the only fillable type today.
- Say `fields` at `add_widget` is how you get columns; rows cannot be added
  yet.
- Say checklist / kanban / chart / form render as shells.

**Still missing (Canary)**

- Model Context Tool Inspector listing vs. our five tools.
- Whether schemas look Draft-7 / inline.
- Whether `navigator.modelContext` is also present beside document.
- Confirm `ToolRegistry.schemaEncoding` (`object` vs `string`) in that
  runtime.

Until Canary exists, do not change `modelContext.ts` preference order.

## 2026-08-28 — Day 3 data layer

Shipped on `main` (PR #3, merge `ed39860`; main tip `3f498ec` also includes the
Day 3 merge commit). The feature branch `cursor/day-3-data-layer-952d` is gone;
do not recreate it. Day 2 is on `main` as well (PR #2).

**Tools now registered:** the Day 2 five, plus `bind_data`, `add_rows`, `update_rows`, `delete_rows`, `read_widget_data`, `undo`. Live descriptions name those tools. They still do not name `create_form_tool`, `set_layout`, `set_theme`, or `remove_minted_tool`.

**Landmines closed while the files were small**

- `Widget` is a `type` discriminant union. Renderers switch on `widget.type`, not duck-typed config.
- `mutate` runs `produceWithPatches` *before* `set`. A throwing recipe leaves the store unchanged.
- Persist version 3 drops command-log entries whose inverse patches still mention Day 1 `content`. Persist key remains `chameleon-board-v1`.
- Reset keeps the current `stateVersion` (does not rewind to 0) and clears the log.
- Store `undo(actor)` records the caller. The undo tool passes `'agent'`. The header button still defaults to `'human'`.

**UI:** table cells edit through `mutate(actor: 'human')`; checklist and kanban render for real; widget delete, activity list, and an agent toast are wired. Chart and form stay shells.

**Mini-checkpoint (ChatGPT desktop / Sol, after deploy):** Reset canvas, prompt
`track my job search`. Runtime: ChatGPT desktop built-in browser + GPT-5.6 Sol.
Header: `11 tools via document` (`document.modelContext`). 1m 44s, state v16,
6 commands. Luna has WebMCP off; do not test on chatgpt.com Sites or regular
Chrome.

| Widget | Type | What landed |
|---|---|---|
| Job search command center | note | Real content |
| Interview preparation | note | Real content |
| Application pipeline | table | Fields exist; empty-state **No rows yet** |
| People and contacts | table | Empty |
| Checklist | checklist | **No items yet** |
| Workspace tips | table | Seed **What happens next** renamed (last command: Updated “What happens next”) |

No kanban. No `add_rows`. Same bias as the Day 2 dinner-party run
(`docs/day-2-chatgpt-dinner-party.png`): structure without data. Notes held the
real content; tables and the checklist stayed hollow.

Day 3 EOD bar was: kanban + table with rows, then a human edit visible in
`get_activity_log`. Structure landed; data did not.

**Description changes made from this run** (live tool strings only, not
`docs/01-tool-spec.md`, not the human prompt):

- `add_widget`: a pipeline / status board must be kanban (select `groupByField`,
  default key `status`), not an empty table. After table / kanban / form, the
  next call is `add_rows` (or `bind_data` then `add_rows` if fields were
  omitted). Checklist: skip `bind_data`; `add_rows` with text / done / due /
  note. Notes are prose in `config.markdown` only. “No rows yet” / “No items
  yet” means `add_rows` is still required.
- `bind_data`: schema only — then `add_rows`. Skip on checklist and note.
- `add_rows`: the fill tool; empty states are unfinished work.
- `update_widget` / `describe_current_state` / `read_widget_data`: do not dump
  rows into notes; `rowCount` 0 is unfinished.
- Still do not name `create_form_tool`, `set_layout`, `set_theme`, or
  `remove_minted_tool`. The `NAME_TAKEN` error hint no longer names
  `remove_minted_tool`.

**Next check (done):** hard-refresh, Reset canvas, re-run `track my job
search`. Screenshot: `docs/day-3-chatgpt-job-search.png`.

**Retry result (ChatGPT desktop / Sol):** same prompt, header still
`11 tools via document`. Footer: state v22 · 6 commands (reset kept v16;
six more mutations). Latest: Updated “What happens next”. Sol recap claimed
the board was done.

| Widget | Type | What landed |
|---|---|---|
| Job search command center | note | Weekly targets in markdown |
| Application pipeline | table | Fields exist; **No rows yet** |
| This week | checklist | **No items yet** |
| People and conversations | table | **No rows yet** |
| Interview preparation | note | Before/after conversation bullets in markdown |
| Workspace tips | table | Seed rows; renamed from What happens next |

No kanban. No `add_rows`. Description-only rewrite did not change behavior.
Sol treats empty widgets as a finished workspace.

**Second pass (tool results, not the human prompt):** descriptions were
ignored, so the follow-up now lives in the payload the model reads after
each call.

- `add_widget` returns `needsRows` + `next`. A table titled like a pipeline
  is told to `remove_widget` and add a kanban, then `add_rows`. Checklist
  `next` is `add_rows` with text/done/due/note.
- `bind_data` returns `next` pointing at `add_rows`.
- `add_rows` returns remaining `unfinished` widgets so one filled table is
  not the stop condition.
- `describe_current_state` returns `unfinished` (empty tables/checklists)
  at the top of the snapshot.

**Next check:** hard-refresh, Reset canvas, re-run `track my job search`.
Expect a kanban pipeline with rows, `add_rows` on table/checklist, and an
empty `unfinished` list.

### UI verification done in this VM

- Default board: note + table both render (markdown / Astryx Table).
- Drag by header and resize still persist through `mutate` and undo.
- Click-to-edit on the note writes a human `update_widget` command.
- Empty WebMCP banner is visible in stable Chrome and dismissable.
