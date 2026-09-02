# Chameleon verification map

This directory is the maintained source for verifying the user-facing behavior of Chameleon. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch Chameleon with `control-chameleon launch` so Vite listens on `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/` (default 14711).
- Use a unique `CHAMELEON_VERIFY_RUN` per concurrent job. The Chrome profile is `/tmp/chameleon-verify/<run>/chrome-profile`.
- Put `.cursor/skills/verify-chameleon/scripts` on `PATH`.
- Run `control-chameleon doctor --expect-empty` and require the `CHAMELEON` mark, `Untitled workspace`, heading `What are you working on?`, empty activity copy, and a footer matching `state vN · 0 commands`.
- Never drive `localhost:4711` or any instance whose `state.json` this run did not write.

## Driving conventions

- Start every recipe from the empty canvas unless its preconditions say otherwise. Recipes that drag or edit widgets first choose `Load a sample board`. `Reset canvas` returns the empty canvas and an empty log inside the same profile. It does not rewind `stateVersion` to 0.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position. The drag handle class `widget-drag-handle` and resize handle `.react-resizable-handle` are the exceptions the grid requires.
- Treat every command as literal. Keep quoted names, curly quotes in activity copy, and the middle dot in `state v0 · 0 commands` unchanged.
- Run browser actions through `control-chameleon browser`. Open editors and the activity list must finish in that same command.
- Restore the empty canvas after a mutation when the next recipe needs it. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with the `CHAMELEON` mark visible.
- Mutation proof includes the activity footer and, for persistence, a reload plus a `chameleon-board-v1` dump.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-chameleon` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Open the empty canvas](./open-canvas.md) covers first paint, identity, copy prompts, empty activity, and the unhosted WebMCP banner.
- [Build the board by hand](./build-by-hand.md) covers Add widget, a ready checklist, the table-to-agent handoff, and Rename board.
- [Move and resize widgets](./move-and-resize.md) covers dragging and resizing a card and the activity line that follows.
- [Edit widgets by hand](./edit-widgets.md) covers note markdown, table cells, adding a row, and deleting a widget.
- [Review human and agent activity](./review-activity.md) covers timestamps, actor/action attribution, and undone commands.
- [Undo last change](./undo.md) covers enabling undo after a mutation and restoring the prior layout.
- [Reset the canvas](./reset-canvas.md) covers wiping commands and returning to the empty canvas.
- [Persist across reload](./persist-reload.md) covers localStorage surviving a browser reload.
- [Clear the canvas to the empty state](./empty-canvas.md) covers copy-prompt buttons, loading the sample board, and Reset restoring empty.
- [Stack the grid on a narrow viewport](./mobile-stack.md) covers the 375px one-column stack and the no-persist drag guard.
