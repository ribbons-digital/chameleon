# Stack the grid on a narrow viewport

Mobile stack is the seed board at a width under 700px. Widgets sit in one column. Drag and resize are off, so a phone does not write a stacked layout into localStorage.

## Sub-features

- `mobile-one-column` places both seed widgets in the same left edge at 375px wide.
- `mobile-reading-order` places `What happens next` below `A canvas that listens`.
- `mobile-no-persist` leaves the activity line unchanged after a drag attempt at 375px.

## How to get to it (user POV)

- Open the launched URL in a 375px-wide viewport.
- Try to drag a widget. The card should not move on the stored grid.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- Start from seed (`control-chameleon doctor --expect-seed`).
- Pass `--width 375 --height 812` on every command in this recipe. The default viewport is 1400px and will not stack.

- **Measure stacked cards.** Load the seed board at phone width. Run `control-chameleon browser measure --name "A canvas that listens" --width 375 --height 812` and `control-chameleon browser measure --name "What happens next" --width 375 --height 812`. Both boxes share the same `x`. The table `y` is greater than the note `y`.
- **Drag is ignored.** Attempt a drag at phone width. Run `control-chameleon browser drag --name "A canvas that listens" --dx 320 --dy 0 --width 375 --height 812` then `control-chameleon browser assert --text "Drag, edit, or ask an agent to create the first activity entry." --width 375 --height 812`. The empty activity sentence stays. `Latest: Moved` does not appear.
- **Proof.** Capture the stacked board. Run `control-chameleon browser screenshot --path artifacts/day-5/mobile-375.png --width 375 --height 812` and `control-chameleon browser snapshot --aria --path artifacts/day-5/mobile-375.aria.txt --width 375 --height 812`. The screenshot is a tall single column. Both widget titles are visible.

## Gotchas

- `--width` and `--height` apply to that Chrome session only. A later command without them reopens at 1400px.
- `useContainerWidth` can report a wide container. The app also mins against `window.innerWidth`, which is why the Playwright viewport must be 375, not only a CSS media query.
- Drag disable is the persist guard. If a drag at 375px writes `Latest: Moved`, stacked coordinates leaked into storage. That is a fail, not a layout nit.
