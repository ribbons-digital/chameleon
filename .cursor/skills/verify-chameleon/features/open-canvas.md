# Open the seeded canvas

Open canvas is the first paint of a new Chameleon profile: the brand mark, untitled workspace title, two seed widgets, disabled undo, and empty activity copy.

## Sub-features

- `open-identity` shows the `CHAMELEON` mark and heading `Untitled workspace`.
- `open-widgets` shows the welcome note and the next-steps table on the widget canvas.
- `open-empty-activity` shows the empty activity line and `state v0 · 0 commands`.
- `open-undo-disabled` leaves `Undo last change` disabled until a mutation exists.

## How to get to it (user POV)

- Open the launched URL in the disposable Chrome profile created by `control-chameleon launch`.
- Choose `Reset canvas` on an already-open board that still uses this run's profile.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- This run's Chrome profile is new, or the board has been reset.
- `control-chameleon doctor --expect-seed` reports the seed title, both widgets, empty activity, and disabled undo.

- **Open URL.** Load the launched URL. Run `control-chameleon doctor --expect-seed`. The page shows `CHAMELEON`, heading `Untitled workspace`, region `Widget canvas`, heading `A canvas that listens`, heading `What happens next`, and `state v0 · 0 commands`.
- **Empty activity.** Read the footer. Run `control-chameleon browser assert --text "Drag or resize a widget to create the first activity entry."`. The empty-state sentence is visible and `Latest:` is not.
- **Undo disabled.** Inspect the header control. Run `control-chameleon browser assert --role button --name "Undo last change" --disabled`. The button is visible and disabled.
- **Reset entry.** If the board was dirty, choose `Reset canvas` and re-run doctor. Run `control-chameleon browser click --role button --name "Reset canvas"` then `control-chameleon doctor --expect-seed`. Seed widgets and empty activity return.
- **Proof.** Capture the seed board. Run `control-chameleon browser snapshot --aria --path artifacts/open-canvas/home.aria.txt` and `control-chameleon browser screenshot --path artifacts/open-canvas/home.png`. Both artifacts show `CHAMELEON`, `Untitled workspace`, `A canvas that listens`, and `What happens next`.

## Gotchas

- `document.title` is currently `tmp-scaffold`. Assert the on-page `CHAMELEON` mark and `h1`, not the tab title.
- `--expect-seed` fails if this profile already has commands. Use a new `CHAMELEON_VERIFY_RUN` or `Reset canvas`.
- Grid items mount after a width measurement. If the canvas region exists but widget headings do not, wait and retry doctor; do not click through a blank grid.
- Port 4711 is the human dev server. A board there is not this run.
