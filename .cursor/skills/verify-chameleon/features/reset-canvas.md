# Reset the canvas

Reset the canvas wipes the command log and restores the two seed widgets and empty activity line without starting a new Chrome profile.

## Sub-features

- `reset-after-mutation` returns titles, empty activity, and `state v0 · 0 commands` after a drag.
- `reset-disables-undo` disables `Undo last change` after reset.

## How to get to it (user POV)

- Choose the `Reset canvas` button in the header.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from seed, then create one drag so reset has something to clear.

- **Dirty the board.** Drag the welcome note. Run `control-chameleon browser drag --name "A canvas that listens" --dx 320 --dy 0` then `control-chameleon browser wait --text "Latest: Moved “A canvas that listens”"`.
- **Reset.** Choose `Reset canvas`. Run `control-chameleon browser click --role button --name "Reset canvas"`. The empty activity sentence returns, the heading is `Untitled workspace`, and the footer reads `state v0 · 0 commands`.
- **Doctor seed.** Re-check seed identity. Run `control-chameleon doctor --expect-seed`. It passes on this same profile.
- **Proof.** Capture the reset board. Run `control-chameleon browser snapshot --aria --path artifacts/reset-canvas/seed.aria.txt` and `control-chameleon browser screenshot --path artifacts/reset-canvas/seed.png`. The artifacts match the open-canvas seed: `CHAMELEON`, both widget titles, empty activity.

## Gotchas

- Reset is immediate. There is no confirm dialog.
- Reset restores the seed document in this profile. It does not delete proof files under `artifacts/`.
- After reset, a later reload must still show the seed board. If it shows the pre-reset layout, persist wrote stale state; file that as a persist bug, not a reset pass.
