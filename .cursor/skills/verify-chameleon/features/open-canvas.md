# Open the empty canvas

Open canvas is the first paint of a new Chameleon profile: the brand mark, untitled workspace title, empty-state heading, three copy-prompt buttons, Load a sample board, disabled undo, empty activity copy, and (in browsers without WebMCP) a dismissable banner.

## Sub-features

- `open-identity` shows the `CHAMELEON` mark and heading `Untitled workspace`.
- `open-empty` shows heading `What are you working on?` and the three copy-prompt buttons.
- `open-sample-control` shows `Load a sample board`.
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
- `control-chameleon doctor --expect-empty` reports the empty canvas, copy buttons, empty activity, and disabled undo.

- **Open URL.** Load the launched URL. Run `control-chameleon doctor --expect-empty`. The page shows `CHAMELEON`, heading `Untitled workspace`, region `Widget canvas`, heading `What are you working on?`, button `Copy wedding planner prompt`, button `Load a sample board`, and `state v0 · 0 commands`.
- **Empty activity.** Read the footer. Run `control-chameleon browser assert --text "Drag, edit, or ask an agent to create the first activity entry."`. The empty-state sentence is visible and `Latest:` is not.
- **Activity drawer.** Expand the empty list. Run `control-chameleon browser click --role button --name "Show activity" --wait-text "No activity yet" --aria-snapshot artifacts/open-canvas/activity.aria.txt --screenshot artifacts/open-canvas/activity.png`. The heading `Activity` and the row `No activity yet` are visible in the same session. The next command will find the list closed again.
- **Undo disabled.** Inspect the header control. Run `control-chameleon browser assert --role button --name "Undo last change" --disabled`. The button is visible and disabled.
- **Unhosted banner.** In stable Chrome, the info banner is visible. Run `control-chameleon browser assert --text "WebMCP not detected in this browser"`. Skip this bullet only if doctor reported `webmcpBanner: false` because the browser hosted WebMCP.
- **Proof.** Capture the empty canvas. Run `control-chameleon browser snapshot --aria --path artifacts/open-canvas/home.aria.txt` and `control-chameleon browser screenshot --path artifacts/open-canvas/home.png`. Both artifacts show `CHAMELEON`, `Untitled workspace`, and `What are you working on?`.

## Gotchas

- The tab title is `Chameleon`. Assert the on-page `CHAMELEON` mark and `h1`, not a guess at `document.title`.
- `--expect-empty` fails if this profile already has commands. Use a new `CHAMELEON_VERIFY_RUN` or `Reset canvas`. After reset the version number may not be `v0`; the command count must still be 0.
- Reset returns to this empty canvas. It does not restore the sample note and table.
- Port 4711 is the human dev server. A board there is not this run.
- `Show activity` is session UI. Snapshot it on the same command as the click, or the list will be gone.
