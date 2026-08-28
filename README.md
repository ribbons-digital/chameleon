# Chameleon

**Software that grows its own API.** Chameleon is a near-blank web page that an AI agent turns
into working software — a wedding planner, a job-search tracker, a health log — live, in
conversation, using [WebMCP](https://github.com/webmachinelearning/webmcp)
(`document.modelContext` / `navigator.modelContext`) layout, data, and styling tools built on a
six-widget grammar (table, kanban, checklist, chart, note, form).

Its signature move: **tools that mint tools.** When the agent builds a form widget and calls
`create_form_tool`, Chameleon registers a brand-new WebMCP tool (e.g. `log_blood_sugar`) whose
input schema is derived from that form's fields. The app's tool surface grows as the agent
builds it, and minted tools persist across reloads. The human can drag, resize, and edit
everything by hand; every mutation — human or agent — lands in one command log that powers undo
and lets the agent reason from ground truth. Fully local-first: no backend, no auth, all state
in the browser.

Built for the [OpenAI WebMCP Challenge](https://webmcp.devpost.com/) (deadline Sep 3, 2026).

## Status

**Day 1 foundation is live.** The Vite/React/Astryx application now has a persisted
Zustand + Immer board, a complete human/agent command-log mutation gate, inverse-patch undo,
and a draggable/resizable react-grid-layout canvas. Custom StyleX styles compile through the
official `@stylexjs/unplugin` Vite integration and are passed to Astryx via `xstyle`.
Implementation continues following `docs/04-build-plan.md` day by day.

| Doc | Contents |
|---|---|
| [docs/01-tool-spec.md](docs/01-tool-spec.md) | All 15 static WebMCP tools (agent-facing descriptions, Zod schemas, JSON Schema, return payloads, error codes) + the full dynamic tool-minting lifecycle |
| [docs/02-widget-grammar.md](docs/02-widget-grammar.md) | The six widget types, config schemas, data-binding model, canonical `describe_current_state` payload |
| [docs/03-repo-scaffold.md](docs/03-repo-scaffold.md) | Directory layout, key module contracts, dependencies, Vitest coverage bar |
| [docs/04-build-plan.md](docs/04-build-plan.md) | Day-by-day plan Aug 28 → Sep 3 with agent-testing checkpoints and cut lines |
| [docs/05-demo-script.md](docs/05-demo-script.md) | Timed <3-minute demo video script |
| [docs/06-submission.md](docs/06-submission.md) | Devpost text draft, license rationale, deployment steps, judge-proofing checklist |

## Planned stack

Vite + React 19 SPA (TanStack Router, no SSR) · Astryx design system (pre-built CSS, StyleX
`xstyle` for custom styles) · Zustand + Immer (persisted document + command log) · Zod 4 (one
schema per tool for both runtime validation and WebMCP `inputSchema`) · react-grid-layout ·
Recharts · Vitest · Cloudflare Workers static deploy.

## Running

```bash
npm install
npm run dev        # http://localhost:4711
npm test
npm run deploy     # wrangler → Cloudflare Workers
```

To use it with an agent: open the deployed HTTPS URL in ChatGPT's desktop-app browser, or in
Chrome Canary with the WebMCP flag enabled (`chrome://flags` → search "webmcp"), then say what
you're working on.

## License

[MIT](LICENSE)
