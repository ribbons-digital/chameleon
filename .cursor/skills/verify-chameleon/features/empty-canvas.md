# Clear the canvas to the empty state

Empty canvas is first paint, and it is also what Reset canvas restores. The heading is "What are you working on?" with three copy-prompt buttons and Load a sample board. There are no widgets until an agent adds them, the human chooses Add widget, or the human loads the sample board.

## Sub-features

- `empty-first-paint` shows heading `What are you working on?` on a fresh profile.
- `empty-copy-wedding` copies the wedding planner prompt and relabels that button `Copied`.
- `empty-load-sample` places the sample note and table.
- `empty-reset` returns to this empty canvas from the sample board.

## How to get to it (user POV)

- Open the launched URL on a new profile.
- Choose `Reset canvas`.
- Choose `Copy wedding planner prompt`.
- Choose `Load a sample board` when you want widgets without an agent.
- Choose `Add widget` when you want to start by hand; that path is covered in `build-by-hand.md`.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from empty (`control-chameleon doctor --expect-empty`).
- Do not seed localStorage by hand.

- **Copy a prompt.** Choose `Copy wedding planner prompt`. Run `control-chameleon browser click --role button --name "Copy wedding planner prompt" --wait-text "Copied" --screenshot artifacts/day-5/copy-prompt.png --aria-snapshot artifacts/day-5/copy-prompt.aria.txt`. That button now reads `Copied`. The other two copy buttons keep their original labels.
- **Load sample.** Choose `Load a sample board`. Run `control-chameleon browser click --role button --name "Load a sample board" --wait-text "Latest: Loaded a sample board"`. Headings `A canvas that listens` and `What happens next` are visible. Confirm with `control-chameleon doctor --expect-sample`.
- **Reset to empty.** Choose `Reset canvas`, review the destructive-action dialog, then choose `Reset workspace`. Run `control-chameleon browser reset --wait-text "What are you working on?"` then `control-chameleon doctor --expect-empty`. The empty-state heading returns. The sample titles are gone.
- **Proof.** Capture the empty canvas. Run `control-chameleon browser snapshot --aria --path artifacts/day-5/empty-canvas.aria.txt` and `control-chameleon browser screenshot --path artifacts/day-5/empty-canvas.png`. Both artifacts show `CHAMELEON`, `What are you working on?`, and the three copy buttons.

## Gotchas

- Clipboard write can fail in a locked-down profile. If `Copied` never appears, record the click command and the unmet label as a skip, not a pass through a different path.
- `Copied` is React state. Snapshot it on the same command as the click.
- After `Load a sample board`, undo is enabled and the footer is `Latest: Loaded a sample board`, not the empty activity sentence.
