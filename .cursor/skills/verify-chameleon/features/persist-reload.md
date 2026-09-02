# Persist across reload

Persist across reload keeps widget positions, hand edits, and the command log when the user reloads the tab, using the same Chrome profile's localStorage.

## Sub-features

- `persist-after-move` keeps an intentional vertical gap and `Latest: Moved “A canvas that listens”` after reload instead of compacting it only on screen.
- `persist-storage` writes key `chameleon-board-v1` in this profile.
- `persist-reset` keeps the empty canvas after reset then reload.

## How to get to it (user POV)

- Reload the tab (browser reload) after dragging a widget.
- Close and reopen Chrome against the same `CHAMELEON_VERIFY_RUN` profile (the next `control-chameleon browser` command does this).

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from empty, then load the sample board (`control-chameleon browser click --role button --name "Load a sample board" --wait-text "Latest: Loaded a sample board"`).

- **Mutate.** Drag the welcome note down, leaving empty rows above it. Run `control-chameleon browser drag --name "A canvas that listens" --dx 0 --dy 240 --wait-text "Latest: Moved “A canvas that listens”"` then `control-chameleon browser measure --name "A canvas that listens"`. Record the returned `y`.
- **Reload tab.** Reload. Run `control-chameleon browser reload --wait-text "Latest: Moved “A canvas that listens”"` then measure again. The moved summary and `state v2 · 2 commands` remain, and the note has the same lower `y`; the grid did not visually compact away the stored gap.
- **Storage dump.** Read the persisted document. Run `control-chameleon browser storage --path artifacts/persist-reload/board.json`. The file is non-empty JSON that includes `A canvas that listens`, a positive stored `position.y`, and a commands array.
- **Fresh Chrome, same profile.** Run a new command so Chrome starts again on this user-data-dir. Run `control-chameleon browser assert --text "Latest: Moved “A canvas that listens”"`. The mutation is still visible.
- **Proof.** Capture the reloaded board. Run `control-chameleon browser snapshot --aria --path artifacts/persist-reload/reloaded.aria.txt` and `control-chameleon browser screenshot --path artifacts/persist-reload/reloaded.png`. The artifacts show the moved activity line and the `CHAMELEON` mark.

## Gotchas

- Persistence is per Chrome profile, not per Vite process. Reloading with a new `CHAMELEON_VERIFY_RUN` is an empty canvas and does not disprove persist.
- Dumping `chameleon-board-v1` is a side-effect check. The visible footer after reload is the user-facing proof.
- Do not `localStorage.setItem` in `evaluate` to arrange state. Arrange by dragging, then reload.
- Hydration can flash the empty canvas for a moment. Wait for the `Latest: Moved` line, not a fixed sleep.
- Persist version is 3. A dump that still mentions Day 1 `content` on a command patch is a migration miss, not a pass.
