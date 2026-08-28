# Open the seeded canvas

Open canvas is the first paint of a new Chameleon profile: the brand mark, untitled workspace title, two seed widgets, disabled undo, empty activity copy, and (in browsers without WebMCP) a dismissable banner.

## Sub-features

- `open-identity` shows the `CHAMELEON` mark and heading `Untitled workspace`.
- `open-widgets` shows the welcome note and the next-steps table on the widget canvas.
- `open-empty-activity` shows the empty activity line and `state v0 · 0 commands` on a fresh profile.
- `open-activity-drawer` opens the activity list to `No activity yet`.
- `open-undo-disabled` leaves `Undo last change` disabled until a mutation exists.
- `open-unhosted-banner` shows `WebMCP not detected in this browser` in stable Chrome.

## How to get to it (user POV)

- Open the launched URL in the disposable Chrome profile created by `control-chameleon launch`.
- Choose `Reset canvas` on an already-open board that still uses this run's profile.
- Choose `Show activity` in the footer to expand the empty list.

## Driving it with control-chameleon

Preconditions:

- Chameleon is healthy at `http://127.0.0.1:$CHAMELEON_VERIFY_PORT/`.
- This run's Chrome profile is new.
- `control-chameleon doctor --expect-seed` reports the seed title, both widgets, empty activity, and disabled undo.

- **Open URL.** Load the launched URL. Run `control-chameleon doctor --expect-seed`. The page shows `CHAMELEON`, heading `Untitled workspace`, region `Widget canvas`, heading `A canvas that listens`, heading `What happens next`, and `state v0 · 0 commands`.
- **Empty activity.** Read the footer. Run `control-chameleon browser assert --text "Drag, edit, or ask an agent to create the first activity entry."`. The empty-state sentence is visible and `Latest:` is not.
- **Activity drawer.** Expand the empty list. Run `control-chameleon browser click --role button --name "Show activity" --wait-text "No activity yet" --aria-snapshot artifacts/open-canvas/activity.aria.txt --screenshot artifacts/open-canvas/activity.png`. The heading `Activity` and the row `No activity yet` are visible in the same session. The next command will find the list closed again.
- **Undo disabled.** Inspect the header control. Run `control-chameleon browser assert --role button --name "Undo last change" --disabled`. The button is visible and disabled.
- **Unhosted banner.** In stable Chrome, the info banner is visible. Run `control-chameleon browser assert --text "WebMCP not detected in this browser"`. Skip this bullet only if doctor reported `webmcpBanner: false` because the browser hosted WebMCP.
- **Proof.** Capture the seed board. Run `control-chameleon browser snapshot --aria --path artifacts/open-canvas/home.aria.txt` and `control-chameleon browser screenshot --path artifacts/open-canvas/home.png`. Both artifacts show `CHAMELEON`, `Untitled workspace`, `A canvas that listens`, and `What happens next`.

## Gotchas

- The tab title is `Chameleon`. Assert the on-page `CHAMELEON` mark and `h1`, not a guess at `document.title`.
- `--expect-seed` fails if this profile already has commands. Use a new `CHAMELEON_VERIFY_RUN` or `Reset canvas`. After reset the version number may not be `v0`; the command count must still be 0.
- Grid items mount after a width measurement. If the canvas region exists but widget headings do not, wait and retry doctor; do not click through a blank grid.
- Port 4711 is the human dev server. A board there is not this run.
- `Show activity` is session UI. Snapshot it on the same command as the click, or the list will be gone.
