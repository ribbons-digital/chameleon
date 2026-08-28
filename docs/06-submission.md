# Chameleon — Submission Checklist & Devpost Draft

## 1. Hard requirements (verify each, twice: Day 6 and Day 7 morning)

- [ ] **Live HTTPS URL** (Cloudflare Workers) — loads in a clean profile; testable in ChatGPT's
      desktop browser; shows the WebMCP-not-detected banner gracefully in stable Chrome.
- [ ] **YouTube video**: public (not unlisted), <3:00, audible voiceover, playable logged-out.
- [ ] **Public GitHub repo** with the license visible (GitHub shows "MIT license" in the header —
      requires the file be named `LICENSE` at root with standard text).
- [ ] **Devpost text** — four required sections below, pasted and formatted.
- [ ] Submitted (not draft) by **11:00am PDT Sep 3** — self-imposed 2h buffer.

## 2. License decision

**MIT.** Rationale: judge-legible at a glance, zero friction for the "visible OSS license"
requirement, compatible with every dependency in the stack (Astryx is MIT, as are React,
Zustand, Recharts, react-grid-layout). No copyleft benefit matters for a hackathon artifact.
Copyright line: the project author, year 2026. Also set `"license": "MIT"` in `package.json`
(some scanners read that).

## 3. README requirements (write on Day 5)

1. One-paragraph pitch + hero GIF (the minting moment).
2. **Try it with an agent** — the judge path, first and prominent: live URL; how to open it in
   ChatGPT's desktop browser; Chrome Canary flag instructions + Model Context Tool Inspector;
   three copy-paste prompts (one per demo product).
3. What WebMCP tools it exposes — link to `docs/01-tool-spec.md`; table of the 15 static tools;
   the minted-tool explanation with the log_blood_sugar example schema.
4. Run locally: `npm i && npm run dev` (port 4711); `npm test`; `npm run deploy`.
5. Architecture sketch (one diagram: store → mutate gate → command log; registry → modelContext).
6. Demo video link, license badge, "built for the OpenAI WebMCP Challenge" note.

## 4. Deployment steps (Cloudflare Workers, static assets)

1. `wrangler.toml`: name `chameleon`, `[assets] directory = "dist"`,
   `not_found_handling = "single-page-application"` (SPA fallback for TanStack Router).
2. `npm run build` → `wrangler deploy` → `https://chameleon.<account>.workers.dev` (HTTPS by
   default; custom domain optional, skip unless free time on Day 6).
3. Verify headers: no `X-Frame-Options` weirdness, correct `content-type` on the JS chunks.
4. Redeploy at each day's EOD; final deploy + `v1.0.0` tag on Day 6.
5. Fallback if Workers misbehaves: `netlify deploy --prod --dir dist` — decision at first
   failure, not after debugging sessions.

## 5. Devpost text — the four required sections (draft; finalize Day 6)

### Why this use case is a fit for WebMCP

Chameleon only makes sense *as* a WebMCP app. It's a page that starts blank and becomes working
software — a wedding planner, a job-search tracker, a diabetes log — because an agent composes
it live from a six-widget grammar using layout, data, and styling tools the page registers via
`navigator.modelContext` (canonically `document.modelContext`). The defining constraints of
WebMCP are exactly the features this product needs: tools run **client-side in the live tab**,
so the agent manipulates the same DOM, the same localStorage, the same undo stack the human is
using — there is no server to sync, and none exists (Chameleon is fully local-first). And
because tool registration is dynamic, the app can do something no static MCP server can: when
the agent creates a form widget, Chameleon **mints a new WebMCP tool** whose input schema is
derived from that form's fields. The tool surface is not a fixed API — it grows as the agent
builds, and persists across reloads.

### How it improves the experience of using the web service

Today, "flexible" tools (Notion, Airtable, spreadsheets) make the user do the software design:
pick structures, name columns, configure views — before entering a single wedding guest. In
Chameleon you state the goal in plain language and watch a purpose-built app assemble in
seconds, then use it like any direct-manipulation app: drag, resize, type, check things off.
Repeated actions get better than a UI: after the agent mints `log_blood_sugar`, logging a
reading is one sentence to your agent — validated against the same schema as the on-screen form,
appended to the same dataset, charted instantly. The agent stays useful over time because
`describe_current_state` and the shared activity log give it ground truth, including everything
the human changed by hand — so "what's left to book?" or "reorganize this around next week" are
answered from the real state of *your* data, not a guess.

### What humans + agents can do together that was impossible before

Two things. First, **co-editing one live artifact with symmetric visibility**: the human and the
agent mutate the same client-side state through the same command log — the human drags a widget,
the agent reads that edit (`humanEditsSinceLastDescribe`, `get_activity_log`) and adapts its next
layout decision; the agent seeds rows and the human corrects them inline. Neither party works on
a stale copy, and either can undo the other. Before WebMCP, an agent could fill forms *at* a page
via screen scraping, or call a backend API *around* the page — it could never share the page's
own state with its user in real time. Second, **the agent extending the app's API for its
successor**: `create_form_tool` means the agent that designs your health log also authors the
tool (name, description, schema) that tomorrow's agent — in a fresh conversation, with no
context — will discover on `modelContext` and call correctly. Humans get software shaped by
conversation; agents get an API shaped by the software they built. That loop did not exist
before tools could be registered by the page, at runtime, from client state.

### Implementation notes

- **Stack**: Vite + React 19 SPA (TanStack Router, no SSR — `modelContext` is client-only and
  the app is local-first), Astryx design system (pre-built CSS + StyleX `xstyle` for custom
  styles), Zustand + Immer, react-grid-layout, Recharts. Static deploy on Cloudflare Workers.
- **One schema, two consumers**: every tool's input schema is authored once in Zod 4 and
  converted with `z.toJSONSchema()` — the same object validates at execute time and ships as the
  WebMCP `inputSchema`. A Vitest suite proves accept/reject parity between the Zod schema and
  the emitted JSON Schema for every tool, including minted ones.
- **Current spec compliance**: `registerTool()` only (no removed `provideContext`), lifetime
  owned by per-tool `AbortController`s, feature detection across `document.modelContext` /
  `navigator.modelContext`, types from `@mcp-b/webmcp-types`.
- **Minted-tool lifecycle**: derive Zod schema from form fields → register → persist record →
  re-register on reload; re-derive on field changes; unregister on widget delete; name-collision
  and reserved-name policy; all covered by lifecycle tests including simulated reload.
- **Everything is a command**: human drags and agent tool calls flow through one mutation gate
  (Immer `produceWithPatches`), giving a unified activity log, inverse-patch undo (exposed to
  both the human and the agent), and the `stateVersion` counter agents use to detect staleness.
- **Errors are a UX surface for agents**: tools never throw; every failure returns a stable code
  plus a `hint` sentence telling the agent what to do next ("Call describe_current_state to list
  valid widget ids"). Hints were tuned against real agent transcripts in ChatGPT's browser and
  Chrome Canary.

## 6. Devpost form details

- **Title**: Chameleon — software that grows its own API
- **Tagline** (~60 chars): "A blank page your agent turns into working software."
- **Gallery**: hero screenshot per demo product (3), the minted-tool freeze-frame with the ⚡
  badge, activity-drawer screenshot. First image = minting freeze-frame (it's the differentiator).
- **Built with**: webmcp, react, typescript, vite, zod, zustand, recharts, cloudflare-workers, astryx, stylex
- **"Try it out" links**: live URL + GitHub repo.
- Video URL: the public YouTube link.

## 7. Judge-proofing checklist (Day 7 morning, clean machine)

- [ ] URL cold-loads < 3s; empty state renders; suggested prompts visible.
- [ ] ChatGPT browser: all 15 tools discovered; wedding prompt builds a board.
- [ ] Canary + flag: inspector lists tools with schemas; mint/unmint reflected live.
- [ ] Stable Chrome (no WebMCP): banner + GIF render; app still usable by hand.
- [ ] Hard reload mid-session: board + minted tools persist.
- [ ] YouTube plays logged-out at <3:00; captions on the mint beat readable at 480p.
- [ ] GitHub repo public; LICENSE badge visible; README judge path works copy-paste.
