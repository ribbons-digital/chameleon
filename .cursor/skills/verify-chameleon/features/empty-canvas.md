# Clear the canvas to the empty state

Empty canvas is the board after every widget is deleted. The seed note and table are gone. The canvas shows "What are you working on?" and three copy-prompt buttons. Reset still restores the seed widgets. First load is not blank.

## Sub-features

- `empty-after-delete` shows heading `What are you working on?` after both seed widgets are deleted.
- `empty-copy-wedding` copies the wedding planner prompt and relabels that button `Copied`.
- `empty-reset-restores-seed` restores the seed note and table from this empty board.

## How to get to it (user POV)

- Choose `Delete A canvas that listens`, then `Delete What happens next`.
- Choose `Copy wedding planner prompt` on the empty canvas.
- Choose `Reset canvas` from the empty canvas.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from seed (`control-chameleon doctor --expect-seed`).
- Do not seed localStorage by hand.

- **Delete both widgets.** Choose the note delete control, then the table delete control. Run `control-chameleon browser click --role button --name "Delete A canvas that listens" --wait-text "Latest: Removed “A canvas that listens”"` then `control-chameleon browser click --role button --name "Delete What happens next" --wait-text "What are you working on?"`. The canvas heading is `What are you working on?`. The seed widget titles are gone.
- **Copy a prompt.** Choose `Copy wedding planner prompt`. Run `control-chameleon browser click --role button --name "Copy wedding planner prompt" --wait-text "Copied"`. That button now reads `Copied`. The other two copy buttons keep their original labels.
- **Proof.** Capture the empty canvas. Run `control-chameleon browser snapshot --aria --path artifacts/day-5/empty-canvas.aria.txt` and `control-chameleon browser screenshot --path artifacts/day-5/empty-canvas.png`. Both artifacts show `CHAMELEON`, `What are you working on?`, and the three copy buttons.
- **Reset restores seed.** Choose `Reset canvas`. Run `control-chameleon browser click --role button --name "Reset canvas"` then `control-chameleon doctor --expect-seed`. The seed note and table return. The empty-state heading is gone.

## Gotchas

- First paint of a new profile is the seed board, not this empty state. Reset also returns to seed. The only user path here is deleting every widget.
- Clipboard write can fail in a locked-down profile. If `Copied` never appears, record the click command and the unmet label as a skip, not a pass through a different path.
- After this recipe, later features that drag `A canvas that listens` need Reset or a new run.
