# Review human and agent activity

Activity lets a human see the newest mutation in the footer or open a timestamped list of recent human and agent commands. Summaries, actors, actions, rationales, and undone state make collaboration inspectable instead of silently replacing each other's work.

## Sub-features

- `activity-latest` shows the newest command as `Latest: …` while the drawer is closed.
- `activity-open` opens a list headed `Activity`.
- `activity-attribution` shows a local time, actor, and action for each entry.
- `activity-rationale` includes an agent's rationale when one was supplied.
- `activity-undone` marks a reverted target command `undone` and adds the human undo command.
- `activity-empty` shows `No activity yet` on an empty board.

## How to get to it (user POV)

- Read `Latest: …` beneath `Show activity`.
- Choose `Show activity` to expand the command list.
- Choose `Hide activity` to return to the one-line latest summary.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from empty (`control-chameleon doctor --expect-empty`).
- Keep the drawer action and its evidence in one command because open state is not persisted.

- **Empty activity.** Run `control-chameleon browser click --role button --name "Show activity" --wait-text "No activity yet" --aria-snapshot artifacts/review-activity/empty.aria.txt`. The list is headed `Activity` and says agent tools and hand edits will appear there.
- **Create attributable human commands.** Run `control-chameleon browser menu --name "Add widget" --item Note --wait-text "Latest: Added note “New note”"` then `control-chameleon browser rename --value "Shared workspace" --wait-text "Latest: Renamed board to “Shared workspace”"`.
- **Open populated activity.** Run `control-chameleon browser click --role button --name "Show activity" --wait-text "Renamed board to “Shared workspace”" --aria-snapshot artifacts/review-activity/populated.aria.txt --screenshot artifacts/review-activity/populated.png`. The newest rows include `human · rename_board` and `human · add_widget`, each preceded by a local time.
- **Create and inspect undo.** Run `control-chameleon browser click --role button --name "Undo last change" --wait-text "Latest: Undid: Renamed board to “Shared workspace”"` then open the drawer again with `control-chameleon browser click --role button --name "Show activity" --wait-text "Undid: Renamed board to “Shared workspace”" --aria-snapshot artifacts/review-activity/undo.aria.txt --screenshot artifacts/review-activity/undo.png`. The original rename row includes `undone`; the new undo row is attributed to `human · undo`.

## Gotchas

- Times use the Chrome profile's locale and timezone. Assert the summary, actor, and action; do not hard-code `12:41 AM`.
- The activity list is React state. A later browser command sees it closed again.
- The target command remains in the list after undo and gains `undone`; undo also appends a separate command.
- Stable Chrome cannot create agent commands through this skill. Agent rationale display is covered when a board was built in a real WebMCP host; do not fake one through the store.
- Only the newest 20 entries render in the drawer. Use the WebMCP `get_activity_log` tool for older agent-side history.
