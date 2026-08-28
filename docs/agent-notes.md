# Agent checkpoint notes

Living log of real-agent and inspector findings. Day 2 is the first checkpoint.
Rewrite tool descriptions from evidence here — do not paper over a misuse by
changing the human prompt.

## 2026-08-28 — Day 2 checkpoint

### Environment of this run

This session is a Cloud Agent VM. It can deploy to Cloudflare and drive a
normal Chromium for UI verification. It cannot launch:

- ChatGPT’s desktop-app browser
- Chrome Canary with `chrome://flags/#enable-webmcp-testing`

Those two runtimes are still required before we treat descriptions as
empirically tuned. Recorded below is everything this environment *could*
verify, plus the compatibility adapter we shipped so a later Canary/ChatGPT
pass can be a description-tuning pass instead of a rewrite of the handlers.

### Detection (implementation)

`getModelContext()` / `detectModelContext()`:

1. Feature-detect `document.modelContext` first (canonical April 2026 draft).
2. Fall back to `navigator.modelContext` only if the document surface is absent
   (`@mcp-b/webmcp-types` marks navigator as `@deprecated`).
3. If neither exists, the registry still tracks tools so the UI can show
   “N tools ready”, and a Banner + console line explain how to enable WebMCP.

Unit tests cover the preference order. Live UI in this VM (stable Chromium)
correctly reports **WebMCP not detected** and still renders the board.

### Registration contract vs. known implementation drift

Evidence from `@mcp-b/webmcp-types` 5.0.1 (not weakened in handlers):

| Surface | Spec / types | Known drift |
|---|---|---|
| `registerTool` | object `inputSchema`, returns `Promise<void>`, lifetime via `AbortSignal` | `getTools()` on Chrome 149–153 returned the schema as a **string**; 154+ returns an object. Some polyfills mirrored the string form on register. |
| `unregisterTool` | **absent** | Older snippets still mention it. Registry always `abort()`s, then calls `unregisterTool(name)` if that function exists. |
| `provideContext` / `clearContext` | removed March 2026 | We never call them. |
| Tool execute input | one object argument | If a runtime ever delivers a JSON string, that would be an adapter concern at the registry edge — handlers always receive Zod-parsed objects. |

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

### Still to capture on ChatGPT desktop + Canary

Prompt: “set up a page for planning a small dinner party”.

Watch and paste here:

- Which tools were discovered (names + whether schemas look Draft-7 / inline).
- Which tools it actually called, in order.
- Any argument mistakes (wrong `type` enum, missing `title`, config-as-string).
- Whether `document.modelContext`, `navigator.modelContext`, or both appear.
- Model Context Tool Inspector listing vs. our five tools.

Until that transcript exists, do not rewrite the spec descriptions.

### UI verification done in this VM

- Default board: note + table both render (markdown / Astryx Table).
- Drag by header and resize still persist through `mutate` and undo.
- Click-to-edit on the note writes a human `update_widget` command.
- Empty WebMCP banner is visible in stable Chrome and dismissable.
