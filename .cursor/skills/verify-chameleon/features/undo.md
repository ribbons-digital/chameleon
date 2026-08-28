# Undo last change

Undo last change restores the board to the layout from before the newest mutation and records that restore in the activity footer.

## Sub-features

- `undo-disabled-seed` keeps the control disabled when there is nothing to revert.
- `undo-after-move` restores the welcome note after a drag.
- `undo-activity` writes `Latest: Undid: Moved “A canvas that listens”` and bumps the version.

## How to get to it (user POV)

- Choose the `Undo last change` button in the header after dragging or resizing a widget.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from seed (`control-chameleon doctor --expect-seed`).

- **Disabled on seed.** Confirm undo is inert. Run `control-chameleon browser assert --role button --name "Undo last change" --disabled`. The control does not apply a change.
- **Create a mutation.** Drag the welcome note. Run `control-chameleon browser drag --name "A canvas that listens" --dx 320 --dy 0` then `control-chameleon browser wait --text "Latest: Moved “A canvas that listens”"`. Undo becomes enabled.
- **Undo the move.** Choose `Undo last change`. Run `control-chameleon browser click --role button --name "Undo last change"`. The footer shows `Latest: Undid: Moved “A canvas that listens”` and `state v2 · 2 commands`. Confirm with `control-chameleon browser wait --text "Latest: Undid: Moved “A canvas that listens”"`.
- **Proof.** Capture the restored board. Run `control-chameleon browser snapshot --aria --path artifacts/undo/restored.aria.txt` and `control-chameleon browser screenshot --path artifacts/undo/restored.png`. The artifacts show the undo summary and both seed widget titles.

## Gotchas

- Undo of a move is a new command. `stateVersion` goes up, it does not roll back to 0.
- The button disables again only when every non-undo command is marked undone. After one undo of one move it stays enabled if other mutations remain.
- There is no redo control. Re-drag if the user wants the layout back.
- Do not call `useBoardStore.getState().undo()` as proof. The header button is the user path.
- The header button records actor `human`. That is distinct from the WebMCP `undo` tool, which this skill does not drive.
