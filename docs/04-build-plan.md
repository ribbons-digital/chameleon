# Chameleon — Build Plan: Aug 28 → Sep 3, 1:00pm PDT

Ordering principle (per the judging-risk ranking): **Execution first** — the deployed app must
never break in a judge's hands — then WebMCP leverage, then demo polish. Concretely that means:
deploy to HTTPS on day 1 and keep `main` deployable every day; test with real agents from day 2;
freeze features 48h before the deadline.

**Standing rules, every day**

- Commit per logical change; push before every testing session. `npm test` green before EOD push.
- The deployed URL is redeployed at each day's end — judges-facing environment never drifts far
  from `main`.
- Any feature that misses its day gets evaluated against the cut lines (§ Cut lines) — we cut
  scope, never the test bar.

---

## Day 1 — Thu Aug 28: skeleton, styling risk retired, deployed URL exists

- Scaffold Vite + React 19 + TypeScript; TanStack Router (file-based, single route, **no SSR**).
- Astryx: install core + all 7 themes + CLI; run `astryx init` (AGENTS.md cheat sheet); pre-built
  CSS imports in `__root.tsx`; ThemeProvider; `astryx doctor` to pin the StyleX peer range.
- **Retire the styling risk (timeboxed ~2h)**: wire `vite-plugin-stylex`, write one
  `stylex.create()` style, pass via `xstyle`, verify in dev AND `vite build` output.
  **Fallback if the plugin fights StyleX/Vite versions**: drop the plugin, write custom styles
  as plain CSS + `className` (Astryx supports any styling for our own code). Decide by EOD; do
  not carry this risk into day 2.
- Store: `model/types.ts`, `boardStore` + persist, `mutate.ts` gate, command log with Immer
  patches, undo.
- Grid: react-grid-layout with 2 hardcoded dummy widgets; drag/resize writes through `mutate`.
- Deploy: `wrangler` static assets → HTTPS URL live. CI-less is fine; `npm run deploy` is the
  pipeline.
- Tests started: `commands.test.ts`, `fields.test.ts`.

**EOD bar**: HTTPS URL renders a themed board with draggable dummy widgets; undo works; tests green.

## Day 2 — Fri Aug 29: tool surface online + FIRST agent checkpoint

- `webmcp/`: modelContext detection, registry (+ fake for tests), `makeTool`, result envelope,
  boot sequencing.
- Tools: `describe_current_state`, `add_widget`, `update_widget`, `remove_widget`,
  `get_activity_log`. Widgets renderable: **note + table** (table read-only is acceptable today).
- Tests: `registry.test.ts`, `schema-roundtrip.test.ts` (statics), `describe.test.ts`,
  `widgets.test.ts`.
- **Agent checkpoint #1 (deployed URL, both runtimes)** — do not skip, this is the earliest
  moment external reality can falsify the design:
  - **ChatGPT desktop app browser**: open the URL, prompt "set up a page for planning a small
    dinner party" — verify tool discovery, watch which tools it picks, capture transcript.
  - **Chrome Canary**: enable the WebMCP flag (`chrome://flags/#enable-webmcp-testing`; if the
    name moved, search flags for "webmcp" — the flag has been renamed once already), verify via
    the **Model Context Tool Inspector** that all tools list with correct schemas; confirm
    whether this build exposes `document.modelContext`, `navigator.modelContext`, or both, and
    adjust `modelContext.ts` if needed.
  - Output of checkpoint: a `docs/agent-notes.md` log of misused tools → description rewrites.

**EOD bar**: an agent in ChatGPT's browser can build a note+table page on the live URL.

## Day 3 — Sat Aug 30: data layer + human editing + remaining flat widgets

- Tools: `bind_data` (+ row migration), `add_rows`, `update_rows`, `delete_rows`,
  `read_widget_data`, `undo` (as a tool; the store undo exists since day 1).
- Widgets: **checklist, kanban**; table becomes editable (inline cells, add-row).
- Human-edit surfaces all writing through `mutate(actor:'human')`: cell edit, checkbox, kanban
  card drag, widget delete, ActivityDrawer, AgentPulse.
- Tests: `data.test.ts`, `migrate.test.ts`, `undo.test.ts`, kanban/checklist config
  cross-checks.
- Mini-checkpoint (30 min, ChatGPT browser): "track my job search" → does the agent build
  kanban + table and put rows in? Fix descriptions per notes.

**EOD bar**: job-search scenario works end-to-end with human hand-edits visible in
`get_activity_log`.

## Day 4 — Sun Aug 31: THE SIGNATURE MOVE + chart + layout/theme + checkpoint #2

- `minted.ts`: schema derivation, mint/unmint/remint, persistence, boot re-registration.
- Tools: `create_form_tool`, `remove_minted_tool`, `set_layout`, `set_theme`.
- Widgets: **form** (submit parity with minted tool), **chart** (Recharts, lazy-loaded,
  `sourceWidgetId`, aggregates).
- ⚡ badge on minted forms; empty states for chart.
- Tests: `mint.test.ts`, `minted-lifecycle.test.ts`, form/tool parity, `layout.test.ts`,
  describe fixture test.
- **Agent checkpoint #2 (deployed URL, both runtimes)** — run all three demo scenarios as
  scripted in docs/05, unrehearsed prompts first, then the scripted ones:
  1. wedding planner, 2. job search, 3. health log **including**: mint → reload page → "log a
  reading of 104 after lunch" → minted tool fires → chart updates.
  - In Canary's inspector: confirm the minted tool appears/disappears live at mint/unmint.
  - Verify localStorage persistence across reload in both runtimes.

**EOD bar**: all 15 tools + minting lifecycle work against the live URL in both runtimes. This is
feature-complete.

## Day 5 — Mon Sep 1: hardening + freeze

- Error-message audit: trigger every error code from a real agent session; rewrite unclear hints.
- Empty/loading/error states: blank-board EmptyState with 3 suggested prompts; "WebMCP not
  detected" banner with enable instructions (judges may open in stable Chrome first!); chart
  empty states; localStorage-full guard.
- Mobile/responsive pass (grid stacks to 1 column below 700px; judges may open on a phone even
  though agents won't).
- Performance: bundle check (`vite build` report), Recharts lazy chunk confirmed, 5k-row table
  scroll acceptable.
- README (per docs/06), LICENSE check, repo public, screenshots taken.
- **Full dress rehearsal**: run the exact demo script twice in ChatGPT's browser on the deployed
  URL, timed. Note every hesitation — those become day-6 caption moments or prompt tweaks.
- **Feature freeze at EOD.** After this point only judge-blocking bugs get fixed.

**Cut-line review happens at noon today** — see below.

## Day 6 — Tue Sep 2: demo video + submission materials (reserved, no coding)

- Record the demo per docs/05 (screen + voiceover; OBS or QuickTime; 1080p; captions for the
  minting moment). Budget: 3 takes recording (morning), edit + title cards (afternoon).
- Upload to YouTube **public** (not unlisted — Devpost requires public), verify playback logged
  out, <3:00.
- Devpost: create submission, paste the four-section text (docs/06 draft, finalized), gallery
  images, live URL, repo URL, video URL.
- **Submit a complete draft submission today.** Devpost allows editing until the deadline;
  an existing submission converts deadline risk into edit polish.
- Final redeploy; tag `v1.0.0`; verify the live URL one last time in a clean browser profile.

## Day 7 — Wed Sep 3 (deadline 1:00pm PDT): buffer only

- Morning: re-verify live URL + video + repo visibility from a machine that has never seen the
  project. Fix only judge-blocking issues.
- **Hard stop 11:00am PDT**: final submission confirmed on Devpost (2-hour buffer for Devpost
  flakiness). Nothing ships after 11am.

---

## Cut lines (apply top-down when behind; reviewed Day 5 noon)

Never cut: the 3 demo scenarios, `create_form_tool` + full minted lifecycle,
`describe_current_state`, persistence, human editing + activity log, the test bar.

| # | Cut | Saves | Consequence |
|---|---|---|---|
| 1 | Themes: ship `neutral` + `matcha` only | CSS weight + theme QA | `set_theme` enum shrinks; restyle beat in demo still works |
| 2 | `chart.aggregate` (keep `none`) | Recharts data-shaping code | Agent pre-aggregates via rows; demo unaffected |
| 3 | Kanban human drag-between-columns | dnd edge cases in RGL | Human moves cards via inline select; agent unaffected (`update_rows`) |
| 4 | `read_widget_data` offset paging (keep limit) | pagination QA | Fine below 200 rows — all demos are |
| 5 | `chart.sourceWidgetId` | cross-widget selectors | Health demo: agent binds fields on the chart and mirrors rows with `add_rows`; visibly clunkier — cut only in emergency |
| 6 | Mobile layout pass | a day-5 afternoon | Desktop-only note in README; judges instructed to use desktop |
| 7 | `undo` as an agent tool (keep human undo) | one tool's QA | Weakens tool-catalog completeness slightly |

Explicitly **not** on the cut list and not to be attempted at all: multi-board support,
IndexedDB migration (localStorage suffices at our limits), collaborative sync, agent-side
streaming/partial results, form field types beyond the six, import/export.

## Standing risk register

| Risk | Mitigation |
|---|---|
| ChatGPT browser behaves differently from Canary (schema strictness, tool-call limits) | Checkpoint from day 2 in **both**; envelope-not-throw design; inline schemas, no $refs |
| API entry point drift (`document.` vs `navigator.modelContext`, flag rename) | Detection helper checks both; flag verified at checkpoint #1; polyfill `@mcp-b/global` as last-resort shim for the demo, decided day 2 |
| `vite-plugin-stylex` incompatibility | Day-1 timebox + plain-CSS fallback (Astryx unaffected) |
| react-grid-layout + React 19 friction | Day-1 dummy-widget test surfaces it immediately; fallback `gridstack.js` wrapper, decided day 1 |
| Judge opens URL in a non-WebMCP browser | Banner with enable instructions + a 20-sec looping GIF of the app working, embedded on the empty state |
| localStorage cleared by judge / private mode | App boots to a well-designed EmptyState — the blank page IS the product's first screen anyway |
