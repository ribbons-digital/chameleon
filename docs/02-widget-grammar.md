# Chameleon — Widget Grammar Specification

Six widget types. No seventh. Every product the agent composes is a combination of these, which
is exactly what makes the grammar learnable by an agent mid-conversation.

## 1. Core model

```ts
type Widget = {
  id: string;                       // "w_" + nanoid(8)
  type: 'table'|'kanban'|'checklist'|'chart'|'note'|'form';
  title: string;                    // 1–80 chars, shown in the widget header
  position: { x: number; y: number; w: number; h: number };   // 12-col grid, rowHeight 40px
  config: WidgetConfig;             // per-type, below
  dataset: DataSet | null;          // null for note
  createdAt: string; updatedAt: string;
  lastModifiedBy: 'human' | 'agent';
};

type DataSet = {
  fields: Field[];                  // ≤20
  rows: Row[];                      // ≤5,000
};

type Field = {
  key: string;                      // /^[a-z][a-z0-9_]{0,39}$/  — stable identity
  label: string;                    // 1–60 chars — display name
  type: 'text'|'number'|'date'|'select'|'boolean'|'url';
  required: boolean;                // default false
  options?: string[];               // select only: 1–30 options, unique
  description?: string;             // ≤200 chars; flows into minted-tool schemas
};

type Row = {
  _id: string;                      // "r_" + nanoid(8)
  _createdAt: string; _updatedAt: string;
  _createdBy: 'human' | 'agent';
  [fieldKey: string]: unknown;      // values typed per Field.type; missing = empty
};
```

**Value validation per field type** (used by add_rows/update_rows, the form UI, and minted
tools — one function, `validateValue(field, value)`):

| type | Accepted | Coercion |
|---|---|---|
| text | string ≤2000 | numbers/booleans stringified |
| number | finite number | numeric strings parsed |
| date | `yyyy-mm-dd` string | Date objects and ISO datetimes truncated |
| select | one of `options` | trimmed, case-sensitive match only |
| boolean | boolean | `"true"`/`"false"` strings parsed |
| url | string passing `URL()` parse, http(s) only | none |

## 2. Data-binding model

- **Each widget owns its dataset.** No shared tables, no joins — with one read-only exception:
  a **chart may reference another widget's dataset** via `config.sourceWidgetId` (chart-over-form
  is the health-log demo: the minted `log_blood_sugar` tool appends to the form's dataset and the
  chart re-renders live). The reference is read-only; deleting the source leaves the chart in an
  empty "source removed" state. Cycles are impossible (charts have no own consumers).
- `bind_data` replaces the field list and migrates rows (kept keys survive; removed keys drop;
  select values outside new options clear; type changes re-coerce, clearing on failure).
- **Fixed-schema types**: `checklist` has an implicit schema and rejects `bind_data`; `note` has
  no dataset at all. Everything else (`table`, `kanban`, `chart` w/o source, `form`) requires
  `bind_data` (or `fields` at `add_widget` time) before rows can exist.

## 3. Per-type config schemas (Zod, authoritative)

### 3.1 `table`

Spreadsheet-like records. Default renderer for "list of things with attributes."

```ts
const TableConfig = z.object({
  columnOrder: z.array(z.string()).optional(),      // field keys; unlisted keys append in schema order
  sort: z.object({ field: z.string(), dir: z.enum(['asc','desc']) }).optional(),
  rowNumbers: z.boolean().default(false),
}).strict();
```

Human affordances: inline cell editing, add-row footer, column sort by header click, row delete.
Cross-checks at validation: `columnOrder` and `sort.field` must reference existing field keys
(`FIELD_NOT_FOUND` otherwise).

### 3.2 `kanban`

Cards grouped into columns by a **select** field.

```ts
const KanbanConfig = z.object({
  groupByField: z.string(),                          // must be a select field
  cardTitleField: z.string(),                        // any field; rendered as card headline
  cardDetailFields: z.array(z.string()).max(3).default([]),
  columnOrder: z.array(z.string()).optional(),       // subset/reorder of groupByField options
}).strict();
```

Columns = the group-by field's `options` (plus an automatic "No status" column for empty
values). Human affordances: drag card between columns (writes the group-by field → command log),
add-card button per column. Cross-checks: `groupByField` exists and is `select`;
title/detail fields exist.

### 3.3 `checklist`

Fixed implicit schema (reported as `fields` in `describe_current_state` so agents can still use
row tools):

```json
[
  { "key": "text", "label": "Item",  "type": "text",    "required": true },
  { "key": "done", "label": "Done",  "type": "boolean", "required": false },
  { "key": "due",  "label": "Due",   "type": "date",    "required": false },
  { "key": "note", "label": "Note",  "type": "text",    "required": false }
]
```

```ts
const ChecklistConfig = z.object({
  showCompleted: z.boolean().default(true),
  sortBy: z.enum(['manual', 'due', 'created']).default('manual'),
  showProgress: z.boolean().default(true),            // "7 of 12 done" header bar
}).strict();
```

Human affordances: checkbox toggle, inline text edit, add-item input, due-date picker.

### 3.4 `chart`

Recharts renderer over its own dataset or another widget's.

```ts
const ChartConfig = z.object({
  chartType: z.enum(['line', 'bar', 'area', 'pie']),
  xField: z.string(),                                 // pie: the category field
  yFields: z.array(z.string()).min(1).max(4),         // number fields; pie uses yFields[0]
  sourceWidgetId: z.string().optional(),              // read-only ref to table/checklist/form dataset
  aggregate: z.enum(['none', 'sum', 'count', 'avg']).default('none'),
                                                      // groups by xField when not 'none'
}).strict();
```

Cross-checks: fields resolve against the **effective dataset** (own or source's); `yFields` must
be `number` type (except `aggregate: 'count'`); `sourceWidgetId` must exist, be a dataset-bearing
widget, and not be another chart. Date x-axes sort chronologically automatically. Empty states:
"No data yet", "Source widget was removed."

### 3.5 `note`

```ts
const NoteConfig = z.object({
  markdown: z.string().max(20000).default(''),
  variant: z.enum(['plain', 'callout']).default('plain'),
}).strict();
```

Rendered markdown (headings, lists, bold, links, task-list syntax read-only). Human affordance:
click-to-edit textarea. The agent updates content via `update_widget({ config: { markdown } })`.
No dataset; row tools return `WRONG_WIDGET_TYPE`.

### 3.6 `form`

The only widget that can mint tools. Rows are submissions.

```ts
const FormConfig = z.object({
  description: z.string().max(300).optional(),        // helper text under the title
  submitLabel: z.string().min(1).max(30).default('Add entry'),
  showRecentSubmissions: z.number().int().min(0).max(10).default(3),
                                                      // mini-list under the form; 0 hides it
}).strict();
```

Human affordances: fill + submit (validated with the same `validateValue` as minted tools —
byte-identical acceptance is a test), edit recent submissions inline. Widget header shows a badge
when a minted tool is attached: `⚡ log_blood_sugar` — this is the on-screen artifact the demo
zooms in on.

## 4. Limits (single source: `model/limits.ts`)

| Limit | Value | Enforced by |
|---|---|---|
| Widgets per board | 24 | add_widget |
| Fields per dataset | 20 | bind_data / add_widget |
| Rows per widget | 5,000 | add_rows |
| Rows per add_rows / patches per update_rows / ids per delete_rows | 50 | row tools |
| Select options | 30 | Field schema |
| Minted tools | 12 | create_form_tool |
| Command-log entries kept | 500 (older entries compacted; undo window shrinks accordingly) | command log |
| Note markdown | 20,000 chars | NoteConfig |

Rationale: every limit is far above demo needs but keeps `localStorage` (~5 MB) and
`describe_current_state` payloads bounded.

## 5. `describe_current_state` — canonical example payload

The exact JSON an agent sees mid-way through the health-log demo (this doubles as a fixture in
`tests/fixtures/`):

```json
{
  "ok": true,
  "stateVersion": 41,
  "board": {
    "title": "Diabetes tracker",
    "theme": { "name": "matcha", "mode": "light", "density": "comfortable" },
    "grid": { "cols": 12, "rowHeightPx": 40 },
    "widgetCount": 3
  },
  "widgets": [
    {
      "id": "w_kQ2mX9ab",
      "type": "form",
      "title": "Blood sugar log",
      "position": { "x": 0, "y": 0, "w": 4, "h": 8 },
      "config": { "description": "Log each reading right after you take it.",
                  "submitLabel": "Log reading", "showRecentSubmissions": 3 },
      "fields": [
        { "key": "reading", "label": "Blood sugar (mg/dL)", "type": "number", "required": true },
        { "key": "context", "label": "When taken", "type": "select", "required": true,
          "options": ["fasting", "before meal", "after meal", "bedtime"] },
        { "key": "note", "label": "Note", "type": "text", "required": false }
      ],
      "rowCount": 4,
      "sampleRows": [
        { "_id": "r_8dKw1pQz", "_createdAt": "2026-08-30T14:02:11Z", "_updatedAt": "2026-08-30T14:02:11Z",
          "_createdBy": "agent", "reading": 104, "context": "after meal", "note": "post-lunch walk" },
        { "_id": "r_2mVx7Ttf", "_createdAt": "2026-08-30T08:15:40Z", "_updatedAt": "2026-08-30T08:15:40Z",
          "_createdBy": "human", "reading": 96, "context": "fasting" }
      ],
      "mintedTools": ["log_blood_sugar"],
      "lastModified": { "at": "2026-08-30T14:02:11Z", "by": "agent" }
    },
    {
      "id": "w_pR4nY2cd",
      "type": "chart",
      "title": "Readings over time",
      "position": { "x": 4, "y": 0, "w": 8, "h": 8 },
      "config": { "chartType": "line", "xField": "_createdAt", "yFields": ["reading"],
                  "sourceWidgetId": "w_kQ2mX9ab", "aggregate": "none" },
      "fields": null,
      "rowCount": 4,
      "sampleRows": [],
      "mintedTools": [],
      "lastModified": { "at": "2026-08-30T13:58:02Z", "by": "agent" }
    },
    {
      "id": "w_zT7wA5ef",
      "type": "checklist",
      "title": "Daily routine",
      "position": { "x": 0, "y": 8, "w": 4, "h": 6 },
      "config": { "showCompleted": true, "sortBy": "manual", "showProgress": true },
      "fields": [
        { "key": "text", "label": "Item", "type": "text", "required": true },
        { "key": "done", "label": "Done", "type": "boolean", "required": false },
        { "key": "due", "label": "Due", "type": "date", "required": false },
        { "key": "note", "label": "Note", "type": "text", "required": false }
      ],
      "rowCount": 3,
      "sampleRows": [
        { "_id": "r_5hJq9Mnb", "_createdAt": "2026-08-30T13:55:20Z", "_updatedAt": "2026-08-30T14:10:05Z",
          "_createdBy": "agent", "text": "Morning fasting reading", "done": true }
      ],
      "mintedTools": [],
      "lastModified": { "at": "2026-08-30T14:10:05Z", "by": "human" }
    }
  ],
  "mintedTools": [
    { "toolName": "log_blood_sugar", "widgetId": "w_kQ2mX9ab",
      "description": "Records one blood-glucose reading in the Blood sugar log…",
      "createdAt": "2026-08-30T13:59:31Z" }
  ],
  "recentActivity": [
    { "seq": 41, "at": "2026-08-30T14:10:05Z", "actor": "human",
      "action": "update_rows", "summary": "Checked off \"Morning fasting reading\" in Daily routine" },
    { "seq": 40, "at": "2026-08-30T14:02:11Z", "actor": "agent",
      "action": "log_blood_sugar", "summary": "Logged reading 104 (after meal) via minted tool",
      "rationale": "User asked to log their post-lunch reading." }
  ],
  "humanEditsSinceLastDescribe": 1
}
```

Notes that make this shape agent-friendly (deliberate choices):

- `sampleRows` means most conversations never need `read_widget_data` — one call gives full
  situational awareness.
- Charts report the **effective** `rowCount` of their source, so the agent knows the chart has
  data without resolving the reference itself.
- `_createdAt` is a legal `xField` — synthetic meta-fields (`_id`, `_createdAt`, `_updatedAt`)
  are documented in field cross-check errors so the agent discovers them on failure, and
  `_createdAt` is explicitly mentioned in the chart section of `add_widget`'s error details.
- `humanEditsSinceLastDescribe` gives the agent a one-integer answer to "did the human touch
  anything since I last looked?"
