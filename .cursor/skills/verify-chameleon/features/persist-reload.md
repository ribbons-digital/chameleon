# Persist across reload

Persist across reload keeps widget positions and the command log when the user reloads the tab, using the same Chrome profile's localStorage.

## Sub-features

- `persist-after-move` keeps the moved layout and `Latest: Moved “A canvas that listens”` after reload.
- `persist-storage` writes key `chameleon-board-v1` in this profile.
- `persist-reset` keeps the seed board after reset then reload.

## How to get to it (user POV)

- Reload the tab (browser reload) after dragging a widget.
- Close and reopen Chrome against the same `CHAMELEON_VERIFY_RUN` profile (the next `control-chameleon browser` command does this).

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from seed (`control-chameleon doctor --expect-seed`).

- **Mutate.** Drag the welcome note. Run `control-chameleon browser drag --name "A canvas that listens" --dx 320 --dy 0` then `control-chameleon browser wait --text "Latest: Moved “A canvas that listens”"`.
- **Reload tab.** Reload. Run `control-chameleon browser reload` then `control-chameleon browser wait --text "Latest: Moved “A canvas that listens”"`. The moved summary and `state v1 · 1 commands` are still visible. Both widget titles remain.
- **Storage dump.** Read the persisted document. Run `control-chameleon browser storage --path artifacts/persist-reload/board.json`. The file is non-empty JSON that includes `A canvas that listens` and a commands array.
- **Fresh Chrome, same profile.** Run a new command so Chrome starts again on this user-data-dir. Run `control-chameleon browser assert --text "Latest: Moved “A canvas that listens”"`. The mutation is still visible.
- **Proof.** Capture the reloaded board. Run `control-chameleon browser snapshot --aria --path artifacts/persist-reload/reloaded.aria.txt` and `control-chameleon browser screenshot --path artifacts/persist-reload/reloaded.png`. The artifacts show the moved activity line and the `CHAMELEON` mark.

## Gotchas

- Persistence is per Chrome profile, not per Vite process. Reloading with a new `CHAMELEON_VERIFY_RUN` is a blank seed board and does not disprove persist.
- Dumping `chameleon-board-v1` is a side-effect check. The visible footer after reload is the user-facing proof.
- Do not `localStorage.setItem` in `evaluate` to arrange state. Arrange by dragging, then reload.
- Hydration can flash the seed widgets for a moment. Wait for the `Latest: Moved` line, not a fixed sleep.
