# Chameleon — Demo Video Script (target 2:50, hard cap 3:00)

**Format**: screen recording of ChatGPT's desktop-app browser with the agent sidebar visible the
whole time — judges must SEE tool calls firing, not just results. Voiceover throughout (Devpost
requires audio). Lower-third captions mark the two ideas that matter: ground-truth reads and
tools-that-mint-tools. 1080p, cursor highlighting on.

**Prep before recording**: clean profile; three boards pre-scripted with exact prompts (below);
the job-search segment is **pre-recorded and time-lapsed** (build it live off-camera, speed 4×) —
everything else is real-time. Do a full timed rehearsal on Day 5.

---

| Time | Beat | On screen | Voiceover (verbatim draft) |
|---|---|---|---|
| 0:00–0:10 | Hook | The near-blank page: just "What are you working on?" + 3 suggested prompts | "This is Chameleon. It ships with no features. Every feature you're about to see is built by an AI agent, live, in the browser, using the proposed WebMCP standard." |
| 0:10–0:22 | Setup | Type into ChatGPT: *"I'm planning my wedding for next June — about 80 guests. Set this page up for me."* Agent sidebar shows `describe_current_state` then `add_widget` calls firing | "The page exposes tools through navigator.modelContext. The agent reads the empty board — then starts building." |
| 0:22–0:50 | **Product 1: wedding planner** composes live | Widgets appear one by one with agent-flash outlines: checklist "Before the venue tour", table "Guest list" (with bind_data visible), kanban "Vendors" (booked/contacted/to research), note "Budget notes". `set_layout` fires; the board snaps into arrangement | "Six widget types — table, kanban, checklist, chart, note, form — are the whole grammar. The agent binds real field schemas, seeds rows, and lays it out. This isn't a mockup; every cell is editable software." |
| 0:50–1:10 | **Human hands on** mid-flow | Cursor drags the kanban wider, edits a guest's RSVP inline, checks off a checklist item. Then type: *"what did I just change?"* → sidebar shows `get_activity_log` → agent answers correctly in chat | "And I stay in control — drag, resize, edit by hand. Every change lands in a shared activity log, so when I ask the agent what changed… it reads ground truth. Human and agent are editing the same live state." |
| 1:10–1:30 | **Product 2: job-search tracker** (time-lapse, 4×) | New board. Prompt: *"switch gears — I'm tracking my job search."* Time-lapse: kanban pipeline (applied→screen→onsite→offer), table of contacts, checklist of weekly goals; then `set_theme` flips it dark/compact | "Same blank page, different goal, different product. A pipeline, contacts, weekly goals — and the agent restyles the whole thing to match. One URL that becomes whatever you need." |
| 1:30–1:42 | **Product 3: health log** setup | New board. Prompt: *"I'm managing my type 2 diabetes. I want to log blood sugar readings and see trends."* Agent builds form "Blood sugar log" (reading, context, note) + line chart wired to it | "Now the part that's genuinely new. For a health log, the agent builds a form and a chart…" |
| 1:42–2:05 | ⚡ **THE SIGNATURE MOVE** | Sidebar shows `create_form_tool` firing. **Freeze-frame 2s**, caption: **"The app just registered a NEW WebMCP tool: log_blood_sugar — schema derived from the form the agent built."** Zoom on the ⚡ log_blood_sugar badge on the widget | "…and then it mints a brand-new tool. create_form_tool takes the form it just designed and registers log_blood_sugar as a first-class WebMCP tool, input schema derived from those fields. The agent didn't just use the app's API. **It extended it.**" |
| 2:05–2:25 | Minted tool in action + persistence | Type: *"log a reading of 104, taken after lunch."* Sidebar shows `log_blood_sugar` (the minted tool!) firing; row appears in form's recent list; chart animates the new point. **Hard page reload**; tool still listed in sidebar; log another reading | "Now 'log 104 after lunch' is one native tool call — validated, charted, done. And it survives reload: the tool re-registers from local storage. The app's API grew because the agent grew it." |
| 2:25–2:40 | Undo + trust close | Ask: *"actually, remove that last reading"* → `undo` fires, point vanishes; open ActivityDrawer showing the full human+agent history | "Everything either of us does is one command log — inspectable, undoable, local-first. No backend, no account. Your data never leaves the tab." |
| 2:40–2:55 | Close card | Title card: **Chameleon — software that grows its own API.** URL + GitHub + "Built on WebMCP (navigator.modelContext)" | "Chameleon: an app that's composed in conversation — and the first one whose tool surface is built by the agent that uses it. Try it at the link below." |

**Timing budget check**: beats sum to 2:55 with 5s slack. If a take runs long, compress the
job-search time-lapse (1:10–1:30) first — it's the generality beat, not the leverage beat.

## Shot discipline

- The agent sidebar with tool-call names visible is **non-negotiable in every beat** — WebMCP
  leverage must be visually verifiable, not narrated.
- Exactly one freeze-frame (the mint). More would dilute it.
- All three prompts are typed on camera (time-lapse included) — no cuts that could look staged.
- Record voiceover separately from screen capture; sync in edit (protects against flubbed lines
  forcing re-takes of good screen footage).

## Fallback

If ChatGPT's browser misbehaves on recording day, record the same script in Chrome Canary with
the Model Context Tool Inspector docked right (tools visibly appearing/disappearing at mint time
is arguably an even better visual for beat 1:42). Decision made at the day-5 dress rehearsal.
