---
name: verify-chameleon
description: Drive the Chameleon Vite/React canvas the way a user does. Open the seeded workspace, drag and resize widgets, edit a note or table cell, undo, reset, and prove localStorage persistence. Use when proving a Chameleon UI change, before claiming a board mutation works, or when a PR touches src/App.tsx, src/grid, src/store, or src/widgets.
---

# Verify Chameleon

Chameleon is a single-route web canvas. A user sees a header, two seed widgets on a 12-column grid, Undo last change, Reset canvas, Show activity, and a footer version line. There is no login. State lives in the browser under localStorage key `chameleon-board-v1`.

This skill is for agents that need to prove a change on the running page. Unit tests in `tests/` do not count as proof. Do not call Zustand setters, do not seed localStorage by hand, and do not drive `http://localhost:4711` unless this run launched it (it did not: launch refuses 4711).

WebMCP tools (`document.modelContext`) are not a user path in this browser. Stable Chrome here shows the dismissable `WebMCP not detected in this browser` banner and a token like `15 tools ready`. Do not treat tool calls as verification of the canvas. Checklist, kanban, chart, and form widgets are not on the seed board; a human cannot add them without an agent host, so they are out of scope for this skill until a user-facing add-widget control exists.

Each `browser` command opens Chrome against this run's profile, does the work, and closes it. Open editors and the activity list are React state, not persisted. Finish those in one command (`browser note`, `browser cell`, or a click with `--wait-text` / `--aria-snapshot` / `--screenshot`). Layout, cells, and the command log persist, so drag, reload, and undo can be separate commands.

## Launch

From the repo root:

```bash
export PATH="$PWD/.cursor/skills/verify-chameleon/scripts:$PATH"
export CHAMELEON_VERIFY_RUN="${CHAMELEON_VERIFY_RUN:-$(date +%s)}"
export CHAMELEON_VERIFY_PORT="${CHAMELEON_VERIFY_PORT:-14711}"
npm install
control-chameleon launch
```

Ready when `control-chameleon launch` prints `"ok": true` and `"url": "http://127.0.0.1:<port>/"`. Vite is bound to 127.0.0.1. The first `doctor` or `browser` command opens Chrome against a disposable profile at `/tmp/chameleon-verify/<run>/chrome-profile`.

If the repo `node_modules` or the harness `scripts/node_modules` are missing, `launch` runs `npm install` for each.

Teardown is `control-chameleon cleanup`. It kills the Vite pid recorded in the run state and deletes that run's Chrome profile. It does not delete `.cursor/skills/verify-chameleon/artifacts/`.

Default port is 14711. Launch exits if `CHAMELEON_VERIFY_PORT=4711` because that is the human `npm run dev` port. Two runs can coexist: give each a distinct `CHAMELEON_VERIFY_RUN` and `CHAMELEON_VERIFY_PORT`. Never attach to an instance whose `state.json` this run did not write.

## Doctor

```bash
control-chameleon doctor
control-chameleon doctor --expect-seed
```

Doctor is read-only. Run it first whenever the page looks wrong.

It checks:

- The Vite pid in `/tmp/chameleon-verify/<run>/state.json` is alive.
- `GET` of that state's URL returns HTTP 2xx.
- The page shows the `CHAMELEON` mark, a region named `Widget canvas`, a button named `Undo last change`, and a button named `Reset canvas`.
- The URL and profile match this run. If they do not, stop. That is someone else's session.

`--expect-seed` also requires the first-load board:

- Heading `Untitled workspace`
- Headings `A canvas that listens` and `What happens next`
- Activity copy `Drag, edit, or ask an agent to create the first activity entry.`
- Footer matching `state vN · 0 commands` (middle dot is `·`). A fresh profile is `v0`. Reset keeps the current `N` and clears the log, so a reset board can be `state v1 · 0 commands`.
- `Undo last change` disabled

A board that still has commands will fail `--expect-seed`. Use `Reset canvas` or a new run id.

## Drive

Put `scripts` on `PATH` as in Launch, then run the commands in `features/` verbatim.

Stable handles:

| What | Handle |
|---|---|
| App identity | text `CHAMELEON` |
| Board title | heading level 1, seed value `Untitled workspace` |
| Canvas | region `Widget canvas` |
| Welcome note | heading `A canvas that listens` |
| Next-steps table | heading `What happens next` |
| Undo | button `Undo last change` |
| Reset | button `Reset canvas` |
| Activity toggle | button `Show activity` / `Hide activity` |
| Empty activity | `Drag, edit, or ask an agent to create the first activity entry.` |
| Empty activity list | `No activity yet` |
| After a move | `Latest: Moved “A canvas that listens”` (curly quotes) |
| After a resize | `Latest: Resized “A canvas that listens”` |
| After a note edit | `Latest: Edited note “A canvas that listens”` |
| After a table edit | `Latest: Edited “What happens next”` |
| After add row | `Latest: Added a row to “What happens next”` |
| After delete widget | `Latest: Removed “A canvas that listens”` |
| After undo | `Latest: Undid: Moved “A canvas that listens”` |
| Version line | `state vN · M commands` |
| Unhosted token | `15 tools ready` |
| Unhosted banner | `WebMCP not detected in this browser` |
| Banner dismiss | button `Dismiss` |
| Delete widget | button `Delete A canvas that listens` |
| Add table row | button `Add row` |
| Note editor | textbox `Note markdown` |
| Seed table cell | button whose name is the cell text, then textbox `Step` |
| Empty canvas | heading `What are you working on?` |
| Copy wedding prompt | button `Copy wedding planner prompt`, then `Copied` |
| Measure widget box | `browser measure --name <heading>` |
| Viewport | `--width` and `--height` on any `browser` command (default 1400x900) |

Drag from `header.widget-drag-handle` (the card header, including the heading). Resize from that card's `.react-resizable-handle` (southeast corner). Clicking markdown or a table cell does not drag; the grid cancels drag on `textarea`, `input`, `button`, and `[role="checkbox"]`.

```bash
control-chameleon browser click --role button --name "Reset canvas"
control-chameleon browser assert --role button --name "Undo last change" --disabled
control-chameleon browser drag --name "A canvas that listens" --dx 320 --dy 0
control-chameleon browser wait --text "Latest: Moved “A canvas that listens”"
control-chameleon browser note --name "A canvas that listens" --markdown "Edited from verification." --wait-text "Latest: Edited note “A canvas that listens”"
control-chameleon browser cell --from "Your agent reads the board" --value "Hand edits land in the log" --wait-text "Latest: Edited “What happens next”"
control-chameleon browser click --role button --name "Show activity" --wait-text "No activity yet" --aria-snapshot artifacts/open-canvas/activity.aria.txt --screenshot artifacts/open-canvas/activity.png
control-chameleon browser snapshot --aria --path artifacts/open-canvas/home.aria.txt
control-chameleon browser screenshot --path artifacts/open-canvas/home.png
control-chameleon browser storage --path artifacts/open-canvas/board.json
control-chameleon browser measure --name "A canvas that listens" --width 375 --height 812
```

Relative `--path`, `--aria-snapshot`, and `--screenshot` values resolve to `.cursor/skills/verify-chameleon/`. One Chrome profile is locked per run. Do not run two `browser` commands in parallel against the same `CHAMELEON_VERIFY_RUN`.

Read the feature map before driving. Cover the entry points the map lists for the feature you claim. An unreachable entry is a skip with the attempted command, not a pass through a different path.

## Evidence

Proof lives in `.cursor/skills/verify-chameleon/artifacts/<feature>/`. Keep it after cleanup.

A passing proof has:

1. The user action (click, drag, resize, type, reload) and the resulting screen, not only the final screen.
2. An ARIA snapshot and a screenshot that show the `CHAMELEON` mark plus the widget titles or activity line you assert.
3. For persistence, the activity line after reload plus a dump of `chameleon-board-v1` from that same profile. The dump is a side-effect check. It is not a substitute for the visible footer.
4. The feature file id and entry point in the artifact names or the command log.

Do not write localStorage yourself, do not use Vitest as the live proof, and do not screenshot a board you did not launch.

## Cleanup

```bash
control-chameleon cleanup
```

Kills the Vite pid from this run's `state.json`. Deletes `/tmp/chameleon-verify/<run>/chrome-profile` and `state.json`. Leaves `artifacts/` in place. After cleanup, confirm the screenshot and ARIA files still exist.

If launch or doctor fails, run cleanup before retrying the same run id so the next launch can recreate the profile.

## Helpers

`scripts/control-chameleon` is a shell wrapper around `scripts/control-chameleon.mjs`. `scripts/package.json` installs `playwright-core` and is verification scaffolding, not app runtime.

Chrome binary: `CHROME_PATH`, else `/usr/local/bin/google-chrome`, else `/usr/bin/google-chrome-stable`. Headed Chrome: `CHAMELEON_VERIFY_HEADED=1`.
