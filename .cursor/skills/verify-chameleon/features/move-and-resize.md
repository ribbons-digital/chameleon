# Move and resize widgets

Move and resize lets a user drag a widget card or pull its southeast handle, then see that mutation in the activity footer and version line.

## Sub-features

- `move-drag` moves the welcome note by dragging the card header.
- `resize-handle` changes the welcome note size from the southeast handle.
- `move-activity` writes `Latest: Moved “A canvas that listens”` and increments the command count.
- `resize-activity` writes `Latest: Resized “A canvas that listens”`.

## How to get to it (user POV)

- Drag the welcome note header (`A canvas that listens`) by the heading or the type token.
- Drag the southeast resize handle on that same card.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- The board is the seed layout (`control-chameleon doctor --expect-seed`).
- No other `browser` command is using this run's Chrome profile.

- **Drag note.** Drag the welcome note to the right. Run `control-chameleon browser drag --name "A canvas that listens" --dx 320 --dy 0`. The footer shows `Latest: Moved “A canvas that listens”` and `state v1 · 1 commands`. Confirm with `control-chameleon browser wait --text "Latest: Moved “A canvas that listens”"` and `control-chameleon browser assert --text "state v1 · 1 commands"`.
- **Undo enabled.** Inspect undo. Run `control-chameleon browser assert --role button --name "Undo last change" --enabled`. The button is no longer disabled.
- **Resize note.** Pull the southeast handle. Run `control-chameleon browser resize --name "A canvas that listens" --dx 80 --dy 80`. The footer shows `Latest: Resized “A canvas that listens”` and `state v2 · 2 commands`. Confirm with `control-chameleon browser wait --text "Latest: Resized “A canvas that listens”"`.
- **Proof.** Capture the mutated board. Run `control-chameleon browser snapshot --aria --path artifacts/move-and-resize/moved.aria.txt` and `control-chameleon browser screenshot --path artifacts/move-and-resize/moved.png`. Both artifacts show the `CHAMELEON` mark and the `Latest: Resized` line.

## Gotchas

- Activity summaries use curly quotes: `“A canvas that listens”`. Straight quotes will not match.
- A drag shorter than one grid cell records nothing. If activity stays on the empty-state sentence, increase `--dx` and retry from seed.
- The resize handle sits on the card corner. Clicking the heading drags; it does not resize.
- `dx` 320 is about two columns on a 1400px window. Do not use coordinate clicks against another machine's layout.
- Drag from the header. Clicks on markdown, table cells, or `Add row` are cancelled as drags on purpose.
