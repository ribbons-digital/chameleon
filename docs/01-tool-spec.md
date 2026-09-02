# Chameleon — WebMCP Tool Specification

This is the contract between Chameleon and any browser-integrated agent. **The agent is the
customer of this document**: every name, description, and error message below is written to be
read by a model at tool-selection time, not by a human at code-review time.

## 0. Platform decisions (stated, not optional)

These reflect the WebMCP spec as of the **April 23, 2026 W3C Community Group Draft** and the
March 2026 breaking change:

1. **Entry point**: the canonical API is `document.modelContext`; `navigator.modelContext` is a
   deprecated alias (Chromium 150+). We feature-detect both and use whichever exists:

   ```ts
   export function getModelContext(): ModelContext | undefined {
     return (document as any).modelContext ?? (navigator as any).modelContext;
   }
   ```

2. **No `provideContext` / `clearContext`** — removed from the spec in March 2026 (PR #132).
   We only ever call `registerTool()`.
3. **Registration lifetime is owned by an `AbortSignal`.** `unregisterTool()` is not in the
   current types. Every registration in Chameleon is created with its own `AbortController`;
   "unregister" means `controller.abort()`. Where an implementation still exposes
   `unregisterTool(name)`, our registry calls it as a fallback after aborting (harmless if absent).
4. **Types**: `@mcp-b/webmcp-types` (dev dependency, declarations only), activated via
   `"types": ["@mcp-b/webmcp-types"]` in `tsconfig.json`.
5. **One schema, two consumers**: every tool's input schema is authored **once in Zod 4** and
   converted to JSON Schema with Zod's native `z.toJSONSchema(schema, { target: 'draft-7' })`.
   *Stated deviation from the brief*: `zod-to-json-schema` is unnecessary on Zod 4 — the native
   converter serves the same "one schema for runtime validation and WebMCP inputSchema" goal
   with one fewer dependency. If anything forces a Zod 3 pin, swap in `zod-to-json-schema` with
   `{ target: 'jsonSchema7', $refStrategy: 'none' }`; the registry API doesn't change.
   We always generate **inline schemas (no `$ref`)** — agent runtimes and the Chrome inspector
   handle inline schemas more reliably.
6. **Every tool validates its input with the same Zod schema at execute time.** The spec says
   the browser validates against `inputSchema`, but we do not trust that across
   ChatGPT's browser, Canary, and polyfills. Validation failures return `INVALID_INPUT` with
   Zod's flattened issues — never a thrown exception.

## 1. Result envelope (all tools)

Tools **never throw**. Every tool returns MCP-style content whose single text block is a JSON
string in one of two shapes:

```ts
// success
{ ok: true, stateVersion: number, ...toolSpecificPayload }

// failure
{ ok: false, stateVersion: number,
  error: { code: ErrorCode, message: string, hint: string, details?: unknown } }
```

- `stateVersion` is a monotonically increasing integer bumped on every board mutation (human or
  agent). Agents use it to detect that the board changed under them; if a mutation tool is called
  with stale assumptions the data doesn't corrupt — the agent just re-reads.
- `hint` is an **instruction to the agent**, e.g. `"Call describe_current_state to list valid
  widget ids."` Every error code has a fixed hint (table in §5).

Registry wrapper (uniform for all tools):

```ts
function makeTool<I>(def: {
  name: string; description: string; input: z.ZodType<I>;
  handler: (input: I) => ToolOk | ToolErr;
}): RegisterableTool {
  return {
    name: def.name,
    description: def.description,
    inputSchema: z.toJSONSchema(def.input, { target: 'draft-7' }),
    async execute(raw) {
      const parsed = def.input.safeParse(raw);
      const result = parsed.success
        ? safeRun(() => def.handler(parsed.data))
        : err('INVALID_INPUT', formatZodIssues(parsed.error));
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  };
}
```

## 2. Naming and description conventions

- Static tool names: `snake_case`, verb-first for mutations, noun-first reads are prefixed
  `describe_`/`read_`/`get_`.
- Descriptions follow a fixed template so the agent can pattern-match:
  **what it does → when to use it → what it returns → pitfalls.** Target 40–90 words. Name
  concrete field/enum values in prose (models weight descriptions over schemas).
- Every mutating tool takes an optional `rationale: string` (≤300 chars). It is stored in the
  command log and surfaced in `get_activity_log` and the on-screen activity drawer. **This is the
  `explain_layout` requirement, redesigned**: instead of a separate write-only tool the agent
  explains itself inline on every mutation, and reads the accumulated rationale log back via
  `get_activity_log`. (Decision: a standalone `explain_layout` tool would be a second write path
  that agents forget to call; a parameter on the mutation itself gets filled in reliably.)

## 3. Static tool catalog (15 tools)

Shared Zod fragments (see `docs/02-widget-grammar.md` for `Field`, per-type configs, limits):

```ts
const WidgetId  = z.string().regex(/^w_[a-zA-Z0-9_-]{6,}$/)
  .describe('A widget id as returned by add_widget or describe_current_state, e.g. "w_x8Kd2q".');
const Rationale = z.string().max(300).optional()
  .describe('One sentence explaining why you are making this change. Shown to the human in the activity log.');
const Position  = z.object({
  x: z.number().int().min(0).max(11), y: z.number().int().min(0),
  w: z.number().int().min(2).max(12), h: z.number().int().min(2).max(20),
}).describe('Grid placement on a 12-column grid. One row unit is ~40px. Omit to auto-place below existing widgets.');
```

---

### 3.1 `describe_current_state` (read)

> **Description (verbatim, agent-facing):** Returns the full ground-truth snapshot of the board:
> title, theme, every widget (id, type, title, grid position, config, data field schema, row
> count, up to 3 sample rows), all dynamically minted tools, the last 10 activity-log entries
> including edits the human made by hand, and the current stateVersion. Call this before your
> first mutation and again whenever a tool reports a stale or missing id. This is the only tool
> that shows you what the human has changed.

```ts
const DescribeInput = z.object({
  include_sample_rows: z.boolean().default(true)
    .describe('Set false to omit sample rows for a smaller response.'),
});
```

**Returns** (exact shape — this is the spec for `snapshot.ts`):

```ts
{
  ok: true, stateVersion: number,
  board: {
    title: string,
    theme: { name: 'neutral'|'butter'|'chocolate'|'matcha'|'stone'|'gothic'|'y2k',
             mode: 'light'|'dark', density: 'comfortable'|'compact' },
    grid: { cols: 12, rowHeightPx: 40 },
    widgetCount: number,
  },
  widgets: Array<{
    id: string, type: 'table'|'kanban'|'checklist'|'chart'|'note'|'form',
    title: string,
    position: { x: number, y: number, w: number, h: number },
    config: object,                    // full per-type config, see widget grammar spec
    fields: Field[] | null,           // null for note; checklist reports its fixed schema
    rowCount: number,
    sampleRows: Row[],                // ≤3, omitted when include_sample_rows=false
    mintedTools: string[],            // tool names bound to this widget (forms only)
    lastModified: { at: string /*ISO*/, by: 'human'|'agent' },
  }>,
  mintedTools: Array<{ toolName: string, widgetId: string, description: string, createdAt: string }>,
  recentActivity: Array<{ seq: number, at: string, actor: 'human'|'agent',
                          action: string, summary: string, rationale?: string }>,  // last 10
  humanEditsSinceLastDescribe: number,   // resets to 0 on each call — cheap "what changed" signal
  humanChangesSinceLastDescribe: Array<{ seq, at, actor: 'human', action, summary }>,
                                          // the hand edits behind that count, newest first
                                          // (drags, cell edits, deletes, undo); empty after each call
}
```

**Errors**: none beyond `INVALID_INPUT` (read-only, always succeeds on a valid board).

---

### 3.2 `read_widget_data` (read)

> **Description:** Returns rows of one widget's dataset with pagination. Use when you need more
> than the 3 sample rows from describe_current_state — for example to compute a summary, find a
> row id to update, or check what the human typed. Rows include their row id (`_id`) and
> `_createdAt`/`_updatedAt` timestamps. Note widgets have no dataset.

```ts
const ReadWidgetDataInput = z.object({
  widgetId: WidgetId,
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
```

**Returns**: `{ ok, stateVersion, widgetId, fields: Field[], total: number, rows: Row[] }`
**Errors**: `WIDGET_NOT_FOUND`, `WRONG_WIDGET_TYPE` (note widgets).

---

### 3.3 `get_activity_log` (read)

> **Description:** Returns the board's command log, newest first — every mutation made by you or
> by the human dragging, editing, or deleting things by hand. Each entry has an actor
> ('human'|'agent'), an action name, a human-readable summary, and the rationale the agent gave.
> Use it to answer "what did the human change?" or to review your own recent edits before
> reorganizing.

```ts
const GetActivityLogInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  actor: z.enum(['human', 'agent']).optional()
    .describe('Filter to only human edits or only agent edits.'),
  since_seq: z.number().int().min(0).optional()
    .describe('Only entries with seq greater than this value.'),
});
```

**Returns**: `{ ok, stateVersion, entries: ActivityEntry[] }` (same entry shape as
`recentActivity` above, plus `undone: boolean`).

---

### 3.4 `add_widget` (mutate)

> **Description:** Creates one widget on the board and returns its id. type is one of: table
> (spreadsheet-like records), kanban (cards grouped by a select field), checklist (todo items
> with optional due dates), chart (line/bar/area/pie over a dataset), note (markdown text), form
> (input fields the human fills in — and the only widget that can mint a new tool via
> create_form_tool). For table, kanban, chart and form you should usually call bind_data next to
> define fields, unless you pass `fields` here. Omit position to auto-place. Prefer several small
> focused widgets over one giant one.

```ts
const AddWidgetInput = z.object({
  type: z.enum(['table', 'kanban', 'checklist', 'chart', 'note', 'form']),
  title: z.string().min(1).max(80),
  config: WidgetConfigByType.optional()
    .describe('Type-specific config. If omitted, sensible defaults are used. See each type\'s schema.'),
  fields: z.array(Field).max(20).optional()
    .describe('Optional shortcut: define the data schema at creation time instead of calling bind_data.'),
  position: Position.optional(),
  rationale: Rationale,
});
```

`WidgetConfigByType` is the discriminated-union-free variant: config is validated **against the
schema selected by `type`** inside the handler (keeps the published JSON Schema simple — a
`type` enum plus a permissive `config` object whose per-type shape is documented in each type's
prose; the handler re-validates strictly). Decision: agents fill discriminated unions
unreliably; prose + handler validation is more robust and errors carry the exact per-type schema
in `details`.

**Returns**: `{ ok, stateVersion, widgetId, position }` (final position after auto-placement).
**Errors**: `INVALID_CONFIG` (per-type validation failed; `details` = expected schema),
`LIMIT_EXCEEDED` (board max 24 widgets), `FIELD_NOT_FOUND` (config references a field key not in
`fields`).

**Generated JSON Schema** (representative example — the other tools compile mechanically the
same way):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "type": { "type": "string", "enum": ["table","kanban","checklist","chart","note","form"] },
    "title": { "type": "string", "minLength": 1, "maxLength": 80 },
    "config": { "type": "object",
      "description": "Type-specific config. If omitted, sensible defaults are used. See each type's schema." },
    "fields": { "type": "array", "maxItems": 20, "items": { /* Field schema, inlined */ },
      "description": "Optional shortcut: define the data schema at creation time instead of calling bind_data." },
    "position": { "type": "object",
      "description": "Grid placement on a 12-column grid. One row unit is ~40px. Omit to auto-place below existing widgets.",
      "properties": {
        "x": { "type": "integer", "minimum": 0, "maximum": 11 },
        "y": { "type": "integer", "minimum": 0 },
        "w": { "type": "integer", "minimum": 2, "maximum": 12 },
        "h": { "type": "integer", "minimum": 2, "maximum": 20 } },
      "required": ["x","y","w","h"], "additionalProperties": false },
    "rationale": { "type": "string", "maxLength": 300,
      "description": "One sentence explaining why you are making this change. Shown to the human in the activity log." }
  },
  "required": ["type","title"],
  "additionalProperties": false
}
```

---

### 3.5 `update_widget` (mutate)

> **Description:** Updates a widget's title, config, and/or position. Only the keys you pass
> change; config is deep-merged per key (pass a key with null to clear it). Does not touch data
> rows — use the row tools for that — and does not change the field schema — use bind_data. If
> the widget is a form with a minted tool, changing config does not affect the minted tool.

```ts
const UpdateWidgetInput = z.object({
  widgetId: WidgetId,
  title: z.string().min(1).max(80).optional(),
  config: z.record(z.string(), z.unknown()).optional()
    .describe('Partial config patch, validated against the widget\'s type schema after merge.'),
  position: Position.optional(),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, widgetId }`
**Errors**: `WIDGET_NOT_FOUND`, `INVALID_CONFIG`, `NO_CHANGES` (nothing passed).

---

### 3.6 `remove_widget` (mutate)

> **Description:** Deletes a widget and its data rows. If the widget is a form with a minted
> tool, that tool is unregistered immediately and will not come back on reload. If any chart uses
> this widget as its data source, the chart stays but shows an empty state until re-pointed. The
> human can undo this from the UI, and you can undo it with the undo tool.

```ts
const RemoveWidgetInput = z.object({ widgetId: WidgetId, rationale: Rationale });
```

**Returns**: `{ ok, stateVersion, removedWidgetId, unregisteredTools: string[] }`
**Errors**: `WIDGET_NOT_FOUND`.

---

### 3.7 `bind_data` (mutate)

> **Description:** Defines or replaces the field schema of a table, kanban, chart, or form
> widget. Fields have a key (snake_case), label, and type: text, number, date (ISO yyyy-mm-dd),
> select (with options), boolean, or url. Existing rows are migrated: values for kept keys
> survive, removed keys are dropped, new keys start empty, and a select value not in the new
> options is cleared. Checklist and note widgets have fixed schemas and reject this tool. If the
> widget is a form with a minted tool, the minted tool's inputSchema is re-derived and
> re-registered automatically — tell the user if you renamed fields they were using.

```ts
const BindDataInput = z.object({
  widgetId: WidgetId,
  fields: z.array(Field).min(1).max(20),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, widgetId, fields, migratedRowCount, remintedTool?: string }`
**Errors**: `WIDGET_NOT_FOUND`, `WRONG_WIDGET_TYPE`, `INVALID_CONFIG` (duplicate keys, select
without options, config references — e.g. kanban `groupByField` — that the new schema breaks;
`details` names the broken reference).

**Generated JSON Schema** (second representative example — note how `Field` inlines):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "widgetId": { "type": "string", "pattern": "^w_[a-zA-Z0-9_-]{6,}$",
      "description": "A widget id as returned by add_widget or describe_current_state, e.g. \"w_x8Kd2q\"." },
    "fields": { "type": "array", "minItems": 1, "maxItems": 20,
      "items": {
        "type": "object",
        "properties": {
          "key": { "type": "string", "pattern": "^[a-z][a-z0-9_]{0,39}$" },
          "label": { "type": "string", "minLength": 1, "maxLength": 60 },
          "type": { "type": "string", "enum": ["text","number","date","select","boolean","url"] },
          "required": { "type": "boolean", "default": false },
          "options": { "type": "array", "items": { "type": "string", "minLength": 1 },
            "minItems": 1, "maxItems": 30,
            "description": "Required when type is \"select\"; forbidden otherwise." },
          "description": { "type": "string", "maxLength": 200 }
        },
        "required": ["key","label","type"], "additionalProperties": false } },
    "rationale": { "type": "string", "maxLength": 300,
      "description": "One sentence explaining why you are making this change. Shown to the human in the activity log." }
  },
  "required": ["widgetId","fields"],
  "additionalProperties": false
}
```

---

### 3.8 `add_rows` (mutate)

> **Description:** Appends up to 50 data rows to a table, kanban, chart, checklist, or form
> widget. Each row is an object keyed by the widget's field keys (checklist keys: text, done,
> due, note). Unknown keys are rejected, values are coerced to field types where safe (numbers
> from numeric strings, ISO dates), and required-field violations are rejected per row. Returns
> the new row ids in order. For a single form submission on the user's behalf, prefer the form's
> own minted tool if one exists — it validates exactly like the on-screen form.

```ts
const AddRowsInput = z.object({
  widgetId: WidgetId,
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(50),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, widgetId, rowIds: string[], rowCount }`
**Errors**: `WIDGET_NOT_FOUND`, `WRONG_WIDGET_TYPE` (note), `NO_FIELDS_BOUND` (hint: call
bind_data first), `INVALID_ROWS` (`details`: per-row index + issues), `LIMIT_EXCEEDED`
(5,000 rows per widget).

---

### 3.9 `update_rows` (mutate)

> **Description:** Applies partial patches to existing rows by row id (get ids from
> read_widget_data). Only the keys you pass change. Use this to move kanban cards (patch the
> group-by field), check off checklist items (patch done), or correct values. Batched: up to 50
> patches in one call; the call is atomic — if any patch is invalid, none apply.

```ts
const UpdateRowsInput = z.object({
  widgetId: WidgetId,
  patches: z.array(z.object({
    rowId: z.string(),
    set: z.record(z.string(), z.unknown()).describe('Field key → new value. Pass null to clear a value.'),
  })).min(1).max(50),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, widgetId, updatedRowIds: string[] }`
**Errors**: `WIDGET_NOT_FOUND`, `ROW_NOT_FOUND` (`details`: which rowIds), `INVALID_ROWS`.

---

### 3.10 `delete_rows` (mutate)

> **Description:** Deletes rows by id from one widget. Up to 50 per call. Deleted rows can be
> restored with undo. If you intend to clear an entire widget, pass all row ids from
> read_widget_data rather than deleting the widget itself.

```ts
const DeleteRowsInput = z.object({
  widgetId: WidgetId,
  rowIds: z.array(z.string()).min(1).max(50),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, widgetId, deletedCount, rowCount }`
**Errors**: `WIDGET_NOT_FOUND`, `ROW_NOT_FOUND`.

---

### 3.11 `set_layout` (mutate) — the `reorganize` tool

> **Description:** Repositions and resizes many widgets in one atomic call on the 12-column
> grid. Pass every widget you want to move; unlisted widgets keep their position but may be
> pushed down to resolve overlaps (the grid never overlaps). Use after describe_current_state so
> your coordinates reflect any hand-dragging the human did. Give a rationale — it is shown to the
> human as the explanation for the reshuffle. Typical use: group related widgets, put the most
> actionable widget top-left, give charts at least w=6.

```ts
const SetLayoutInput = z.object({
  items: z.array(z.object({ widgetId: WidgetId }).extend(Position.shape)).min(1).max(24),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, layout: Array<{ widgetId, x, y, w, h }> }` (final resolved
positions after collision-push — may differ from requested; agent should treat this as truth).
**Errors**: `WIDGET_NOT_FOUND`, `DUPLICATE_ID`.

---

### 3.12 `set_theme` (mutate) — the `restyle` tool

> **Description:** Restyles the whole board: theme name (neutral, butter, chocolate, matcha,
> stone, gothic, y2k), light or dark mode, and density (comfortable or compact). Also sets the
> board title shown in the header. All arguments optional; only what you pass changes. Use
> sparingly — pick a theme that fits the user's stated goal (e.g. matcha for a health log,
> neutral for a job search) and stick with it.

```ts
const SetThemeInput = z.object({
  boardTitle: z.string().min(1).max(60).optional(),
  theme: z.enum(['neutral','butter','chocolate','matcha','stone','gothic','y2k']).optional(),
  mode: z.enum(['light','dark']).optional(),
  density: z.enum(['comfortable','compact']).optional(),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, theme: { name, mode, density }, boardTitle }`
**Errors**: `NO_CHANGES`.
*(Cut line: if theme CSS weight becomes a problem, ship `neutral` + `matcha` only and shrink the
enum — the tool contract otherwise unchanged.)*

---

### 3.13 `create_form_tool` (mutate) — **the signature move**

> **Description:** Mints a brand-new tool on this page from a form widget. The new tool's
> inputSchema is derived from the form's current fields, and calling it appends one validated
> submission row to the form's dataset — exactly as if the human submitted the form. Use this
> when the user will repeatedly log the same kind of entry (e.g. blood sugar readings, job
> applications, expenses), so future requests like "log 104 after lunch" become one direct tool
> call instead of a row-editing session. Choose a verb_noun toolName the user would say
> (log_blood_sugar, add_application). The minted tool persists across page reloads until the
> form is deleted or remove_minted_tool is called. Minting re-derives automatically if the
> form's fields change later.

```ts
const CreateFormToolInput = z.object({
  widgetId: WidgetId.describe('Must be a form widget with at least one bound field.'),
  toolName: z.string().regex(/^[a-z][a-z0-9_]{2,49}$/)
    .describe('snake_case verb phrase, e.g. "log_blood_sugar". Must not collide with an existing tool.'),
  description: z.string().min(20).max(500)
    .describe('Written for the NEXT agent that discovers this tool with no other context. Say what one call records, name the fields and their units/options, and give one example invocation in prose.'),
  rationale: Rationale,
});
```

**Returns**:
`{ ok, stateVersion, toolName, widgetId, inputSchema: <the generated JSON Schema>, note: "Tool is registered now and will re-register on every page load." }`
Returning the generated `inputSchema` lets the calling agent immediately confirm what it minted.

**Errors**: `WIDGET_NOT_FOUND`, `WRONG_WIDGET_TYPE` (hint: only form widgets mint tools),
`NO_FIELDS_BOUND`, `NAME_TAKEN` (`details.existingKind: 'static'|'minted'`; hint suggests
`toolName_2` or a more specific verb), `RESERVED_NAME` (the 15 static names + `chameleon_*`
prefix are reserved), `LIMIT_EXCEEDED` (max 12 minted tools; hint: remove one first).

---

### 3.14 `remove_minted_tool` (mutate)

> **Description:** Unregisters a tool previously created with create_form_tool and removes it
> from persistence so it will not re-register on reload. The form widget and its data are
> untouched. Use when the user no longer needs a logging shortcut or when you want to re-mint
> under a better name.

```ts
const RemoveMintedToolInput = z.object({
  toolName: z.string().regex(/^[a-z][a-z0-9_]{2,49}$/),
  rationale: Rationale,
});
```

**Returns**: `{ ok, stateVersion, removedToolName }`
**Errors**: `TOOL_NOT_FOUND` (hint: describe_current_state lists minted tools; static tools
cannot be removed).

---

### 3.15 `undo` (mutate)

> **Description:** Reverts the most recent board mutations (human or agent), newest first, up to
> 10 steps per call. Returns what was undone so you can confirm to the user. Data-destructive
> operations (remove_widget, delete_rows) are fully restored including rows and any minted tool
> the widget carried. There is no redo — re-apply changes with the normal tools if the user
> changes their mind.

```ts
const UndoInput = z.object({ steps: z.number().int().min(1).max(10).default(1) });
```

**Returns**: `{ ok, stateVersion, undone: Array<{ seq, action, summary, actor }> }`
**Errors**: `NOTHING_TO_UNDO`.

---

## 4. Minted tools — full lifecycle

### 4.1 Schema derivation (`webmcp/minted.ts`)

`deriveSubmissionSchema(fields: Field[]) → z.ZodObject`, mapping per field type:

| Field type | Zod                                            | JSON Schema fragment |
|-----------|-------------------------------------------------|----------------------|
| `text`    | `z.string().max(2000)`                          | `{"type":"string","maxLength":2000}` |
| `number`  | `z.number()`                                    | `{"type":"number"}` |
| `date`    | `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`       | `{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"}` |
| `select`  | `z.enum(options)`                               | `{"type":"string","enum":[...]}` |
| `boolean` | `z.boolean()`                                   | `{"type":"boolean"}` |
| `url`     | `z.string().url()`                              | `{"type":"string","format":"uri"}` |

Field `required: false` → `.optional()`. Field `label` + `description` concatenate into the
property's `description` (e.g. `"Blood sugar (mg/dL). Measured value from the glucometer."`).
The object is `.strict()` → `"additionalProperties": false`.

**Worked example.** Form fields:

```json
[
  { "key": "reading",  "label": "Blood sugar (mg/dL)", "type": "number", "required": true },
  { "key": "context",  "label": "When taken",          "type": "select", "required": true,
    "options": ["fasting", "before meal", "after meal", "bedtime"] },
  { "key": "note",     "label": "Note",                "type": "text",   "required": false }
]
```

`create_form_tool(widgetId, "log_blood_sugar", "Records one blood-glucose reading …")` registers:

```json
{
  "name": "log_blood_sugar",
  "description": "Records one blood-glucose reading …",
  "inputSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "reading": { "type": "number", "description": "Blood sugar (mg/dL)" },
      "context": { "type": "string", "enum": ["fasting","before meal","after meal","bedtime"],
                   "description": "When taken" },
      "note":    { "type": "string", "maxLength": 2000, "description": "Note" }
    },
    "required": ["reading", "context"],
    "additionalProperties": false
  }
}
```

Its execute handler = `add_rows(widgetId, [input])` under the hood (same validation, same
command-log entry, same undo path), returning
`{ ok, stateVersion, rowId, widgetId, message: "Logged to \"Blood sugar log\" (417 rows total)." }`.

### 4.2 Register / unregister / re-register

The registry (`webmcp/registry.ts`) owns one `AbortController` per registration:

```ts
class ToolRegistry {
  private live = new Map<string, { controller: AbortController; def: RegisterableTool }>();
  register(def: RegisterableTool) {
    if (this.live.has(def.name)) throw new NameTakenError(def.name);
    const controller = new AbortController();
    getModelContext()?.registerTool(def, { signal: controller.signal });
    this.live.set(def.name, { controller, def });
  }
  unregister(name: string) {
    this.live.get(name)?.controller.abort();   // spec-current lifetime mechanism
    this.live.delete(name);
  }
  replace(def: RegisterableTool) { this.unregister(def.name); this.register(def); }
}
```

Lifecycle events:

| Event | Registry action |
|---|---|
| App boot | Register 15 static tools, then re-register every persisted minted tool (order: static first, so collision checks against statics are meaningful). |
| `create_form_tool` succeeds | Persist `{ toolName, widgetId, description, createdAt }` in the store (inside the same Immer transaction as the command-log entry), then `register()`. |
| `bind_data` / field change on a minted form | `replace()` with re-derived schema. Description is preserved; a line `"(Schema updated <ISO date>.)"` is appended so a long-lived agent notices. |
| `remove_widget` on a minted form | `unregister()` + remove persisted record. |
| `remove_minted_tool` | Same. |
| `undo` of a widget removal | Re-persist + `register()` again (undo restores the minted-tool record because it lives in the same store slice). |
| Page reload | Persist middleware rehydrates → boot sequence re-registers. If a persisted minted tool references a widget id that no longer exists (corruption), it is dropped silently and logged to console — never registered broken. |

### 4.3 Collision policy

One namespace for everything. Checks at mint time, in order:
1. `RESERVED_NAME` — the 15 static names, plus anything starting `chameleon_` (reserved for
   future static tools), plus `undo`, `redo`, `help`.
2. `NAME_TAKEN` — any live registration (covers minted tools **and** anything another script
   registered; the registry treats a thrown error from `registerTool` as `NAME_TAKEN` too, since
   the spec makes duplicate registration an error).
3. On reload, if two persisted records somehow share a name (should be impossible — enforced at
   write time), first wins, second is dropped and logged.

No auto-renaming: the agent gets `NAME_TAKEN` with a hint and chooses. Auto-renames create tools
the agent doesn't know the name of.

## 5. Error codes (complete)

| Code | Fixed hint (verbatim in payload) |
|---|---|
| `INVALID_INPUT` | "Arguments failed schema validation. Read error.details, fix those fields, and retry the same tool." |
| `INVALID_CONFIG` | "This config does not match this widget type. Call describe_current_state, then pass a config for that type." |
| `INVALID_ROWS` | "One or more rows failed field validation. details lists row index, field key, and issue. Fix only those rows and retry." |
| `WIDGET_NOT_FOUND` | "No widget has this id. Call describe_current_state and use an id from that snapshot. The human may have deleted it." |
| `WRONG_WIDGET_TYPE` | "This tool does not apply to this widget type. Call describe_current_state and pick a widget of a type this tool accepts." |
| `ROW_NOT_FOUND` | "One or more rowIds do not exist in this widget. Call read_widget_data and copy ids from the current rows." |
| `NO_FIELDS_BOUND` | "This widget has no field schema yet. Call bind_data first, then add_rows." |
| `FIELD_NOT_FOUND` | "Config names a field key that is not in this widget schema. Call describe_current_state, then retry with a listed key." |
| `NAME_TAKEN` | "A tool with this name already exists. Pick a more specific name, or call remove_minted_tool first if you own it." |
| `RESERVED_NAME` | "This name is reserved by the app. Choose a different verb_noun name that is not a static tool." |
| `NO_CHANGES` | "You passed no fields to change. Include at least one property to update." |
| `NOTHING_TO_UNDO` | "The command log is empty. There is nothing to revert." |
| `DUPLICATE_ID` | "The same widgetId appears more than once in items. Each widget may appear at most once." |
| `LIMIT_EXCEEDED` | "A hard limit was hit. details names which limit and the maximum. Call remove_widget, delete_rows, or remove_minted_tool until you are under it, then retry." |
| `TOOL_NOT_FOUND` | "No minted tool has this name. describe_current_state lists minted tools. Static tools cannot be removed." |
| `INTERNAL` | "Unexpected app error. State was not changed. Call describe_current_state and retry once." |

## 6. Description quality bar (checklist applied to every tool before ship)

- [ ] First sentence says what the tool does in ≤15 words.
- [ ] Says **when to prefer this tool** over its neighbors (add_rows vs. minted tool, set_layout vs. update_widget.position).
- [ ] Names concrete enum values and units in prose, not just in the schema.
- [ ] States side effects the agent can't see (minted tool re-registration, cascade to charts).
- [ ] States persistence/undo behavior if destructive.
- [ ] ≤90 words for static tools. Minted tool descriptions are agent-authored; `create_form_tool`'s
      description parameter tells the agent how to write them (see §3.13) — this is deliberate:
      **we teach the agent to write good descriptions for the next agent.**
- [ ] Tested empirically at the day-2/day-4 checkpoints: if either ChatGPT's browser or Gemini-in-Chrome
      picks the wrong tool for a scripted prompt, the descriptions get revised, not the prompt.
