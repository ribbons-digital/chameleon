# Reset the canvas

Reset the canvas wipes the command log, advances the board version, and returns to the empty canvas without starting a new Chrome profile.

## Sub-features

- `reset-after-mutation` returns the empty-state heading and empty activity after a drag. The footer shows `state vN · 0 commands` where `N` is one greater than the version before reset.
- `reset-disables-undo` disables `Undo last change` after reset.

## How to get to it (user POV)

- Choose the `Reset canvas` button in the header.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from empty, load the sample board, then create one drag so reset has something to clear.

- **Load sample.** Choose `Load a sample board`. Run `control-chameleon browser click --role button --name "Load a sample board" --wait-text "Latest: Loaded a sample board"`.
- **Dirty the board.** Drag the welcome note. Run `control-chameleon browser drag --name "A canvas that listens" --dx 320 --dy 0` then `control-chameleon browser wait --text "Latest: Moved “A canvas that listens”"`.
- **Reset.** Choose `Reset canvas`. Run `control-chameleon browser click --role button --name "Reset canvas"`. Heading `What are you working on?` returns. The empty activity sentence returns. The footer matches `state vN · 0 commands`. After load plus one drag that `N` is 3: one version each for load, drag, and reset.
- **Doctor empty.** Re-check first paint. Run `control-chameleon doctor --expect-empty`. It passes on this same profile even though the version is not 0.
- **Proof.** Capture the reset board. Run `control-chameleon browser snapshot --aria --path artifacts/reset-canvas/empty.aria.txt` and `control-chameleon browser screenshot --path artifacts/reset-canvas/empty.png`. The artifacts match the open-canvas empty state. Do not require `v0` in the screenshot.

## Gotchas

- Reset is immediate. There is no confirm dialog.
- Reset restores the empty document in this profile and increments `stateVersion`. Assert `0 commands` and `What are you working on?`, not `v0` or the sample widgets.
- Reset does not delete proof files under `artifacts/`.
- After reset, a later reload must still show the empty canvas. If it shows the pre-reset layout, persist wrote stale state; file that as a persist bug, not a reset pass.
