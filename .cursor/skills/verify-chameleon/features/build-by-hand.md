# Build the board by hand

Build by hand lets a human name the workspace and add or rename a note, checklist, or table without a WebMCP host. Every action enters the same command log the agent reads; a new table has no fields and explicitly asks the agent to bind them.

## Sub-features

- `build-menu` opens `Add widget` with Note, Checklist, and Table choices.
- `build-note` adds editable markdown titled `New note`.
- `build-checklist` adds a ready-to-use checklist titled `New checklist`.
- `build-table-handoff` adds `New table` with `No columns yet` and guidance to ask the agent to bind fields.
- `build-rename` changes the level-one board heading and logs a human `rename_board` command.
- `build-rename-widget` lets the human correct an agent- or human-created widget title and logs `update_widget`.
- `build-command-log` writes each add and rename to the shared activity footer.

## How to get to it (user POV)

- Choose `Add widget`, then choose Note, Checklist, or Table.
- Choose `Rename board`, replace the current name, and press Enter or leave the field.
- Choose the pencil action beside a widget title, replace the name, and press Enter or leave the field.
- In a new checklist, type an item and press Enter or choose `Add item`.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from empty (`control-chameleon doctor --expect-empty`).
- No other `browser` command is using this run's Chrome profile.

- **Discover choices.** Open the menu and capture it before Chrome closes. Run `control-chameleon browser click --role button --name "Add widget" --settle 300 --aria-snapshot artifacts/build-by-hand/menu.aria.txt --screenshot artifacts/build-by-hand/menu.png`. The same artifact shows menuitems Note, Checklist, and Table.
- **Add note.** Run `control-chameleon browser menu --name "Add widget" --item Note --wait-text "Latest: Added note “New note”"`. Heading `New note` and its Write note action appear.
- **Rename note.** Run `control-chameleon browser rename-widget --name "New note" --value "Shared brief" --wait-text "Latest: Renamed “New note” to “Shared brief”"`. Heading `Shared brief` replaces `New note`; the human correction is now visible to the agent in the command log.
- **Add checklist.** Run `control-chameleon browser menu --name "Add widget" --item Checklist --wait-text "Latest: Added checklist “New checklist”"`. Heading `New checklist` and textbox `New item` appear.
- **Use checklist.** Run `control-chameleon browser fill --role textbox --name "New item" --value "Review agent changes" --press Enter --wait-text "Latest: Added “Review agent changes”"`. The visible item and activity line prove the checklist is immediately usable.
- **Add table for agent handoff.** Run `control-chameleon browser menu --name "Add widget" --item Table --wait-text "Latest: Added table “New table”"`. The table shows `No columns yet` and `Ask the agent to bind fields, or pass fields when adding this table.`
- **Rename board.** Run `control-chameleon browser rename --value "Human and agent workspace" --wait-text "Latest: Renamed board to “Human and agent workspace”"`. The level-one heading changes to that name.
- **Proof.** Run `control-chameleon browser snapshot --aria --path artifacts/build-by-hand/board.aria.txt` and `control-chameleon browser screenshot --path artifacts/build-by-hand/board.png`. Both artifacts show the renamed board, renamed note, checklist and table headings, the checklist item, the table handoff, and the latest human activity.

## Gotchas

- `Add widget` and `Rename board` are two-step React interactions. Use `browser menu` and `browser rename`; separate click/fill commands reopen Chrome after transient UI state is gone.
- Widget rename is also two-step React state. Use `browser rename-widget`, not separate click and fill commands.
- Menu item matching uses the visible prefix (`Note`, `Checklist`, or `Table`), not the longer accessible name that includes its description.
- `New table` intentionally has no columns. That is a human-to-agent handoff, not a failed add.
- Rename board and rename widget are separate actions; neither silently renames the other.
- New widgets auto-place below the current board. On a phone they still render in one column.
