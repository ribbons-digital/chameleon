# Edit widgets by hand

Edit widgets by hand lets a user change the welcome note's markdown, change a seed table cell, add a blank table row, or delete a widget, each of which writes a human command into the activity footer.

## Sub-features

- `edit-note` replaces the welcome note body and writes `Latest: Edited note “A canvas that listens”`.
- `edit-cell` replaces a seed table cell and writes `Latest: Edited “What happens next”`.
- `edit-add-row` adds a blank row to the seed table and writes `Latest: Added a row to “What happens next”`.
- `edit-delete-widget` removes the welcome note and writes `Latest: Removed “A canvas that listens”`.

## How to get to it (user POV)

- Click the welcome note body, type markdown, and leave the field (blur).
- Click a Step cell in `What happens next`, type a new value, and press Enter.
- Choose `Add row` under that table.
- Choose `Delete A canvas that listens` on the welcome note header.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- The board is the seed layout (`control-chameleon doctor --expect-seed`).
- Run `edit-delete-widget` last, or reset before the other bullets.

- **Edit note.** Click the note body, replace the markdown, and blur. Run `control-chameleon browser note --name "A canvas that listens" --markdown "Edited from verification." --wait-text "Latest: Edited note “A canvas that listens”"`. The note shows the new sentence and undo is enabled.
- **Edit cell.** Click the first Step cell and press Enter. Run `control-chameleon browser cell --from "Your agent reads the board" --value "Hand edits land in the log" --field Step --wait-text "Latest: Edited “What happens next”"`. The cell button now reads `Hand edits land in the log`.
- **Add row.** Choose `Add row`. Run `control-chameleon browser click --role button --name "Add row" --wait-text "Latest: Added a row to “What happens next”"`. A new row appears with an `Edit` cell button.
- **Delete widget.** Choose the note's delete control. Run `control-chameleon browser click --role button --name "Delete A canvas that listens" --wait-text "Latest: Removed “A canvas that listens”"`. The heading `A canvas that listens` is gone. Confirm with `control-chameleon browser refute --text "A canvas that listens"`.
- **Proof.** Capture the board after the note and cell edits, before delete. Run `control-chameleon browser snapshot --aria --path artifacts/edit-widgets/edited.aria.txt` and `control-chameleon browser screenshot --path artifacts/edit-widgets/edited.png` after `edit-cell` (reset and redo if you already deleted). Both artifacts show `CHAMELEON` and `Latest: Edited`.

## Gotchas

- `browser note` and `browser cell` must click, type, and commit in one command. Chrome closes after each CLI call, which would discard an open editor.
- An unchanged note blur writes nothing. The markdown passed to `--markdown` has to differ from the seed body.
- Seed cell buttons use the cell text as the accessible name. After the first edit, `--from` must be the new text, not `Your agent reads the board`.
- Two widgets can show `Add row` once an agent has added another table. On the seed board there is one.
- Deleting the welcome note is hard to undo in later recipes that drag by that heading. Reset after this feature.
- Escape in a cell editor discards the draft. Proof uses Enter.
